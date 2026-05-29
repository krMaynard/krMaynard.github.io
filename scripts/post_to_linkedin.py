#!/usr/bin/env python3
"""Post the newest blog entry to LinkedIn if it hasn't been posted yet.

Reads blog.html, finds the first (newest) .news-entry, compares its id
against .github/last_linkedin_post, and calls the LinkedIn UGC Posts API
if there's a new entry. Updates the tracking file on success.

Required env vars:
  LINKEDIN_ACCESS_TOKEN   OAuth 2.0 bearer token
  LINKEDIN_PERSON_URN     e.g. urn:li:person:AbCdEfGhIj

Optional env vars (enable automatic token refresh — recommended):
  LINKEDIN_REFRESH_TOKEN  OAuth 2.0 refresh token (valid ~1 year)
  LINKEDIN_CLIENT_ID      LinkedIn app client ID
  LINKEDIN_CLIENT_SECRET  LinkedIn app client secret
  GH_PAT                  GitHub PAT with secrets:write for this repo
  GITHUB_REPOSITORY       Set automatically by GitHub Actions (owner/repo)
"""

import base64
import json
import os
import sys
import urllib.error
import urllib.parse
import urllib.request
from html.parser import HTMLParser

TRACKING_FILE = ".github/last_linkedin_post"
BLOG_FILE = "blog.html"
SITE_BASE_URL = "https://krmaynard.github.io"
GEMINI_PRIMARY_MODEL = "gemini-3.1-pro-preview"
GEMINI_FALLBACK_MODEL = "gemini-3.5-flash"
LINKEDIN_API_URL = "https://api.linkedin.com/v2/ugcPosts"
LINKEDIN_TOKEN_URL = "https://www.linkedin.com/oauth/v2/accessToken"
GITHUB_API_URL = "https://api.github.com"
MAX_POST_CHARS = 3000


# ---------------------------------------------------------------------------
# HTML parsing
# ---------------------------------------------------------------------------

class _EntryParser(HTMLParser):
    """Extracts the first .news-entry from blog.html."""

    def __init__(self):
        super().__init__()
        self.entry = None
        self._depth = 0
        self._in_entry = False
        self._in_h3 = False
        self._in_p = False
        self._p_captured = False
        self._in_tag_span = False

    def handle_starttag(self, tag, attrs):
        if self.entry is not None and self._depth == 0:
            return

        attrs_dict = dict(attrs)

        if tag == "div":
            cls = attrs_dict.get("class", "")
            if "news-entry" in cls and self.entry is None:
                self._in_entry = True
                self._depth = 1
                self.entry = {
                    "id": attrs_dict.get("id", ""),
                    "title": "",
                    "url": None,
                    "summary": "",
                    "tags": [],
                }
                return
            if self._in_entry:
                self._depth += 1

        if not self._in_entry:
            return

        if tag == "h3":
            self._in_h3 = True
        elif tag == "a" and self._in_h3:
            href = attrs_dict.get("href", "")
            if href:
                self.entry["url"] = href
        elif tag == "p" and not self._p_captured:
            self._in_p = True
        elif tag == "span" and "tag" in attrs_dict.get("class", ""):
            self._in_tag_span = True

    def handle_endtag(self, tag):
        if not self._in_entry:
            return
        if tag == "div":
            self._depth -= 1
            if self._depth == 0:
                self._in_entry = False
        elif tag == "h3":
            self._in_h3 = False
        elif tag == "p" and self._in_p:
            self._in_p = False
            self._p_captured = True
        elif tag == "span" and self._in_tag_span:
            self._in_tag_span = False

    def handle_data(self, data):
        if not self._in_entry or self.entry is None:
            return
        if self._in_h3:
            self.entry["title"] += data
        elif self._in_p:
            self.entry["summary"] += data
        elif self._in_tag_span:
            text = data.strip()
            if text:
                self.entry["tags"].append(text)


def parse_latest_entry(html):
    parser = _EntryParser()
    parser.feed(html)
    entry = parser.entry
    if not entry:
        return None
    entry["title"] = entry["title"].strip()
    entry["summary"] = entry["summary"].strip()
    if entry["url"] and entry["url"].startswith("/"):
        entry["url"] = SITE_BASE_URL + entry["url"]
    return entry


# ---------------------------------------------------------------------------
# Tracking file
# ---------------------------------------------------------------------------

def read_last_posted():
    try:
        with open(TRACKING_FILE, encoding="utf-8") as f:
            return f.read().strip()
    except FileNotFoundError:
        return ""


def write_last_posted(entry_id):
    os.makedirs(os.path.dirname(TRACKING_FILE), exist_ok=True)
    with open(TRACKING_FILE, "w", encoding="utf-8") as f:
        f.write(entry_id + "\n")


