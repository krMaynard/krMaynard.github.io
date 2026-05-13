/* Google Government Removals — Interactive Dashboard
 * Loads /data/google-government-removals.json, wires up filters,
 * computes aggregates client-side, and renders charts with Chart.js.
 *
 * Data schema (compact, integer-coded):
 *   row = [periodIdx, countryIdx, requestorIdx, productIdx, reasonIdx,
 *          numRequests, itemsRequested,
 *          removedLegal, removedPolicy,
 *          notFound, notEnoughInfo, noAction, alreadyRemoved]
 */
(function () {
  'use strict';

  // ───────── Strings (en/ja) ─────────
  // The site's <html lang> is hardcoded in the layout, so detect from the URL path.
  var lang = /^\/ja(\/|$)/.test(window.location.pathname) ? 'ja' : 'en';
  var L = {
    en: {
      loading: 'Loading data…',
      loadError: 'Could not load dataset.',
      anyCountry: 'All countries',
      anyRequestor: 'All requestor types',
      anyProduct: 'All Google products',
      anyReason: 'All reasons',
      from: 'From',
      to: 'To',
      reset: 'Reset filters',
      metricRequests: 'Government requests',
      metricItems: 'Items targeted for removal',
      metricRemoved: 'Items actually removed',
      metricRate: 'Removal rate',
      metricCountries: 'Countries represented',
      metricPeriods: 'Reporting periods',
      chartTimeseries: 'Items targeted for removal, by reporting period',
      chartCountries: 'Top 10 countries by items targeted',
      chartReasons: 'Top reasons cited',
      chartProducts: 'Top Google products targeted',
      chartCompliance: 'How Google responded',
      respLegal: 'Removed (legal)',
      respPolicy: 'Removed (policy)',
      respAlready: 'Already removed',
      respNotFound: 'Content not found',
      respNotEnough: 'Not enough info',
      respNoAction: 'No action taken',
      tableTitle: 'Filtered records (top 25 by items targeted)',
      colPeriod: 'Period',
      colCountry: 'Country',
      colRequestor: 'Requestor',
      colProduct: 'Product',
      colReason: 'Reason',
      colItems: 'Items targeted',
      colRemoved: 'Items removed',
      empty: 'No records match the current filters.',
      shown: 'rows in filter',
      itemsRequested: 'Items targeted',
      itemsRemoved: 'Items removed',
      breakdownLabel: 'Break down by',
      bdNone: 'None (total)',
      bdCountry: 'Country',
      bdRequestor: 'Requestor type',
      bdProduct: 'Google product',
      bdReason: 'Reason',
      other: 'Other',
      removalRateOverTime: 'Removal rate over time',
      changeOverRange: 'Change over selected range',
      trendUp: 'up',
      trendDown: 'down',
      trendFlat: 'flat',
      vsFirstPeriod: 'first → last period in range'
    },
    ja: {
      loading: 'データ読み込み中…',
      loadError: 'データセットを読み込めませんでした。',
      anyCountry: 'すべての国',
      anyRequestor: 'すべての要請者タイプ',
      anyProduct: 'すべてのGoogleプロダクト',
      anyReason: 'すべての理由',
      from: '開始',
      to: '終了',
      reset: 'フィルタをリセット',
      metricRequests: '政府からの要請件数',
      metricItems: '削除対象アイテム数',
      metricRemoved: '実際に削除されたアイテム数',
      metricRate: '削除率',
      metricCountries: '対象国数',
      metricPeriods: '報告期間数',
      chartTimeseries: '報告期間別・削除対象アイテム数',
      chartCountries: '削除対象アイテム数の多い国 トップ10',
      chartReasons: '主な削除理由',
      chartProducts: '対象となったGoogleプロダクト',
      chartCompliance: 'Googleの対応内訳',
      respLegal: '削除（法的）',
      respPolicy: '削除（ポリシー）',
      respAlready: '既に削除済み',
      respNotFound: 'コンテンツ未発見',
      respNotEnough: '情報不足',
      respNoAction: '対応なし',
      tableTitle: 'フィルタ後のレコード（削除対象アイテム数の多い順 上位25件）',
      colPeriod: '期間',
      colCountry: '国',
      colRequestor: '要請者',
      colProduct: 'プロダクト',
      colReason: '理由',
      colItems: '削除対象数',
      colRemoved: '削除数',
      empty: '現在のフィルタに該当するレコードはありません。',
      shown: '件',
      itemsRequested: '削除対象',
      itemsRemoved: '削除済み',
      breakdownLabel: '内訳の軸',
      bdNone: 'なし（合計）',
      bdCountry: '国',
      bdRequestor: '要請者タイプ',
      bdProduct: 'Googleプロダクト',
      bdReason: '理由',
      other: 'その他',
      removalRateOverTime: '削除率の推移',
      changeOverRange: '選択範囲での変化',
      trendUp: '増加',
      trendDown: '減少',
      trendFlat: '横ばい',
      vsFirstPeriod: '範囲の最初の期間 → 最後の期間'
    }
  }[lang];

  // ───────── State ─────────
  var DATA = null;
  var CHARTS = {};
  var FILTERS = {
    fromPeriod: 0,
    toPeriod: 0,
    country: -1,
    requestor: -1,
    product: -1,
    reason: -1,
    breakdownBy: 'none' // 'none' | 'country' | 'requestor' | 'product' | 'reason'
  };

  var BRAND = '#2a9d8f';
  var BRAND_DARK = '#1e7268';
  var BRAND_LIGHT = '#64CEAA';
  var PALETTE = ['#2a9d8f', '#264653', '#e9c46a', '#f4a261', '#e76f51',
                 '#8ab17d', '#287271', '#b5838d', '#6d597a', '#a8dadc',
                 '#457b9d', '#1d3557'];

  // Map breakdown dimension → row column index + label lookup.
  var DIM = {
    country:   { col: 1, labelsKey: 'country_names' },
    requestor: { col: 2, labelsKey: 'requestors' },
    product:   { col: 3, labelsKey: 'products' },
    reason:    { col: 4, labelsKey: 'reasons' }
  };

  // ───────── Utilities ─────────
  function fmt(n) {
    if (n == null || isNaN(n)) return '0';
    return n.toLocaleString(lang === 'ja' ? 'ja-JP' : 'en-US');
  }
  function pct(n) {
    if (!isFinite(n)) return '–';
    return (n * 100).toFixed(1) + '%';
  }
  function signedPct(n) {
    if (!isFinite(n)) return '–';
    var s = (n * 100).toFixed(1) + '%';
    return n > 0 ? '+' + s : s;
  }
  function getCssVar(name, fallback) {
    var v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
    return v || fallback;
  }
  // Convert "January - June 2019" → "2019-H1", "July - December 2019" → "2019-H2".
  function periodLabel(p) {
    if (!p) return p;
    var m = /(\d{4})/.exec(p);
    if (!m) return p;
    var year = m[1];
    var half = /January/i.test(p) ? 'H1' : (/July/i.test(p) ? 'H2' : '');
    return half ? year + '-' + half : p;
  }
  function chartTextColor() { return getCssVar('--text', '#333'); }
  function chartGridColor() {
    return document.documentElement.getAttribute('data-theme') === 'dark'
      ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.06)';
  }

  // ───────── Filtering ─────────
  function rowMatches(r) {
    if (r[0] < FILTERS.fromPeriod || r[0] > FILTERS.toPeriod) return false;
    if (FILTERS.country >= 0 && r[1] !== FILTERS.country) return false;
    if (FILTERS.requestor >= 0 && r[2] !== FILTERS.requestor) return false;
    if (FILTERS.product >= 0 && r[3] !== FILTERS.product) return false;
    if (FILTERS.reason >= 0 && r[4] !== FILTERS.reason) return false;
    return true;
  }

  function filteredRows() {
    var out = [];
    var rows = DATA.rows;
    for (var i = 0; i < rows.length; i++) if (rowMatches(rows[i])) out.push(rows[i]);
    return out;
  }

  // ───────── Aggregation ─────────
  function aggregate(rows) {
    var P = DATA.periods.length;
    var totals = {
      requests: 0, items: 0, legal: 0, policy: 0,
      notFound: 0, notEnough: 0, noAction: 0, already: 0
    };
    var byPeriod = new Array(P).fill(0);
    var byPeriodRemoved = new Array(P).fill(0);
    var byCountry = {};
    var byReason = {};
    var byProduct = {};
    var countriesSeen = new Set();
    var periodsSeen = new Set();

    // Trend mode: build per-period × per-category matrix for the selected dimension.
    var dim = DIM[FILTERS.breakdownBy] || null;
    // matrix[categoryIdx] = Array(P) of items_targeted
    var matrix = dim ? {} : null;

    for (var i = 0; i < rows.length; i++) {
      var r = rows[i];
      totals.requests  += r[5];
      totals.items     += r[6];
      totals.legal     += r[7];
      totals.policy    += r[8];
      totals.notFound  += r[9];
      totals.notEnough += r[10];
      totals.noAction  += r[11];
      totals.already   += r[12];

      byPeriod[r[0]] += r[6];
      byPeriodRemoved[r[0]] += r[7] + r[8] + r[12];

      byCountry[r[1]] = (byCountry[r[1]] || 0) + r[6];
      byReason[r[4]]  = (byReason[r[4]]  || 0) + r[6];
      byProduct[r[3]] = (byProduct[r[3]] || 0) + r[6];

      countriesSeen.add(r[1]);
      periodsSeen.add(r[0]);

      if (dim) {
        var cat = r[dim.col];
        if (!matrix[cat]) matrix[cat] = new Array(P).fill(0);
        matrix[cat][r[0]] += r[6];
      }
    }

    totals.removed = totals.legal + totals.policy + totals.already;
    totals.rate = totals.items > 0 ? totals.removed / totals.items : 0;
    totals.countries = countriesSeen.size;
    totals.periodsActive = periodsSeen.size;

    return {
      totals: totals,
      byPeriod: byPeriod, byPeriodRemoved: byPeriodRemoved,
      byCountry: byCountry, byReason: byReason, byProduct: byProduct,
      matrix: matrix
    };
  }

  function topN(map, n, labels) {
    var arr = Object.keys(map).map(function (k) { return [parseInt(k, 10), map[k]]; });
    arr.sort(function (a, b) { return b[1] - a[1]; });
    arr = arr.slice(0, n);
    return {
      labels: arr.map(function (x) { return labels[x[0]]; }),
      values: arr.map(function (x) { return x[1]; })
    };
  }

  // ───────── Rendering ─────────
  function renderMetrics(agg) {
    var t = agg.totals;
    var rangeLabel = DATA.periodLabels[FILTERS.fromPeriod] + ' – ' + DATA.periodLabels[FILTERS.toPeriod];

    // Period-over-period: items targeted in the first selected period vs the last.
    var first = agg.byPeriod[FILTERS.fromPeriod];
    var last  = agg.byPeriod[FILTERS.toPeriod];
    var trendNum, trendCls;
    if (FILTERS.fromPeriod === FILTERS.toPeriod || first === 0) {
      trendNum = '–';
      trendCls = 'td-trend-flat';
    } else {
      var delta = (last - first) / first;
      trendNum = signedPct(delta);
      trendCls = delta > 0.005 ? 'td-trend-up' : (delta < -0.005 ? 'td-trend-down' : 'td-trend-flat');
    }

    var metrics = [
      { num: fmt(t.requests),  label: L.metricRequests },
      { num: fmt(t.items),     label: L.metricItems },
      { num: fmt(t.removed),   label: L.metricRemoved },
      { num: pct(t.rate),      label: L.metricRate },
      { num: fmt(t.countries), label: L.metricCountries },
      { num: trendNum,         label: L.changeOverRange, cls: trendCls, hint: L.vsFirstPeriod }
    ];
    var html = metrics.map(function (m) {
      var numCls = 'td-metric-num' + (m.cls ? ' ' + m.cls : '');
      var hint = m.hint ? '<span class="td-metric-hint">' + m.hint + '</span>' : '';
      return '<div class="td-metric"><span class="' + numCls + '">' + m.num +
             '</span><span class="td-metric-label">' + m.label + '</span>' + hint + '</div>';
    }).join('');
    document.getElementById('td-metrics').innerHTML = html;
    document.getElementById('td-range-label').textContent = rangeLabel;
  }

  function destroy(name) {
    if (CHARTS[name]) { CHARTS[name].destroy(); delete CHARTS[name]; }
  }

  function commonChartOptions(extra) {
    var textColor = chartTextColor();
    var gridColor = chartGridColor();
    var base = {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 250 },
      plugins: {
        legend: { labels: { color: textColor, font: { family: 'Open Sans, system-ui, sans-serif' } } },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              var v = typeof ctx.parsed === 'object' ? (ctx.parsed.y != null ? ctx.parsed.y : ctx.parsed.x) : ctx.parsed;
              return (ctx.dataset.label ? ctx.dataset.label + ': ' : '') + fmt(v);
            }
          }
        }
      },
      scales: {
        x: { ticks: { color: textColor }, grid: { color: gridColor } },
        y: { ticks: { color: textColor, callback: function (v) { return fmt(v); } }, grid: { color: gridColor } }
      }
    };
    if (extra) Object.keys(extra).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  function renderTimeseries(agg) {
    destroy('time');
    var ctx = document.getElementById('td-chart-time').getContext('2d');
    var fromP = FILTERS.fromPeriod, toP = FILTERS.toPeriod;
    var labels = DATA.periodLabels.slice(fromP, toP + 1);

    if (FILTERS.breakdownBy === 'none' || !agg.matrix) {
      // Original two-line view.
      var dataReq = agg.byPeriod.slice(fromP, toP + 1);
      var dataRem = agg.byPeriodRemoved.slice(fromP, toP + 1);
      CHARTS.time = new Chart(ctx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            { label: L.itemsRequested, data: dataReq, borderColor: BRAND, backgroundColor: 'rgba(42,157,143,0.10)',
              fill: true, tension: 0.25, borderWidth: 2, borderDash: [4,4], pointRadius: 3 },
            { label: L.itemsRemoved, data: dataRem, borderColor: BRAND_DARK, backgroundColor: 'rgba(30,114,104,0.0)',
              fill: false, tension: 0.25, borderWidth: 2, pointRadius: 3 }
          ]
        },
        options: commonChartOptions()
      });
      return;
    }

    // Breakdown mode: top-7 categories + "Other".
    var dim = DIM[FILTERS.breakdownBy];
    var labelLookup = DATA[dim.labelsKey];
    var withCountryCode = FILTERS.breakdownBy === 'country';

    // Rank categories by total items in the selected period range.
    // Rows are pre-filtered by fromP..toP, so values outside the range are 0
    // and a full-array reduction equals the in-range sum.
    function rangeTotal(arr) {
      return arr.reduce(function (a, b) { return a + b; }, 0);
    }
    var entries = Object.keys(agg.matrix).map(function (k) {
      return { idx: parseInt(k, 10), series: agg.matrix[k], total: rangeTotal(agg.matrix[k]) };
    }).sort(function (a, b) { return b.total - a.total; });

    var TOP = 7;
    var top = entries.slice(0, TOP);
    var rest = entries.slice(TOP);

    var datasets = top.map(function (e, i) {
      var color = PALETTE[i % PALETTE.length];
      var name = labelLookup[e.idx];
      if (withCountryCode) name = name + ' (' + DATA.countries[e.idx] + ')';
      return {
        label: name,
        data: e.series.slice(fromP, toP + 1),
        borderColor: color,
        backgroundColor: color,
        borderWidth: 2,
        tension: 0.25,
        pointRadius: 2,
        fill: false
      };
    });

    if (rest.length > 0) {
      var otherSeries = new Array(toP - fromP + 1).fill(0);
      rest.forEach(function (e) {
        for (var i = fromP; i <= toP; i++) otherSeries[i - fromP] += e.series[i];
      });
      datasets.push({
        label: L.other + ' (' + rest.length + ')',
        data: otherSeries,
        borderColor: '#9aa0a6',
        backgroundColor: '#9aa0a6',
        borderWidth: 1.5,
        borderDash: [2, 3],
        tension: 0.25,
        pointRadius: 2,
        fill: false
      });
    }

    CHARTS.time = new Chart(ctx, {
      type: 'line',
      data: { labels: labels, datasets: datasets },
      options: commonChartOptions()
    });
  }

  function renderRateOverTime(agg) {
    destroy('rate');
    var ctx = document.getElementById('td-chart-rate');
    if (!ctx) return;
    var fromP = FILTERS.fromPeriod, toP = FILTERS.toPeriod;
    var labels = DATA.periodLabels.slice(fromP, toP + 1);
    var rates = [];
    for (var i = fromP; i <= toP; i++) {
      var req = agg.byPeriod[i];
      var rem = agg.byPeriodRemoved[i];
      rates.push(req > 0 ? +(rem / req * 100).toFixed(2) : null);
    }
    var textColor = chartTextColor();
    var gridColor = chartGridColor();
    CHARTS.rate = new Chart(ctx.getContext('2d'), {
      type: 'line',
      data: {
        labels: labels,
        datasets: [{
          label: L.metricRate,
          data: rates,
          borderColor: BRAND_DARK,
          backgroundColor: 'rgba(30,114,104,0.12)',
          borderWidth: 2,
          tension: 0.25,
          pointRadius: 3,
          fill: true,
          spanGaps: true
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: { duration: 250 },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) {
            return ctx.parsed.y == null ? '–' : ctx.parsed.y.toFixed(1) + '%';
          } } }
        },
        scales: {
          x: { ticks: { color: textColor }, grid: { color: gridColor } },
          y: {
            beginAtZero: true,
            suggestedMax: 100,
            ticks: { color: textColor, callback: function (v) { return v + '%'; } },
            grid: { color: gridColor }
          }
        }
      }
    });
  }

  function renderHBar(name, canvasId, agg, dim, labels, n, color) {
    destroy(name);
    var top = topN(agg, n, labels);
    var ctx = document.getElementById(canvasId).getContext('2d');
    var textColor = chartTextColor();
    var gridColor = chartGridColor();
    CHARTS[name] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: top.labels,
        datasets: [{ label: L.itemsRequested, data: top.values, backgroundColor: color, borderRadius: 3 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return fmt(ctx.parsed.x); } } }
        },
        scales: {
          x: { ticks: { color: textColor, callback: function (v) { return fmt(v); } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { display: false } }
        }
      }
    });
  }

  function renderCountries(agg) {
    var labels = DATA.countries.map(function (code, i) {
      return DATA.country_names[i] + ' (' + code + ')';
    });
    renderHBar('countries', 'td-chart-countries', agg.byCountry, 'country', labels, 10, BRAND);
  }
  function renderProducts(agg) {
    renderHBar('products', 'td-chart-products', agg.byProduct, 'product', DATA.products, 10, BRAND_LIGHT);
  }

  function renderReasons(agg) {
    destroy('reasons');
    var top = topN(agg.byReason, 8, DATA.reasons);
    var ctx = document.getElementById('td-chart-reasons').getContext('2d');
    var textColor = chartTextColor();
    CHARTS.reasons = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: top.labels,
        datasets: [{ data: top.values, backgroundColor: PALETTE, borderColor: getCssVar('--bg-elevated', '#fff'), borderWidth: 2 }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '55%',
        plugins: {
          legend: { position: 'right', labels: { color: textColor, font: { size: 11 }, boxWidth: 12 } },
          tooltip: { callbacks: { label: function (ctx) {
            var sum = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
            var v = ctx.parsed;
            return ctx.label + ': ' + fmt(v) + ' (' + (sum > 0 ? ((v/sum)*100).toFixed(1) : '0') + '%)';
          } } }
        }
      }
    });
  }

  function renderCompliance(agg) {
    destroy('comp');
    var t = agg.totals;
    var ctx = document.getElementById('td-chart-compliance').getContext('2d');
    var data = [t.legal, t.policy, t.already, t.notFound, t.notEnough, t.noAction];
    var labels = [L.respLegal, L.respPolicy, L.respAlready, L.respNotFound, L.respNotEnough, L.respNoAction];
    var textColor = chartTextColor();
    var gridColor = chartGridColor();
    CHARTS.comp = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [{ data: data, backgroundColor: [BRAND_DARK, BRAND, BRAND_LIGHT, '#e9c46a', '#f4a261', '#e76f51'], borderRadius: 3 }]
      },
      options: {
        indexAxis: 'y',
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) {
            var sum = ctx.dataset.data.reduce(function (a, b) { return a + b; }, 0);
            return fmt(ctx.parsed.x) + (sum > 0 ? ' (' + ((ctx.parsed.x/sum)*100).toFixed(1) + '%)' : '');
          } } }
        },
        scales: {
          x: { ticks: { color: textColor, callback: function (v) { return fmt(v); } }, grid: { color: gridColor } },
          y: { ticks: { color: textColor }, grid: { display: false } }
        }
      }
    });
  }

  function renderTable(rows) {
    var sorted = rows.slice().sort(function (a, b) { return b[6] - a[6]; }).slice(0, 25);
    var tbody = document.getElementById('td-table-body');
    if (sorted.length === 0) {
      tbody.innerHTML = '<tr><td colspan="7" class="td-empty">' + L.empty + '</td></tr>';
      return;
    }
    tbody.innerHTML = sorted.map(function (r) {
      var removed = r[7] + r[8] + r[12];
      return '<tr>' +
        '<td>' + DATA.periodLabels[r[0]] + '</td>' +
        '<td>' + DATA.country_names[r[1]] + '</td>' +
        '<td>' + DATA.requestors[r[2]] + '</td>' +
        '<td>' + DATA.products[r[3]] + '</td>' +
        '<td>' + DATA.reasons[r[4]] + '</td>' +
        '<td class="td-num">' + fmt(r[6]) + '</td>' +
        '<td class="td-num">' + fmt(removed) + '</td>' +
        '</tr>';
    }).join('');
    document.getElementById('td-row-count').textContent = fmt(rows.length) + ' ' + L.shown;
  }

  function refresh() {
    var rows = filteredRows();
    var agg = aggregate(rows);
    renderMetrics(agg);
    renderTimeseries(agg);
    renderRateOverTime(agg);
    renderCountries(agg);
    renderReasons(agg);
    renderProducts(agg);
    renderCompliance(agg);
    renderTable(rows);
  }

  // ───────── Filter UI wiring ─────────
  function buildSelect(id, items, anyLabel, withIndex) {
    var sel = document.getElementById(id);
    var opts = ['<option value="-1">' + anyLabel + '</option>'];
    var pairs = items.map(function (label, i) {
      return { label: withIndex ? withIndex(label, i) : label, idx: i };
    });
    pairs.sort(function (a, b) {
      return a.label.localeCompare(b.label, lang === 'ja' ? 'ja' : 'en');
    });
    pairs.forEach(function (p) {
      opts.push('<option value="' + p.idx + '">' + p.label + '</option>');
    });
    sel.innerHTML = opts.join('');
  }

  function buildPeriodSelects() {
    var fromSel = document.getElementById('td-from');
    var toSel = document.getElementById('td-to');
    var opts = DATA.periodLabels.map(function (label, i) {
      return '<option value="' + i + '">' + label + '</option>';
    }).join('');
    fromSel.innerHTML = opts;
    toSel.innerHTML = opts;
    fromSel.value = '0';
    toSel.value = String(DATA.periods.length - 1);
    FILTERS.fromPeriod = 0;
    FILTERS.toPeriod = DATA.periods.length - 1;
  }

  function buildBreakdownSelect() {
    var sel = document.getElementById('td-breakdown');
    if (!sel) return;
    sel.innerHTML = [
      '<option value="none">' + L.bdNone + '</option>',
      '<option value="country">' + L.bdCountry + '</option>',
      '<option value="requestor">' + L.bdRequestor + '</option>',
      '<option value="product">' + L.bdProduct + '</option>',
      '<option value="reason">' + L.bdReason + '</option>'
    ].join('');
    sel.value = 'none';
  }

  function wireFilters() {
    document.getElementById('td-from').addEventListener('change', function (e) {
      FILTERS.fromPeriod = parseInt(e.target.value, 10);
      if (FILTERS.fromPeriod > FILTERS.toPeriod) {
        FILTERS.toPeriod = FILTERS.fromPeriod;
        document.getElementById('td-to').value = String(FILTERS.toPeriod);
      }
      refresh();
    });
    document.getElementById('td-to').addEventListener('change', function (e) {
      FILTERS.toPeriod = parseInt(e.target.value, 10);
      if (FILTERS.toPeriod < FILTERS.fromPeriod) {
        FILTERS.fromPeriod = FILTERS.toPeriod;
        document.getElementById('td-from').value = String(FILTERS.fromPeriod);
      }
      refresh();
    });
    [['td-country','country'], ['td-requestor','requestor'], ['td-product','product'], ['td-reason','reason']]
      .forEach(function (pair) {
        document.getElementById(pair[0]).addEventListener('change', function (e) {
          FILTERS[pair[1]] = parseInt(e.target.value, 10);
          refresh();
        });
      });
    var bd = document.getElementById('td-breakdown');
    if (bd) {
      bd.addEventListener('change', function (e) {
        FILTERS.breakdownBy = e.target.value;
        refresh();
      });
    }
    document.getElementById('td-reset').addEventListener('click', function () {
      FILTERS.fromPeriod = 0;
      FILTERS.toPeriod = DATA.periods.length - 1;
      FILTERS.country = FILTERS.requestor = FILTERS.product = FILTERS.reason = -1;
      FILTERS.breakdownBy = 'none';
      document.getElementById('td-from').value = '0';
      document.getElementById('td-to').value = String(DATA.periods.length - 1);
      document.getElementById('td-country').value = '-1';
      document.getElementById('td-requestor').value = '-1';
      document.getElementById('td-product').value = '-1';
      document.getElementById('td-reason').value = '-1';
      if (bd) bd.value = 'none';
      refresh();
    });
  }

  // Re-render charts on theme toggle so colors update.
  function watchTheme() {
    var obs = new MutationObserver(function () {
      if (DATA) refresh();
    });
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  }

  // ───────── Boot ─────────
  function boot() {
    fetch('/data/google-government-removals.json')
      .then(function (r) { if (!r.ok) throw new Error('HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        DATA = json;
        DATA.periodLabels = DATA.periods.map(periodLabel);
        document.getElementById('td-loading').hidden = true;
        document.getElementById('td-app').hidden = false;
        buildPeriodSelects();
        buildBreakdownSelect();
        buildSelect('td-country', DATA.countries, L.anyCountry, function (code, i) {
          return DATA.country_names[i] + ' (' + code + ')';
        });
        buildSelect('td-requestor', DATA.requestors, L.anyRequestor);
        buildSelect('td-product', DATA.products, L.anyProduct);
        buildSelect('td-reason', DATA.reasons, L.anyReason);
        wireFilters();
        watchTheme();
        refresh();
      })
      .catch(function (err) {
        var el = document.getElementById('td-loading');
        if (el) el.textContent = L.loadError + ' (' + err.message + ')';
      });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
