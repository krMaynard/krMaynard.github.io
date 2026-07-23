import { exportJWK, generateKeyPair, SignJWT } from "jose";
import { describe, expect, it, vi } from "vitest";
import { verifyEvp } from "../src/evp";

const NOW = 1_785_000_000;
const EMAIL = "reader@example.com";
const NONCE = "one-use-nonce";
const AUDIENCE = "https://kieranmaynard.com";
const ISSUER = "https://accounts.example";

async function fixture(overrides: { email?: string; nonce?: string; audience?: string } = {}) {
  const issuerKeys = await generateKeyPair("EdDSA");
  const browserKeys = await generateKeyPair("EdDSA");
  const issuerPublicJwk = await exportJWK(issuerKeys.publicKey);
  issuerPublicJwk.kid = "issuer-key";
  const browserPublicJwk = await exportJWK(browserKeys.publicKey);

  const evt = await new SignJWT({
    email: overrides.email || EMAIL,
    email_verified: true,
    cnf: { jwk: browserPublicJwk },
  })
    .setProtectedHeader({ alg: "EdDSA", kid: "issuer-key", typ: "evt+jwt" })
    .setIssuer(ISSUER)
    .setIssuedAt(NOW)
    .sign(issuerKeys.privateKey);

  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(evt + "~"));
  let binary = "";
  for (const byte of new Uint8Array(digest)) binary += String.fromCharCode(byte);
  const sdHash = btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const kb = await new SignJWT({
    nonce: overrides.nonce || NONCE,
    sd_hash: sdHash,
  })
    .setProtectedHeader({ alg: "EdDSA", typ: "kb+jwt" })
    .setAudience(overrides.audience || AUDIENCE)
    .setIssuedAt(NOW)
    .sign(browserKeys.privateKey);

  const fetcher = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.startsWith("https://cloudflare-dns.com/dns-query")) {
      return Response.json({ Answer: [{ data: '"iss=accounts.example"' }] });
    }
    if (url === `${ISSUER}/.well-known/email-verification`) {
      return Response.json({ jwks_uri: "https://accounts.example/keys" });
    }
    if (url === "https://accounts.example/keys") {
      return Response.json({ keys: [issuerPublicJwk] });
    }
    return new Response("not found", { status: 404 });
  }) as typeof fetch;

  return { rawToken: `${evt}~${kb}`, fetcher };
}

describe("verifyEvp", () => {
  it("accepts a token with issuer, DNS, origin, nonce, and key binding intact", async () => {
    const { rawToken, fetcher } = await fixture();
    await expect(verifyEvp({
      rawToken,
      email: EMAIL,
      nonce: NONCE,
      audience: AUDIENCE,
      now: NOW,
      fetcher,
    })).resolves.toBeUndefined();
  });

  it("rejects a token replayed with another nonce", async () => {
    const { rawToken, fetcher } = await fixture();
    await expect(verifyEvp({
      rawToken,
      email: EMAIL,
      nonce: "different-nonce",
      audience: AUDIENCE,
      now: NOW,
      fetcher,
    })).rejects.toThrow("nonce");
  });

  it("rejects a token bound to another origin", async () => {
    const { rawToken, fetcher } = await fixture();
    await expect(verifyEvp({
      rawToken,
      email: EMAIL,
      nonce: NONCE,
      audience: "https://attacker.example",
      now: NOW,
      fetcher,
    })).rejects.toThrow("audience");
  });

  it("rejects a token for another email address", async () => {
    const { rawToken, fetcher } = await fixture();
    await expect(verifyEvp({
      rawToken,
      email: "other@example.com",
      nonce: NONCE,
      audience: AUDIENCE,
      now: NOW,
      fetcher,
    })).rejects.toThrow("email");
  });
});
