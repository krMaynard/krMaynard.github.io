/**
 * VLOP Dashboard integrity tests.
 *
 * Covers:
 *   1. vlop-dsa.json data schema (shape, bounds, completeness)
 *   2. Pure utility function logic (reimplemented from vlop-dashboard.js)
 *   3. DESIGNATIONS reference data
 *   4. CATEGORY_PARENTS taxonomy mapping
 *
 * Run with: node tests/vlop-dashboard.test.js
 * No external dependencies — uses Node.js built-ins only.
 */

'use strict';

const assert = require('assert');
const fs = require('fs');
const path = require('path');

// ── Test runner ───────────────────────────────────────────────

let passed = 0;
let failed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    console.log(`  ✓  ${name}`);
    passed++;
  } catch (err) {
    console.log(`  ✗  ${name}`);
    console.log(`     ${err.message}`);
    failures.push({ name, message: err.message });
    failed++;
  }
}

function group(label, fn) {
  console.log(`\n${label}`);
  fn();
}

// ── Load data ─────────────────────────────────────────────────

const DATA_PATH = path.join(__dirname, '..', 'data', 'vlop-dsa.json');
const D = JSON.parse(fs.readFileSync(DATA_PATH, 'utf8'));

// ── Pure utility functions (mirrored from vlop-dashboard.js) ──
// These are the logic functions whose correctness the dashboard depends on.
// Tests here document the contract so regressions are caught immediately.

function n(v) { return v == null ? 0 : v; }
function pct(v) { return (v * 100).toFixed(1) + '%'; }

function inSvcs(svcs, svcIdx) {
  return svcs === null || svcs.indexOf(svcIdx) !== -1;
}

function aggregateBySvc(rows, extractFn, mergeFn) {
  const result = {};
  rows.forEach(function (r) {
    const si = r[0];
    const vals = extractFn(r);
    result[si] = result[si] ? mergeFn(result[si], vals) : vals;
  });
  return result;
}

function sumObj(bySvc) {
  let total = null;
  Object.values(bySvc).forEach(function (obj) {
    if (!total) { total = Object.assign({}, obj); }
    else { Object.keys(obj).forEach(function (k) { total[k] = (total[k] || 0) + obj[k]; }); }
  });
  return total || {};
}

// ── DESIGNATIONS (mirrored from vlop-dashboard.js) ───────────

const DESIGNATIONS = [
  { name: 'AliExpress',        type: 'VLOP',  date: '2023-04-25' },
  { name: 'Amazon Store',      type: 'VLOP',  date: '2023-04-25' },
  { name: 'Apple App Store',   type: 'VLOP',  date: '2023-04-25' },
  { name: 'Bing',              type: 'VLOSE', date: '2023-04-25' },
  { name: 'Booking.com',       type: 'VLOP',  date: '2023-04-25' },
  { name: 'Facebook',          type: 'VLOP',  date: '2023-04-25' },
  { name: 'Google Maps',       type: 'VLOP',  date: '2023-04-25' },
  { name: 'Google Play',       type: 'VLOP',  date: '2023-04-25' },
  { name: 'Google Search',     type: 'VLOSE', date: '2023-04-25' },
  { name: 'Google Shopping',   type: 'VLOP',  date: '2023-04-25' },
  { name: 'Instagram',         type: 'VLOP',  date: '2023-04-25' },
  { name: 'LinkedIn',          type: 'VLOP',  date: '2023-04-25' },
  { name: 'Pinterest',         type: 'VLOP',  date: '2023-04-25' },
  { name: 'Snapchat',          type: 'VLOP',  date: '2023-04-25' },
  { name: 'TikTok',            type: 'VLOP',  date: '2023-04-25' },
  { name: 'Wikipedia',         type: 'VLOP',  date: '2023-04-25' },
  { name: 'X (Twitter)',       type: 'VLOP',  date: '2023-04-25' },
  { name: 'YouTube',           type: 'VLOP',  date: '2023-04-25' },
  { name: 'Zalando',           type: 'VLOP',  date: '2023-04-25' },
  { name: 'Pornhub',           type: 'VLOP',  date: '2023-12-20' },
  { name: 'Stripchat',         type: 'VLOP',  date: '2023-12-20', until: '2025-05-27' },
  { name: 'XVideos',           type: 'VLOP',  date: '2023-12-20' },
  { name: 'Shein',             type: 'VLOP',  date: '2024-04-26' },
  { name: 'Temu',              type: 'VLOP',  date: '2024-05-31' },
  { name: 'XNXX',              type: 'VLOP',  date: '2024-07-10' },
  { name: 'WhatsApp Channels', type: 'VLOP',  date: '2026-01-26' },
];