# ---------------------------------------------------------------------------
# LinkedIn post text
# ---------------------------------------------------------------------------

def _slugify_tag(tag):
    slug = "".join(c for c in tag if c.isalnum())
    return "#" + slug if slug else ""


class _PostBodyParser(HTMLParser):
    """Extracts paragraph text from <div class="post-body">."""

    def __init__(self):
        super().__init__()
        self._in_body = False
        self._depth = 0
        self._in_p = False
        self._current = ""
        self.paragraphs = []

    def handle_starttag(self, tag, attrs):
        attrs_dict = dict(attrs)
        if tag == "div" and "post-body" in attrs_dict.get("class", ""):
            self._in_body = True
            self._depth = 1
            return
        if not self._in_body:
            return
        if tag == "div":
            self._depth += 1
        elif tag == "p":
            self._in_p = True
            self._current = ""

    def handle_endtag(self, tag):
        if not self._in_body:
            return
        if tag == "div":
            self._depth -= 1
            if self._depth == 0:
                self._in_body = False
        elif tag == "p" and self._in_p:
            self._in_p = False
            para = self._current.strip()
            if para:
                self.paragraphs.append(para)

    def handle_data(self, data):
        if self._in_body and self._in_p:
            self._current += data


def _extract_post_body(url):
    """Derive a local file path from the post URL and return paragraph text."""
    if not url or not url.startswith(SITE_BASE_URL):
        return None
    rel_path = url[len(SITE_BASE_URL):].lstrip("/")
    if not rel_path.endswith(".html"):
        return None
    try:
        with open(rel_path, encoding="utf-8") as f:
            html = f.read()
    except FileNotFoundError:
        return None
    parser = _PostBodyParser()
    parser.feed(html)
    return "\n\n".join(parser.paragraphs) if parser.paragraphs else None


