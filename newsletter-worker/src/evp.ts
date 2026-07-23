import {
  decodeJwt,
  decodeProtectedHeader,
  importJWK,
  jwtVerify,
  type JWK,
  type JWTPayload,
} from "jose";

type EvtPayload = JWTPayload & {
  email?: string;
  email_verified?: boolean;
  cnf?: { jwk?: JWK };
  _sd?: string[];
  _sd_alg?: string;
};

type KbPayload = JWTPayload & {
  nonce?: string;
  sd_hash?: string;
};

type IssuerMetadata = {
  jwks_uri?: string;
  signing_alg_values_supported?: string[];
};

export type VerifyEvpInput = {
  rawToken: string;
  email: string;
  nonce: string;
  audience: string;
  now?: number;
  fetcher?: typeof fetch;
};

function base64url(bytes: ArrayBuffer): string {
  var binary = "";
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256(value: string): Promise<string> {
  return base64url(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)));
}

function decodeDisclosure(encoded: string): [string, string, unknown] {
  const normalized = encoded.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const bytes = Uint8Array.from(atob(padded), (character) => character.charCodeAt(0));
  const value = JSON.parse(new TextDecoder().decode(bytes));
  if (!Array.isArray(value) || value.length !== 3 || typeof value[1] !== "string") {
    throw new Error("Invalid selective-disclosure claim");
  }
  return value as [string, string, unknown];
}

async function applyDisclosures(payload: EvtPayload, disclosures: string[]): Promise<EvtPayload> {
  const accepted = new Set(payload._sd || []);
  const output = { ...payload };
  for (const encoded of disclosures) {
    const digest = await sha256(encoded);
    if (!accepted.has(digest)) throw new Error("Unbound selective-disclosure claim");
    const [, key, value] = decodeDisclosure(encoded);
    output[key as keyof EvtPayload] = value as never;
  }
  return output;
}

async function discoverIssuer(emailDomain: string, fetcher: typeof fetch): Promise<string> {
  const query = encodeURIComponent(`_email-verification.${emailDomain}`);
  const response = await fetcher(`https://cloudflare-dns.com/dns-query?name=${query}&type=TXT`, {
    headers: { Accept: "application/dns-json" },
  });
  if (!response.ok) throw new Error("Email provider DNS lookup failed");
  const data = (await response.json()) as { Answer?: Array<{ data?: string }> };
  for (const answer of data.Answer || []) {
    const text = (answer.data || "").replace(/^"|"$/g, "").replace(/"\s*"/g, "");
    if (text.startsWith("iss=")) return text.slice(4);
  }
  throw new Error("Email provider has not delegated EVP verification");
}

function issuerHost(issuer: string): string {
  return issuer.startsWith("http") ? new URL(issuer).hostname.toLowerCase() : issuer.toLowerCase();
}

function secureUrl(value: string, label: string): URL {
  const url = new URL(value);
  if (url.protocol !== "https:") throw new Error(`${label} must use HTTPS`);
  return url;
}

export async function verifyEvp(input: VerifyEvpInput): Promise<void> {
  const fetcher = input.fetcher || fetch;
  const pieces = input.rawToken.split("~");
  if (pieces.length < 2 || !pieces[0] || !pieces[pieces.length - 1]) {
    throw new Error("Invalid EVP token format");
  }

  const evtJwt = pieces[0];
  const kbJwt = pieces[pieces.length - 1];
  const disclosures = pieces.slice(1, -1).filter(Boolean);
  const issuerPresentation = pieces.slice(0, -1).join("~") + "~";
  const decodedEvt = await applyDisclosures(decodeJwt(evtJwt) as EvtPayload, disclosures);
  const decodedKb = decodeJwt(kbJwt) as KbPayload;
  const issuer = decodedEvt.iss;
  if (!issuer || typeof issuer !== "string") throw new Error("EVP token is missing its issuer");

  const now = input.now || Math.floor(Date.now() / 1000);
  if (decodedEvt.email?.toLowerCase() !== input.email.toLowerCase()) {
    throw new Error("EVP email does not match the submitted address");
  }
  if (decodedEvt.email_verified !== true) throw new Error("EVP email is not verified");
  if (decodedKb.nonce !== input.nonce) throw new Error("EVP nonce does not match");
  if (decodedKb.aud !== input.audience) throw new Error("EVP audience does not match");
  if (typeof decodedKb.iat !== "number" || decodedKb.iat < now - 600 || decodedKb.iat > now + 60) {
    throw new Error("EVP token timestamp is outside the allowed window");
  }
  if (decodedKb.sd_hash !== await sha256(issuerPresentation)) {
    throw new Error("EVP key binding does not match the issuer token");
  }

  const emailDomain = input.email.split("@")[1]?.toLowerCase();
  if (!emailDomain) throw new Error("Invalid email address");
  const delegatedIssuer = await discoverIssuer(emailDomain, fetcher);
  if (issuerHost(delegatedIssuer) !== issuerHost(issuer)) {
    throw new Error("EVP issuer is not authoritative for this email domain");
  }

  const issuerUrl = secureUrl(issuer.startsWith("http") ? issuer : `https://${issuer}`, "EVP issuer");
  const metadataResponse = await fetcher(new URL("/.well-known/email-verification", issuerUrl));
  if (!metadataResponse.ok) throw new Error("EVP issuer discovery failed");
  const metadata = (await metadataResponse.json()) as IssuerMetadata;
  if (!metadata.jwks_uri) throw new Error("EVP issuer metadata has no JWKS endpoint");
  const jwksUri = secureUrl(metadata.jwks_uri, "EVP JWKS endpoint");
  const jwksResponse = await fetcher(jwksUri);
  if (!jwksResponse.ok) throw new Error("EVP issuer keys could not be loaded");
  const jwks = (await jwksResponse.json()) as { keys?: JWK[] };
  const evtHeader = decodeProtectedHeader(evtJwt);
  let verifiedEvt: EvtPayload | undefined;
  for (const jwk of jwks.keys || []) {
    if (evtHeader.kid && jwk.kid && evtHeader.kid !== jwk.kid) continue;
    try {
      const key = await importJWK(jwk, evtHeader.alg);
      verifiedEvt = (await jwtVerify(evtJwt, key, { issuer: issuerUrl.toString().replace(/\/$/, "") })).payload as EvtPayload;
      break;
    } catch {
      continue;
    }
  }
  if (!verifiedEvt) throw new Error("EVP issuer signature is invalid");

  const browserJwk = verifiedEvt.cnf?.jwk;
  if (!browserJwk) throw new Error("EVP token has no browser key");
  const kbHeader = decodeProtectedHeader(kbJwt);
  const browserKey = await importJWK(browserJwk, kbHeader.alg);
  await jwtVerify(kbJwt, browserKey, { audience: input.audience });
}