// ── CATEGORY_PARENTS (mirrored from vlop-dashboard.js) ───────

const CATEGORY_PARENTS = {
  KEYWORD_OTHER: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_HIDDEN_ADVERTISEMENT: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_INSUFFICIENT_INFORMATION_ON_TRADERS: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_LANGUAGE_REQUIREMENTS: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_MISLEADING_INFO_CONSUMER_RIGHTS: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_MISLEADING_INFO_GOODS_SERVICES: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_NONCOMPLIANCE_PRICING: 'STATEMENT_CATEGORY_CONSUMER_INFORMATION',
  KEYWORD_ADULT_SEXUAL_MATERIAL: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_CYBER_BULLYING_INTIMIDATION: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_CYBER_HARASSMENT: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_OTHER_SEXUAL_HARASSMENT: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_CYBER_STALKING: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_NON_CONSENSUAL_IMAGE_SHARING: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_NUDITY: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_OTHER_NUDITY_SEXUAL_ACTIVITY: 'STATEMENT_CATEGORY_CYBER_VIOLENCE',
  KEYWORD_BULLYING_AGAINST_GIRLS: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_CYBER_HARASSMENT_AGAINST_WOMEN: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_CYBER_STALKING_AGAINST_WOMEN: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_FEMALE_GENDERED_DISINFORMATION: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_INCITEMENT_AGAINST_WOMEN: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_NON_CONSENSUAL_IMAGE_SHARING_AGAINST_WOMEN: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE_AGAINST_WOMEN: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_TRAFFICKING_WOMEN_GIRLS: 'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN',
  KEYWORD_BIOMETRIC_DATA_BREACH: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_DATA_FALSIFICATION: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_MISSING_PROCESSING_GROUND: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_OTHER_DATA_PROTECTION: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_OTHER_PRIVACY: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_RIGHT_TO_BE_FORGOTTEN: 'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS',
  KEYWORD_CYBER_INCITEMENT: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_DEFAMATION: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_DISCRIMINATION: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_HATE_SPEECH: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_VIOLATION_EU_LAW: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_VIOLATION_NATIONAL_LAW: 'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH',
  KEYWORD_COPYRIGHT_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_DESIGN_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_GEOGRAPHIC_INDICATIONS_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_OTHER_INTELLECTUAL_PROPERTY_INFRINGEMENTS_THIRD_PARTY_VIOLATION_OR_DATA_VIOLATION: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_PATENT_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_TRADE_SECRET_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_TRADEMARK_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
  KEYWORD_COORDINATED_HARM: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_IMPERSONATION_ACCOUNT_HIJACKING: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_INAUTHENTIC_ACCOUNTS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_INAUTHENTIC_LISTINGS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_INAUTHENTIC_USER_REVIEWS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_MISINFORMATION_DISINFORMATION: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_OTHER_CIVIC_DISCOURSE: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_OTHER_FAKE_ENGAGEMENT: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_OTHER_SPAM_AND_ARTIFICIAL_ENGAGEMENT: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
  KEYWORD_AGE_SPECIFIC_RESTRICTIONS: 'STATEMENT_CATEGORY_PROTECTION_OF_MINORS',
  KEYWORD_AGE_SPECIFIC_RESTRICTIONS_MINORS: 'STATEMENT_CATEGORY_PROTECTION_OF_MINORS',
  KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL: 'STATEMENT_CATEGORY_PROTECTION_OF_MINORS',
  KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL_DEEPFAKE: 'STATEMENT_CATEGORY_PROTECTION_OF_MINORS',
  KEYWORD_GROOMING_SEXUAL_ENTICEMENT_MINORS: 'STATEMENT_CATEGORY_PROTECTION_OF_MINORS',
  KEYWORD_HUMAN_EXPLOITATION: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_HUMAN_TRAFFICKING: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_ILLEGAL_ORGANIZATIONS: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_OTHER_FUGITIVE: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_OTHER_KIDNAPPED_OR_MISSING_PERSON: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_OTHER_PUBLIC_SECURITY: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_RISK_ENVIRONMENTAL_DAMAGE: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_RISK_PUBLIC_HEALTH: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_TERRORIST_CONTENT: 'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY',
  KEYWORD_OTHER_FINANCIAL_FRAUDS_SCAMS: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_OTHER_FRAUD_AND_DECEPTION: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_OTHER_FRAUD_OR_DECEPTION: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_OTHER_LEAD_ADS: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_PHISHING: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_PYRAMID_SCHEMES: 'STATEMENT_CATEGORY_SCAMS_AND_FRAUD',
  KEYWORD_CONTENT_PROMOTING_EATING_DISORDERS: 'STATEMENT_CATEGORY_SELF_HARM',
  KEYWORD_SELF_MUTILATION: 'STATEMENT_CATEGORY_SELF_HARM',
  KEYWORD_SUICIDE: 'STATEMENT_CATEGORY_SELF_HARM',
  KEYWORD_UNSAFE_CHALLENGES: 'STATEMENT_CATEGORY_SELF_HARM',
  KEYWORD_GOODS_SERVICES_NOT_PERMITTED: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_OTHER_CRYPTOCURRENCY: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_OTHER_GAMBLING: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_OTHER_STOLEN_GOODS: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_OTHER_VEHICLE_ACCESSORIES: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_PROHIBITED_PRODUCTS: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_UNSAFE_PRODUCTS: 'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS',
  KEYWORD_OTHER_GRAPHIC: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_INCITEMENT_VIOLENCE_HATRED: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_GRAPHIC_VIOLENCE: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_MURDER: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_PHYSICAL_ASSAULT: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_SEX_CRIME_SEXUAL_ASSAULT: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_THREATS_OF_VIOLENCE: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_OTHER_TRESPASS_PROPERTY_AND_ENVIRONMENTAL_DAMAGE: 'STATEMENT_CATEGORY_VIOLENCE',
  KEYWORD_GEOGRAPHICAL_REQUIREMENTS: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_DISCRIMINATORY_PRACTICES: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_HARMFUL_ACCOUNT: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_INELIGIBLE_USER: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_MEMORIALIZATION: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_MONETIZATION_VIOLATION: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_PAYMENT_TERMS: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_POLITICAL_ADVERTISING: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_PROFANITY: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_REPEAT_VIOLATOR: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_SPAM: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_AD_POLICY_EDITORIAL: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_AD_POLICY_SAFETY_AND_PRIVACY: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_PROFILE_POLICIES: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_UNKNOWN: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_UNORIGINAL_CONTENT: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
  KEYWORD_OTHER_ILLEGALITY: 'STATEMENT_CATEGORY_OTHER_ILLEGAL',
  KEYWORD_ANIMAL_HARM: 'STATEMENT_CATEGORY_ANIMAL_WELFARE',
  KEYWORD_UNLAWFUL_SALE_ANIMALS: 'STATEMENT_CATEGORY_ANIMAL_WELFARE',
};

