import importlib.util
import unittest
from pathlib import Path


REPO = Path(__file__).resolve().parents[1]
SPEC = importlib.util.spec_from_file_location(
    "post_to_linkedin", REPO / "scripts" / "post_to_linkedin.py"
)
POSTER = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(POSTER)


class LinkedInPosterTests(unittest.TestCase):
    def test_robotics_entry_uses_only_published_linkedin_languages(self):
        entry = POSTER.parse_latest_entry((REPO / "blog.html").read_text(encoding="utf-8"))

        self.assertEqual(entry["li_langs"].split(), ["en", "zh", "ja"])
        for lang in entry["li_langs"].split():
            localized_url = POSTER._localized_url(entry["url"], lang)
            relative_path = localized_url.removeprefix(POSTER.SITE_BASE_URL).lstrip("/")
            self.assertTrue((REPO / relative_path).is_file(), lang)

    def test_delete_linkedin_post_url_encodes_the_urn(self):
        seen = {}

        class Response:
            status = 204

            def __enter__(self):
                return self

            def __exit__(self, *_args):
                return False

        original_urlopen = POSTER.urllib.request.urlopen
        POSTER.urllib.request.urlopen = lambda request, timeout: (
            seen.update(url=request.full_url, method=request.method) or Response()
        )
        try:
            POSTER.delete_linkedin_post("urn:li:share:123", "token")
        finally:
            POSTER.urllib.request.urlopen = original_urlopen

        self.assertEqual(seen["method"], "DELETE")
        self.assertEqual(
            seen["url"],
            "https://api.linkedin.com/v2/ugcPosts/urn%3Ali%3Ashare%3A123",
        )


if __name__ == "__main__":
    unittest.main()
