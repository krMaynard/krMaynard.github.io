// Offline Hong Kong itinerary map renderer.
// Real coastline = Natural Earth 10m (clipped). Rendered to PNG via Playwright
// Chromium. All labels in Chinese. No network at render time.
const fs = require('fs');
const { chromium } = require('playwright'); // npm i playwright && npx playwright install chromium

const LAND = JSON.parse(fs.readFileSync(__dirname + '/hk_land.json', 'utf8'));
const W = 1180, H = 860;
const PR = Math.PI / 180, R = 6378137;
const mercX = lon => lon * PR;
const mercY = lat => Math.log(Math.tan(Math.PI / 4 + lat * PR / 2));

// ---- Style ----------------------------------------------------------------
const C = {
  water: '#cfe6ef', waterDeep: '#bcdCE9', land: '#f6f1e7', landEdge: '#cdbfa6',
  green: '#cfe3b8', greenEdge: '#b6d196', pin: '#d7472f', pinDark: '#a8331f',
  food: '#e08a2b', transport: '#3d7fb8', ink: '#2a2622', muted: '#6b6157',
  halo: '#ffffff', card: '#ffffff', accent: '#0e7c86'
};
const FONT = "'WenQuanYi Zen Hei','Noto Sans CJK SC',sans-serif";

// ---- Points of interest ---------------------------------------------------
// cat: hotel|sight|transport|food|airport   d: day number (badge)
const POI = {
  hotel:   { lon:114.1727, lat:22.2972, zh:'尖沙咀凯悦酒店', en:'Hyatt Regency TST', cat:'hotel' },
  k11:     { lon:114.1735, lat:22.2954, zh:'K11 商场',        en:'K11 Musea',        cat:'food' },
  avenue:  { lon:114.1742, lat:22.2934, zh:'星光大道',        en:'Avenue of Stars',  cat:'sight', d:1 },
  science: { lon:114.1772, lat:22.3016, zh:'香港科学馆',      en:'Science Museum',   cat:'sight', d:1 },
  space:   { lon:114.1719, lat:22.2942, zh:'香港太空馆',      en:'Space Museum',     cat:'sight', d:4 },
  sfTST:   { lon:114.1690, lat:22.2937, zh:'天星小轮·尖沙咀', en:'Star Ferry (TST)', cat:'transport' },
  sfCEN:   { lon:114.1612, lat:22.2876, zh:'天星小轮·中环',   en:'Star Ferry (Central)', cat:'transport' },
  central: { lon:114.1583, lat:22.2820, zh:'中环',            en:'Central',          cat:'sight', d:2 },
  ifc:     { lon:114.1588, lat:22.2853, zh:'国际金融中心商场', en:'IFC Mall',         cat:'sight', d:2 },
  pTram:   { lon:114.1602, lat:22.2774, zh:'山顶缆车·中环站', en:'Peak Tram',        cat:'transport', d:2 },
  peak:    { lon:114.1450, lat:22.2759, zh:'太平山顶·凌霄阁', en:'The Peak',         cat:'sight', d:2 },
  ocean:   { lon:114.1757, lat:22.2466, zh:'海洋公园',        en:'Ocean Park',       cat:'sight', d:3 },
  airport: { lon:113.9185, lat:22.3080, zh:'香港国际机场',    en:"HK Int'l Airport", cat:'airport', d:4 },
  // restaurants (smaller pins, shown where relevant)
  timhowan:{ lon:114.1716, lat:22.2988, zh:'添好运',   en:'Tim Ho Wan',   cat:'food' },
  tsuiwah: { lon:114.1729, lat:22.2980, zh:'翠华餐厅', en:'Tsui Wah',     cat:'food' },
  taihing: { lon:114.1712, lat:22.2978, zh:'太兴',     en:'Tai Hing',     cat:'food' },
  spring:  { lon:114.1761, lat:22.2972, zh:'鹿鸣春',   en:'Spring Deer',  cat:'food' },
  sweet:   { lon:114.1709, lat:22.2996, zh:'糖朝',     en:'Sweet Dynasty',cat:'food' },
  ausdairy:{ lon:114.1706, lat:22.3050, zh:'澳洲牛奶公司', en:'Australia Dairy', cat:'food' },
  dintai:  { lon:114.1700, lat:22.2982, zh:'鼎泰丰',   en:'Din Tai Fung', cat:'food' },
  crystal: { lon:114.1586, lat:22.2851, zh:'翡翠拉面', en:'Crystal Jade', cat:'food' },
  panda:   { lon:114.1746, lat:22.2481, zh:'熊猫餐厅', en:'Panda Rest.',  cat:'food' },
};

