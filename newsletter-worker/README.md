# Newsletter Worker

Cloudflare Worker backing the site's newsletter form.

- Uses Chrome's experimental Email Verification Protocol (EVP) when the
  browser supplies a token.
- Falls back to a transactional double-opt-in email.
- Stores only subscriber state and hashed confirmation/unsubscribe tokens in
  D1.

## Production setup

1. Authenticate Wrangler: `npx wrangler login`.
2. Enable sending for `kieranmaynard.com`:
   `npx wrangler email sending enable kieranmaynard.com`.
3. Create D1: `npx wrangler d1 create kieran-newsletter`.
4. Replace the placeholder `database_id` in `wrangler.jsonc`.
5. Apply migrations:
   `npx wrangler d1 migrations apply kieran-newsletter --remote`.
6. Run `npm run check`, `npm test`, and `npx wrangler deploy`.
7. Set `newsletter_worker_url` in the site's `_config.yml` to the deployed
   Worker origin.
8. Register `https://kieranmaynard.com` for the Chrome EVP origin trial and set
   `email_verification_origin_trial_token` in `_config.yml`.

EVP is a progressive enhancement. Unsupported browsers and providers continue
through email confirmation.

Until `newsletter_worker_url` is configured, the site intentionally omits the
signup form. This prevents a relative `/subscribe` action from being submitted
to GitHub Pages, which does not accept POST requests and returns HTTP 405.