// ── Tests ─────────────────────────────────────────────────────

group('1. vlop-dsa.json — top-level structure', () => {
  const REQUIRED_KEYS = [
    'meta', 'services', 'service_platforms', 'categories', 'category_labels',
    'sections', 'indicators', 'scopes', 'surfaces', 't3', 't4', 't5', 't6', 't7',
  ];

  test('all required top-level keys are present', () => {
    for (const key of REQUIRED_KEYS) {
      assert.ok(key in D, `Missing key: ${key}`);
    }
  });

  test('services and service_platforms have equal length', () => {
    assert.strictEqual(
      D.services.length, D.service_platforms.length,
      `services (${D.services.length}) !== service_platforms (${D.service_platforms.length})`
    );
  });

  test('there are exactly 25 services', () => {
    assert.strictEqual(D.services.length, 25, `Expected 25 services, got ${D.services.length}`);
  });

  test('services contains all expected platforms', () => {
    const expected = [
      'Google Maps', 'Google Play', 'Google Search', 'Google Shopping', 'YouTube',
      'X', 'TikTok', 'Facebook', 'Instagram', 'Pinterest',
      'AliExpress', 'Amazon', 'LinkedIn', 'Booking.com',
      'App Store', 'Bing', 'SHEIN',
      'Wikipedia', 'Zalando', 'Temu', 'Snapchat', 'Pornhub', 'XVideos', 'XNXX',
    ];
    for (const name of expected) {
      assert.ok(D.services.includes(name), `Missing service: ${name}`);
    }
  });

  test('non-VLOP Apple and Wikimedia services are absent', () => {
    const removed = ['Apple Books', 'iCloud Storage', 'Apple Podcasts',
                     'Wikidata', 'Wikimedia Commons', 'Wikiversity', 'Wikivoyage', 'Wiktionary'];
    for (const name of removed) {
      assert.ok(!D.services.includes(name), `Service should be absent: ${name}`);
    }
  });

  test('categories[0] is TOTAL', () => {
    assert.strictEqual(D.categories[0], 'TOTAL', `Expected TOTAL at index 0, got ${D.categories[0]}`);
  });

  test('surfaces[0] is the All sentinel', () => {
    assert.strictEqual(D.surfaces[0], 'All', `Expected 'All' at index 0, got ${D.surfaces[0]}`);
  });

  test('meta.period covers H2 2025', () => {
    assert.ok(D.meta && D.meta.period, 'meta.period is missing');
    assert.strictEqual(D.meta.period, '2025-07-01/2025-12-31',
      `Unexpected period: ${D.meta.period}`);
  });

  test('all service names are non-empty strings', () => {
    D.services.forEach((s, i) => {
      assert.ok(typeof s === 'string' && s.length > 0, `Service at index ${i} is empty`);
    });
  });

  test('no duplicate service names', () => {
    const seen = new Set();
    D.services.forEach(s => {
      assert.ok(!seen.has(s), `Duplicate service: ${s}`);
      seen.add(s);
    });
  });

  test('category_labels covers all STATEMENT_CATEGORY_ codes in categories', () => {
    const stmtCats = D.categories.filter(
      c => typeof c === 'string' && c.startsWith('STATEMENT_CATEGORY_')
    );
    for (const code of stmtCats) {
      assert.ok(code in D.category_labels, `Missing category_label for: ${code}`);
    }
  });

  test('sections, indicators, scopes are non-empty arrays', () => {
    for (const key of ['sections', 'indicators', 'scopes']) {
      assert.ok(Array.isArray(D[key]) && D[key].length > 0, `${key} is empty or not an array`);
    }
  });
});