// stylised parks (soft green accents, approximate)
const PARKS = [
  [[114.122,22.252],[114.135,22.247],[114.155,22.255],[114.165,22.270],[114.158,22.282],[114.140,22.284],[114.126,22.276]], // Peak country park
  [[114.165,22.236],[114.180,22.236],[114.186,22.248],[114.178,22.256],[114.166,22.252]], // Ocean Park headland
  [[114.1693,22.2992],[114.1715,22.2984],[114.1734,22.2992],[114.1738,22.3012],[114.1730,22.3030],[114.1710,22.3036],[114.1693,22.3028],[114.1688,22.3010]], // Kowloon Park
];

const DISTRICTS = [
  { lon:114.176, lat:22.315, t:'九龙',        s:'KOWLOON' },
  { lon:114.150, lat:22.262, t:'香港岛',      s:'HONG KONG ISLAND' },
  { lon:114.163, lat:22.2905, t:'维多利亚港', s:'VICTORIA HARBOUR', water:true },
];

// dashed connectors (transport hints): [from,to,label]
const LINKS = [
  ['sfTST','sfCEN','天星小轮 ⛴'],
  ['pTram','peak','山顶缆车'],
];

// ---- Views ----------------------------------------------------------------
const VIEWS = [
  { id:'00-overview', cx:114.158, cy:22.272, span:0.140, title:'全程总览', sub:'维多利亚港 · 香港四日游',
    show:['hotel','avenue','science','space','sfTST','sfCEN','central','ifc','pTram','peak','ocean'],
    noLabel:['sfTST','sfCEN','pTram'],
    districts:true, links:['pTram->peak'] , card:'big'},
  { id:'01-tst-area', cx:114.1718, cy:22.2982, span:0.034, title:'尖沙咀一带', sub:'住宿 · 海滨 · 美食',
    show:['hotel','k11','avenue','space','science','sfTST','timhowan','tsuiwah','taihing','spring','sweet','ausdairy','dintai'],
    hi:'hotel', districts:true },
  { id:'02-avenue', cx:114.1730, cy:22.2930, span:0.030, title:'星光大道', sub:'第1天 · 维港海滨 · 幻彩咏香江',
    show:['avenue','hotel','space','sfTST','science'], hi:'avenue', districts:true,
    note:{lon:114.166,lat:22.2895,t:'晚 8:00 幻彩咏香江 灯光秀'} },
  { id:'03-science', cx:114.1760, cy:22.3010, span:0.030, title:'香港科学馆', sub:'第1天 · 雨天备选 · 动手展品',
    show:['science','hotel','space','avenue'], hi:'science', districts:true },
  { id:'04-space', cx:114.1716, cy:22.2945, span:0.028, title:'香港太空馆', sub:'第4天 · 蛋形天象厅 · 球幕电影',
    show:['space','avenue','hotel','sfTST'], hi:'space', districts:true },
  { id:'05-starferry', cx:114.1650, cy:22.2906, span:0.040, title:'天星小轮', sub:'尖沙咀 ⇄ 中环 · 约十分钟',
    show:['sfTST','sfCEN','ifc','central','hotel'], hi:'sfTST', districts:true, links:['sfTST->sfCEN'] },
  { id:'06-central-ifc', cx:114.1588, cy:22.2842, span:0.034, title:'中环 · 国际金融中心', sub:'第2天 · 购物 · 吹空调 · 翡翠拉面',
    show:['central','ifc','sfCEN','crystal','pTram'], hi:'ifc', districts:true },
  { id:'07-peak', cx:114.1500, cy:22.2772, span:0.052, title:'太平山顶 · 山顶缆车', sub:'第2天 · 凌霄阁观景台 · 俯瞰全港',
    show:['peak','pTram','central','ifc','sfCEN'], hi:'peak', districts:true, links:['pTram->peak'] },
  { id:'08-oceanpark', cx:114.1730, cy:22.2495, span:0.052, title:'海洋公园', sub:'第3天 · 大熊猫 · 水族馆 · 海洋列车',
    show:['ocean','panda'], hi:'ocean', districts:true },
  { id:'09-airport', cx:113.9550, cy:22.3030, span:0.170, title:'香港国际机场', sub:'第4天 · 机场快线 · 晚班机返美',
    show:['airport'], hi:'airport', lantau:true },
];

