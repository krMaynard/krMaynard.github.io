const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const locales = ["", "de/", "es/", "fr/", "it/", "ja/", "ko/", "zh/"];

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

for (const locale of locales) {
  const blog = read(`${locale}blog.html`);
  assert.match(blog, /data-webgl-hero="blog"/, `${locale}blog.html is missing the blog hero`);
  assert.match(blog, /class="webgl-hero__canvas"/, `${locale}blog.html is missing the hero canvas`);

  const transparency = read(`${locale}transparency.html`);
  assert.match(
    transparency,
    /data-webgl-hero="transparency"/,
    `${locale}transparency.html is missing the transparency hero`
  );
  assert.match(
    transparency,
    /class="webgl-hero__canvas"/,
    `${locale}transparency.html is missing the hero canvas`
  );
}

const renderer = read("webgl-hero.js");
assert.match(renderer, /draw\(performance\.now\(\)\)/, "reduced motion should render a static frame");

console.log("WebGL hero checks passed for all localized blog and transparency pages");