group('2. vlop-dsa.json — table row schemas', () => {
  // Row length schema from vlop-dashboard.js comment:
  //   t3: [svcIdx, catIdx, scopeIdx, ordersAct, items, ordersInfo]          = 6 cols
  //   t4: [svcIdx, catIdx, notices, tfNotices, items, tfItems, median,
  //        tfMedian, actLaw, tfActLaw, actTC, tfActTC]                       = 12 cols
  //   t5: [svcIdx, catIdx, measures, automated, removal, disable, demoted,
  //        ageRestr, interaction, labelled, visOther, monSusp, monTerm,
  //        monOther, svcSusp, svcTerm, accSusp, accTerm]                     = 18 cols
  //   t6: same as t5 + surfaceIdx                                            = 19 cols
  //   t7: [svcIdx, secIdx, indIdx, scopeIdx, value, surfaceIdx]              = 6 cols

  const svcCount  = D.services.length;
  const catCount  = D.categories.length;
  const secCount  = D.sections.length;
  const indCount  = D.indicators.length;
  const scopeCount = D.scopes.length;
  const surfCount = D.surfaces.length;

  test('t3 rows have exactly 6 columns', () => {
    const bad = D.t3.filter(r => r.length !== 6);
    assert.strictEqual(bad.length, 0, `${bad.length} t3 rows have wrong column count`);
  });

  test('t4 rows have exactly 12 columns', () => {
    const bad = D.t4.filter(r => r.length !== 12);
    assert.strictEqual(bad.length, 0, `${bad.length} t4 rows have wrong column count`);
  });

  test('t5 rows have exactly 18 columns', () => {
    const bad = D.t5.filter(r => r.length !== 18);
    assert.strictEqual(bad.length, 0, `${bad.length} t5 rows have wrong column count`);
  });

  test('t6 rows have exactly 19 columns', () => {
    const bad = D.t6.filter(r => r.length !== 19);
    assert.strictEqual(bad.length, 0, `${bad.length} t6 rows have wrong column count`);
  });

  test('t7 rows have exactly 6 columns', () => {
    const bad = D.t7.filter(r => r.length !== 6);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have wrong column count`);
  });

  test('t3 service indices are in bounds', () => {
    const bad = D.t3.filter(r => r[0] < 0 || r[0] >= svcCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t3 rows have out-of-bounds service index`);
  });

  test('t4 service indices are in bounds', () => {
    const bad = D.t4.filter(r => r[0] < 0 || r[0] >= svcCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t4 rows have out-of-bounds service index`);
  });

  test('t5 service indices are in bounds', () => {
    const bad = D.t5.filter(r => r[0] < 0 || r[0] >= svcCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t5 rows have out-of-bounds service index`);
  });

  test('t6 service indices are in bounds', () => {
    const bad = D.t6.filter(r => r[0] < 0 || r[0] >= svcCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t6 rows have out-of-bounds service index`);
  });

  test('t7 service indices are in bounds', () => {
    const bad = D.t7.filter(r => r[0] < 0 || r[0] >= svcCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have out-of-bounds service index`);
  });

  test('t3 category indices are in bounds', () => {
    const bad = D.t3.filter(r => r[1] < 0 || r[1] >= catCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t3 rows have out-of-bounds category index`);
  });

  test('t4 category indices are in bounds', () => {
    const bad = D.t4.filter(r => r[1] < 0 || r[1] >= catCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t4 rows have out-of-bounds category index`);
  });

  test('t5 category indices are in bounds', () => {
    const bad = D.t5.filter(r => r[1] < 0 || r[1] >= catCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t5 rows have out-of-bounds category index`);
  });

  test('t6 category indices are in bounds', () => {
    const bad = D.t6.filter(r => r[1] < 0 || r[1] >= catCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t6 rows have out-of-bounds category index`);
  });

  test('t6 surface indices are in bounds', () => {
    const bad = D.t6.filter(r => r[18] < 0 || r[18] >= surfCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t6 rows have out-of-bounds surface index`);
  });

  test('t7 section indices are in bounds', () => {
    const bad = D.t7.filter(r => r[1] < 0 || r[1] >= secCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have out-of-bounds section index`);
  });

  test('t7 indicator indices are in bounds', () => {
    const bad = D.t7.filter(r => r[2] < 0 || r[2] >= indCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have out-of-bounds indicator index`);
  });

  test('t7 scope indices are in bounds', () => {
    const bad = D.t7.filter(r => r[3] < 0 || r[3] >= scopeCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have out-of-bounds scope index`);
  });

  test('t7 surface indices are in bounds', () => {
    const bad = D.t7.filter(r => r[5] < 0 || r[5] >= surfCount);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have out-of-bounds surface index`);
  });
});

group('3. vlop-dsa.json — data value integrity', () => {
  const totalCatIdx = D.categories.indexOf('TOTAL');

  test('TOTAL category is present in the categories array', () => {
    assert.ok(totalCatIdx !== -1, 'TOTAL not found in categories');
  });

  test('each table has at least one row', () => {
    for (const tbl of ['t3', 't4', 't5', 't6', 't7']) {
      assert.ok(D[tbl].length > 0, `${tbl} has no rows`);
    }
  });

  test('t4 key numeric fields (notices, items) are non-negative', () => {
    const bad = D.t4.filter(r => n(r[2]) < 0 || n(r[4]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t4 rows have negative notices or items`);
  });

  test('t4 action counts (actLaw, actTC) are non-negative', () => {
    const bad = D.t4.filter(r => n(r[8]) < 0 || n(r[10]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t4 rows have negative action counts`);
  });

  test('t5 total measures are non-negative', () => {
    const bad = D.t5.filter(r => n(r[2]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t5 rows have negative total measures`);
  });

  test('t6 total measures are non-negative', () => {
    const bad = D.t6.filter(r => n(r[2]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t6 rows have negative total measures`);
  });

  test('t5 automated detection does not exceed total measures', () => {
    const bad = D.t5.filter(r => n(r[3]) > n(r[2]));
    assert.strictEqual(bad.length, 0,
      `${bad.length} t5 rows have automated > total measures`);
  });

  test('t6 automated detection does not exceed total measures (non-TikTok)', () => {
    // TikTok's H2 2025 report contains rows where their automated count
    // exceeds their total-measures figure, which appears to be a reporting
    // artefact in the source PDF (automated detection counted across a
    // broader scope than total actions). We assert the invariant for all
    // other services and document the known TikTok rows here so any new
    // anomalies from other platforms are caught immediately.
    const tiktokIdx = D.services.indexOf('TikTok');
    const bad = D.t6.filter(r => r[0] !== tiktokIdx && n(r[3]) > n(r[2]));
    assert.strictEqual(bad.length, 0,
      `${bad.length} non-TikTok t6 rows have automated > total measures`);

    // Confirm the known TikTok anomaly still exists (update if source data changes).
    const tiktokBad = D.t6.filter(r => r[0] === tiktokIdx && n(r[3]) > n(r[2]));
    assert.strictEqual(tiktokBad.length, 9,
      `Expected 9 TikTok t6 anomaly rows, got ${tiktokBad.length} — source data may have changed`);
  });

  test('t3 order counts are non-negative', () => {
    const bad = D.t3.filter(r => n(r[3]) < 0 || n(r[4]) < 0 || n(r[5]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t3 rows have negative order counts`);
  });

  test('t7 values are non-negative', () => {
    const bad = D.t7.filter(r => n(r[4]) < 0);
    assert.strictEqual(bad.length, 0, `${bad.length} t7 rows have negative values`);
  });

  test('t4 has a TOTAL row for each service that appears', () => {
    const svcsInT4 = new Set(D.t4.map(r => r[0]));
    const svcsWithTotal = new Set(
      D.t4.filter(r => r[1] === totalCatIdx).map(r => r[0])
    );
    for (const svc of svcsInT4) {
      assert.ok(svcsWithTotal.has(svc),
        `Service index ${svc} (${D.services[svc]}) has t4 rows but no TOTAL row`);
    }
  });

  test('t5 has a TOTAL row for each service that appears', () => {
    const svcsInT5 = new Set(D.t5.map(r => r[0]));
    const svcsWithTotal = new Set(
      D.t5.filter(r => r[1] === totalCatIdx).map(r => r[0])
    );
    for (const svc of svcsInT5) {
      assert.ok(svcsWithTotal.has(svc),
        `Service index ${svc} (${D.services[svc]}) has t5 rows but no TOTAL row`);
    }
  });

  test('t6 has a TOTAL row for each service that appears', () => {
    const svcsInT6 = new Set(D.t6.map(r => r[0]));
    const svcsWithTotal = new Set(
      D.t6.filter(r => r[1] === totalCatIdx).map(r => r[0])
    );
    for (const svc of svcsInT6) {
      assert.ok(svcsWithTotal.has(svc),
        `Service index ${svc} (${D.services[svc]}) has t6 rows but no TOTAL row`);
    }
  });

  test('t3 has a TOTAL row for each service that appears', () => {
    const svcsInT3 = new Set(D.t3.map(r => r[0]));
    const svcsWithTotal = new Set(
      D.t3.filter(r => r[1] === totalCatIdx).map(r => r[0])
    );
    for (const svc of svcsInT3) {
      assert.ok(svcsWithTotal.has(svc),
        `Service index ${svc} (${D.services[svc]}) has t3 rows but no TOTAL row`);
    }
  });
});

