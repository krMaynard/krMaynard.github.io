const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const locales = ["", "de/", "es/", "fr/", "it/", "ja/", "ko/", "zh/"];
const homeLocales = [...locales, "bo/", "lzh/", "yue/"];

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

for (const locale of homeLocales) {
  const home = read(`${locale}index.html`);
  assert.match(home, /data-webgl-hero="profile"/, `${locale}index.html is missing the profile graphic`);
  assert.doesNotMatch(home, /avatars\.githubusercontent\.com/, `${locale}index.html still loads the old avatar`);
}

const renderer = read("webgl-hero.js");
assert.match(renderer, /new THREE\.OctahedronGeometry\(0\.62, 1\)/, "profile mode should define the product core");
assert.match(renderer, /new THREE\.TorusGeometry/, "profile mode should define the product orbits");
assert.match(renderer, /profileRings\.forEach/, "profile mode should animate the product orbits");
assert.match(
  renderer,
  /requestAnimationFrame\(\(time\) => \{\s*draw\(time\);\s*frameId = 0;/,
  "reduced motion should render one static frame"
);
assert.match(
  renderer,
  /if \(reduceMotion\.matches\) window\.requestAnimationFrame\(draw\)/,
  "reduced motion should redraw after a resize clears the canvas"
);

console.log("WebGL hero checks passed for all localized blog and transparency pages");
