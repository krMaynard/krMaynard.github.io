# Chatbot worker

Backend for the "Ask about Kieran's work" chat widget on the site
(`chatbot.js`). A small Express service that answers visitor questions using
**Claude** (Anthropic Messages API), grounded **only** in:

1. **The website's own content** — extracted from the real site pages into
   `website-context.txt` by `build-context.js` (no hand-maintained snapshot).
2. **Optional private sources** — one or more files fetched at runtime from a
   private GitHub repo (e.g. a full résumé or detailed bio).

The model is told to answer from those sources only, to refuse off-topic
questions, and to point people to email when it doesn't know.

## How it fits together

```
chatbot.js (widget)  ──POST {message, history}──▶  /chat (this worker)
                                                      │
                                   system prompt = instructions
                                      + website-context.txt  (committed)
                                      + private GitHub sources (fetched, cached 1h)
                                                      │
                                                      ▼
                                            Claude Messages API
```

The widget is injected site-wide by `_layouts/main.html`, but only when
`chatbot_worker_url` is set in `_config.yml`. Until that's set, the chatbot is
dormant.

## Build the website context

The website grounding is generated from the actual pages and **committed** so
the worker has no runtime dependency on the rest of the repo:

```bash
cd chatbot-worker
npm run build:context      # reads ../index.html, ../work.html, ../consulting.html → website-context.txt
```

Re-run this and commit `website-context.txt` whenever the relevant site content
changes. To widen what the bot can answer from, add pages to the `PAGES` list in
`build-context.js`.

## Run locally

```bash
cd chatbot-worker
npm install
cp .env.example .env        # set ANTHROPIC_API_KEY (+ optional GitHub source vars)
npm run build:context               # generate website-context.txt
ANTHROPIC_API_KEY=sk-ant-... npm start
```

Test it (the worker enforces an allow-listed `Origin`):

```bash
curl -s localhost:8080/chat \
  -H 'Content-Type: application/json' \
  -H 'Origin: https://kieranmaynard.com' \
  -d '{"message":"What did Kieran build at Google?","history":[]}'
```

## Configuration

See `.env.example`. Key variables:

| Variable | Required | Purpose |
|----------|----------|---------|
| `ANTHROPIC_API_KEY` | yes | Claude Messages API key |
| `ANTHROPIC_MODEL` | no | Model override (default `claude-opus-4-8`) |
| `GITHUB_TOKEN` | no | Read-only token for the private sources repo |
| `GITHUB_SOURCES_REPO` | no | `owner/repo` holding extra sources |
| `GITHUB_SOURCES_PATHS` | no | Comma-separated file paths in that repo |
| `PORT` | no | Listen port (Cloud Run sets this) |

`GITHUB_RESUME_REPO` / `GITHUB_RESUME_PATH` are still honored as a single-file
fallback if the `GITHUB_SOURCES_*` vars are unset.

## Deploy & enable

A `Dockerfile` is included, so hosts build from it directly (no buildpack — the
`build:context` script is dev-only and must not run at deploy; the committed
`website-context.txt` is all the image needs).

1. Deploy this directory as a service. On Cloud Run, from `chatbot-worker/`:

   ```bash
   gcloud run deploy kieranmaynard-chatbot \
     --source . --region us-central1 --allow-unauthenticated \
     --set-secrets ANTHROPIC_API_KEY=anthropic-key:latest
   ```

   Prefer `--set-secrets` (Secret Manager) over `--set-env-vars` so the key
   isn't stored in plaintext or shell history. For the multi-path source var,
   use a custom delimiter to avoid comma parsing:
   `--set-env-vars "^@^GITHUB_SOURCES_PATHS=a.md,b.md@GITHUB_SOURCES_REPO=owner/repo"`.
2. Put the service's `/chat` URL into `_config.yml`:

   ```yaml
   chatbot_worker_url: https://<service-host>/chat
   ```

3. Rebuild/redeploy the site. The widget then appears on every page.

## Guardrails

- **CORS allow-list** — only `kieranmaynard.com`, `www.kieranmaynard.com`, and
  `krmaynard.github.io` may call `/chat`.
- **Per-IP rate limit** — 10 requests/minute/instance.
- **Input limits** — 500-char messages, last 10 turns of history.
- **Refusals** — a model refusal returns a friendly fallback, never an error.
- Grounding is sent in a cached system block (prompt caching) to keep latency
  and cost down on repeat questions.
