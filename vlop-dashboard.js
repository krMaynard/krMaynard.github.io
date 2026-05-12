/* VLOP DSA Transparency Dashboard
 * Loads /data/vlop-dsa.json and renders comparative charts across Google services.
 *
 * Data schema:
 *   t3 row: [svcIdx, catIdx, scopeIdx, ordersAct, items, ordersInfo]
 *   t4 row: [svcIdx, catIdx, notices, tfNotices, items, tfItems, median, tfMedian, actLaw, tfActLaw, actTC, tfActTC]
 *   t5 row: [svcIdx, catIdx, measures, automated, removal, disable, demoted, ageRestr,
 *            interaction, labelled, visOther, monSusp, monTerm, monOther, svcSusp, svcTerm, accSusp, accTerm]
 *   t6 row: same layout as t5 but catIdx references categories (TC)
 *   t7 row: [svcIdx, secIdx, indIdx, scopeIdx, value]
 */
(function () {
  'use strict';

  var D; // loaded dataset
  var charts = {}; // active Chart.js instances
  var currentTab = 't4';

  var SERVICE_COLORS = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948'
  ];

  // ── Bootstrap ───────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    fetch('/data/vlop-dsa.json')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        D = data;
        document.getElementById('vlop-loading').hidden = true;
        document.getElementById('vlop-app').hidden = false;
        document.getElementById('vlop-readme').hidden = false;
        init();
      })
      .catch(function () {
        document.getElementById('vlop-loading').textContent = 'Could not load dataset.';
      });
  });

  function init() {
    buildServiceFilter();
    buildCategoryFilter('t4');
    wireTabButtons();
    wireFilters();
    render();
  }

  // ── Filters ──────────────────────────────────────────────────
  function buildServiceFilter() {
    var sel = document.getElementById('vlop-service');
    sel.innerHTML = '<option value="">All services</option>';
    D.services.forEach(function (s, i) {
      sel.innerHTML += '<option value="' + i + '">' + s + '</option>';
    });
  }

  function buildCategoryFilter(tab) {
    var sel = document.getElementById('vlop-category');
    var wrap = document.getElementById('vlop-cat-wrap');
    if (tab === 't7') { wrap.hidden = true; return; }
    wrap.hidden = false;
    sel.innerHTML = '<option value="">All categories</option>';

    // Collect categories that appear in the current tab's data
    var seen = {};
    var rows = D[tab] || [];
    rows.forEach(function (r) { seen[r[1]] = true; });

    D.categories.forEach(function (code, i) {
      if (!seen[i]) return;
      var label = D.category_labels[code] || code;
      sel.innerHTML += '<option value="' + i + '">' + label + '</option>';
    });
  }

  function getFilters() {
    var svcVal = document.getElementById('vlop-service').value;
    var catVal = document.getElementById('vlop-category').value;
    return {
      svc: svcVal === '' ? null : parseInt(svcVal),
      cat: catVal === '' ? null : parseInt(catVal),
    };
  }

  function wireTabButtons() {
    document.querySelectorAll('.vlop-tab').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.vlop-tab').forEach(function (b) {
          b.classList.remove('vlop-tab-active');
        });
        btn.classList.add('vlop-tab-active');
        currentTab = btn.dataset.tab;
        buildCategoryFilter(currentTab);
        document.getElementById('vlop-category').value = '';
        render();
      });
    });
  }

  function wireFilters() {
    document.getElementById('vlop-service').addEventListener('change', render);
    document.getElementById('vlop-category').addEventListener('change', render);
    document.getElementById('vlop-reset').addEventListener('click', function () {
      document.getElementById('vlop-service').value = '';
      document.getElementById('vlop-category').value = '';
      render();
    });
  }

  // ── Render dispatcher ────────────────────────────────────────
  function render() {
    destroyCharts();
    var f = getFilters();
    if (currentTab === 't4') renderT4(f);
    else if (currentTab === 't5') renderT5(f);
    else if (currentTab === 't6') renderT6(f);
    else if (currentTab === 't3') renderT3(f);
    else if (currentTab === 't7') renderT7(f);
  }

  // ── T4: Notices ──────────────────────────────────────────────
  function renderT4(f) {
    // Use TOTAL rows for service-level comparison when no category selected
    var catFilter = f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL');
    var rows = D.t4.filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === catFilter;
    });

    // Aggregate by service
    var bySvc = aggregateBySvc(rows, function (r) {
      return { notices: n(r[2]), tfNotices: n(r[3]), items: n(r[4]),
               actLaw: n(r[8]), actTC: n(r[10]) };
    }, function (a, b) {
      return { notices: a.notices + b.notices, tfNotices: a.tfNotices + b.tfNotices,
               items: a.items + b.items, actLaw: a.actLaw + b.actLaw, actTC: a.actTC + b.actTC };
    });

    var totals = sumObj(bySvc);
    var actionTotal = totals.actLaw + totals.actTC;
    var actionRate = totals.notices > 0 ? pct(actionTotal / totals.notices) : '—';

    setMetrics([
      { label: 'Notices received', value: fmt(totals.notices) },
      { label: 'Items referenced', value: fmt(totals.items) },
      { label: 'Actions taken', value: fmt(actionTotal) },
      { label: 'Action rate', value: actionRate },
      { label: 'Trusted flagger notices', value: fmt(totals.tfNotices) },
    ]);

    var svcs = D.services;
    var noticeData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].notices : 0; });
    var actLawData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].actLaw : 0; });
    var actTCData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].actTC : 0; });

    setCharts([
      {
        title: 'Notices received by service',
        id: 'vlop-c1', type: 'bar', wide: true,
        labels: filteredLabels(f.svc), datasets: [{
          label: 'Notices',
          data: filteredData(noticeData, f.svc),
          backgroundColor: filteredColors(f.svc),
        }]
      },
      {
        title: 'Actions taken by legal basis',
        id: 'vlop-c2', type: 'bar', wide: true,
        labels: filteredLabels(f.svc),
        datasets: [
          { label: 'Removed (law)', data: filteredData(actLawData, f.svc), backgroundColor: '#4e79a7' },
          { label: 'Removed (policy)', data: filteredData(actTCData, f.svc), backgroundColor: '#f28e2b' },
        ]
      },
    ]);

    // Category breakdown (non-TOTAL)
    if (f.cat === null) {
      renderCategoryBreakdown('t4', f.svc, function (r) { return n(r[2]); }, 'Notices received');
    }

    // Details table
    var tableRows = D.t4.filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === catFilter;
    });
    showTable(
      ['Service', 'Notices received', 'Trusted flagger', 'Items', 'Median time (hrs)', 'Actions (law)', 'Actions (policy)'],
      tableRows.map(function (r) {
        return [D.services[r[0]], fmt(r[2]), fmt(r[3]), fmt(r[4]), fmt(r[6]), fmt(r[8]), fmt(r[10])];
      }),
      'Notices — ' + catLabel(catFilter)
    );
  }

  // ── T5: Own-initiative illegal ────────────────────────────────
  function renderT5(f) {
    renderT5T6(f, 't5', 'Own-initiative illegal content actions');
  }

  // ── T6: Own-initiative TC ─────────────────────────────────────
  function renderT6(f) {
    renderT5T6(f, 't6', 'Own-initiative policy enforcement actions');
  }

  function renderT5T6(f, tab, tabTitle) {
    var catFilter = f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL');
    var rows = (D[tab] || []).filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === catFilter;
    });

    var bySvc = aggregateBySvc(rows, function (r) {
      return { measures: n(r[2]), automated: n(r[3]),
               removal: n(r[4]), accSusp: n(r[16]), accTerm: n(r[17]) };
    }, function (a, b) {
      return { measures: a.measures + b.measures, automated: a.automated + b.automated,
               removal: a.removal + b.removal, accSusp: a.accSusp + b.accSusp,
               accTerm: a.accTerm + b.accTerm };
    });

    var totals = sumObj(bySvc);
    var autoRate = totals.measures > 0 ? pct(totals.automated / totals.measures) : '—';

    setMetrics([
      { label: 'Total measures', value: fmt(totals.measures) },
      { label: 'Automated detection', value: fmt(totals.automated) },
      { label: 'Automation rate', value: autoRate },
      { label: 'Content removals', value: fmt(totals.removal) },
      { label: 'Account restrictions', value: fmt(totals.accSusp + totals.accTerm) },
    ]);

    var svcs = D.services;
    var measData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].measures : 0; });
    var autoData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].automated : 0; });

    // Action type breakdown aggregated across services (or for selected service)
    var actionRows = (D[tab] || []).filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === catFilter;
    });
    var actionTotals = {
      removal: 0, disable: 0, demoted: 0, ageRestr: 0,
      interaction: 0, labelled: 0, visOther: 0,
      monSusp: 0, monTerm: 0, svcSusp: 0, svcTerm: 0,
      accSusp: 0, accTerm: 0
    };
    actionRows.forEach(function (r) {
      actionTotals.removal += n(r[4]);
      actionTotals.disable += n(r[5]);
      actionTotals.demoted += n(r[6]);
      actionTotals.ageRestr += n(r[7]);
      actionTotals.interaction += n(r[8]);
      actionTotals.labelled += n(r[9]);
      actionTotals.visOther += n(r[10]);
      actionTotals.monSusp += n(r[11]);
      actionTotals.monTerm += n(r[12]);
      actionTotals.svcSusp += n(r[14]);
      actionTotals.svcTerm += n(r[15]);
      actionTotals.accSusp += n(r[16]);
      actionTotals.accTerm += n(r[17]);
    });

    var actionLabels = ['Removal', 'Disable', 'Demoted', 'Age restricted',
                        'Interaction restricted', 'Labelled', 'Vis. other',
                        'Monetary susp.', 'Monetary term.',
                        'Service susp.', 'Service term.',
                        'Account susp.', 'Account term.'];
    var actionData = [
      actionTotals.removal, actionTotals.disable, actionTotals.demoted, actionTotals.ageRestr,
      actionTotals.interaction, actionTotals.labelled, actionTotals.visOther,
      actionTotals.monSusp, actionTotals.monTerm,
      actionTotals.svcSusp, actionTotals.svcTerm,
      actionTotals.accSusp, actionTotals.accTerm
    ].filter(function (v) { return v > 0; });
    var actionLabelsFiltered = actionLabels.filter(function (_, i) {
      return [
        actionTotals.removal, actionTotals.disable, actionTotals.demoted, actionTotals.ageRestr,
        actionTotals.interaction, actionTotals.labelled, actionTotals.visOther,
        actionTotals.monSusp, actionTotals.monTerm,
        actionTotals.svcSusp, actionTotals.svcTerm,
        actionTotals.accSusp, actionTotals.accTerm
      ][i] > 0;
    });

    setCharts([
      {
        title: 'Total measures by service',
        id: 'vlop-c1', type: 'bar', wide: false,
        labels: filteredLabels(f.svc), datasets: [{
          label: 'Measures',
          data: filteredData(measData, f.svc),
          backgroundColor: filteredColors(f.svc),
        }]
      },
      {
        title: 'Automated vs total measures',
        id: 'vlop-c2', type: 'bar', wide: false,
        labels: filteredLabels(f.svc),
        datasets: [
          { label: 'Automated', data: filteredData(autoData, f.svc), backgroundColor: '#4e79a7' },
          { label: 'All measures', data: filteredData(measData, f.svc), backgroundColor: '#ddd', order: 2 },
        ]
      },
      {
        title: 'Action types applied',
        id: 'vlop-c3', type: 'bar', wide: true,
        labels: actionLabelsFiltered,
        datasets: [{ label: 'Count', data: actionData,
          backgroundColor: actionLabelsFiltered.map(function (_, i) {
            return SERVICE_COLORS[i % SERVICE_COLORS.length];
          })
        }]
      },
    ]);

    if (f.cat === null) {
      renderCategoryBreakdown(tab, f.svc, function (r) { return n(r[2]); }, 'Total measures');
    }

    showTable(
      ['Service', 'Total measures', 'Automated', 'Removals', 'Account susp.', 'Account term.'],
      rows.map(function (r) {
        return [D.services[r[0]], fmt(r[2]), fmt(r[3]), fmt(r[4]), fmt(r[16]), fmt(r[17])];
      }),
      tabTitle + ' — ' + catLabel(catFilter)
    );
  }

  // ── T3: Government orders ─────────────────────────────────────
  function renderT3(f) {
    var catFilter = f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL');
    var rows = D.t3.filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === catFilter;
    });

    var bySvc = aggregateBySvc(rows, function (r) {
      return { ordersAct: n(r[3]), items: n(r[4]), ordersInfo: n(r[5]) };
    }, function (a, b) {
      return { ordersAct: a.ordersAct + b.ordersAct, items: a.items + b.items,
               ordersInfo: a.ordersInfo + b.ordersInfo };
    });

    var totals = sumObj(bySvc);
    setMetrics([
      { label: 'Orders to act', value: fmt(totals.ordersAct) },
      { label: 'Items in orders', value: fmt(totals.items) },
      { label: 'Orders for user info', value: fmt(totals.ordersInfo) },
    ]);

    var svcs = D.services;
    var orderData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].ordersAct : 0; });
    var infoData = svcs.map(function (_, i) { return bySvc[i] ? bySvc[i].ordersInfo : 0; });

    setCharts([
      {
        title: 'Orders to act against illegal content',
        id: 'vlop-c1', type: 'bar', wide: true,
        labels: filteredLabels(f.svc),
        datasets: [
          { label: 'Orders to act', data: filteredData(orderData, f.svc), backgroundColor: '#4e79a7' },
          { label: 'Orders for user info', data: filteredData(infoData, f.svc), backgroundColor: '#f28e2b' },
        ]
      },
    ]);

    if (f.cat === null) {
      renderCategoryBreakdown('t3', f.svc, function (r) { return n(r[3]); }, 'Orders to act');
    }

    showTable(
      ['Service', 'Orders to act', 'Items', 'Orders for info'],
      rows.map(function (r) {
        return [D.services[r[0]], fmt(r[3]), fmt(r[4]), fmt(r[5])];
      }),
      'Government orders — ' + catLabel(catFilter)
    );
  }

  // ── T7: Appeals ───────────────────────────────────────────────
  function renderT7(f) {
    // Section 0 = Internal complaints mechanism
    // Scope: 0=Total, 1=Upheld, 2=Reversed, 3=Median time, 4=Decision omitted
    var secInternal = indexOf(D.sections, 'Internal complaints mechanism');
    var indComplaints = indexOf(D.indicators, 'Number of complaints submitted to the internal-complaints mechanism');
    var scopeTotal = indexOf(D.scopes, 'Total number');
    var scopeUpheld = indexOf(D.scopes, 'Decisions upheld');
    var scopeReversed = indexOf(D.scopes, 'Decisions reversed');

    var secSuspensions = indexOf(D.sections, 'Suspensions imposed on repeated offenders');

    function t7val(svcIdx, sec, ind, scope) {
      var row = D.t7.find(function (r) {
        return r[0] === svcIdx && r[1] === sec && r[2] === ind && r[3] === scope;
      });
      return row ? n(row[4]) : 0;
    }

    var totalComplaints = 0, totalUpheld = 0, totalReversed = 0;
    D.services.forEach(function (_, i) {
      if (f.svc !== null && i !== f.svc) return;
      totalComplaints += t7val(i, secInternal, indComplaints, scopeTotal);
      totalUpheld += t7val(i, secInternal, indComplaints, scopeUpheld);
      totalReversed += t7val(i, secInternal, indComplaints, scopeReversed);
    });

    setMetrics([
      { label: 'Total complaints', value: fmt(totalComplaints) },
      { label: 'Decisions upheld', value: fmt(totalUpheld) },
      { label: 'Decisions reversed', value: fmt(totalReversed) },
      { label: 'Uphold rate', value: totalComplaints > 0 ? pct(totalUpheld / totalComplaints) : '—' },
      { label: 'Reversal rate', value: totalComplaints > 0 ? pct(totalReversed / totalComplaints) : '—' },
    ]);

    var svcLabels = filteredLabels(f.svc);
    var complaintData = D.services.map(function (_, i) {
      return t7val(i, secInternal, indComplaints, scopeTotal);
    });
    var upheldData = D.services.map(function (_, i) {
      return t7val(i, secInternal, indComplaints, scopeUpheld);
    });
    var reversedData = D.services.map(function (_, i) {
      return t7val(i, secInternal, indComplaints, scopeReversed);
    });

    setCharts([
      {
        title: 'Internal complaints by service',
        id: 'vlop-c1', type: 'bar', wide: true,
        labels: svcLabels,
        datasets: [{ label: 'Total complaints',
          data: filteredData(complaintData, f.svc),
          backgroundColor: filteredColors(f.svc) }]
      },
      {
        title: 'Complaint outcomes by service',
        id: 'vlop-c2', type: 'bar', wide: true,
        labels: svcLabels,
        datasets: [
          { label: 'Upheld', data: filteredData(upheldData, f.svc), backgroundColor: '#4e79a7' },
          { label: 'Reversed', data: filteredData(reversedData, f.svc), backgroundColor: '#e15759' },
        ]
      },
    ]);

    // Table: all T7 rows for selected service, section=internal
    var tableRows = D.t7.filter(function (r) {
      return (f.svc === null || r[0] === f.svc) && r[1] === secInternal;
    });
    showTable(
      ['Service', 'Indicator', 'Scope', 'Value'],
      tableRows.map(function (r) {
        return [D.services[r[0]], D.indicators[r[2]], D.scopes[r[3]], fmt(r[4])];
      }),
      'Internal complaints mechanism'
    );
  }

  // ── Category breakdown helper ─────────────────────────────────
  function renderCategoryBreakdown(tab, svcFilter, valueFn, metricLabel) {
    var rows = (D[tab] || []).filter(function (r) {
      return (svcFilter === null || r[0] === svcFilter) &&
             D.categories[r[1]] !== 'TOTAL';
    });

    var byCat = {};
    rows.forEach(function (r) {
      var ci = r[1];
      byCat[ci] = (byCat[ci] || 0) + valueFn(r);
    });

    var sorted = Object.keys(byCat)
      .map(function (k) { return { idx: parseInt(k), val: byCat[k] }; })
      .filter(function (x) { return x.val > 0; })
      .sort(function (a, b) { return b.val - a.val; })
      .slice(0, 10);

    if (sorted.length === 0) return;

    var catLabels = sorted.map(function (x) { return shortCatLabel(x.idx); });
    var catData = sorted.map(function (x) { return x.val; });

    var chartsEl = document.getElementById('vlop-charts');
    var wrap = document.createElement('div');
    wrap.className = 'td-chart-card td-chart-card-wide';
    wrap.innerHTML = '<h3>Top 10 categories by ' + metricLabel.toLowerCase() + '</h3>' +
      '<div class="td-chart-wrap td-chart-tall"><canvas id="vlop-cat-chart"></canvas></div>';
    chartsEl.appendChild(wrap);

    var ctx = document.getElementById('vlop-cat-chart').getContext('2d');
    charts['vlop-cat-chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: catLabels,
        datasets: [{
          label: metricLabel,
          data: catData,
          backgroundColor: catLabels.map(function (_, i) {
            return SERVICE_COLORS[i % SERVICE_COLORS.length];
          }),
        }]
      },
      options: chartOpts({ indexAxis: 'y', maintainAspectRatio: false })
    });
  }

  // ── UI helpers ────────────────────────────────────────────────
  function setMetrics(items) {
    var el = document.getElementById('vlop-metrics');
    el.innerHTML = items.map(function (m) {
      return '<div class="td-metric"><div class="td-metric-value">' + m.value +
             '</div><div class="td-metric-label">' + m.label + '</div></div>';
    }).join('');
  }

  function setCharts(specs) {
    var el = document.getElementById('vlop-charts');
    el.innerHTML = '';
    specs.forEach(function (spec) {
      var div = document.createElement('div');
      div.className = 'td-chart-card' + (spec.wide ? ' td-chart-card-wide' : '');
      div.innerHTML = '<h3>' + spec.title + '</h3>' +
        '<div class="td-chart-wrap"><canvas id="' + spec.id + '"></canvas></div>';
      el.appendChild(div);
    });
    specs.forEach(function (spec) {
      var ctx = document.getElementById(spec.id).getContext('2d');
      charts[spec.id] = new Chart(ctx, {
        type: spec.type,
        data: { labels: spec.labels, datasets: spec.datasets },
        options: chartOpts({ indexAxis: spec.type === 'bar' ? 'x' : 'x' })
      });
    });
  }

  function showTable(headers, rows, title) {
    var wrap = document.getElementById('vlop-table-wrap');
    wrap.hidden = false;
    document.getElementById('vlop-table-title').textContent = title;
    document.getElementById('vlop-row-count').textContent = rows.length + ' rows';
    var head = document.getElementById('vlop-table-head');
    head.innerHTML = headers.map(function (h) { return '<th>' + h + '</th>'; }).join('');
    var body = document.getElementById('vlop-table-body');
    body.innerHTML = rows.map(function (r) {
      return '<tr>' + r.map(function (c) { return '<td>' + (c || '—') + '</td>'; }).join('') + '</tr>';
    }).join('');
  }

  function destroyCharts() {
    Object.keys(charts).forEach(function (k) { charts[k].destroy(); });
    charts = {};
    document.getElementById('vlop-table-wrap').hidden = true;
    document.getElementById('vlop-metrics').innerHTML = '';
    document.getElementById('vlop-charts').innerHTML = '';
  }

  function chartOpts(extra) {
    var base = {
      responsive: true,
      plugins: {
        legend: { display: true, position: 'top' },
        tooltip: {
          callbacks: {
            label: function (ctx) {
              return ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw);
            }
          }
        }
      },
      scales: {
        x: { ticks: { font: { size: 11 } } },
        y: { ticks: { font: { size: 11 } } }
      }
    };
    Object.keys(extra || {}).forEach(function (k) { base[k] = extra[k]; });
    return base;
  }

  // ── Data helpers ──────────────────────────────────────────────
  function n(v) { return v == null ? 0 : v; }

  function fmt(v) {
    if (v == null) return '—';
    if (typeof v === 'number') return v.toLocaleString();
    return v;
  }

  function pct(v) {
    return (v * 100).toFixed(1) + '%';
  }

  function indexOf(arr, val) {
    return arr.indexOf(val);
  }

  function catLabel(catIdx) {
    var code = D.categories[catIdx];
    return D.category_labels[code] || code || 'Unknown';
  }

  function shortCatLabel(catIdx) {
    var label = catLabel(catIdx);
    return label.length > 35 ? label.slice(0, 33) + '…' : label;
  }

  function filteredLabels(svcFilter) {
    if (svcFilter !== null) return [D.services[svcFilter]];
    return D.services;
  }

  function filteredData(arr, svcFilter) {
    if (svcFilter !== null) return [arr[svcFilter]];
    return arr;
  }

  function filteredColors(svcFilter) {
    if (svcFilter !== null) return [SERVICE_COLORS[svcFilter]];
    return SERVICE_COLORS;
  }

  function aggregateBySvc(rows, extractFn, mergeFn) {
    var result = {};
    rows.forEach(function (r) {
      var si = r[0];
      var vals = extractFn(r);
      result[si] = result[si] ? mergeFn(result[si], vals) : vals;
    });
    return result;
  }

  function sumObj(bySvc) {
    var total = null;
    Object.values(bySvc).forEach(function (obj) {
      if (!total) {
        total = Object.assign({}, obj);
      } else {
        Object.keys(obj).forEach(function (k) { total[k] = (total[k] || 0) + obj[k]; });
      }
    });
    return total || {};
  }

}());
