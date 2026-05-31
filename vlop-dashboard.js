/* VLOP DSA Transparency Dashboard
 * Loads /data/vlop-dsa.json and renders comparative charts across platforms/services.
 *
 * Data schema:
 *   t3 row: [svcIdx, catIdx, scopeIdx, ordersAct, items, ordersInfo]
 *   t4 row: [svcIdx, catIdx, notices, tfNotices, items, tfItems, median, tfMedian, actLaw, tfActLaw, actTC, tfActTC]
 *   t5 row: [svcIdx, catIdx, measures, automated, removal, disable, demoted, ageRestr,
 *            interaction, labelled, visOther, monSusp, monTerm, monOther, svcSusp, svcTerm, accSusp, accTerm]
 *   t6 row: same layout as t5, plus a trailing surfaceIdx (into `surfaces`)
 *   t7 row: [svcIdx, secIdx, indIdx, scopeIdx, value, surfaceIdx]
 *
 * `surfaces` lists report breakdowns for t6/t7 (index 0 = "All" = no breakdown).
 * Google publishes those tables as several disjoint sub-reports per service
 * (Core/Ads, and for Search a per-action-level split); rows are summed across
 * surfaces by default and can be isolated with the Surface filter.
 */
(function () {
  'use strict';

  var lang = /^\/zh(\/|$)/.test(window.location.pathname) ? 'zh'
           : /^\/ja(\/|$)/.test(window.location.pathname) ? 'ja'
           : /^\/ko(\/|$)/.test(window.location.pathname) ? 'ko'
           : 'en';
  var LOCALE = { en: 'en-US', ja: 'ja-JP', zh: 'zh-CN', ko: 'ko-KR' }[lang];

  var L = {
    en: {
      loading: 'Loading data…',
      loadError: 'Could not load dataset.',
      allPlatforms: 'All',
      allServices: 'All',
      allCategories: 'All',
      allKeywords: 'All',
      allSurfaces: 'All surfaces',
      topKeywords: 'Top keywords by ',
      reset: 'Reset filters',
      rows: 'rows',
      // tabs
      tabT4: 'Notices',
      tabT5: 'Own-initiative: Illegal',
      tabT6: 'Own-initiative: Policy',
      tabT3: 'Government Orders',
      tabT7: 'Appeals',
      // T4 metrics
      noticesReceived: 'Notices received',
      itemsReferenced: 'Items referenced',
      actionsTaken: 'Actions taken',
      actionRate: 'Action rate',
      tfNotices: 'Trusted flagger notices',
      // T4 charts
      noticesByService: 'Notices received by service',
      actionsByBasis: 'Actions taken by legal basis',
      removedLaw: 'Removed (law)',
      removedPolicy: 'Removed (policy)',
      // T4 table
      tNotices: 'Notices received', tTrusted: 'Trusted flagger',
      tItems: 'Items', tMedian: 'Median time (hrs)',
      tActLaw: 'Actions (law)', tActPolicy: 'Actions (policy)',
      tNoticesTitle: 'Notices — ',
      // T5/T6 metrics
      totalMeasures: 'Total measures',
      automatedDetection: 'Automated detection',
      automationRate: 'Automation rate',
      contentRemovals: 'Content removals',
      accountRestrictions: 'Account restrictions',
      // T5/T6 charts
      measuresByService: 'Total measures by service',
      automatedVsTotal: 'Automated vs total measures',
      automated: 'Automated',
      allMeasures: 'All measures',
      actionTypes: 'Action types applied',
      count: 'Count',
      measures: 'Measures',
      // T5/T6 action type labels
      aRemoval: 'Removal', aDisable: 'Disable', aDemoted: 'Demoted',
      aAgeRestr: 'Age restricted', aInteraction: 'Interaction restricted',
      aLabelled: 'Labelled', aVisOther: 'Vis. other',
      aMonSusp: 'Monetary susp.', aMonTerm: 'Monetary term.',
      aSvcSusp: 'Service susp.', aSvcTerm: 'Service term.',
      aAccSusp: 'Account susp.', aAccTerm: 'Account term.',
      // T5/T6 table
      tMeasures: 'Total measures', tAutomated: 'Automated',
      tRemovals: 'Removals', tAccSusp: 'Account susp.', tAccTerm: 'Account term.',
      t5Title: 'Own-initiative illegal content actions — ',
      t6Title: 'Own-initiative policy enforcement actions — ',
      // T3
      ordersToAct: 'Orders to act',
      itemsInOrders: 'Items in orders',
      ordersForInfo: 'Orders for user info',
      ordersChart: 'Orders to act against illegal content',
      ordersToActLabel: 'Orders to act',
      ordersForInfoLabel: 'Orders for user info',
      tOrdersAct: 'Orders to act', tItemsOrders: 'Items', tOrdersInfo: 'Orders for info',
      t3Title: 'Government orders — ',
      // T7
      totalComplaints: 'Total complaints',
      decisionsUpheld: 'Decisions upheld',
      decisionsReversed: 'Decisions reversed',
      upholdRate: 'Uphold rate',
      reversalRate: 'Reversal rate',
      overturnRate: 'Overturn rate by service',
      complaintsByService: 'Internal complaints by service',
      complaintOutcomes: 'Complaint outcomes by service',
      upheld: 'Upheld',
      reversed: 'Reversed',
      tIndicator: 'Indicator', tScope: 'Scope', tValue: 'Value',
      t7Title: 'Internal complaints mechanism',
      // shared
      tService: 'Service',
      topCategories: 'Top 10 categories by ',
      // VLOP/VLOSE designation timeline
      desigTitle: 'VLOP & VLOSE designations',
      desigIntro: 'Every platform and search engine designated under the EU DSA, by designation date. Stripchat was de-designated in May 2025; WhatsApp Channels was designated in January 2026, after this reporting period.',
      thPlatform: 'Platform', thType: 'Type', thDesignated: 'Designated', thStatus: 'Status',
      statusActive: 'Active', statusDeDesignated: 'De-designated',
    },
    ja: {
      loading: 'データ読み込み中…',
      loadError: 'データセットを読み込めませんでした。',
      allPlatforms: 'すべて',
      allServices: 'すべて',
      allCategories: 'すべて',
      allKeywords: 'すべて',
      allSurfaces: 'すべての区分',
      topKeywords: 'キーワード別トップ10（',
      reset: 'フィルタをリセット',
      rows: '件',
      tabT4: '通知',
      tabT5: '自主的措置：違法コンテンツ',
      tabT6: '自主的措置：ポリシー違反',
      tabT3: '政府命令',
      tabT7: '異議申立',
      noticesReceived: '受信した通知数',
      itemsReferenced: '対象アイテム数',
      actionsTaken: '講じた措置数',
      actionRate: '措置率',
      tfNotices: '信頼できるフラッガーからの通知',
      noticesByService: 'サービス別・受信通知数',
      actionsByBasis: '法的根拠別・措置数',
      removedLaw: '削除（法律）',
      removedPolicy: '削除（ポリシー）',
      tNotices: '受信通知数', tTrusted: '信頼できるフラッガー',
      tItems: 'アイテム数', tMedian: '処理時間中央値（時間）',
      tActLaw: '措置数（法律）', tActPolicy: '措置数（ポリシー）',
      tNoticesTitle: '通知 — ',
      totalMeasures: '総措置数',
      automatedDetection: '自動検出数',
      automationRate: '自動化率',
      contentRemovals: 'コンテンツ削除数',
      accountRestrictions: 'アカウント制限数',
      measuresByService: 'サービス別・総措置数',
      automatedVsTotal: '自動措置数 vs 総措置数',
      automated: '自動',
      allMeasures: '全措置',
      actionTypes: '措置種別の内訳',
      count: '件数',
      measures: '措置数',
      aRemoval: '削除', aDisable: '無効化', aDemoted: '表示抑制',
      aAgeRestr: '年齢制限', aInteraction: 'インタラクション制限',
      aLabelled: 'ラベル付け', aVisOther: '可視性制限（その他）',
      aMonSusp: '収益停止', aMonTerm: '収益終了',
      aSvcSusp: 'サービス停止', aSvcTerm: 'サービス終了',
      aAccSusp: 'アカウント停止', aAccTerm: 'アカウント終了',
      tMeasures: '総措置数', tAutomated: '自動措置数',
      tRemovals: '削除数', tAccSusp: 'アカウント停止', tAccTerm: 'アカウント終了',
      t5Title: '自主的措置（違法コンテンツ）— ',
      t6Title: '自主的措置（ポリシー違反）— ',
      ordersToAct: '対処命令数',
      itemsInOrders: '命令内アイテム数',
      ordersForInfo: '情報提供命令数',
      ordersChart: '違法コンテンツへの対処命令',
      ordersToActLabel: '対処命令',
      ordersForInfoLabel: '情報提供命令',
      tOrdersAct: '対処命令数', tItemsOrders: 'アイテム数', tOrdersInfo: '情報提供命令数',
      t3Title: '政府命令 — ',
      totalComplaints: '総申立件数',
      decisionsUpheld: '維持された決定',
      decisionsReversed: '覆された決定',
      upholdRate: '維持率',
      reversalRate: '逆転率',
      overturnRate: 'サービス別・逆転率',
      complaintsByService: 'サービス別・内部申立件数',
      complaintOutcomes: 'サービス別・申立結果',
      upheld: '維持',
      reversed: '逆転',
      tIndicator: '指標', tScope: 'スコープ', tValue: '値',
      t7Title: '内部申立メカニズム',
      tService: 'サービス',
      topCategories: 'カテゴリ別トップ10（',
      desigTitle: 'VLOP・VLOSEの指定',
      desigIntro: 'EUのDSAに基づき指定されたすべてのプラットフォームと検索エンジンを指定日順に示します。Stripchatは2025年5月に指定解除され、WhatsApp Channelsは本報告期間後の2026年1月に指定されました。',
      thPlatform: 'プラットフォーム', thType: '種別', thDesignated: '指定日', thStatus: 'ステータス',
      statusActive: '指定中', statusDeDesignated: '指定解除',
    },
    zh: {
      loading: '数据加载中…',
      loadError: '无法加载数据集。',
      allPlatforms: '全部',
      allServices: '全部',
      allCategories: '全部',
      allKeywords: '全部',
      allSurfaces: '全部细分',
      topKeywords: '关键词前10名（',
      reset: '重置筛选',
      rows: '条',
      tabT4: '通知',
      tabT5: '主动措施：违法内容',
      tabT6: '主动措施：违规内容',
      tabT3: '政府命令',
      tabT7: '申诉',
      noticesReceived: '收到的通知数',
      itemsReferenced: '涉及条目数',
      actionsTaken: '已采取的措施数',
      actionRate: '措施率',
      tfNotices: '可信举报者通知数',
      noticesByService: '各服务收到的通知数',
      actionsByBasis: '按法律依据分类的措施数',
      removedLaw: '已删除（法律）',
      removedPolicy: '已删除（政策）',
      tNotices: '通知数', tTrusted: '可信举报者',
      tItems: '条目数', tMedian: '处理时间中位数（小时）',
      tActLaw: '措施数（法律）', tActPolicy: '措施数（政策）',
      tNoticesTitle: '通知 — ',
      totalMeasures: '总措施数',
      automatedDetection: '自动检测数',
      automationRate: '自动化率',
      contentRemovals: '内容删除数',
      accountRestrictions: '账号限制数',
      measuresByService: '各服务总措施数',
      automatedVsTotal: '自动措施数 vs 总措施数',
      automated: '自动',
      allMeasures: '全部措施',
      actionTypes: '措施类型分布',
      count: '数量',
      measures: '措施数',
      aRemoval: '删除', aDisable: '停用', aDemoted: '降级推荐',
      aAgeRestr: '年龄限制', aInteraction: '互动限制',
      aLabelled: '添加标签', aVisOther: '可见性限制（其他）',
      aMonSusp: '收益暂停', aMonTerm: '收益终止',
      aSvcSusp: '服务暂停', aSvcTerm: '服务终止',
      aAccSusp: '账号暂停', aAccTerm: '账号终止',
      tMeasures: '总措施数', tAutomated: '自动措施数',
      tRemovals: '删除数', tAccSusp: '账号暂停', tAccTerm: '账号终止',
      t5Title: '主动措施（违法内容）— ',
      t6Title: '主动措施（违规内容）— ',
      ordersToAct: '处理命令数',
      itemsInOrders: '命令涉及条目数',
      ordersForInfo: '信息披露命令数',
      ordersChart: '针对违法内容的处理命令',
      ordersToActLabel: '处理命令',
      ordersForInfoLabel: '信息披露命令',
      tOrdersAct: '处理命令数', tItemsOrders: '条目数', tOrdersInfo: '信息披露命令数',
      t3Title: '政府命令 — ',
      totalComplaints: '总申诉数',
      decisionsUpheld: '维持原决定',
      decisionsReversed: '撤销原决定',
      upholdRate: '维持率',
      reversalRate: '撤销率',
      overturnRate: '各服务撤销率',
      complaintsByService: '各服务内部申诉数',
      complaintOutcomes: '各服务申诉结果',
      upheld: '维持',
      reversed: '撤销',
      tIndicator: '指标', tScope: '范围', tValue: '值',
      t7Title: '内部投诉机制',
      tService: '服务',
      topCategories: '类别前10名（',
      desigTitle: 'VLOP与VLOSE认定',
      desigIntro: '根据欧盟DSA认定的所有平台与搜索引擎，按认定日期排列。Stripchat已于2025年5月被撤销认定；WhatsApp Channels于本报告期之后的2026年1月获认定。',
      thPlatform: '平台', thType: '类型', thDesignated: '认定日期', thStatus: '状态',
      statusActive: '认定中', statusDeDesignated: '已撤销认定',
    },
    ko: {
      loading: '데이터 로딩 중…',
      loadError: '데이터셋을 불러올 수 없습니다.',
      allPlatforms: '전체',
      allServices: '전체',
      allCategories: '전체',
      allKeywords: '전체',
      allSurfaces: '모든 구분',
      topKeywords: '키워드 상위 10개 (',
      reset: '필터 초기화',
      rows: '건',
      tabT4: '통지',
      tabT5: '자발적 조치: 불법',
      tabT6: '자발적 조치: 정책',
      tabT3: '정부 명령',
      tabT7: '이의 신청',
      noticesReceived: '수신된 통지 수',
      itemsReferenced: '대상 항목 수',
      actionsTaken: '취한 조치 수',
      actionRate: '조치 비율',
      tfNotices: '신뢰할 수 있는 신고자 통지',
      noticesByService: '서비스별 수신 통지 수',
      actionsByBasis: '법적 근거별 조치 수',
      removedLaw: '삭제 (법률)',
      removedPolicy: '삭제 (정책)',
      tNotices: '수신 통지 수', tTrusted: '신뢰할 수 있는 신고자',
      tItems: '항목 수', tMedian: '처리 시간 중앙값 (시간)',
      tActLaw: '조치 (법률)', tActPolicy: '조치 (정책)',
      tNoticesTitle: '통지 — ',
      totalMeasures: '총 조치 수',
      automatedDetection: '자동 탐지 수',
      automationRate: '자동화 비율',
      contentRemovals: '콘텐츠 삭제 수',
      accountRestrictions: '계정 제한 수',
      measuresByService: '서비스별 총 조치 수',
      automatedVsTotal: '자동 조치 vs 전체 조치',
      automated: '자동',
      allMeasures: '전체 조치',
      actionTypes: '조치 유형 분포',
      count: '건수',
      measures: '조치 수',
      aRemoval: '삭제', aDisable: '비활성화', aDemoted: '노출 제한',
      aAgeRestr: '연령 제한', aInteraction: '상호작용 제한',
      aLabelled: '라벨 부착', aVisOther: '가시성 제한 (기타)',
      aMonSusp: '수익화 정지', aMonTerm: '수익화 종료',
      aSvcSusp: '서비스 정지', aSvcTerm: '서비스 종료',
      aAccSusp: '계정 정지', aAccTerm: '계정 종료',
      tMeasures: '총 조치 수', tAutomated: '자동 조치 수',
      tRemovals: '삭제 수', tAccSusp: '계정 정지', tAccTerm: '계정 종료',
      t5Title: '자발적 조치 (불법 콘텐츠) — ',
      t6Title: '자발적 조치 (정책 위반) — ',
      ordersToAct: '처리 명령 수',
      itemsInOrders: '명령 내 항목 수',
      ordersForInfo: '정보 제공 명령 수',
      ordersChart: '불법 콘텐츠에 대한 처리 명령',
      ordersToActLabel: '처리 명령',
      ordersForInfoLabel: '정보 제공 명령',
      tOrdersAct: '처리 명령 수', tItemsOrders: '항목 수', tOrdersInfo: '정보 제공 명령 수',
      t3Title: '정부 명령 — ',
      totalComplaints: '총 이의 신청 수',
      decisionsUpheld: '유지된 결정',
      decisionsReversed: '번복된 결정',
      upholdRate: '유지율',
      reversalRate: '번복률',
      overturnRate: '서비스별 번복률',
      complaintsByService: '서비스별 내부 이의 신청 수',
      complaintOutcomes: '서비스별 이의 신청 결과',
      upheld: '유지',
      reversed: '번복',
      tIndicator: '지표', tScope: '범위', tValue: '값',
      t7Title: '내부 이의 신청 메커니즘',
      tService: '서비스',
      topCategories: '카테고리 상위 10개 (',
      desigTitle: 'VLOP 및 VLOSE 지정',
      desigIntro: 'EU DSA에 따라 지정된 모든 플랫폼과 검색 엔진을 지정일순으로 표시합니다. Stripchat은 2025년 5월 지정 해제되었으며, WhatsApp Channels는 본 보고 기간 이후인 2026년 1월에 지정되었습니다.',
      thPlatform: '플랫폼', thType: '유형', thDesignated: '지정일', thStatus: '상태',
      statusActive: '지정 중', statusDeDesignated: '지정 해제',
    },
  };

  var _ = L[lang];

  // ───────── DSA category label translations ─────────
  // Keyed by DSA taxonomy code (STATEMENT_CATEGORY_* / KEYWORD_*). Only ja/zh/ko
  // need entries — English maps are implicit identity via D.category_labels.
  // Anything missing falls through to the English label.
  var CATEGORY_TR = {
    ja: {
      'TOTAL': 'すべての項目',
      'STATEMENT_CATEGORY_ANIMAL_WELFARE': '動物福祉',
      'KEYWORD_ANIMAL_HARM': '動物への危害',
      'KEYWORD_UNLAWFUL_SALE_ANIMALS': '違法な動物販売',
      'KEYWORD_OTHER': 'その他のサブカテゴリに該当しないもの',
      'STATEMENT_CATEGORY_CONSUMER_INFORMATION': '消費者情報の侵害',
      'KEYWORD_HIDDEN_ADVERTISEMENT': '隠された広告またはコマーシャルコミュニケーション（インフルエンサーによるものを含む）',
      'KEYWORD_INSUFFICIENT_INFORMATION_ON_TRADERS': '事業者情報の不足',
      'KEYWORD_MISLEADING_INFO_GOODS_SERVICES': '商品・サービスの特性に関する誤解を招く情報',
      'KEYWORD_MISLEADING_INFO_CONSUMER_RIGHTS': '消費者の権利に関する誤解を招く情報',
      'KEYWORD_NONCOMPLIANCE_PRICING': '価格規制への不適合',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE': 'サイバー暴力',
      'KEYWORD_CYBER_BULLYING_INTIMIDATION': 'サイバーいじめ・脅迫',
      'KEYWORD_CYBER_HARASSMENT': 'サイバーハラスメント',
      'KEYWORD_CYBER_INCITEMENT': '憎悪または暴力をあおるサイバー扇動',
      'KEYWORD_CYBER_STALKING': 'サイバーストーキング',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING': '同意のない（性的）素材の共有（画像ベースの性的虐待を含む。未成年者を映したコンテンツを除く）',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE': '第三者の特徴を用いたディープフェイク等の素材を同意なく共有（未成年者を映したコンテンツを除く）',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN': '女性に対するサイバー暴力',
      'KEYWORD_BULLYING_AGAINST_GIRLS': '少女に対するサイバーいじめ・脅迫',
      'KEYWORD_CYBER_HARASSMENT_AGAINST_WOMEN': '女性に対するサイバーハラスメント',
      'KEYWORD_CYBER_STALKING_AGAINST_WOMEN': '女性に対するサイバーストーキング',
      'KEYWORD_FEMALE_GENDERED_DISINFORMATION': 'ジェンダー化された偽情報',
      'KEYWORD_INCITEMENT_AGAINST_WOMEN': '女性に対する暴力・憎悪をあおる違法な扇動',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING_AGAINST_WOMEN': '女性に対する同意のない（性的）素材の共有（女性に対する画像ベースの性的虐待を含む。未成年者を映したコンテンツを除く）',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE_AGAINST_WOMEN': '女性に対する第三者の特徴を用いたディープフェイク等の素材を同意なく共有（未成年者を映したコンテンツを除く）',
      'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS': 'データ保護・プライバシー侵害',
      'KEYWORD_BIOMETRIC_DATA_BREACH': '生体データの侵害',
      'KEYWORD_DATA_FALSIFICATION': 'データの改ざん',
      'KEYWORD_MISSING_PROCESSING_GROUND': 'データ処理の根拠の欠如',
      'KEYWORD_RIGHT_TO_BE_FORGOTTEN': '忘れられる権利',
      'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH': '違法または有害な言論',
      'KEYWORD_DEFAMATION': '名誉毀損',
      'KEYWORD_DISCRIMINATION': '差別',
      'KEYWORD_HATE_SPEECH': '保護対象の特性に基づく暴力・憎悪をあおる違法な扇動（ヘイトスピーチ）',
      'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS': '知的財産権侵害',
      'KEYWORD_COPYRIGHT_INFRINGEMENT': '著作権侵害',
      'KEYWORD_DESIGN_INFRINGEMENT': '意匠権侵害',
      'KEYWORD_GEOGRAPHIC_INDICATIONS_INFRINGEMENT': '地理的表示権の侵害',
      'KEYWORD_PATENT_INFRINGEMENT': '特許権侵害',
      'KEYWORD_TRADE_SECRET_INFRINGEMENT': '営業秘密の侵害',
      'KEYWORD_TRADEMARK_INFRINGEMENT': '商標権侵害',
      'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS': '市民的言論・選挙への悪影響',
      'KEYWORD_MISINFORMATION_DISINFORMATION': '誤情報・偽情報、外国による情報操作・干渉',
      'KEYWORD_VIOLATION_EU_LAW': '市民的言論・選挙に関連するEU法違反',
      'KEYWORD_VIOLATION_NATIONAL_LAW': '市民的言論・選挙に関連する国内法違反',
      'STATEMENT_CATEGORY_PROTECTION_OF_MINORS': '未成年者の保護',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS_MINORS': '未成年者に関する年齢制限',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL': '児童性的虐待コンテンツ',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL_DEEPFAKE': 'ディープフェイク等を含む児童性的虐待コンテンツ',
      'KEYWORD_GROOMING_SEXUAL_ENTICEMENT_MINORS': '未成年者へのグルーミング／性的誘惑',
      'KEYWORD_UNSAFE_CHALLENGES': '危険なチャレンジ',
      'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY': '公共の安全に対するリスク',
      'KEYWORD_ILLEGAL_ORGANIZATIONS': '違法組織',
      'KEYWORD_RISK_ENVIRONMENTAL_DAMAGE': '環境破壊のリスク',
      'KEYWORD_RISK_PUBLIC_HEALTH': '公衆衛生上のリスク',
      'KEYWORD_TERRORIST_CONTENT': 'テロリストコンテンツ',
      'STATEMENT_CATEGORY_SCAMS_AND_FRAUD': '詐欺・不正',
      'KEYWORD_IMPERSONATION_ACCOUNT_HIJACKING': 'なりすまし・アカウント乗っ取り',
      'KEYWORD_INAUTHENTIC_ACCOUNTS': '虚偽アカウント',
      'KEYWORD_INAUTHENTIC_LISTINGS': '虚偽の出品',
      'KEYWORD_INAUTHENTIC_USER_REVIEWS': '虚偽のユーザーレビュー',
      'KEYWORD_PHISHING': 'フィッシング',
      'KEYWORD_PYRAMID_SCHEMES': 'ねずみ講',
      'STATEMENT_CATEGORY_SELF_HARM': '自傷行為',
      'KEYWORD_CONTENT_PROMOTING_EATING_DISORDERS': '摂食障害を助長するコンテンツ',
      'KEYWORD_SELF_MUTILATION': '自傷',
      'KEYWORD_SUICIDE': '自殺',
      'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS': '安全でない、不適合または禁止された製品',
      'KEYWORD_PROHIBITED_PRODUCTS': '禁止または制限された製品',
      'KEYWORD_UNSAFE_PRODUCTS': '安全でない、または不適合な製品',
      'STATEMENT_CATEGORY_VIOLENCE': '暴力',
      'KEYWORD_COORDINATED_HARM': '連携した加害行為',
      'KEYWORD_INCITEMENT_VIOLENCE_HATRED': '暴力・憎悪を一般的に呼びかけるまたは扇動する行為',
      'KEYWORD_HUMAN_EXPLOITATION': '人身搾取',
      'KEYWORD_HUMAN_TRAFFICKING': '人身売買',
      'KEYWORD_TRAFFICKING_WOMEN_GIRLS': '女性・少女の人身売買',
      'STATEMENT_CATEGORY_OTHER_VIOLATION_TC': '提供者の利用規約に対するその他の違反',
      'KEYWORD_ADULT_SEXUAL_MATERIAL': '成人向け性的素材',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS': '年齢に関する制限',
      'KEYWORD_GEOGRAPHICAL_REQUIREMENTS': '地理的要件',
      'KEYWORD_GOODS_SERVICES_NOT_PERMITTED': 'プラットフォーム上での提供が許可されていない商品・サービス',
      'KEYWORD_LANGUAGE_REQUIREMENTS': '言語要件',
      'KEYWORD_NUDITY': 'ヌード',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_ORDER': '公的機関により違法コンテンツの種類が特定されていない',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_NOTICE': '通報者により違法とされるコンテンツの種類が特定されていない'
    },
    zh: {
      'TOTAL': '全部条目',
      'STATEMENT_CATEGORY_ANIMAL_WELFARE': '动物福利',
      'KEYWORD_ANIMAL_HARM': '伤害动物',
      'KEYWORD_UNLAWFUL_SALE_ANIMALS': '非法销售动物',
      'KEYWORD_OTHER': '未归入其他子类别',
      'STATEMENT_CATEGORY_CONSUMER_INFORMATION': '消费者信息侵权',
      'KEYWORD_HIDDEN_ADVERTISEMENT': '隐性广告或商业宣传（包括来自网红的隐性宣传）',
      'KEYWORD_INSUFFICIENT_INFORMATION_ON_TRADERS': '商家信息不足',
      'KEYWORD_MISLEADING_INFO_GOODS_SERVICES': '关于商品和服务特性的误导性信息',
      'KEYWORD_MISLEADING_INFO_CONSUMER_RIGHTS': '关于消费者权利的误导性信息',
      'KEYWORD_NONCOMPLIANCE_PRICING': '不符合价格法规',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE': '网络暴力',
      'KEYWORD_CYBER_BULLYING_INTIMIDATION': '网络欺凌与恐吓',
      'KEYWORD_CYBER_HARASSMENT': '网络骚扰',
      'KEYWORD_CYBER_INCITEMENT': '煽动仇恨或暴力的网络行为',
      'KEYWORD_CYBER_STALKING': '网络跟踪',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING': '未经同意分享（私密）素材，包括（基于图像的）性虐待（不含描绘未成年人的内容）',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE': '未经同意分享利用第三方面部特征的深度伪造等技术素材（不含描绘未成年人的内容）',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN': '针对女性的网络暴力',
      'KEYWORD_BULLYING_AGAINST_GIRLS': '针对女童的网络欺凌与恐吓',
      'KEYWORD_CYBER_HARASSMENT_AGAINST_WOMEN': '针对女性的网络骚扰',
      'KEYWORD_CYBER_STALKING_AGAINST_WOMEN': '针对女性的网络跟踪',
      'KEYWORD_FEMALE_GENDERED_DISINFORMATION': '性别化的虚假信息',
      'KEYWORD_INCITEMENT_AGAINST_WOMEN': '非法煽动针对女性的暴力与仇恨',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING_AGAINST_WOMEN': '未经同意分享针对女性的（私密）素材，包括（基于图像的）针对女性的性虐待（不含描绘未成年人的内容）',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE_AGAINST_WOMEN': '未经同意分享利用第三方面部特征针对女性的深度伪造等技术素材（不含描绘未成年人的内容）',
      'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS': '数据保护与隐私侵权',
      'KEYWORD_BIOMETRIC_DATA_BREACH': '生物识别数据泄露',
      'KEYWORD_DATA_FALSIFICATION': '数据伪造',
      'KEYWORD_MISSING_PROCESSING_GROUND': '缺少数据处理依据',
      'KEYWORD_RIGHT_TO_BE_FORGOTTEN': '被遗忘权',
      'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH': '违法或有害言论',
      'KEYWORD_DEFAMATION': '诽谤',
      'KEYWORD_DISCRIMINATION': '歧视',
      'KEYWORD_HATE_SPEECH': '基于受保护特征非法煽动暴力与仇恨（仇恨言论）',
      'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS': '知识产权侵权',
      'KEYWORD_COPYRIGHT_INFRINGEMENT': '版权侵权',
      'KEYWORD_DESIGN_INFRINGEMENT': '外观设计侵权',
      'KEYWORD_GEOGRAPHIC_INDICATIONS_INFRINGEMENT': '地理标志侵权',
      'KEYWORD_PATENT_INFRINGEMENT': '专利侵权',
      'KEYWORD_TRADE_SECRET_INFRINGEMENT': '商业秘密侵权',
      'KEYWORD_TRADEMARK_INFRINGEMENT': '商标侵权',
      'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS': '对公民话语或选举的负面影响',
      'KEYWORD_MISINFORMATION_DISINFORMATION': '错误信息、虚假信息、境外信息操纵与干预',
      'KEYWORD_VIOLATION_EU_LAW': '违反与公民话语或选举有关的欧盟法律',
      'KEYWORD_VIOLATION_NATIONAL_LAW': '违反与公民话语或选举有关的国家法律',
      'STATEMENT_CATEGORY_PROTECTION_OF_MINORS': '未成年人保护',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS_MINORS': '与未成年人相关的年龄限制',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL': '儿童性虐待材料',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL_DEEPFAKE': '含有深度伪造等技术的儿童性虐待材料',
      'KEYWORD_GROOMING_SEXUAL_ENTICEMENT_MINORS': '诱拐／诱骗未成年人',
      'KEYWORD_UNSAFE_CHALLENGES': '不安全的挑战',
      'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY': '公共安全风险',
      'KEYWORD_ILLEGAL_ORGANIZATIONS': '非法组织',
      'KEYWORD_RISK_ENVIRONMENTAL_DAMAGE': '环境破坏风险',
      'KEYWORD_RISK_PUBLIC_HEALTH': '公共卫生风险',
      'KEYWORD_TERRORIST_CONTENT': '恐怖主义内容',
      'STATEMENT_CATEGORY_SCAMS_AND_FRAUD': '诈骗',
      'KEYWORD_IMPERSONATION_ACCOUNT_HIJACKING': '冒充或账号劫持',
      'KEYWORD_INAUTHENTIC_ACCOUNTS': '虚假账号',
      'KEYWORD_INAUTHENTIC_LISTINGS': '虚假商品列表',
      'KEYWORD_INAUTHENTIC_USER_REVIEWS': '虚假用户评价',
      'KEYWORD_PHISHING': '网络钓鱼',
      'KEYWORD_PYRAMID_SCHEMES': '传销',
      'STATEMENT_CATEGORY_SELF_HARM': '自残',
      'KEYWORD_CONTENT_PROMOTING_EATING_DISORDERS': '宣扬饮食失调的内容',
      'KEYWORD_SELF_MUTILATION': '自我伤害',
      'KEYWORD_SUICIDE': '自杀',
      'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS': '不安全、不合规或禁止的产品',
      'KEYWORD_PROHIBITED_PRODUCTS': '禁止或受限制的产品',
      'KEYWORD_UNSAFE_PRODUCTS': '不安全或不合规的产品',
      'STATEMENT_CATEGORY_VIOLENCE': '暴力',
      'KEYWORD_COORDINATED_HARM': '协同伤害',
      'KEYWORD_INCITEMENT_VIOLENCE_HATRED': '一般性煽动暴力或仇恨',
      'KEYWORD_HUMAN_EXPLOITATION': '人口剥削',
      'KEYWORD_HUMAN_TRAFFICKING': '人口贩运',
      'KEYWORD_TRAFFICKING_WOMEN_GIRLS': '贩运妇女与女童',
      'STATEMENT_CATEGORY_OTHER_VIOLATION_TC': '其他违反提供者条款的行为',
      'KEYWORD_ADULT_SEXUAL_MATERIAL': '成人性内容',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS': '年龄限制',
      'KEYWORD_GEOGRAPHICAL_REQUIREMENTS': '地理要求',
      'KEYWORD_GOODS_SERVICES_NOT_PERMITTED': '不允许在平台上提供的商品／服务',
      'KEYWORD_LANGUAGE_REQUIREMENTS': '语言要求',
      'KEYWORD_NUDITY': '裸露',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_ORDER': '公共机关未指明违法内容类型',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_NOTICE': '通知者未指明涉嫌违法内容的类型'
    },
    ko: {
      'TOTAL': '전체 항목',
      'STATEMENT_CATEGORY_ANIMAL_WELFARE': '동물 복지',
      'KEYWORD_ANIMAL_HARM': '동물 학대',
      'KEYWORD_UNLAWFUL_SALE_ANIMALS': '불법 동물 판매',
      'KEYWORD_OTHER': '다른 하위 카테고리에 해당하지 않는 항목',
      'STATEMENT_CATEGORY_CONSUMER_INFORMATION': '소비자 정보 침해',
      'KEYWORD_HIDDEN_ADVERTISEMENT': '인플루언서 등에 의한 숨겨진 광고 또는 상업적 커뮤니케이션',
      'KEYWORD_INSUFFICIENT_INFORMATION_ON_TRADERS': '판매자 정보 부족',
      'KEYWORD_MISLEADING_INFO_GOODS_SERVICES': '상품 및 서비스의 특성에 관한 오해를 유발하는 정보',
      'KEYWORD_MISLEADING_INFO_CONSUMER_RIGHTS': '소비자 권리에 관한 오해를 유발하는 정보',
      'KEYWORD_NONCOMPLIANCE_PRICING': '가격 규정 미준수',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE': '사이버 폭력',
      'KEYWORD_CYBER_BULLYING_INTIMIDATION': '사이버 괴롭힘 및 협박',
      'KEYWORD_CYBER_HARASSMENT': '사이버 괴롭힘',
      'KEYWORD_CYBER_INCITEMENT': '증오 또는 폭력을 선동하는 사이버 행위',
      'KEYWORD_CYBER_STALKING': '사이버 스토킹',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING': '동의 없는 (성적) 자료 공유, 이미지 기반 성적 학대 포함 (미성년자 묘사 콘텐츠 제외)',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE': '제3자의 외형을 이용한 딥페이크 등의 자료를 동의 없이 공유 (미성년자 묘사 콘텐츠 제외)',
      'STATEMENT_CATEGORY_CYBER_VIOLENCE_AGAINST_WOMEN': '여성에 대한 사이버 폭력',
      'KEYWORD_BULLYING_AGAINST_GIRLS': '여아에 대한 사이버 괴롭힘 및 협박',
      'KEYWORD_CYBER_HARASSMENT_AGAINST_WOMEN': '여성에 대한 사이버 괴롭힘',
      'KEYWORD_CYBER_STALKING_AGAINST_WOMEN': '여성에 대한 사이버 스토킹',
      'KEYWORD_FEMALE_GENDERED_DISINFORMATION': '성별화된 허위 정보',
      'KEYWORD_INCITEMENT_AGAINST_WOMEN': '여성에 대한 폭력 및 증오를 선동하는 불법 행위',
      'KEYWORD_NON_CONSENSUAL_IMAGE_SHARING_AGAINST_WOMEN': '여성에 대한 동의 없는 (성적) 자료 공유, 여성을 대상으로 한 이미지 기반 성적 학대 포함 (미성년자 묘사 콘텐츠 제외)',
      'KEYWORD_NON_CONSENSUAL_MATERIAL_DEEPFAKE_AGAINST_WOMEN': '여성에 대한 제3자의 외형을 이용한 딥페이크 등의 자료를 동의 없이 공유 (미성년자 묘사 콘텐츠 제외)',
      'STATEMENT_CATEGORY_DATA_PROTECTION_AND_PRIVACY_VIOLATIONS': '데이터 보호 및 프라이버시 침해',
      'KEYWORD_BIOMETRIC_DATA_BREACH': '생체 데이터 유출',
      'KEYWORD_DATA_FALSIFICATION': '데이터 위조',
      'KEYWORD_MISSING_PROCESSING_GROUND': '데이터 처리 근거 부재',
      'KEYWORD_RIGHT_TO_BE_FORGOTTEN': '잊힐 권리',
      'STATEMENT_CATEGORY_ILLEGAL_OR_HARMFUL_SPEECH': '불법 또는 유해한 표현',
      'KEYWORD_DEFAMATION': '명예 훼손',
      'KEYWORD_DISCRIMINATION': '차별',
      'KEYWORD_HATE_SPEECH': '보호 대상 특성에 기반한 폭력 및 증오를 선동하는 불법 행위 (혐오 표현)',
      'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS': '지식재산권 침해',
      'KEYWORD_COPYRIGHT_INFRINGEMENT': '저작권 침해',
      'KEYWORD_DESIGN_INFRINGEMENT': '디자인권 침해',
      'KEYWORD_GEOGRAPHIC_INDICATIONS_INFRINGEMENT': '지리적 표시권 침해',
      'KEYWORD_PATENT_INFRINGEMENT': '특허권 침해',
      'KEYWORD_TRADE_SECRET_INFRINGEMENT': '영업비밀 침해',
      'KEYWORD_TRADEMARK_INFRINGEMENT': '상표권 침해',
      'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS': '시민적 담론 또는 선거에 대한 부정적 영향',
      'KEYWORD_MISINFORMATION_DISINFORMATION': '잘못된 정보, 허위 정보, 외국 정보 조작 및 개입',
      'KEYWORD_VIOLATION_EU_LAW': '시민적 담론 또는 선거와 관련된 EU법 위반',
      'KEYWORD_VIOLATION_NATIONAL_LAW': '시민적 담론 또는 선거와 관련된 국내법 위반',
      'STATEMENT_CATEGORY_PROTECTION_OF_MINORS': '미성년자 보호',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS_MINORS': '미성년자 관련 연령 제한',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL': '아동 성적 학대물',
      'KEYWORD_CHILD_SEXUAL_ABUSE_MATERIAL_DEEPFAKE': '딥페이크 등의 기술이 포함된 아동 성적 학대물',
      'KEYWORD_GROOMING_SEXUAL_ENTICEMENT_MINORS': '미성년자에 대한 그루밍 / 성적 유인',
      'KEYWORD_UNSAFE_CHALLENGES': '안전하지 않은 챌린지',
      'STATEMENT_CATEGORY_RISK_FOR_PUBLIC_SECURITY': '공공 안전에 대한 위험',
      'KEYWORD_ILLEGAL_ORGANIZATIONS': '불법 조직',
      'KEYWORD_RISK_ENVIRONMENTAL_DAMAGE': '환경 파괴 위험',
      'KEYWORD_RISK_PUBLIC_HEALTH': '공중 보건 위험',
      'KEYWORD_TERRORIST_CONTENT': '테러 콘텐츠',
      'STATEMENT_CATEGORY_SCAMS_AND_FRAUD': '사기 및 부정',
      'KEYWORD_IMPERSONATION_ACCOUNT_HIJACKING': '사칭 또는 계정 탈취',
      'KEYWORD_INAUTHENTIC_ACCOUNTS': '허위 계정',
      'KEYWORD_INAUTHENTIC_LISTINGS': '허위 상품 등록',
      'KEYWORD_INAUTHENTIC_USER_REVIEWS': '허위 사용자 리뷰',
      'KEYWORD_PHISHING': '피싱',
      'KEYWORD_PYRAMID_SCHEMES': '피라미드 사기',
      'STATEMENT_CATEGORY_SELF_HARM': '자해',
      'KEYWORD_CONTENT_PROMOTING_EATING_DISORDERS': '섭식 장애를 조장하는 콘텐츠',
      'KEYWORD_SELF_MUTILATION': '자해',
      'KEYWORD_SUICIDE': '자살',
      'STATEMENT_CATEGORY_UNSAFE_AND_PROHIBITED_PRODUCTS': '안전하지 않거나 부적합하거나 금지된 제품',
      'KEYWORD_PROHIBITED_PRODUCTS': '금지 또는 제한된 제품',
      'KEYWORD_UNSAFE_PRODUCTS': '안전하지 않거나 부적합한 제품',
      'STATEMENT_CATEGORY_VIOLENCE': '폭력',
      'KEYWORD_COORDINATED_HARM': '조직적인 가해 행위',
      'KEYWORD_INCITEMENT_VIOLENCE_HATRED': '폭력 또는 증오에 대한 일반적 호소 또는 선동',
      'KEYWORD_HUMAN_EXPLOITATION': '인신 착취',
      'KEYWORD_HUMAN_TRAFFICKING': '인신매매',
      'KEYWORD_TRAFFICKING_WOMEN_GIRLS': '여성 및 여아 인신매매',
      'STATEMENT_CATEGORY_OTHER_VIOLATION_TC': '제공자의 이용약관에 대한 기타 위반',
      'KEYWORD_ADULT_SEXUAL_MATERIAL': '성인 성적 자료',
      'KEYWORD_AGE_SPECIFIC_RESTRICTIONS': '연령별 제한',
      'KEYWORD_GEOGRAPHICAL_REQUIREMENTS': '지역별 요구사항',
      'KEYWORD_GOODS_SERVICES_NOT_PERMITTED': '플랫폼에서 제공이 허용되지 않는 상품 / 서비스',
      'KEYWORD_LANGUAGE_REQUIREMENTS': '언어 요구사항',
      'KEYWORD_NUDITY': '노출',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_ORDER': '공공 기관이 불법 콘텐츠 유형을 지정하지 않음',
      'STATEMENT_CATEGORY_NOT_SPECIFIED_NOTICE': '신고자가 위법 의심 콘텐츠 유형을 지정하지 않음'
    }
  };

  function trCatLabel(code) {
    if (lang === 'en') return null;
    var t = CATEGORY_TR[lang];
    return t ? (t[code] || null) : null;
  }

  // Maps KEYWORD_* codes → parent STATEMENT_CATEGORY_* codes (DSA taxonomy)
  var CATEGORY_PARENTS = {
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
    KEYWORD_OTHER_INTELLECTUAL_PROPERTY_INFRINGEMENTS_THIRD_PARTY_VIOLATION_OR_DATA_VIOLATION: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
    KEYWORD_PATENT_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
    KEYWORD_TRADEMARK_INFRINGEMENT: 'STATEMENT_CATEGORY_INTELLECTUAL_PROPERTY_INFRINGEMENTS',
    KEYWORD_COORDINATED_HARM: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_IMPERSONATION_ACCOUNT_HIJACKING: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_INAUTHENTIC_ACCOUNTS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_INAUTHENTIC_LISTINGS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_INAUTHENTIC_USER_REVIEWS: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_MISINFORMATION_DISINFORMATION: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_OTHER_CIVIC_DISCOURSE: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
    KEYWORD_OTHER_FAKE_ENGAGEMENT: 'STATEMENT_CATEGORY_NEGATIVE_EFFECTS_ON_CIVIC_DISCOURSE_OR_ELECTIONS',
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
    KEYWORD_OTHER_UNKNOWN: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
    KEYWORD_OTHER_UNORIGINAL_CONTENT: 'STATEMENT_CATEGORY_OTHER_VIOLATION_TC',
    KEYWORD_OTHER_ILLEGALITY: 'STATEMENT_CATEGORY_OTHER_ILLEGAL',
    KEYWORD_ANIMAL_HARM: 'STATEMENT_CATEGORY_ANIMAL_WELFARE',
    KEYWORD_UNLAWFUL_SALE_ANIMALS: 'STATEMENT_CATEGORY_ANIMAL_WELFARE',
  };

  var D;
  var charts = {};
  var currentTab = 't4';

  var PALETTE = [
    '#4e79a7', '#f28e2b', '#e15759', '#76b7b2', '#59a14f', '#edc948',
    '#b07aa1', '#ff9da7', '#9c755f', '#bab0ac', '#d37295'
  ];

  function svcColor(i) { return PALETTE[i % PALETTE.length]; }

  // ── VLOP / VLOSE designation timeline ───────────────────────
  // Official European Commission designation dates under the DSA. `until` marks
  // a later de-designation. Reference data, independent of the report dataset.
  var DESIGNATIONS = [
    { name: 'AliExpress', type: 'VLOP', date: '2023-04-25' },
    { name: 'Amazon Store', type: 'VLOP', date: '2023-04-25' },
    { name: 'Apple App Store', type: 'VLOP', date: '2023-04-25' },
    { name: 'Bing', type: 'VLOSE', date: '2023-04-25' },
    { name: 'Booking.com', type: 'VLOP', date: '2023-04-25' },
    { name: 'Facebook', type: 'VLOP', date: '2023-04-25' },
    { name: 'Google Maps', type: 'VLOP', date: '2023-04-25' },
    { name: 'Google Play', type: 'VLOP', date: '2023-04-25' },
    { name: 'Google Search', type: 'VLOSE', date: '2023-04-25' },
    { name: 'Google Shopping', type: 'VLOP', date: '2023-04-25' },
    { name: 'Instagram', type: 'VLOP', date: '2023-04-25' },
    { name: 'LinkedIn', type: 'VLOP', date: '2023-04-25' },
    { name: 'Pinterest', type: 'VLOP', date: '2023-04-25' },
    { name: 'Snapchat', type: 'VLOP', date: '2023-04-25' },
    { name: 'TikTok', type: 'VLOP', date: '2023-04-25' },
    { name: 'Wikipedia', type: 'VLOP', date: '2023-04-25' },
    { name: 'X (Twitter)', type: 'VLOP', date: '2023-04-25' },
    { name: 'YouTube', type: 'VLOP', date: '2023-04-25' },
    { name: 'Zalando', type: 'VLOP', date: '2023-04-25' },
    { name: 'Pornhub', type: 'VLOP', date: '2023-12-20' },
    { name: 'Stripchat', type: 'VLOP', date: '2023-12-20', until: '2025-05-27' },
    { name: 'XVideos', type: 'VLOP', date: '2023-12-20' },
    { name: 'Shein', type: 'VLOP', date: '2024-04-26' },
    { name: 'Temu', type: 'VLOP', date: '2024-05-31' },
    { name: 'XNXX', type: 'VLOP', date: '2024-07-10' },
    { name: 'WhatsApp Channels', type: 'VLOP', date: '2026-01-26' }
  ];

  function fmtDate(iso) {
    var p = iso.split('-');
    return new Date(p[0], p[1] - 1, p[2]).toLocaleDateString(LOCALE, {
      year: 'numeric', month: 'short', day: 'numeric'
    });
  }

  function renderDesignations() {
    var sec = document.getElementById('vlop-designations');
    if (!sec) return;
    document.getElementById('vlop-desig-title').textContent = _.desigTitle;
    document.getElementById('vlop-desig-intro').textContent = _.desigIntro;

    var head = document.getElementById('vlop-desig-head');
    head.innerHTML = '';
    [_.thPlatform, _.thType, _.thDesignated, _.thStatus].forEach(function (h) {
      var th = document.createElement('th');
      th.textContent = h;
      head.appendChild(th);
    });

    var rows = DESIGNATIONS.slice().sort(function (a, b) {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      if (a.name !== b.name) return a.name < b.name ? -1 : 1;
      return 0;
    });
    var body = document.getElementById('vlop-desig-body');
    body.innerHTML = '';
    rows.forEach(function (r) {
      var tr = document.createElement('tr');
      if (r.until) tr.className = 'desig-inactive';
      var status = r.until ? _.statusDeDesignated + ' · ' + fmtDate(r.until) : _.statusActive;
      [r.name, r.type, fmtDate(r.date), status].forEach(function (val) {
        var td = document.createElement('td');
        td.textContent = val;
        tr.appendChild(td);
      });
      body.appendChild(tr);
    });
    document.getElementById('vlop-desig-count').textContent = rows.length + ' ' + _.rows;
    sec.hidden = false;
  }

  // ── Bootstrap ────────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', function () {
    document.getElementById('vlop-loading').textContent = _.loading;
    renderDesignations();
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
        document.getElementById('vlop-loading').textContent = _.loadError;
      });
  });

  function init() {
    var tabMap = { t4: _.tabT4, t5: _.tabT5, t6: _.tabT6, t3: _.tabT3, t7: _.tabT7 };
    document.querySelectorAll('.vlop-tab').forEach(function (btn) {
      btn.textContent = tabMap[btn.dataset.tab] || btn.textContent;
    });
    document.getElementById('vlop-reset').textContent = _.reset;

    buildPlatformFilter();
    buildServiceFilter(null);
    buildCategoryFilter('t4');
    buildKeywordFilter('t4', null);
    buildSurfaceFilter('t4');
    wireTabButtons();
    wireFilters();
    render();
  }

  // ── Filters ──────────────────────────────────────────────────
  function buildPlatformFilter() {
    var sel = document.getElementById('vlop-platform');
    sel.innerHTML = '<option value="">' + _.allPlatforms + '</option>';
    var seen = [];
    (D.service_platforms || []).forEach(function (p) {
      if (seen.indexOf(p) === -1) {
        seen.push(p);
        sel.innerHTML += '<option value="' + p + '">' + p + '</option>';
      }
    });
  }

  function buildServiceFilter(platformFilter) {
    var sel = document.getElementById('vlop-service');
    var prev = sel.value;
    sel.innerHTML = '<option value="">' + _.allServices + '</option>';
    D.services.forEach(function (s, i) {
      if (platformFilter && (D.service_platforms || [])[i] !== platformFilter) return;
      sel.innerHTML += '<option value="' + i + '">' + s + '</option>';
    });
    // restore previous selection if still valid
    if (prev && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
  }

  function buildCategoryFilter(tab) {
    var sel = document.getElementById('vlop-category');
    var catWrap = document.getElementById('vlop-cat-wrap');
    if (!sel || !catWrap) return;
    if (tab === 't7') { catWrap.hidden = true; return; }
    catWrap.hidden = false;
    sel.innerHTML = '<option value="">' + _.allCategories + '</option>';
    var seen = {};
    (D[tab] || []).forEach(function (r) { seen[r[1]] = true; });
    D.categories.forEach(function (code, i) {
      if (!seen[i]) return;
      if (typeof code !== 'string' || code.indexOf('STATEMENT_CATEGORY') !== 0) return;
      var label = trCatLabel(code) || D.category_labels[code] || code;
      sel.innerHTML += '<option value="' + i + '">' + label + '</option>';
    });
  }

  function buildKeywordFilter(tab, parentCatCode) {
    var sel = document.getElementById('vlop-keyword');
    var kwWrap = document.getElementById('vlop-kw-wrap');
    if (!sel || !kwWrap) return;
    if (tab === 't7') { kwWrap.hidden = true; return; }
    kwWrap.hidden = false;
    var prev = sel.value;
    sel.innerHTML = '<option value="">' + _.allKeywords + '</option>';
    var seen = {};
    (D[tab] || []).forEach(function (r) { seen[r[1]] = true; });
    D.categories.forEach(function (code, i) {
      if (!seen[i]) return;
      if (typeof code !== 'string' || code.indexOf('KEYWORD_') !== 0) return;
      if (parentCatCode && CATEGORY_PARENTS[code] !== parentCatCode) return;
      var label = trCatLabel(code) || D.category_labels[code] || code;
      sel.innerHTML += '<option value="' + i + '">' + label + '</option>';
    });
    if (prev && sel.querySelector('option[value="' + prev + '"]')) sel.value = prev;
  }

  // Surface (report breakdown) lives in the last column of t6/t7 rows.
  var SURFACE_COL = { t6: 18, t7: 5 };

  function buildSurfaceFilter(tab) {
    var sel = document.getElementById('vlop-surface');
    var wrap = document.getElementById('vlop-surf-wrap');
    if (!sel || !wrap) return;
    var col = SURFACE_COL[tab];
    var seen = {};
    if (col !== undefined) {
      (D[tab] || []).forEach(function (r) { if (r[col]) seen[r[col]] = true; });
    }
    var idxs = Object.keys(seen).map(Number).sort(function (a, b) { return a - b; });
    if (idxs.length === 0) { wrap.hidden = true; sel.innerHTML = ''; return; }
    wrap.hidden = false;
    sel.innerHTML = '<option value="">' + _.allSurfaces + '</option>';
    idxs.forEach(function (i) {
      sel.innerHTML += '<option value="' + i + '">' + (D.surfaces[i] || i) + '</option>';
    });
  }

  function getFilters() {
    var platVal = document.getElementById('vlop-platform').value;
    var svcVal = document.getElementById('vlop-service').value;
    var catVal = document.getElementById('vlop-category').value;
    var kwVal = document.getElementById('vlop-keyword').value;
    var surfEl = document.getElementById('vlop-surface');
    var surfVal = surfEl ? surfEl.value : '';

    // svcs: null = all services, otherwise array of service indices to include
    var svcs = null;
    if (svcVal !== '') {
      svcs = [parseInt(svcVal)];
    } else if (platVal !== '') {
      svcs = [];
      (D.service_platforms || []).forEach(function (p, i) {
        if (p === platVal) svcs.push(i);
      });
    }

    return {
      svcs: svcs,
      cat: catVal === '' ? null : parseInt(catVal),
      kw: kwVal === '' ? null : parseInt(kwVal),
      surf: surfVal === '' ? null : parseInt(surfVal),
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
        buildKeywordFilter(currentTab, null);
        buildSurfaceFilter(currentTab);
        document.getElementById('vlop-category').value = '';
        document.getElementById('vlop-keyword').value = '';
        render();
      });
    });
  }

  function wireFilters() {
    document.getElementById('vlop-platform').addEventListener('change', function () {
      var platVal = document.getElementById('vlop-platform').value;
      buildServiceFilter(platVal || null);
      render();
    });
    document.getElementById('vlop-service').addEventListener('change', render);
    document.getElementById('vlop-category').addEventListener('change', function () {
      var catVal = document.getElementById('vlop-category').value;
      var parentCode = catVal !== '' ? D.categories[parseInt(catVal)] : null;
      buildKeywordFilter(currentTab, parentCode);
      document.getElementById('vlop-keyword').value = '';
      render();
    });
    document.getElementById('vlop-keyword').addEventListener('change', render);
    var surfEl = document.getElementById('vlop-surface');
    if (surfEl) surfEl.addEventListener('change', render);
    document.getElementById('vlop-reset').addEventListener('click', function () {
      document.getElementById('vlop-platform').value = '';
      buildServiceFilter(null);
      document.getElementById('vlop-service').value = '';
      document.getElementById('vlop-category').value = '';
      buildKeywordFilter(currentTab, null);
      document.getElementById('vlop-keyword').value = '';
      buildSurfaceFilter(currentTab);
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

  function inSvcs(svcs, svcIdx) {
    return svcs === null || svcs.indexOf(svcIdx) !== -1;
  }

  // ── T4: Notices ──────────────────────────────────────────────
  function renderT4(f) {
    var catFilter = f.kw !== null ? f.kw : (f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL'));
    var rows = D.t4.filter(function (r) {
      return inSvcs(f.svcs, r[0]) && r[1] === catFilter;
    });

    var bySvc = aggregateBySvc(rows, function (r) {
      return { notices: n(r[2]), tfNotices: n(r[3]), items: n(r[4]),
               actLaw: n(r[8]), actTC: n(r[10]) };
    }, function (a, b) {
      return { notices: a.notices + b.notices, tfNotices: a.tfNotices + b.tfNotices,
               items: a.items + b.items, actLaw: a.actLaw + b.actLaw, actTC: a.actTC + b.actTC };
    });

    var totals = sumObj(bySvc);
    var actionTotal = totals.actLaw + totals.actTC;

    setMetrics([
      { label: _.noticesReceived, value: fmt(totals.notices) },
      { label: _.itemsReferenced, value: fmt(totals.items) },
      { label: _.actionsTaken, value: fmt(actionTotal) },
      { label: _.actionRate, value: totals.notices > 0 ? pct(actionTotal / totals.notices) : '—' },
      { label: _.tfNotices, value: fmt(totals.tfNotices) },
    ]);

    var activeSvcs = activeSvcIndices(f.svcs);
    var noticeData = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].notices : 0; });
    var actLawData = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].actLaw : 0; });
    var actTCData  = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].actTC : 0; });

    setCharts([
      {
        title: _.noticesByService, id: 'vlop-c1', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [{ label: _.noticesReceived, data: noticeData,
                     backgroundColor: svcColors(activeSvcs) }]
      },
      {
        title: _.actionsByBasis, id: 'vlop-c2', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [
          { label: _.removedLaw,    data: actLawData, backgroundColor: '#4e79a7' },
          { label: _.removedPolicy, data: actTCData,  backgroundColor: '#f28e2b' },
        ]
      },
    ]);

    if (f.kw === null) {
      renderCategoryBreakdown('t4', f.svcs, function (r) { return n(r[2]); }, _.noticesReceived, f.cat);
    }

    showTable(
      [_.tService, _.tNotices, _.tTrusted, _.tItems, _.tMedian, _.tActLaw, _.tActPolicy],
      rows.map(function (r) {
        return [D.services[r[0]], fmt(r[2]), fmt(r[3]), fmt(r[4]), fmt(r[6]), fmt(r[8]), fmt(r[10])];
      }),
      _.tNoticesTitle + catLabel(catFilter)
    );
  }

  // ── T5/T6 shared ─────────────────────────────────────────────
  function renderT5(f) { renderT5T6(f, 't5', _.t5Title); }
  function renderT6(f) { renderT5T6(f, 't6', _.t6Title); }

  function renderT5T6(f, tab, titlePrefix) {
    var catFilter = f.kw !== null ? f.kw : (f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL'));
    var sCol = SURFACE_COL[tab];
    var rows = (D[tab] || []).filter(function (r) {
      return inSvcs(f.svcs, r[0]) && r[1] === catFilter
             && (f.surf === null || sCol === undefined || r[sCol] === f.surf);
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

    setMetrics([
      { label: _.totalMeasures,       value: fmt(totals.measures) },
      { label: _.automatedDetection,  value: fmt(totals.automated) },
      { label: _.automationRate,      value: totals.measures > 0 ? pct(totals.automated / totals.measures) : '—' },
      { label: _.contentRemovals,     value: fmt(totals.removal) },
      { label: _.accountRestrictions, value: fmt(totals.accSusp + totals.accTerm) },
    ]);

    var activeSvcs = activeSvcIndices(f.svcs);
    var measData = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].measures   : 0; });
    var autoData = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].automated  : 0; });

    var actionLabels = [_.aRemoval, _.aDisable, _.aDemoted, _.aAgeRestr,
                        _.aInteraction, _.aLabelled, _.aVisOther,
                        _.aMonSusp, _.aMonTerm, _.aSvcSusp, _.aSvcTerm,
                        _.aAccSusp, _.aAccTerm];
    var rawData = [4, 5, 6, 7, 8, 9, 10, 11, 12, 14, 15, 16, 17].map(function (col) {
      return rows.reduce(function (s, r) { return s + n(r[col]); }, 0);
    });
    var filteredAL = actionLabels.filter(function (_, i) { return rawData[i] > 0; });
    var filteredAD = rawData.filter(function (v) { return v > 0; });

    setCharts([
      {
        title: _.measuresByService, id: 'vlop-c1', type: 'bar', wide: false,
        labels: svcLabels(activeSvcs),
        datasets: [{ label: _.measures, data: measData, backgroundColor: svcColors(activeSvcs) }]
      },
      {
        title: _.automatedVsTotal, id: 'vlop-c2', type: 'bar', wide: false,
        labels: svcLabels(activeSvcs),
        datasets: [
          { label: _.automated,   data: autoData, backgroundColor: '#4e79a7' },
          { label: _.allMeasures, data: measData, backgroundColor: '#ddd', order: 2 },
        ]
      },
      {
        title: _.actionTypes, id: 'vlop-c3', type: 'bar', wide: true,
        labels: filteredAL,
        datasets: [{ label: _.count, data: filteredAD,
          backgroundColor: filteredAL.map(function (_, i) { return PALETTE[i % PALETTE.length]; })
        }]
      },
    ]);

    if (f.kw === null) {
      renderCategoryBreakdown(tab, f.svcs, function (r) { return n(r[2]); }, _.totalMeasures, f.cat, f.surf);
    }

    // One table row per service (summing across surfaces when not filtered).
    var tAgg = {};
    rows.forEach(function (r) {
      var v = tAgg[r[0]] || (tAgg[r[0]] = [0, 0, 0, 0, 0]);
      v[0] += n(r[2]); v[1] += n(r[3]); v[2] += n(r[4]); v[3] += n(r[16]); v[4] += n(r[17]);
    });
    showTable(
      [_.tService, _.tMeasures, _.tAutomated, _.tRemovals, _.tAccSusp, _.tAccTerm],
      Object.keys(tAgg).map(Number).sort(function (a, b) { return a - b; }).map(function (s) {
        var v = tAgg[s];
        return [D.services[s], fmt(v[0]), fmt(v[1]), fmt(v[2]), fmt(v[3]), fmt(v[4])];
      }),
      titlePrefix + catLabel(catFilter)
    );
  }

  // ── T3: Government orders ─────────────────────────────────────
  function renderT3(f) {
    var catFilter = f.kw !== null ? f.kw : (f.cat !== null ? f.cat : indexOf(D.categories, 'TOTAL'));
    var rows = D.t3.filter(function (r) {
      return inSvcs(f.svcs, r[0]) && r[1] === catFilter;
    });

    var bySvc = aggregateBySvc(rows, function (r) {
      return { ordersAct: n(r[3]), items: n(r[4]), ordersInfo: n(r[5]) };
    }, function (a, b) {
      return { ordersAct: a.ordersAct + b.ordersAct, items: a.items + b.items,
               ordersInfo: a.ordersInfo + b.ordersInfo };
    });

    var totals = sumObj(bySvc);
    setMetrics([
      { label: _.ordersToAct,  value: fmt(totals.ordersAct) },
      { label: _.itemsInOrders, value: fmt(totals.items) },
      { label: _.ordersForInfo, value: fmt(totals.ordersInfo) },
    ]);

    var activeSvcs = activeSvcIndices(f.svcs);
    var orderData = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].ordersAct : 0; });
    var infoData  = activeSvcs.map(function (i) { return bySvc[i] ? bySvc[i].ordersInfo : 0; });

    setCharts([
      {
        title: _.ordersChart, id: 'vlop-c1', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [
          { label: _.ordersToActLabel,   data: orderData, backgroundColor: '#4e79a7' },
          { label: _.ordersForInfoLabel, data: infoData,  backgroundColor: '#f28e2b' },
        ]
      },
    ]);

    if (f.kw === null) {
      renderCategoryBreakdown('t3', f.svcs, function (r) { return n(r[3]); }, _.ordersToAct, f.cat);
    }

    showTable(
      [_.tService, _.tOrdersAct, _.tItemsOrders, _.tOrdersInfo],
      rows.map(function (r) {
        return [D.services[r[0]], fmt(r[3]), fmt(r[4]), fmt(r[5])];
      }),
      _.t3Title + catLabel(catFilter)
    );
  }

  // ── T7: Appeals ───────────────────────────────────────────────
  function renderT7(f) {
    var secInternal  = indexOf(D.sections,   'Internal complaints mechanism');
    var indComplaints = indexOf(D.indicators, 'Number of complaints submitted to the internal-complaints mechanism');
    var scopeTotal   = indexOf(D.scopes, 'Total number');
    var scopeUpheld  = indexOf(D.scopes, 'Decisions upheld');
    var scopeReversed = indexOf(D.scopes, 'Decisions reversed');

    // Sum across surfaces (a service may report the same indicator under
    // several surfaces, e.g. Google's organic + ads appeals).
    function t7val(svcIdx, sec, ind, scope) {
      return D.t7.reduce(function (s, r) {
        if (r[0] === svcIdx && r[1] === sec && r[2] === ind && r[3] === scope &&
            (f.surf === null || r[5] === f.surf)) {
          return s + n(r[4]);
        }
        return s;
      }, 0);
    }

    var totalComplaints = 0, totalUpheld = 0, totalReversed = 0;
    D.services.forEach(function (_, i) {
      if (!inSvcs(f.svcs, i)) return;
      totalComplaints += t7val(i, secInternal, indComplaints, scopeTotal);
      totalUpheld     += t7val(i, secInternal, indComplaints, scopeUpheld);
      totalReversed   += t7val(i, secInternal, indComplaints, scopeReversed);
    });

    setMetrics([
      { label: _.totalComplaints,   value: fmt(totalComplaints) },
      { label: _.decisionsUpheld,   value: fmt(totalUpheld) },
      { label: _.decisionsReversed, value: fmt(totalReversed) },
      { label: _.upholdRate,   value: totalComplaints > 0 ? pct(totalUpheld   / totalComplaints) : '—' },
      { label: _.reversalRate, value: totalComplaints > 0 ? pct(totalReversed / totalComplaints) : '—' },
    ]);

    var activeSvcs = activeSvcIndices(f.svcs);
    var complaintData   = activeSvcs.map(function (i) { return t7val(i, secInternal, indComplaints, scopeTotal); });
    var upheldData      = activeSvcs.map(function (i) { return t7val(i, secInternal, indComplaints, scopeUpheld); });
    var reversedData    = activeSvcs.map(function (i) { return t7val(i, secInternal, indComplaints, scopeReversed); });
    var overturnRateData = activeSvcs.map(function (i) {
      var total = t7val(i, secInternal, indComplaints, scopeTotal);
      var rev   = t7val(i, secInternal, indComplaints, scopeReversed);
      return total > 0 ? parseFloat((rev / total * 100).toFixed(1)) : null;
    });

    setCharts([
      {
        title: _.complaintsByService, id: 'vlop-c1', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [{ label: _.totalComplaints, data: complaintData,
                     backgroundColor: svcColors(activeSvcs) }]
      },
      {
        title: _.complaintOutcomes, id: 'vlop-c2', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [
          { label: _.upheld,   data: upheldData,   backgroundColor: '#4e79a7' },
          { label: _.reversed, data: reversedData, backgroundColor: '#e15759' },
        ]
      },
      {
        title: _.overturnRate, id: 'vlop-c3', type: 'bar', wide: true,
        labels: svcLabels(activeSvcs),
        datasets: [{ label: '%', data: overturnRateData,
                     backgroundColor: svcColors(activeSvcs) }],
        pctAxis: true,
      },
    ]);

    // Aggregate by service/indicator/scope, summing across surfaces.
    var t7agg = {};
    var t7order = [];
    D.t7.forEach(function (r) {
      if (!inSvcs(f.svcs, r[0]) || r[1] !== secInternal) return;
      if (f.surf !== null && r[5] !== f.surf) return;
      var k = r[0] + '|' + r[2] + '|' + r[3];
      if (!(k in t7agg)) { t7agg[k] = { svc: r[0], ind: r[2], scope: r[3], val: 0 }; t7order.push(k); }
      t7agg[k].val += n(r[4]);
    });
    showTable(
      [_.tService, _.tIndicator, _.tScope, _.tValue],
      t7order.map(function (k) {
        var a = t7agg[k];
        return [D.services[a.svc], D.indicators[a.ind], D.scopes[a.scope], fmt(a.val)];
      }),
      _.t7Title
    );
  }

  // ── Category breakdown helper ─────────────────────────────────
  function renderCategoryBreakdown(tab, svcsFilter, valueFn, metricLabel, catIdx, surf) {
    var parentCode = catIdx !== null && catIdx !== undefined ? D.categories[catIdx] : null;
    var sCol = SURFACE_COL[tab];

    var rows = (D[tab] || []).filter(function (r) {
      if (!inSvcs(svcsFilter, r[0])) return false;
      if (surf !== null && surf !== undefined && sCol !== undefined && r[sCol] !== surf) return false;
      var code = D.categories[r[1]];
      if (typeof code !== 'string' || code === 'TOTAL') return false;
      if (parentCode) {
        return code.indexOf('KEYWORD_') === 0 && CATEGORY_PARENTS[code] === parentCode;
      }
      return code.indexOf('STATEMENT_CATEGORY') === 0;
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
    var catData   = sorted.map(function (x) { return x.val; });
    // ja/zh use full-width parens; ko uses ASCII parens (the prefix strings
    // are written to match each language's typographic convention, so the
    // closing paren must follow suit).
    var closeParen = (lang === 'ja' || lang === 'zh') ? '）' : ')';
    var title;
    if (parentCode) {
      title = lang !== 'en'
        ? _.topKeywords + metricLabel + closeParen
        : _.topKeywords + metricLabel.toLowerCase();
    } else {
      title = lang !== 'en'
        ? _.topCategories + metricLabel + closeParen
        : _.topCategories + metricLabel.toLowerCase();
    }

    var chartsEl = document.getElementById('vlop-charts');
    var wrap = document.createElement('div');
    wrap.className = 'td-chart-card td-chart-card-wide';
    wrap.innerHTML = '<h3>' + title + '</h3>' +
      '<div class="td-chart-wrap td-chart-tall"><canvas id="vlop-cat-chart"></canvas></div>';
    chartsEl.appendChild(wrap);

    var ctx = document.getElementById('vlop-cat-chart').getContext('2d');
    charts['vlop-cat-chart'] = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: catLabels,
        datasets: [{ label: metricLabel, data: catData,
          backgroundColor: catLabels.map(function (_, i) { return PALETTE[i % PALETTE.length]; }) }]
      },
      options: chartOpts({ indexAxis: 'y', maintainAspectRatio: false })
    });
  }

  // ── UI helpers ────────────────────────────────────────────────
  function setMetrics(items) {
    document.getElementById('vlop-metrics').innerHTML = items.map(function (m) {
      return '<div class="td-metric"><div class="td-metric-num">' + m.value +
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
      var extra = {};
      if (spec.pctAxis) {
        extra.scales = {
          x: { ticks: { font: { size: 11 } } },
          y: { ticks: { font: { size: 11 }, callback: function (v) { return v + '%'; } }, max: 100 }
        };
        extra.plugins = {
          legend: { display: false },
          tooltip: { callbacks: { label: function (ctx) { return ' ' + ctx.raw + '%'; } } }
        };
      }
      charts[spec.id] = new Chart(ctx, {
        type: spec.type,
        data: { labels: spec.labels, datasets: spec.datasets },
        options: chartOpts(extra)
      });
    });
  }

  function showTable(headers, rows, title) {
    var wrap = document.getElementById('vlop-table-wrap');
    wrap.hidden = false;
    document.getElementById('vlop-table-title').textContent = title;
    document.getElementById('vlop-row-count').textContent = rows.length + ' ' + _.rows;
    document.getElementById('vlop-table-head').innerHTML =
      headers.map(function (h) { return '<th>' + h + '</th>'; }).join('');
    document.getElementById('vlop-table-body').innerHTML =
      rows.map(function (r) {
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
        tooltip: { callbacks: { label: function (ctx) {
          return ' ' + ctx.dataset.label + ': ' + fmt(ctx.raw);
        }}}
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
    if (typeof v === 'number') return v.toLocaleString(LOCALE);
    return v;
  }
  function pct(v) { return (v * 100).toFixed(1) + '%'; }
  function indexOf(arr, val) { return arr.indexOf(val); }

  function catLabel(catIdx) {
    var code = D.categories[catIdx];
    return trCatLabel(code) || D.category_labels[code] || code || 'Unknown';
  }
  // CJK characters render roughly twice as wide as Latin ones, so the same
  // pixel budget fits about half as many of them. Truncate accordingly.
  var SHORT_LABEL_MAX = (lang === 'ja' || lang === 'zh' || lang === 'ko') ? 20 : 35;
  function shortCatLabel(catIdx) {
    var label = catLabel(catIdx);
    return label.length > SHORT_LABEL_MAX
      ? label.slice(0, SHORT_LABEL_MAX - 2) + '…'
      : label;
  }

  function activeSvcIndices(svcs) {
    return svcs !== null ? svcs : D.services.map(function (_, i) { return i; });
  }
  function svcLabels(indices) {
    return indices.map(function (i) { return D.services[i]; });
  }
  function svcColors(indices) {
    return indices.map(function (i) { return svcColor(i); });
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
      if (!total) { total = Object.assign({}, obj); }
      else { Object.keys(obj).forEach(function (k) { total[k] = (total[k] || 0) + obj[k]; }); }
    });
    return total || {};
  }

}());