def _call_gemini(model, prompt, api_key):
    """Call the Gemini generateContent API for a given model. Returns text or raises."""
    payload = {"contents": [{"parts": [{"text": prompt}]}]}
    data = json.dumps(payload).encode("utf-8")
    url = (
        "https://generativelanguage.googleapis.com/v1beta/models/"
        f"{model}:generateContent?key={api_key}"
    )
    req = urllib.request.Request(
        url,
        data=data,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = json.loads(resp.read())
        return body["candidates"][0]["content"]["parts"][0]["text"].strip()


def generate_linkedin_commentary(title, content, api_key):
    """Generate bilingual EN/JA LinkedIn commentary from the blog post content.

    Tries GEMINI_PRIMARY_MODEL first; falls back to GEMINI_FALLBACK_MODEL on
    any error; returns (None, None) if both fail (caller uses verbatim summary).

    Returns:
        (commentary_text, hashtags_string) — hashtags_string is space-separated
        '#Tag' tokens chosen by the model, or empty string on failure.
    """
    prompt = (
        "You are writing a LinkedIn post for Kieran Maynard, a product manager "
        "specialising in AI, compliance, and content policy.\n\n"
        "Based on the blog post below, write a bilingual LinkedIn post — "
        "English first, then Japanese. "
        "Return ONLY the post body in exactly this format "
        "(no URL, no sign-off, no emojis):\n\n"
        "日本語は下記にあります\n\n"
        "[English commentary]\n\n"
        "[Japanese commentary]\n\n"
        "HASHTAGS: #Tag1 #Tag2 #Tag3\n\n"
        "Guidelines for the English section:\n"
        "- Open with a strong hook (one short sentence that stops the scroll)\n"
        "- Short paragraphs separated by blank lines — LinkedIn formatting\n"
        "- Conversational first-person tone\n"
        "- 100–150 words\n"
        "- End with a brief question or observation to invite engagement\n\n"
        "Guidelines for the Japanese section:\n"
        "- Natural, fluent Japanese — not a literal translation\n"
        "- Professional LinkedIn tone (です/ます)\n"
        "- Match the structure and energy of the English\n\n"
        "Guidelines for HASHTAGS:\n"
        "- Choose 3–5 relevant LinkedIn hashtags that will maximise reach\n"
        "- Mix broad professional tags with topic-specific ones\n"
        "- No spaces within a tag (e.g. #ProductManagement not #Product Management)\n\n"
        f"Title: {title}\n\n"
        f"Blog post:\n{content}"
    )

    for model in (GEMINI_PRIMARY_MODEL, GEMINI_FALLBACK_MODEL):
        try:
            text = _call_gemini(model, prompt, api_key)
            # Extract HASHTAGS line from end of response
            commentary, hashtags = _parse_commentary_and_hashtags(text)
            print(f"Gemini commentary generated ({model}).")
            return commentary, hashtags
        except Exception as e:
            print(f"Gemini {model} error: {e} — {'trying fallback' if model == GEMINI_PRIMARY_MODEL else 'falling back to verbatim summary'}.", file=sys.stderr)

    return None, ""


def _parse_commentary_and_hashtags(text):
    """Split Gemini output into (commentary, hashtags_string).

    Looks for a line starting with 'HASHTAGS:' anywhere in the text (usually
    last). Returns the remainder as commentary and the hashtag tokens as a
    space-separated string.
    """
    lines = text.strip().splitlines()
    hashtag_line = ""
    commentary_lines = []
    for line in lines:
        stripped = line.strip()
        if stripped.upper().startswith("HASHTAGS:"):
            hashtag_line = stripped[len("HASHTAGS:"):].strip()
        else:
            commentary_lines.append(line)
    commentary = "\n".join(commentary_lines).strip()
    return commentary, hashtag_line


def build_post_text(entry, commentary=None, llm_hashtags=None):
    if llm_hashtags:
        hashtags = llm_hashtags
    else:
        hashtags = " ".join(s for t in entry["tags"] if t for s in [_slugify_tag(t)] if s)
    url_line = entry["url"] or (SITE_BASE_URL + "/blog.html")
    body = commentary if commentary else entry["summary"]

    parts = [entry["title"], "", body, "", url_line]
    if hashtags:
        parts += ["", hashtags]
    text = "\n".join(parts)

    if len(text) <= MAX_POST_CHARS:
        return text

    # Trim body to fit (only needed if Gemini returns something unexpectedly long)
    overhead = (
        len(entry["title"]) + 2
        + 2 + len(url_line)
        + (2 + len(hashtags) if hashtags else 0)
        + 1  # ellipsis
    )
    budget = max(0, MAX_POST_CHARS - overhead)
    trimmed = body[:budget].rsplit(" ", 1)[0] + "…"
    parts[2] = trimmed
    return "\n".join(parts)


# ---------------------------------------------------------------------------
# LinkedIn API
# ---------------------------------------------------------------------------

def refresh_access_token(refresh_token, client_id, client_secret):
    """Exchange a refresh token for a fresh access + refresh token pair."""
    data = urllib.parse.urlencode({
        "grant_type": "refresh_token",
        "refresh_token": refresh_token,
        "client_id": client_id,
        "client_secret": client_secret,
    }).encode("utf-8")

    req = urllib.request.Request(
        LINKEDIN_TOKEN_URL,
        data=data,
        headers={"Content-Type": "application/x-www-form-urlencoded"},
        method="POST",
    )
    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            return json.loads(resp.read())
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"Token refresh error {e.code}: {body}", file=sys.stderr)
        return None


def post_to_linkedin(entry, access_token, person_urn, commentary=None, llm_hashtags=None):
    post_text = build_post_text(entry, commentary=commentary, llm_hashtags=llm_hashtags)

    content = {
        "shareCommentary": {"text": post_text},
        "shareMediaCategory": "ARTICLE" if entry["url"] else "NONE",
    }
    if entry["url"]:
        content["media"] = [{"status": "READY", "originalUrl": entry["url"]}]

    payload = {
        "author": person_urn,
        "lifecycleState": "PUBLISHED",
        "specificContent": {"com.linkedin.ugc.ShareContent": content},
        "visibility": {"com.linkedin.ugc.MemberNetworkVisibility": "PUBLIC"},
    }

    data = json.dumps(payload).encode("utf-8")
    req = urllib.request.Request(
        LINKEDIN_API_URL,
        data=data,
        headers={
            "Authorization": f"Bearer {access_token}",
            "Content-Type": "application/json",
            "X-Restli-Protocol-Version": "2.0.0",
        },
        method="POST",
    )

    try:
        with urllib.request.urlopen(req, timeout=30) as resp:
            body = json.loads(resp.read())
            return body.get("id", "(no id returned)")
    except urllib.error.HTTPError as e:
        body = e.read().decode("utf-8", errors="replace")
        print(f"LinkedIn API error {e.code}: {body}", file=sys.stderr)
        sys.exit(1)


# ---------------------------------------------------------------------------
# GitHub Secrets API
# ---------------------------------------------------------------------------