group('4. Pure utility functions', () => {
  test('n() converts null to 0', () => {
    assert.strictEqual(n(null), 0);
  });

  test('n() converts undefined to 0', () => {
    assert.strictEqual(n(undefined), 0);
  });

  test('n() passes through 0', () => {
    assert.strictEqual(n(0), 0);
  });

  test('n() passes through positive numbers', () => {
    assert.strictEqual(n(42), 42);
    assert.strictEqual(n(1000000), 1000000);
  });

  test('n() passes through negative numbers', () => {
    assert.strictEqual(n(-5), -5);
  });

  test('pct() formats 50% correctly', () => {
    assert.strictEqual(pct(0.5), '50.0%');
  });

  test('pct() formats 100% correctly', () => {
    assert.strictEqual(pct(1), '100.0%');
  });

  test('pct() formats 0% correctly', () => {
    assert.strictEqual(pct(0), '0.0%');
  });

  test('pct() rounds to one decimal place', () => {
    assert.strictEqual(pct(1 / 3), '33.3%');
  });

  test('inSvcs(null, idx) always returns true', () => {
    assert.strictEqual(inSvcs(null, 0), true);
    assert.strictEqual(inSvcs(null, 99), true);
  });

  test('inSvcs([1, 3], 1) returns true', () => {
    assert.strictEqual(inSvcs([1, 3], 1), true);
  });

  test('inSvcs([1, 3], 3) returns true', () => {
    assert.strictEqual(inSvcs([1, 3], 3), true);
  });

  test('inSvcs([1, 3], 2) returns false', () => {
    assert.strictEqual(inSvcs([1, 3], 2), false);
  });

  test('inSvcs([], idx) always returns false', () => {
    assert.strictEqual(inSvcs([], 0), false);
  });

  test('aggregateBySvc groups rows by service index', () => {
    const rows = [
      [0, 0, 10, 5],
      [1, 0, 20, 8],
      [0, 1, 30, 2],
    ];
    const result = aggregateBySvc(
      rows,
      r => ({ notices: n(r[2]), items: n(r[3]) }),
      (a, b) => ({ notices: a.notices + b.notices, items: a.items + b.items })
    );
    assert.deepStrictEqual(result[0], { notices: 40, items: 7 });
    assert.deepStrictEqual(result[1], { notices: 20, items: 8 });
  });

  test('aggregateBySvc handles single-row input', () => {
    const rows = [[2, 0, 100, 50]];
    const result = aggregateBySvc(
      rows,
      r => ({ x: n(r[2]), y: n(r[3]) }),
      (a, b) => ({ x: a.x + b.x, y: a.y + b.y })
    );
    assert.deepStrictEqual(result[2], { x: 100, y: 50 });
  });

  test('aggregateBySvc returns empty object for empty input', () => {
    const result = aggregateBySvc([], r => ({ v: r[2] }), (a, b) => ({ v: a.v + b.v }));
    assert.deepStrictEqual(result, {});
  });

  test('sumObj sums across services correctly', () => {
    const bySvc = {
      0: { notices: 100, items: 200 },
      1: { notices: 50,  items: 80  },
      2: { notices: 25,  items: 30  },
    };
    const totals = sumObj(bySvc);
    assert.strictEqual(totals.notices, 175);
    assert.strictEqual(totals.items, 310);
  });

  test('sumObj handles single-service input', () => {
    const bySvc = { 5: { x: 42, y: 7 } };
    const totals = sumObj(bySvc);
    assert.strictEqual(totals.x, 42);
    assert.strictEqual(totals.y, 7);
  });

  test('sumObj returns empty object for empty input', () => {
    assert.deepStrictEqual(sumObj({}), {});
  });

  test('aggregateBySvc + sumObj pipeline matches manual total', () => {
    // Simulate a small t4-like dataset
    const rows = [
      [0, 0, 1000, null],  // svc 0: 1000 notices, 0 items
      [0, 1,  500, null],  // svc 0: 500 more notices
      [1, 0, 2000, null],  // svc 1: 2000 notices
    ];
    const bySvc = aggregateBySvc(
      rows,
      r => ({ notices: n(r[2]) }),
      (a, b) => ({ notices: a.notices + b.notices })
    );
    const totals = sumObj(bySvc);
    assert.strictEqual(totals.notices, 3500);
    assert.strictEqual(bySvc[0].notices, 1500);
    assert.strictEqual(bySvc[1].notices, 2000);
  });
});