// ---- helpers --------------------------------------------------------------
const esc = s => String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
function projector(v) {
  const projW = v.span * PR, projH = projW * H / W;
  const cxp = mercX(v.cx), cyp = mercY(v.cy);
  const x0 = cxp - projW/2, yTop = cyp + projH/2;
  return {
    x: lon => (mercX(lon) - x0) / projW * W,
    y: lat => (yTop - mercY(lat)) / projH * H,
    mPerPx: R * Math.cos(v.cy*PR) * v.span * PR / W,
  };
}
function ringPath(ring, P) {
  const pts = ring.map(([lo,la]) => `${P.x(lo).toFixed(1)},${P.y(la).toFixed(1)}`);
  return 'M' + pts.join('L') + 'Z';
}
function landPaths(P) {
  let d = '';
  for (const poly of LAND) {
    d += ringPath(poly.exterior, P);
    for (const h of poly.holes) d += ringPath(h, P);
  }
  return d;
}

// greedy label placement to avoid overlaps
function placeLabels(items, reserved) {
  const placed = [...reserved];
  const fits = r => r.x>=4 && r.y>=4 && r.x+r.w<=W-4 && r.y+r.h<=H-4 &&
    !placed.some(p => !(r.x+r.w < p.x || r.x > p.x+p.w || r.y+r.h < p.y || r.y > p.y+p.h));
  for (const it of items) {
    const fs = it.fs, w = it.text.length * fs * 1.02 + 8, h = fs * 1.25;
    const cands = [
      [it.x - w/2, it.y - 34 - h, 'middle'], [it.x - w/2, it.y + 12, 'middle'],
      [it.x + 14, it.y - 30, 'start'], [it.x - w - 14, it.y - 30, 'end'],
      [it.x + 14, it.y + 4, 'start'], [it.x - w - 14, it.y + 4, 'end'],
      [it.x - w/2, it.y - 50 - h, 'middle'], [it.x + 14, it.y - 8, 'start'],
    ];
    let chosen = null;
    for (const [rx,ry,anchor] of cands) { const r={x:rx,y:ry,w,h}; if (fits(r)){ chosen={rx,ry,anchor,r}; break; } }
    if (!chosen) { const r={x:it.x-w/2,y:it.y-34-h,w,h}; chosen={rx:r.x,ry:r.y,anchor:'middle',r}; }
    placed.push(chosen.r);
    it.tx = chosen.anchor==='start'?chosen.rx : chosen.anchor==='end'?chosen.rx+w : it.x;
    it.ty = chosen.ry + fs; it.anchor = chosen.anchor;
  }
  return items;
}

function pin(x, y, color, scale=1) {
  const s = scale;
  return `<g transform="translate(${x.toFixed(1)},${y.toFixed(1)}) scale(${s})" filter="url(#ds)">
    <path d="M0,0 C-7,-9 -10.5,-14 -10.5,-19.5 A10.5,10.5 0 1,1 10.5,-19.5 C10.5,-14 7,-9 0,0 Z" fill="${color}"/>
    <circle cx="0" cy="-19.5" r="4.4" fill="#fff"/></g>`;
}
function dot(x, y, color, r=4.5) {
  return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r}" fill="${color}" stroke="#fff" stroke-width="1.6" filter="url(#ds)"/>`;
}

