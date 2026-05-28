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

  // ───────── Strings (en/ja/zh/ko) ─────────
  // The site's <html lang> is hardcoded in the layout, so detect from the URL path.
  var lang = /^\/zh(\/|$)/.test(window.location.pathname) ? 'zh'
           : /^\/ja(\/|$)/.test(window.location.pathname) ? 'ja'
           : /^\/ko(\/|$)/.test(window.location.pathname) ? 'ko'
           : 'en';
  var LOCALE = { en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' }[lang];
  var L = {
    en: {
      loading: 'Loading data…',
      loadError: 'Could not load dataset.',
      anyCountry: 'All',
      anyRequestor: 'All',
      anyProduct: 'All',
      anyReason: 'All',
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
      vsFirstPeriod: 'first → last period in range',
      unknown: 'Unknown'
    },
    ja: {
      loading: 'データ読み込み中…',
      loadError: 'データセットを読み込めませんでした。',
      anyCountry: 'すべて',
      anyRequestor: 'すべて',
      anyProduct: 'すべて',
      anyReason: 'すべて',
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
      vsFirstPeriod: '範囲の最初の期間 → 最後の期間',
      unknown: '不明'
    },
    zh: {
      loading: '加载数据中…',
      loadError: '无法加载数据集。',
      anyCountry: '全部',
      anyRequestor: '全部',
      anyProduct: '全部',
      anyReason: '全部',
      from: '起始',
      to: '结束',
      reset: '重置筛选',
      metricRequests: '政府请求数',
      metricItems: '请求删除的项目数',
      metricRemoved: '实际删除的项目数',
      metricRate: '删除率',
      metricCountries: '涉及国家数',
      metricPeriods: '报告期间数',
      chartTimeseries: '各报告期间的删除目标数量',
      chartCountries: '目标数量最多的前10个国家',
      chartReasons: '主要删除原因',
      chartProducts: '被针对的谷歌产品',
      chartCompliance: '谷歌的处理情况',
      respLegal: '依法删除',
      respPolicy: '依政策删除',
      respAlready: '内容已删除',
      respNotFound: '内容未找到',
      respNotEnough: '信息不足',
      respNoAction: '未采取行动',
      tableTitle: '筛选结果（按目标数量前25条）',
      colPeriod: '期间',
      colCountry: '国家',
      colRequestor: '申请方',
      colProduct: '产品',
      colReason: '原因',
      colItems: '目标数量',
      colRemoved: '已删除数量',
      empty: '当前筛选条件下没有匹配记录。',
      shown: '条记录',
      itemsRequested: '目标数量',
      itemsRemoved: '已删除数量',
      breakdownLabel: '分类维度',
      bdNone: '无（合计）',
      bdCountry: '国家',
      bdRequestor: '申请方类型',
      bdProduct: '谷歌产品',
      bdReason: '原因',
      other: '其他',
      removalRateOverTime: '删除率变化趋势',
      changeOverRange: '所选范围内的变化',
      trendUp: '上升',
      trendDown: '下降',
      trendFlat: '持平',
      vsFirstPeriod: '范围内首期 → 末期',
      unknown: '未知'
    },
    ko: {
      loading: '데이터 로딩 중…',
      loadError: '데이터셋을 불러올 수 없습니다.',
      anyCountry: '전체',
      anyRequestor: '전체',
      anyProduct: '전체',
      anyReason: '전체',
      from: '시작',
      to: '종료',
      reset: '필터 초기화',
      metricRequests: '정부 요청 건수',
      metricItems: '삭제 요청 항목 수',
      metricRemoved: '실제 삭제된 항목 수',
      metricRate: '삭제율',
      metricCountries: '대상 국가 수',
      metricPeriods: '보고 기간 수',
      chartTimeseries: '보고 기간별 삭제 요청 항목 수',
      chartCountries: '삭제 요청 항목 수 기준 상위 10개국',
      chartReasons: '주요 삭제 사유',
      chartProducts: '대상 Google 제품',
      chartCompliance: 'Google의 응답 분류',
      respLegal: '삭제 (법적)',
      respPolicy: '삭제 (정책)',
      respAlready: '이미 삭제됨',
      respNotFound: '콘텐츠를 찾을 수 없음',
      respNotEnough: '정보 불충분',
      respNoAction: '조치 없음',
      tableTitle: '필터링된 레코드 (요청 항목 수 기준 상위 25개)',
      colPeriod: '기간',
      colCountry: '국가',
      colRequestor: '요청자',
      colProduct: '제품',
      colReason: '사유',
      colItems: '요청 항목 수',
      colRemoved: '삭제 수',
      empty: '현재 필터 조건에 해당하는 레코드가 없습니다.',
      shown: '건',
      itemsRequested: '요청 항목',
      itemsRemoved: '삭제됨',
      breakdownLabel: '분류 기준',
      bdNone: '없음 (합계)',
      bdCountry: '국가',
      bdRequestor: '요청자 유형',
      bdProduct: 'Google 제품',
      bdReason: '사유',
      other: '기타',
      removalRateOverTime: '시간에 따른 삭제율',
      changeOverRange: '선택 범위 변화',
      trendUp: '증가',
      trendDown: '감소',
      trendFlat: '보합',
      vsFirstPeriod: '범위의 첫 기간 → 마지막 기간',
      unknown: '알 수 없음'
    }
  }[lang];

  // ───────── Data label translations (reasons, requestors, products) ─────────
  // Keyed by exact English source string from the data file. English maps are
  // implicit identity — only ja/zh/ko need entries. Anything missing falls
  // through to the English source string.
  var DATA_TR = {
    reasons: {
      ja: {
        'Defamation': '名誉毀損',
        'Fraud': '詐欺',
        'Religious offense': '宗教的侮辱',
        'National security': '国家安全保障',
        'Regulated goods and services': '規制対象商品・サービス',
        'Drug abuse': '薬物乱用',
        'Other': 'その他',
        'Trademark': '商標',
        'Copyright': '著作権',
        'Obscenity/Nudity': 'わいせつ・ヌード',
        'Privacy and security': 'プライバシー・セキュリティ',
        'Adult content': 'アダルトコンテンツ',
        'Hate speech': 'ヘイトスピーチ',
        'Bullying harassment': 'いじめ・ハラスメント',
        'Impersonation': 'なりすまし',
        'Electoral law': '選挙法',
        'Geographical dispute': '地理的紛争',
        'Government criticism': '政府批判',
        'Unspecified': '不明',
        'Business complaints': '企業からの苦情',
        'Violence': '暴力',
        'Suicide promotion': '自殺の助長'
      },
      zh: {
        'Defamation': '诽谤',
        'Fraud': '欺诈',
        'Religious offense': '宗教冒犯',
        'National security': '国家安全',
        'Regulated goods and services': '受监管商品与服务',
        'Drug abuse': '药物滥用',
        'Other': '其他',
        'Trademark': '商标',
        'Copyright': '版权',
        'Obscenity/Nudity': '淫秽/裸露',
        'Privacy and security': '隐私与安全',
        'Adult content': '成人内容',
        'Hate speech': '仇恨言论',
        'Bullying harassment': '欺凌骚扰',
        'Impersonation': '冒充',
        'Electoral law': '选举法',
        'Geographical dispute': '地理争议',
        'Government criticism': '批评政府',
        'Unspecified': '未指明',
        'Business complaints': '商业投诉',
        'Violence': '暴力',
        'Suicide promotion': '宣扬自杀'
      },
      ko: {
        'Defamation': '명예 훼손',
        'Fraud': '사기',
        'Religious offense': '종교 모독',
        'National security': '국가 안보',
        'Regulated goods and services': '규제 대상 상품·서비스',
        'Drug abuse': '약물 남용',
        'Other': '기타',
        'Trademark': '상표',
        'Copyright': '저작권',
        'Obscenity/Nudity': '음란물·노출',
        'Privacy and security': '프라이버시 및 보안',
        'Adult content': '성인 콘텐츠',
        'Hate speech': '혐오 표현',
        'Bullying harassment': '괴롭힘·따돌림',
        'Impersonation': '사칭',
        'Electoral law': '선거법',
        'Geographical dispute': '영토 분쟁',
        'Government criticism': '정부 비판',
        'Unspecified': '미지정',
        'Business complaints': '기업 민원',
        'Violence': '폭력',
        'Suicide promotion': '자살 조장'
      }
    },
    requestors: {
      ja: {
        'Court Order directed at 3rd party': '裁判所命令（第三者宛）',
        'Government Officials': '政府関係者',
        'Information and Communications Authority': '情報通信当局',
        'Other': 'その他',
        'Police': '警察',
        'Consumer Protection Authority': '消費者保護当局',
        'Court Order directed at Google': '裁判所命令（Google宛）',
        'Data Protection Authority': 'データ保護当局',
        'Military': '軍',
        'Supression Orders': '報道差止命令'
      },
      zh: {
        'Court Order directed at 3rd party': '法院命令（针对第三方）',
        'Government Officials': '政府官员',
        'Information and Communications Authority': '信息通信主管部门',
        'Other': '其他',
        'Police': '警方',
        'Consumer Protection Authority': '消费者保护主管部门',
        'Court Order directed at Google': '法院命令（针对谷歌）',
        'Data Protection Authority': '数据保护主管部门',
        'Military': '军方',
        'Supression Orders': '禁令'
      },
      ko: {
        'Court Order directed at 3rd party': '법원 명령 (제3자 대상)',
        'Government Officials': '정부 관계자',
        'Information and Communications Authority': '정보통신 당국',
        'Other': '기타',
        'Police': '경찰',
        'Consumer Protection Authority': '소비자 보호 당국',
        'Court Order directed at Google': '법원 명령 (Google 대상)',
        'Data Protection Authority': '데이터 보호 당국',
        'Military': '군',
        'Supression Orders': '보도 금지 명령'
      }
    },
    products: {
      // Most Google product names are recognized brand names worldwide and stay
      // as-is in localized UI (YouTube, Gmail, Maps, etc.). Only generic
      // descriptors and a few products with established localized names get
      // translated.
      ja: {
        'Web Search': 'ウェブ検索',
        'My Business Website': 'マイビジネスのウェブサイト',
        'Sites': 'サイト',
        'Play Apps': 'Play アプリ',
        'Local Photos': 'ローカルの写真',
        'Shopping': 'ショッピング',
        'Local Reviews': 'ローカルのクチコミ',
        'Other': 'その他',
        'Web Search Autocomplete': 'ウェブ検索のオートコンプリート',
        'Cloud Storage': 'クラウド ストレージ',
        'Knowledge Graph': 'ナレッジ グラフ',
        'Books': 'ブックス',
        'Groups': 'グループ',
        'News': 'ニュース',
        'Videos': '動画',
        'Local Posts': 'ローカルの投稿',
        'Places': 'プレイス',
        'Play Music': 'Play ミュージック',
        'Product Search': '商品検索'
      },
      zh: {
        'Web Search': '网页搜索',
        'My Business Website': '我的商家网站',
        'Sites': '协作平台',
        'Play Apps': 'Play 应用',
        'Local Photos': '本地照片',
        'Shopping': '购物',
        'Local Reviews': '本地评价',
        'Other': '其他',
        'Web Search Autocomplete': '网页搜索自动完成',
        'Cloud Storage': '云存储',
        'Knowledge Graph': '知识图谱',
        'Books': '图书',
        'Groups': '网上论坛',
        'News': '新闻',
        'Videos': '视频',
        'Local Posts': '本地帖子',
        'Places': '地点',
        'Play Music': 'Play 音乐',
        'Product Search': '商品搜索'
      },
      ko: {
        'Web Search': '웹 검색',
        'My Business Website': '비즈니스 웹사이트',
        'Sites': '사이트',
        'Play Apps': 'Play 앱',
        'Local Photos': '로컬 사진',
        'Shopping': '쇼핑',
        'Local Reviews': '로컬 리뷰',
        'Other': '기타',
        'Web Search Autocomplete': '웹 검색 자동완성',
        'Cloud Storage': '클라우드 스토리지',
        'Knowledge Graph': '지식 그래프',
        'Books': '도서',
        'Groups': '그룹스',
        'News': '뉴스',
        'Videos': '동영상',
        'Local Posts': '로컬 게시물',
        'Places': '장소',
        'Play Music': 'Play 뮤직',
        'Product Search': '상품 검색'
      }
    }
  };

  function trReason(s)    { return (lang !== 'en' && DATA_TR.reasons[lang][s])    || s; }
  function trRequestor(s) { return (lang !== 'en' && DATA_TR.requestors[lang][s]) || s; }
  function trProduct(s)   { return (lang !== 'en' && DATA_TR.products[lang][s])   || s; }

  // Country localization via Intl.DisplayNames (built-in CLDR data — no
  // need to maintain a 160-row table per language). Two non-ISO codes in the
  // dataset ('null' and 'EUROPOL') fall back to a localized "Unknown" label.
  var COUNTRY_FMT = (function () {
    if (lang === 'en' || typeof Intl === 'undefined' || !Intl.DisplayNames) return null;
    try { return new Intl.DisplayNames([LOCALE], { type: 'region' }); }
    catch (e) { return null; }
  })();
  function trCountryName(code, fallback) {
    if (lang === 'en') return fallback;
    if (!/^[A-Z]{2}$/.test(code)) return L.unknown || fallback;
    if (!COUNTRY_FMT) return fallback;
    try { return COUNTRY_FMT.of(code) || fallback; }
    catch (e) { return fallback; }
  }

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
    return n.toLocaleString(LOCALE);
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
    var bdTr = FILTERS.breakdownBy === 'reason'    ? trReason
             : FILTERS.breakdownBy === 'requestor' ? trRequestor
             : FILTERS.breakdownBy === 'product'   ? trProduct
             : null;

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
      if (withCountryCode) {
        var code = DATA.countries[e.idx];
        name = trCountryName(code, name) + ' (' + code + ')';
      } else if (bdTr) {
        name = bdTr(name);
      }
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
      return trCountryName(code, DATA.country_names[i]) + ' (' + code + ')';
    });
    renderHBar('countries', 'td-chart-countries', agg.byCountry, 'country', labels, 10, BRAND);
  }
  function renderProducts(agg) {
    var labels = DATA.products.map(trProduct);
    renderHBar('products', 'td-chart-products', agg.byProduct, 'product', labels, 10, BRAND_LIGHT);
  }

  function renderReasons(agg) {
    destroy('reasons');
    var reasonLabels = DATA.reasons.map(trReason);
    var top = topN(agg.byReason, 8, reasonLabels);
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
        '<td>' + trCountryName(DATA.countries[r[1]], DATA.country_names[r[1]]) + '</td>' +
        '<td>' + trRequestor(DATA.requestors[r[2]]) + '</td>' +
        '<td>' + trProduct(DATA.products[r[3]]) + '</td>' +
        '<td>' + trReason(DATA.reasons[r[4]]) + '</td>' +
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
      return a.label.localeCompare(b.label, LOCALE);
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
          return trCountryName(code, DATA.country_names[i]) + ' (' + code + ')';
        });
        buildSelect('td-requestor', DATA.requestors, L.anyRequestor, function (label) {
          return trRequestor(label);
        });
        buildSelect('td-product', DATA.products, L.anyProduct, function (label) {
          return trProduct(label);
        });
        buildSelect('td-reason', DATA.reasons, L.anyReason, function (label) {
          return trReason(label);
        });
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
