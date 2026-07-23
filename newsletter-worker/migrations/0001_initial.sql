CREATE TABLE IF NOT EXISTS newsletter_nonces (
  nonce TEXT PRIMARY KEY,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER
);

CREATE INDEX IF NOT EXISTS idx_newsletter_nonces_expires
  ON newsletter_nonces(expires_at);

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
  email TEXT PRIMARY KEY COLLATE NOCASE,
  status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'unsubscribed')),
  verification_method TEXT CHECK (verification_method IN ('evp', 'email')),
  requested_at INTEGER NOT NULL,
  confirmed_at INTEGER,
  unsubscribed_at INTEGER,
  confirmation_token_hash TEXT,
  unsubscribe_token_hash TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'website'
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_confirmation_token
  ON newsletter_subscribers(confirmation_token_hash)
  WHERE confirmation_token_hash IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_unsubscribe_token
  ON newsletter_subscribers(unsubscribe_token_hash);