def _gh_request(path, gh_token, method="GET", payload=None):
    url = GITHUB_API_URL + path
    data = json.dumps(payload).encode("utf-8") if payload else None
    req = urllib.request.Request(
        url,
        data=data,
        headers={
            "Authorization": f"Bearer {gh_token}",
            "Accept": "application/vnd.github+json",
            "X-GitHub-Api-Version": "2022-11-28",
            **({"Content-Type": "application/json"} if data else {}),
        },
        method=method,
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        body = resp.read()
        return json.loads(body) if body else None


def _encrypt_secret(public_key_b64, secret_value):
    """Encrypt secret_value with the repo's public key (libsodium sealed box)."""
    from nacl.encoding import Base64Encoder
    from nacl.public import PublicKey, SealedBox

    pk = PublicKey(public_key_b64.encode(), Base64Encoder)
    encrypted = SealedBox(pk).encrypt(secret_value.encode("utf-8"))
    return base64.b64encode(encrypted).decode("utf-8")


def update_github_secret(repo, secret_name, secret_value, gh_token):
    """Create or update a GitHub Actions secret for the given repo."""
    key_info = _gh_request(f"/repos/{repo}/actions/public-key", gh_token)
    encrypted = _encrypt_secret(key_info["key"], secret_value)
    _gh_request(
        f"/repos/{repo}/actions/secrets/{secret_name}",
        gh_token,
        method="PUT",
        payload={"encrypted_value": encrypted, "key_id": key_info["key_id"]},
    )
    print(f"Updated GitHub secret: {secret_name}")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def set_github_output(key, value):
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    access_token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    person_urn = os.environ.get("LINKEDIN_PERSON_URN")

    if not access_token or not person_urn:
        print(
            "Error: LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

    # --- Optional: refresh the access token automatically ---
    refresh_token = os.environ.get("LINKEDIN_REFRESH_TOKEN")
    client_id = os.environ.get("LINKEDIN_CLIENT_ID")
    client_secret = os.environ.get("LINKEDIN_CLIENT_SECRET")
    gh_pat = os.environ.get("GH_PAT")
    gh_repo = os.environ.get("GITHUB_REPOSITORY")

    if refresh_token and client_id and client_secret and gh_pat and gh_repo:
        print("Refreshing LinkedIn access token…")
        tokens = refresh_access_token(refresh_token, client_id, client_secret)
        if tokens and tokens.get("access_token"):
            access_token = tokens["access_token"]
            update_github_secret(gh_repo, "LINKEDIN_ACCESS_TOKEN", access_token, gh_pat)
            new_refresh = tokens.get("refresh_token")
            if new_refresh:
                update_github_secret(gh_repo, "LINKEDIN_REFRESH_TOKEN", new_refresh, gh_pat)
        else:
            print("Warning: token refresh failed — falling back to existing token.", file=sys.stderr)
    else:
        missing = [
            k for k, v in {
                "LINKEDIN_REFRESH_TOKEN": refresh_token,
                "LINKEDIN_CLIENT_ID": client_id,
                "LINKEDIN_CLIENT_SECRET": client_secret,
                "GH_PAT": gh_pat,
                "GITHUB_REPOSITORY": gh_repo,
            }.items() if not v
        ]
        print(f"Token auto-refresh disabled (missing: {', '.join(missing)}).")

    # --- Parse blog and check for new entry ---
    with open(BLOG_FILE, encoding="utf-8") as f:
        html = f.read()

    entry = parse_latest_entry(html)
    if not entry:
        print("No blog entries found in blog.html.")
        return

    if not entry.get("id"):
        print("Error: The latest blog entry is missing an 'id' attribute.", file=sys.stderr)
        sys.exit(1)

    last_posted = read_last_posted()
    if entry["id"] == last_posted:
        print(f"Entry {entry['id']} already posted to LinkedIn. Nothing to do.")
        return

    # --- Optionally rewrite with Gemini ---
    gemini_api_key = os.environ.get("GEMINI_API_KEY")
    commentary = None
    llm_hashtags = None
    if gemini_api_key:
        post_body = _extract_post_body(entry["url"])
        if post_body:
            print(f"Using full post body for Gemini ({len(post_body)} chars).")
        else:
            print("Full post body not found — falling back to blog.html summary.")
            post_body = entry["summary"]
        print("Generating bilingual LinkedIn commentary with Gemini…")
        commentary, llm_hashtags = generate_linkedin_commentary(entry["title"], post_body, gemini_api_key)
    else:
        print("GEMINI_API_KEY not set — using verbatim blog summary.")

    # --- Post to LinkedIn ---
    print(f"New entry detected: {entry['id']} — {entry['title']}")
    post_id = post_to_linkedin(entry, access_token, person_urn, commentary=commentary, llm_hashtags=llm_hashtags)
    print(f"Posted to LinkedIn: {post_id}")

    write_last_posted(entry["id"])
    set_github_output("posted", "true")


if __name__ == "__main__":
    main()