group('5. DESIGNATIONS reference data', () => {
  const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
  const VALID_TYPES = ['VLOP', 'VLOSE'];

  test('has 26 designations', () => {
    assert.strictEqual(DESIGNATIONS.length, 26,
      `Expected 26 designations, got ${DESIGNATIONS.length}`);
  });

  test('each entry has name, type, and date', () => {
    DESIGNATIONS.forEach(d => {
      assert.ok(d.name, `Entry missing name: ${JSON.stringify(d)}`);
      assert.ok(VALID_TYPES.includes(d.type), `${d.name}: invalid type "${d.type}"`);
      assert.ok(ISO_DATE.test(d.date), `${d.name}: invalid date format "${d.date}"`);
    });
  });

  test('dates are valid calendar dates', () => {
    DESIGNATIONS.forEach(d => {
      const dt = new Date(d.date);
      assert.ok(!isNaN(dt.getTime()), `${d.name}: unparseable date "${d.date}"`);
    });
  });

  test('no duplicate platform names', () => {
    const seen = new Set();
    DESIGNATIONS.forEach(d => {
      assert.ok(!seen.has(d.name), `Duplicate designation: ${d.name}`);
      seen.add(d.name);
    });
  });

  test('Stripchat has a de-designation date', () => {
    const sc = DESIGNATIONS.find(d => d.name === 'Stripchat');
    assert.ok(sc, 'Stripchat not found in DESIGNATIONS');
    assert.ok(sc.until, 'Stripchat is missing the until field');
    assert.ok(ISO_DATE.test(sc.until), `Stripchat: invalid until date "${sc.until}"`);
  });

  test('only Stripchat has a de-designation (until) date', () => {
    const deDesignated = DESIGNATIONS.filter(d => d.until);
    assert.strictEqual(deDesignated.length, 1,
      `Expected 1 de-designated entity, got ${deDesignated.length}: ${deDesignated.map(d => d.name).join(', ')}`);
    assert.strictEqual(deDesignated[0].name, 'Stripchat');
  });

  test('includes 2 VLOSEs (Bing and Google Search)', () => {
    const vloses = DESIGNATIONS.filter(d => d.type === 'VLOSE').map(d => d.name).sort();
    assert.deepStrictEqual(vloses, ['Bing', 'Google Search']);
  });

  test('original 19 VLOPs were designated on 2023-04-25', () => {
    const wave1 = DESIGNATIONS.filter(d => d.date === '2023-04-25');
    assert.strictEqual(wave1.length, 19,
      `Expected 19 April 2023 designations, got ${wave1.length}`);
  });

  test('Pornhub, Stripchat, and XVideos were designated on 2023-12-20', () => {
    const wave2 = DESIGNATIONS
      .filter(d => d.date === '2023-12-20')
      .map(d => d.name)
      .sort();
    assert.deepStrictEqual(wave2, ['Pornhub', 'Stripchat', 'XVideos']);
  });

  test('Shein was designated on 2024-04-26', () => {
    const entry = DESIGNATIONS.find(d => d.name === 'Shein');
    assert.ok(entry, 'Shein not found');
    assert.strictEqual(entry.date, '2024-04-26');
  });

  test('Temu was designated on 2024-05-31', () => {
    const entry = DESIGNATIONS.find(d => d.name === 'Temu');
    assert.ok(entry, 'Temu not found');
    assert.strictEqual(entry.date, '2024-05-31');
  });

  test('XNXX was designated on 2024-07-10', () => {
    const entry = DESIGNATIONS.find(d => d.name === 'XNXX');
    assert.ok(entry, 'XNXX not found');
    assert.strictEqual(entry.date, '2024-07-10');
  });

  test('WhatsApp Channels was designated after the H2 2025 reporting period', () => {
    const entry = DESIGNATIONS.find(d => d.name === 'WhatsApp Channels');
    assert.ok(entry, 'WhatsApp Channels not found');
    const desigDate = new Date(entry.date);
    const periodEnd = new Date('2025-12-31');
    assert.ok(desigDate > periodEnd,
      `WhatsApp Channels designation ${entry.date} should be after 2025-12-31`);
  });
});

