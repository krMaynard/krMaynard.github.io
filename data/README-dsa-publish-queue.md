# Scheduled transparency-post queue

`dsa-publish-queue.json` is the ordered evergreen backlog. The scheduled
workflow runs daily at 15:15 UTC (08:15 PDT / 07:15 PST) and opens a pull
request for the first item that still has `published: false` in its English
post. It never opens a second publication PR while one is awaiting merge.

The PR is the publication gate: its workflow run has already executed the
site test suite and GitHub Pages build, but the post does not go live until
the PR is merged.

## Inject a timely post

1. Stage the new post and its translations with `published: false` on
   `master`.
2. In Actions, run **Publish next queued transparency post** manually and put
   the post's filename stem in `slug` (for example,
   `new-dsa-enforcement-decision`).
3. Merge the generated publication PR after review.

The override does not edit or consume the evergreen order. On the next daily
run, publication resumes at the first unpublished item in the JSON queue.

If an evergreen publication PR is already open, merge or close it before
injecting a timely post. This avoids two PRs racing to edit the same blog
listing pages.

Useful local commands:

```sh
python3 scripts/promote-next.py --list
python3 scripts/promote-next.py --dry-run
python3 scripts/promote-next.py --dry-run --slug POST_SLUG
```
