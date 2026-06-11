'use strict';

/*
 * build-context.js
 * -----------------
 * Generates `website-context.txt` from the *actual* site HTML pages, so the
 * chatbot is grounded only in real website content — no hand-maintained
 * snapshot that can drift out of sync with the site.
 *
 * The worker lives inside the website repo, so this reads the sibling pages
 * directly (`../index.html`, ...). Run it whenever site content changes:
 *
 *     npm run build      # from chatbot-worker/
 *
 * Commit the regenerated `website-context.txt` — the worker reads that file at
 * runtime, so it has no dependency on the rest of the repo being present when
 * deployed.
 */

const fs = require('fs');
const path = require('path');

const SITE_ROOT = path.join(__dirname, '..');
const OUT_FILE = path.join(__dirname, 'website-context.txt');

// Pages that describe Kieran (professional profile + services). Add entries
// here to widen what the chatbot can answer from — only listed pages are used.
const PAGES = [
  { file: 'index.html', title: 'Home — Kieran Maynard' },
  { file: 'work.html', title: 'Work / Portfolio' },
  { file: 'consulting.html', title: 'Consulting Services' },
];

function stripFrontMatter(s) {
  // Jekyll front matter: a leading `---` ... `---` block.
  if (s.startsWith('---')) {
    const end = s.indexOf('\n---', 3);
    if (end !== -1) {
      const nl = s.indexOf('\n', end + 1);
      return nl !== -1 ? s.slice(nl + 1) : '';
    }
  }
  return s;
}

function decodeEntities(s) {
  return s
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&mdash;/g, '—')
    .replace(/&ndash;/g, '–');
}

function htmlToText(html) {
  let s = stripFrontMatter(html);
  // Drop non-content blocks: scripts, styles, HTML comments, Liquid tags.
  s = s.replace(/<script[\s\S]*?<\/script>/gi, ' ');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, ' ');
  s = s.replace(/<!--[\s\S]*?-->/g, ' ');
  s = s.replace(/\{%[\s\S]*?%\}/g, ' ');
  s = s.replace(/\{\{[\s\S]*?\}\}/g, ' ');
  // Turn block boundaries into newlines so the text stays readable.
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|div|h[1-6]|li|ul|ol|section|tr)\s*>/gi, '\n');
  // Strip remaining tags, decode entities, collapse whitespace.
  s = s.replace(/<[^>]+>/g, ' ');
  s = decodeEntities(s);
  s = s.replace(/[ \t]+/g, ' ');
  s = s.replace(/ *\n */g, '\n');
  s = s.replace(/\n{3,}/g, '\n\n');
  return s.trim();
}

function build() {
  const parts = [];
  for (const { file, title } of PAGES) {
    const full = path.join(SITE_ROOT, file);
    if (!fs.existsSync(full)) {
      console.warn(`Skipping missing page: ${file}`);
      continue;
    }
    const text = htmlToText(fs.readFileSync(full, 'utf8'));
    if (text) parts.push(`### ${title} (/${file})\n\n${text}`);
  }

  if (parts.length === 0) {
    console.error('No pages extracted — refusing to write an empty context file.');
    process.exit(1);
  }

  const header =
    'KIERAN MAYNARD — WEBSITE CONTENT\n' +
    'Auto-generated from kieranmaynard.com pages by build-context.js.\n' +
    'This is the source of truth for the website chatbot — do not hand-edit.\n';

  fs.writeFileSync(OUT_FILE, header + '\n' + parts.join('\n\n---\n\n') + '\n');
  console.log(`Wrote ${OUT_FILE} (${parts.length} page${parts.length === 1 ? '' : 's'}).`);
}

build();