function buildSVG(v) {
  const P = projector(v);
  const reserved = [];
  // adaptive title-card width, reserved up front so labels avoid it
  const titleW = 44 + v.title.length * 34 * 1.04 + 22;
  const subW = 46 + v.sub.length * 18 * 1.02 + 16;
  const cardW = Math.min(560, Math.max(330, titleW, subW));
  reserved.push({ x:0, y:0, w:cardW+34, h:128 });
  let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="${FONT}">`;
  svg += `<defs>
    <filter id="ds" x="-40%" y="-40%" width="180%" height="180%"><feDropShadow dx="0" dy="1.4" stdDeviation="1.4" flood-color="#000" flood-opacity="0.30"/></filter>
    <filter id="cardsh" x="-20%" y="-20%" width="140%" height="160%"><feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#000" flood-opacity="0.18"/></filter>
  </defs>`;
  // water
  svg += `<rect width="${W}" height="${H}" fill="${C.water}"/>`;
  // subtle water bands
  svg += `<rect width="${W}" height="${H}" fill="url(#wg)" opacity="0"/>`;
  // land
  svg += `<path d="${landPaths(P)}" fill="${C.land}" stroke="${C.landEdge}" stroke-width="1.1" stroke-linejoin="round"/>`;
  // parks
  for (const pk of PARKS) {
    const d = 'M' + pk.map(([lo,la])=>`${P.x(lo).toFixed(1)},${P.y(la).toFixed(1)}`).join('L') + 'Z';
    svg += `<path d="${d}" fill="${C.green}" stroke="${C.greenEdge}" stroke-width="0.8" opacity="0.72"/>`;
  }
  // district labels
  if (v.districts || v.lantau) for (const d of DISTRICTS) {
    if (v.lantau && d.t!=='维多利亚港') continue;
    const x=P.x(d.lon), y=P.y(d.lat);
    if (x<10||x>W-10||y<10||y>H-10) continue;
    const col = d.water? C.transport : C.muted;
    const dw = d.t.length*22 + 3*(d.t.length-1);
    reserved.push({ x:x-dw/2-6, y:y-22, w:dw+12, h:30 });
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="19" letter-spacing="3" fill="${col}" opacity="0.85" font-style="${d.water?'italic':'normal'}" paint-order="stroke" stroke="${C.water}" stroke-width="3">${esc(d.t)}</text>`;
  }
  if (v.lantau) {
    const x=P.x(113.94), y=P.y(22.255);
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="20" letter-spacing="3" fill="${C.muted}" opacity="0.85" paint-order="stroke" stroke="${C.land}" stroke-width="3">大屿山</text>`;
  }
  // links (dashed)
  const linkList = (v.links||[]).map(s=>s.split('->'));
  for (const [a,b] of linkList) {
    const A=POI[a],B=POI[b]; if(!A||!B) continue;
    svg += `<path d="M${P.x(A.lon).toFixed(1)},${P.y(A.lat).toFixed(1)} L${P.x(B.lon).toFixed(1)},${P.y(B.lat).toFixed(1)}" stroke="${C.transport}" stroke-width="2.4" stroke-dasharray="3 5" stroke-linecap="round" opacity="0.8"/>`;
  }
  // airport view: stylised reclaimed-platform + Airport Express hint
  if (v.id.startsWith('09')) {
    const ax=P.x(113.9185), ay=P.y(22.3080);
    svg += `<rect x="${(ax-46).toFixed(1)}" y="${(ay-30).toFixed(1)}" width="92" height="58" rx="6" fill="${C.land}" stroke="${C.landEdge}" stroke-width="1.1"/>`;
    svg += `<path d="M${ax.toFixed(1)},${ay.toFixed(1)} L${P.x(114.05).toFixed(1)},${P.y(22.305).toFixed(1)} L${P.x(114.16).toFixed(1)},${P.y(22.288).toFixed(1)}" fill="none" stroke="${C.transport}" stroke-width="2.8" stroke-dasharray="2 7" stroke-linecap="round" opacity="0.9"/>`;
    svg += `<text x="${P.x(113.972).toFixed(1)}" y="${P.y(22.289).toFixed(1)}" text-anchor="middle" font-size="18" font-weight="600" fill="${C.transport}" paint-order="stroke" stroke="${C.water}" stroke-width="3.5">机场快线 → 市区</text>`;
  }

  // collect pins; restaurants/transport are secondary
  const ids = v.show;
  const baseFs = v.card==='big' ? 16 : 18;
  const labelItems = [];
  let pinSVG = '', hiSVG = '';
  for (const id of ids) {
    const p = POI[id]; if(!p) continue;
    const x=P.x(p.lon), y=P.y(p.lat);
    if (x<-20||x>W+20||y<-20||y>H+20) continue;
    const isHi = v.hi===id;
    const sec = (p.cat==='food'); // small dot
    if (sec) { pinSVG += dot(x,y,C.food); }
    else if (p.cat==='transport') { pinSVG += dot(x,y,C.transport,5.5); }
    else if (!isHi) { pinSVG += pin(x,y,C.pin,1.0); }
    const fs = isHi?27:(sec?(v.card==='big'?14:15):baseFs);
    if (!(v.noLabel && v.noLabel.includes(id)) || isHi)
      labelItems.push({ id, x, y, text:p.zh, fs, hi:isHi, cat:p.cat });
    if (isHi) {
      hiSVG = `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="17" fill="${C.pin}" opacity="0.18"/>` +
              `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="11" fill="${C.pin}" opacity="0.22"/>` +
              pin(x,y,C.pin,1.6);
    }
  }
  // place highlighted label first (priority)
  labelItems.sort((a,b)=> (b.hi?1:0)-(a.hi?1:0));
  placeLabels(labelItems, reserved);

  svg += pinSVG + hiSVG;
  for (const it of labelItems) {
    const col = it.hi?C.pinDark : (it.cat==='food'?'#8a5114':(it.cat==='transport'?'#1f4d70':C.ink));
    const weight = it.hi?'700':'600';
    svg += `<text x="${it.tx.toFixed(1)}" y="${it.ty.toFixed(1)}" text-anchor="${it.anchor}" font-size="${it.fs}" font-weight="${weight}" fill="${col}" paint-order="stroke" stroke="${C.halo}" stroke-width="4.2" stroke-linejoin="round">${esc(it.text)}</text>`;
  }
  // free note
  if (v.note) {
    const x=P.x(v.note.lon), y=P.y(v.note.lat);
    svg += `<text x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="middle" font-size="16" fill="${C.accent}" font-weight="600" paint-order="stroke" stroke="#fff" stroke-width="3.5">${esc(v.note.t)}</text>`;
  }

  // --- title card (adaptive width; day already shown in subtitle) ---
  svg += `<g filter="url(#cardsh)"><rect x="22" y="22" rx="14" ry="14" width="${cardW.toFixed(0)}" height="92" fill="${C.card}" opacity="0.96"/></g>`;
  svg += `<rect x="22" y="22" rx="14" ry="14" width="6" height="92" fill="${C.pin}"/>`;
  svg += `<text x="44" y="64" font-size="34" font-weight="800" fill="${C.ink}">${esc(v.title)}</text>`;
  svg += `<text x="46" y="96" font-size="18" fill="${C.muted}">${esc(v.sub)}</text>`;

  // --- north arrow ---
  svg += `<g transform="translate(${W-52},${64})"><circle r="22" fill="#fff" opacity="0.9" filter="url(#ds)"/><path d="M0,-15 L6,8 L0,2 L-6,8 Z" fill="${C.ink}"/><text x="0" y="-24" text-anchor="middle" font-size="13" font-weight="700" fill="${C.ink}">北</text></g>`;

  // --- scale bar ---
  const targets = [200,500,1000,2000,5000];
  let m = targets.find(t => t/P.mPerPx < 200) || 5000;
  const barpx = m / P.mPerPx;
  const sxp = W-44-barpx, syp = H-40;
  const label = m>=1000? (m/1000)+' 公里' : m+' 米';
  svg += `<g><rect x="${sxp-10}" y="${syp-22}" width="${barpx+20}" height="34" rx="7" fill="#fff" opacity="0.82"/>
    <line x1="${sxp}" y1="${syp}" x2="${sxp+barpx}" y2="${syp}" stroke="${C.ink}" stroke-width="3"/>
    <line x1="${sxp}" y1="${syp-5}" x2="${sxp}" y2="${syp+5}" stroke="${C.ink}" stroke-width="3"/>
    <line x1="${sxp+barpx}" y1="${syp-5}" x2="${sxp+barpx}" y2="${syp+5}" stroke="${C.ink}" stroke-width="3"/>
    <text x="${sxp+barpx/2}" y="${syp-8}" text-anchor="middle" font-size="14" font-weight="600" fill="${C.ink}">${label}</text></g>`;

  // --- footer attribution ---
  svg += `<text x="24" y="${H-18}" font-size="13" fill="${C.muted}" opacity="0.9">底图 © Natural Earth · 由 Claude Code 离线渲染</text>`;

  svg += `</svg>`;
  return svg;
}

(async () => {
  fs.mkdirSync(__dirname + '/out', { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport:{width:W,height:H}, deviceScaleFactor:2 });
  for (const v of VIEWS) {
    const svg = buildSVG(v);
    const html = `<!doctype html><html><head><meta charset="utf-8"><style>html,body{margin:0;padding:0;background:#fff}</style></head><body>${svg}</body></html>`;
    await page.setContent(html, { waitUntil:'networkidle' });
    await page.waitForTimeout(120);
    const el = await page.$('svg');
    await el.screenshot({ path: `${__dirname}/out/${v.id}.png` });
    console.log('rendered', v.id);
  }
  await browser.close();
  console.log('DONE');
})().catch(e => { console.error(e); process.exit(1); });
