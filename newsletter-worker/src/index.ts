import { verifyEvp } from "./evp";

interface Env {
  DB: D1Database;
  EMAIL: SendEmail;
  SITE_ORIGIN: string;
  FROM_EMAIL: string;
  FROM_NAME: string;
}

const NONCE_LIFETIME_SECONDS = 5 * 60;
const TOKEN_BYTES = 32;

function corsHeaders(env: Env): HeadersInit {
  return {
    "Access-Control-Allow-Origin": env.SITE_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Accept, Content-Type",
    "Cache-Control": "no-store",
    "Vary": "Origin",
  };
}

function json(env: Env, body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: corsHeaders(env) });
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(TOKEN_BYTES));
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function tokenHash(token: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(token));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

function normalizeEmail(value: FormDataEntryValue | null): string | null {
  if (typeof value !== "string") return null;
  const email = value.trim().toLowerCase();
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return null;
  return email;
}

function safeReturnUrl(value: FormDataEntryValue | null, env: Env): URL {
  try {
    const url = new URL(typeof value === "string" ? value : env.SITE_ORIGIN, env.SITE_ORIGIN);
    if (url.origin === env.SITE_ORIGIN) return url;
  } catch {
    // Use the site origin below.
  }
  return new URL(env.SITE_ORIGIN);
}

function redirectWithResult(returnUrl: URL, result: string): Response {
  returnUrl.searchParams.set("newsletter", result);
  return Response.redirect(returnUrl.toString(), 303);
}

async function issueNonce(env: Env): Promise<Response> {
  const nonce = randomToken();
  const now = Math.floor(Date.now() / 1000);
  await env.DB.batch([
    env.DB.prepare(
      "INSERT INTO newsletter_nonces (nonce, created_at, expires_at) VALUES (?, ?, ?)"
    ).bind(nonce, now, now + NONCE_LIFETIME_SECONDS),
    env.DB.prepare(
      "DELETE FROM newsletter_nonces WHERE expires_at < ? OR used_at < ?"
    ).bind(now - 3600, now - 86400),
  ]);
  return json(env, { nonce, expiresIn: NONCE_LIFETIME_SECONDS });
}

async function consumeNonce(env: Env, nonce: string): Promise<boolean> {
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE newsletter_nonces SET used_at = ?
     WHERE nonce = ? AND used_at IS NULL AND expires_at >= ?`
  ).bind(now, nonce, now).run();
  return result.meta.changes === 1;
}

async function sendConfirmationAtOrigin(
  env: Env,
  email: string,
  token: string,
  workerOrigin: string
): Promise<void> {
  const confirmUrl = new URL("/confirm", workerOrigin);
  confirmUrl.searchParams.set("token", token);
  await env.EMAIL.send({
    to: email,
    from: { email: env.FROM_EMAIL, name: env.FROM_NAME },
    subject: "Confirm your newsletter subscription",
    text: `Confirm your subscription: ${confirmUrl}\n\nIf you did not request this, ignore this email.`,
    html: `<p>Confirm your newsletter subscription:</p><p><a href="${confirmUrl}">Confirm subscription</a></p><p>If you did not request this, ignore this email.</p>`,
  });
}

async function subscribe(request: Request, env: Env): Promise<Response> {
  const form = await request.formData();
  const email = normalizeEmail(form.get("email"));
  const nonce = String(form.get("nonce") || "");
  const evt = String(form.get("token") || "");
  const returnUrl = safeReturnUrl(form.get("return_url"), env);
  if (!email || !nonce || !(await consumeNonce(env, nonce))) {
    return redirectWithResult(returnUrl, "error");
  }

  let verificationMethod: "evp" | "email" = "email";
  if (evt) {
    try {
      await verifyEvp({
        rawToken: evt,
        email,
        nonce,
        audience: env.SITE_ORIGIN,
      });
      verificationMethod = "evp";
    } catch (error) {
      console.warn("EVP validation failed; using email confirmation", error);
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const unsubscribeToken = randomToken();
  const unsubscribeHash = await tokenHash(unsubscribeToken);
  if (verificationMethod === "evp") {
    await env.DB.prepare(
      `INSERT INTO newsletter_subscribers
       (email, status, verification_method, requested_at, confirmed_at, unsubscribe_token_hash)
       VALUES (?, 'confirmed', 'evp', ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET
         status = 'confirmed', verification_method = 'evp', confirmed_at = excluded.confirmed_at,
         unsubscribed_at = NULL, confirmation_token_hash = NULL`
    ).bind(email, now, now, unsubscribeHash).run();
    return redirectWithResult(returnUrl, "confirmed");
  }

  const confirmationToken = randomToken();
  const confirmationHash = await tokenHash(confirmationToken);
  await env.DB.prepare(
    `INSERT INTO newsletter_subscribers
     (email, status, requested_at, confirmation_token_hash, unsubscribe_token_hash)
     VALUES (?, 'pending', ?, ?, ?)
     ON CONFLICT(email) DO UPDATE SET
       status = CASE WHEN status = 'confirmed' THEN 'confirmed' ELSE 'pending' END,
       requested_at = excluded.requested_at,
       confirmation_token_hash = CASE WHEN status = 'confirmed' THEN NULL ELSE excluded.confirmation_token_hash END,
       unsubscribe_token_hash = CASE WHEN status = 'confirmed' THEN unsubscribe_token_hash ELSE excluded.unsubscribe_token_hash END`
  ).bind(email, now, confirmationHash, unsubscribeHash).run();

  const existing = await env.DB.prepare(
    "SELECT status FROM newsletter_subscribers WHERE email = ?"
  ).bind(email).first<{ status: string }>();
  if (existing?.status === "confirmed") return redirectWithResult(returnUrl, "confirmed");

  await sendConfirmationAtOrigin(env, email, confirmationToken, new URL(request.url).origin);
  return redirectWithResult(returnUrl, "check-email");
}

async function confirm(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Invalid confirmation link.", { status: 400 });
  const hash = await tokenHash(token);
  const now = Math.floor(Date.now() / 1000);
  const result = await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'confirmed', verification_method = 'email', confirmed_at = ?,
         confirmation_token_hash = NULL, unsubscribed_at = NULL
     WHERE confirmation_token_hash = ? AND status = 'pending'`
  ).bind(now, hash).run();
  const url = new URL(env.SITE_ORIGIN);
  url.searchParams.set("newsletter", result.meta.changes === 1 ? "confirmed" : "error");
  return Response.redirect(url.toString(), 303);
}

async function unsubscribe(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get("token");
  if (!token) return new Response("Invalid unsubscribe link.", { status: 400 });
  const hash = await tokenHash(token);
  const now = Math.floor(Date.now() / 1000);
  await env.DB.prepare(
    `UPDATE newsletter_subscribers
     SET status = 'unsubscribed', unsubscribed_at = ?
     WHERE unsubscribe_token_hash = ?`
  ).bind(now, hash).run();
  return new Response("You have been unsubscribed.", {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: corsHeaders(env) });
    if (url.pathname === "/nonce" && request.method === "GET") return issueNonce(env);
    if (url.pathname === "/subscribe" && request.method === "POST") return subscribe(request, env);
    if (url.pathname === "/confirm" && request.method === "GET") return confirm(request, env);
    if (url.pathname === "/unsubscribe" && request.method === "GET") return unsubscribe(request, env);
    if (url.pathname === "/health") return json(env, { ok: true });
    return new Response("Not found", { status: 404 });
  },
} satisfies ExportedHandler<Env>;
