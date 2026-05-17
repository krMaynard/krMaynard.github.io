#!/usr/bin/env python3
"""Post the newest blog entry to LinkedIn if it hasn't been posted yet.

Reads blog.html, finds the first (newest) .news-entry, compares its id
against .github/last_linkedin_post, and calls the LinkedIn UGC Posts API
if there's a new entry. Updates the tracking file on success.

Required env vars:
  LINKEDIN_ACCESS_TOKEN  OAuth 2.0 bearer token
  LINKEDIN_PERSON_URN    e.g. urn:li:person:AbCdEfGhIj
"""

import json
import os
import sys
import urllib.request
import urllib.error
from html.parser import HTMLParser

TRACKING_FILE = ".github/last_linkedin_post"
BLOG_FILE = "blog.html"
SITE_BASE_URL = "https://krmaynard.github.io"
LINKEDIN_API_URL = "https://api.linkedin.com/v2/ugcPosts"
MAX_POST_CHARS = 3000


class _EntryParser(HTMLParser):
    """Extracts the first .news-entry from blog.html."""

    def __init__(self):
        super().__init__()
        self.entry = None
        self._depth = 0          # div nesting depth inside entry
        self._in_entry = False
        self._in_h3 = False
        self._in_p = False
        self._p_captured = False
        self._in_tag_span = False

    def handle_starttag(self, tag, attrs):
        if self.entry is not None and self._depth == 0:
            return  # already done

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


def _slugify_tag(tag):
    slug = "".join(c for c in tag if c.isalnum())
    return "#" + slug if slug else ""


def build_post_text(entry):
    hashtags = " ".join(s for t in entry["tags"] if t for s in [_slugify_tag(t)] if s)
    url_line = entry["url"] or (SITE_BASE_URL + "/blog.html")

    # Build with full summary first, then trim if needed
    parts = [entry["title"], "", entry["summary"], "", url_line]
    if hashtags:
        parts += ["", hashtags]
    text = "\n".join(parts)

    if len(text) <= MAX_POST_CHARS:
        return text

    # Trim summary to fit
    overhead = (
        len(entry["title"]) + 2
        + 2 + len(url_line)
        + (2 + len(hashtags) if hashtags else 0)
        + 1  # ellipsis
    )
    budget = max(0, MAX_POST_CHARS - overhead)
    trimmed = entry["summary"][:budget].rsplit(" ", 1)[0] + "…"
    parts[2] = trimmed
    return "\n".join(parts)


def post_to_linkedin(entry, access_token, person_urn):
    post_text = build_post_text(entry)

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


def set_github_output(key, value):
    output_file = os.environ.get("GITHUB_OUTPUT")
    if output_file:
        with open(output_file, "a", encoding="utf-8") as f:
            f.write(f"{key}={value}\n")


def main():
    access_token = os.environ.get("LINKEDIN_ACCESS_TOKEN")
    person_urn = os.environ.get("LINKEDIN_PERSON_URN")

    if not access_token or not person_urn:
        print(
            "Error: LINKEDIN_ACCESS_TOKEN and LINKEDIN_PERSON_URN must be set.",
            file=sys.stderr,
        )
        sys.exit(1)

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

    print(f"New entry detected: {entry['id']} — {entry['title']}")
    post_id = post_to_linkedin(entry, access_token, person_urn)
    print(f"Posted to LinkedIn: {post_id}")

    write_last_posted(entry["id"])
    set_github_output("posted", "true")


if __name__ == "__main__":
    main()