group('6. CATEGORY_PARENTS taxonomy', () => {
  const catSet = new Set(D.categories);

  test('all keys are KEYWORD_ codes', () => {
    Object.keys(CATEGORY_PARENTS).forEach(k => {
      assert.ok(k.startsWith('KEYWORD_'), `Non-keyword key in CATEGORY_PARENTS: ${k}`);
    });
  });

  test('all values are STATEMENT_CATEGORY_ codes', () => {
    Object.values(CATEGORY_PARENTS).forEach(v => {
      assert.ok(v.startsWith('STATEMENT_CATEGORY_'),
        `Non-statement-category value in CATEGORY_PARENTS: ${v}`);
    });
  });

  test('all KEYWORD_ keys that appear in data are present in CATEGORY_PARENTS', () => {
    // Every KEYWORD_ code that appears in the actual data rows must have a parent mapping
    // so the category breakdown chart can group them correctly.
    const kwInData = new Set();
    for (const tbl of ['t3', 't4', 't5', 't6']) {
      D[tbl].forEach(r => {
        const code = D.categories[r[1]];
        if (typeof code === 'string' && code.startsWith('KEYWORD_')) kwInData.add(code);
      });
    }
    for (const kw of kwInData) {
      assert.ok(kw in CATEGORY_PARENTS, `KEYWORD in data has no parent mapping: ${kw}`);
    }
  });

  test('all KEYWORD_ keys exist in the categories array', () => {
    Object.keys(CATEGORY_PARENTS).forEach(kw => {
      assert.ok(catSet.has(kw), `KEYWORD in CATEGORY_PARENTS not in categories array: ${kw}`);
    });
  });

  test('all parent STATEMENT_CATEGORY_ values exist in the categories array', () => {
    const uniqueParents = new Set(Object.values(CATEGORY_PARENTS));
    uniqueParents.forEach(parent => {
      assert.ok(catSet.has(parent),
        `Parent category in CATEGORY_PARENTS not in categories array: ${parent}`);
    });
  });

  test('no STATEMENT_CATEGORY_ appears as a key (only keywords are children)', () => {
    Object.keys(CATEGORY_PARENTS).forEach(k => {
      assert.ok(!k.startsWith('STATEMENT_CATEGORY_'),
        `STATEMENT_CATEGORY_ used as child key: ${k}`);
    });
  });

  test('has mappings for core DSA harm categories', () => {
    const requiredKeywords = [
      'KEYWORD_HATE_SPEECH',
      'KEYWORD_TERRORIST_CONTENT',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING',
      'KEYWORD_MISINFORMATION_DISINFORMATION',
      'KEYWORD_PHISHING',
      'KEYWORD_COPYRIGHT_INFRINGEMENT',
    ];
    for (const kw of requiredKeywords) {
      assert.ok(kw in CATEGORY_PARENTS, `Missing CATEGORY_PARENTS entry for: ${kw}`);
    }
  });
});

// ── Summary ───────────────────────────────────────────────────

const total = passed + failed;
console.log(`\n${'─'.repeat(55)}`);
console.log(`Results: ${passed}/${total} passed${failed > 0 ? `, ${failed} failed` : ''}`);

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => console.log(`  • ${f.name}`));
  process.exit(1);
}
