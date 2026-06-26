const MAP_REFERENCE = { width: 1536, height: 1024 };
const PLAYER_SPAWN = { x: MAP_REFERENCE.width * 0.48, y: MAP_REFERENCE.height * 0.73 };
const joystickVector = { x: 0, y: 0 };
const PLAYER_SPRITE = {
  width: 48,
  height: 64,
  collisionWidth: 26,
  collisionHeight: 18,
  collisionOffsetX: 11,
  collisionOffsetY: 44,
  animationMs: 180
};
const INTERACT_KEY = "e";
const INTERACT_KEY_CODE = `Key${INTERACT_KEY.toUpperCase()}`;
const INTERACT_KEY_LABEL = INTERACT_KEY.toUpperCase();
const NPC_INTERACT_KEY = "f";
const NPC_INTERACT_KEY_CODE = `Key${NPC_INTERACT_KEY.toUpperCase()}`;
const NPC_INTERACT_KEY_LABEL = NPC_INTERACT_KEY.toUpperCase();

// ========================================
// 平台区分：缓存结果，避免每帧 matchMedia
// ========================================
let cachedIsMobile = null;
let cachedIsMobileTime = 0;
const IS_MOBILE_CACHE_MS = 300; // 300ms 内复用缓存

function isMobileInput() {
  const now = performance.now();
  if (cachedIsMobile === null || now - cachedIsMobileTime > IS_MOBILE_CACHE_MS) {
    cachedIsMobile = window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;
    cachedIsMobileTime = now;
  }
  return cachedIsMobile;
}

function invalidateMobileCache() {
  cachedIsMobile = null;
}

// 当前平台类型："desktop" | "mobile"
let currentPlatform = "desktop";

const MARKET_NPC_DIALOGUES = Object.freeze({
  paperSeller: {
    name: "宣纸摊主",
    lines: ["来看看宣纸吧！", "生宣洇墨快。", "熟宣适合工笔。"]
  },
  craftsperson: {
    name: "非遗匠人",
    lines: ["捞纸要稳一点。", "今天有手作体验。", "完成可解锁图鉴。"]
  },
  marketVisitor: {
    name: "集市游客",
    lines: ["金币能换纪念物。", "非遗馆有新展品。", "这个集市真热闹！"]
  },
  grandmother: {
    name: "外婆",
    interactionRange: 44,
    bubbleLines: ["纸卖错了，再好的纸也会误了人家的笔墨。", "纸有筋骨，人有手艺。", "认懂纸性，才算真正走进这条老街。"],
    storyLines: ["宣屿，这间铺子不是缺纸，是缺一个真正懂纸的人。", "先认纸性。纸卖错了，再好的纸也会误了人家的笔墨。"]
  },
  teahouseOwner: {
    name: "茶馆老板",
    promptLabel: "听茶馆传闻",
    bubbleLines: ["老街的茶还热着。"],
    randomRumors: [
      "听说非遗馆那本《纸谱十二笺》，以前是你外婆亲手整理的。",
      "青檀林那边风大，老匠人说，好纸的筋骨要从山里找。",
      "书画铺最近来了不少人，不同的人要的纸可不一样。",
      "集市四席行家都不好糊弄，答得上来，才算真懂纸。",
      "做纸急不得，喝茶也急不得，都讲一个慢字。"
    ]
  },
  forestElder: { name: "护林老人", bubbleLines: ["林子不是仓库，不能只取不养。"] },
  workshopMaster: { name: "工坊师傅", bubbleLines: ["浆不匀，纸就不稳。"] },
  dryingElder: { name: "晒纸老人", bubbleLines: ["别急，纸还没晒到时候。"] },
  galleryCurator: { name: "非遗馆馆长", bubbleLines: ["展柜放的是物，故事要靠人讲。"] }
});
const NPC_DIALOGUE_RANGE = 64;

function detectPlatform() {
  const mobile = isMobileInput();
  const next = mobile ? "mobile" : "desktop";
  if (next !== currentPlatform) {
    currentPlatform = next;
    onPlatformChange(next);
  }
  return next;
}

function onPlatformChange(platform) {
  document.documentElement.classList.toggle("mobile-input", platform === "mobile");
  document.documentElement.classList.toggle("desktop-input", platform === "desktop");
  updateMobileControls();
}

const state = {
  gameState: "start",
  introActive: true,
  flags: {},               // 轻量开关：apprenticeProcessCleared 等
  coins: 0,
  reputation: 0,
  upgrades: { bambooMat: false, pulpRecipe: false, workbench: false, barkStorage: false },
  currentOrder: null,
  orderQueue: [],
  orderJudgments: new Set(),
  paperPages: { qingtan: false, straw: false, water: false, craft: false, drying: false, paperNature: false, heritage: false },
  completedQuests: new Set(),
  task: "探索宣纸铺与纸境千年",
  player: { x: PLAYER_SPAWN.x, y: PLAYER_SPAWN.y, speed: 4.2, direction: "down", frame: 0, lastFrameAt: 0 },
  camera: { x: 0, y: 0, width: 0, height: 0 },
  map: {
    naturalWidth: MAP_REFERENCE.width,
    naturalHeight: MAP_REFERENCE.height,
    width: MAP_REFERENCE.width,
    height: MAP_REFERENCE.height,
    scaleX: 1,
    scaleY: 1,
    ready: false
  },
  keys: new Set(),
  activeZone: null,
  lastPaper: null,
  unlockedCards: new Set(["青檀树皮"]),
  hasVisitedPaperShop: false,
  unlockedPaperCategories: new Set(["shengxuan", "shuxuan", "banshuxuan"]),
  unlockedPaperItems: new Set(),
  unlockedKnowledgeCards: new Set(),
  paperShopStoryStage: 0,
  paperShopLevel: 1,
  paperCoins: 0,
  festivalBuffs: { luckyCharm: 0, bambooOil: 0 }, // 集市兑换的临时增益次数
  earnedStamps: new Set(),
  completedFestivalTasks: new Set(),
  festivalMilestoneShown: false,
  storyChapter: 1,           // 主线章节 1-3
  storyMilestones: {},       // 章节内里程碑 { "firstPaper": true, "firstOrder": false, ... }
  ordersCompleted: 0,        // 累计完成订单数
  finaleShown: false,
  festivalCompleteShown: false,
  orderComplete: false,
  modalOpen: false,
  // UI 导航统一由这里维护，避免每个弹窗各自关闭后直接丢失来源页面。
  pageStack: [],
  currentPage: "map",
  currentPageOptions: null,
  miniGame: null,
  debugMode: false,
  toastTimer: null,
  joystickVector,
  joystickActive: false,
  joystickPointerId: null,
  npcDialogueIndex: Object.fromEntries(Object.entries(MARKET_NPC_DIALOGUES).map(([id, dialogue]) => [
    id,
    dialogue.bubbleLines ? Math.floor(Math.random() * dialogue.bubbleLines.length) : 0
  ])),
  nearbyNpcDialogueId: null
};

// 根据宣纸铺柜台位置调整此坐标：用于打开“宣纸铺·分类图鉴”。
const paperShopInteractZone = { x: 650, y: 716, width: 182, height: 86 };

const interactionZones = [
  // 热区顺着山径延展，避免入口牌坊和山石把可交互点卡在不可站立的位置。
  { id: "qingtanForest", name: "青檀林入口", prompt: "进入青檀林，寻找纸的筋骨", mobilePrompt: "进入青檀林", x: 134, y: 108, width: 142, height: 184 },
  // 溪边小路是玩家从老街前往林口的实际通道；与牌坊入口通向同一段剧情，避免路线被水面与水车碰撞打断。
  { id: "qingtanForestTrail", name: "溪边小路 · 青檀林入口", prompt: "沿溪边小路前往青檀林", mobilePrompt: "前往青檀林", x: 280, y: 430, width: 160, height: 190 },
  { id: "dryingYard", name: "晒纸场", prompt: "查看晒纸场", x: 744, y: 250, width: 76, height: 118 },
  { id: "calligraphyShop", name: "书画铺", prompt: "查看订单看板", x: 566, y: 408, width: 88, height: 60 },
  { id: "workshop", name: "宣纸工坊区", prompt: "进入工坊", x: 1200, y: 374, width: 116, height: 54 },
  { id: "waterWheel", name: "水车", prompt: "查看水车", x: 318, y: 618, width: 96, height: 74 },
  {
    id: "paperShop",
    name: "宣纸铺·分类图鉴",
    prompt: "查看宣纸分类图鉴",
    mobilePrompt: "查看宣纸分类图鉴",
    ...paperShopInteractZone
  },
  { id: "museum", name: "非遗馆", prompt: "进入非遗馆", x: 1160, y: 714, width: 158, height: 84 },
  { id: "market", name: "纸境千年", prompt: "前往纸境千年", mobilePrompt: "进入纸境千年", x: 540, y: 800, width: 430, height: 140 },
];

const collisionBoxes = [
  // 左侧溪流和水面
  { id: "streamUpperWater", name: "溪流上段水面", x: 286, y: 142, width: 122, height: 260 },
  { id: "streamMiddleWater", name: "溪流中段水面", x: 0, y: 396, width: 272, height: 328 },
  { id: "streamBridgeLeftWater", name: "木桥左侧水面", x: 0, y: 815, width: 92, height: 209 },
  { id: "streamBridgeRightWater", name: "木桥右侧水面", x: 222, y: 846, width: 130, height: 178 },

  // 左上青檀林山石
  { id: "qingtanForestTopTrees", name: "青檀林树冠", x: 0, y: 0, width: 360, height: 70 },
  { id: "qingtanForestLeftRocks", name: "青檀林山石", x: 0, y: 70, width: 124, height: 318 },
  { id: "qingtanForestRightRocks", name: "青檀林山石", x: 286, y: 70, width: 122, height: 164 },

  // 水车
  { id: "waterWheelHouse", name: "水车棚", x: 150, y: 494, width: 152, height: 96 },
  { id: "waterWheelBody", name: "水车轮", x: 182, y: 548, width: 116, height: 118 },
  { id: "waterWheelPlatform", name: "水车木台", x: 300, y: 540, width: 116, height: 74 },

  // 晒纸架
  { id: "dryingRacksLeft", name: "晒纸架", x: 510, y: 70, width: 198, height: 168 },
  { id: "dryingRacksRight", name: "晒纸架", x: 740, y: 76, width: 210, height: 174 },

  // 书画铺建筑
  { id: "calligraphyShopRoof", name: "书画铺屋顶主体", x: 410, y: 232, width: 328, height: 58 },
  { id: "calligraphyShopLeftWing", name: "书画铺左侧建筑", x: 410, y: 290, width: 142, height: 118 },
  { id: "calligraphyShopDoorInterior", name: "书画铺门内限制区", x: 552, y: 290, width: 102, height: 108 },
  { id: "calligraphyShopRightWing", name: "书画铺右侧建筑", x: 654, y: 290, width: 84, height: 118 },
  { id: "westOldStreetLeftBuilding", name: "老街左侧建筑主体", x: 390, y: 338, width: 148, height: 140 },
  { id: "westOldStreetRightBuilding", name: "老街右侧建筑主体", x: 676, y: 338, width: 54, height: 72 },

  // 茶馆建筑
  { id: "teaHouseBuilding", name: "茶馆建筑主体", x: 823, y: 172, width: 260, height: 210 },
  { id: "teaHouseOutdoorTables", name: "茶馆桌椅", x: 823, y: 368, width: 72, height: 40 },

  // 右上工坊建筑和水缸
  { id: "workshopBackBuildings", name: "工坊后排建筑", x: 1040, y: 62, width: 440, height: 132 },
  { id: "workshopTools", name: "工坊工具台", x: 1010, y: 180, width: 118, height: 134 },
  { id: "workshopVats", name: "工坊纸浆池", x: 1158, y: 204, width: 270, height: 104 },
  { id: "workshopBarrels", name: "工坊大水缸", x: 1118, y: 292, width: 132, height: 90 },
  { id: "workshopFence", name: "工坊围栏", x: 1254, y: 330, width: 196, height: 62 },

  // 宣纸铺建筑
  { id: "paperShopBuilding", name: "宣纸铺建筑主体", x: 548, y: 520, width: 360, height: 196 },
  { id: "paperShopFrontLeftObjects", name: "宣纸铺门前杂物", x: 540, y: 736, width: 72, height: 48 },
  { id: "paperShopFrontRightObjects", name: "宣纸铺门前杂物", x: 842, y: 734, width: 84, height: 48 },

  // 非遗馆建筑
  { id: "museumBuilding", name: "非遗馆建筑主体", x: 1060, y: 512, width: 350, height: 202 },
  { id: "museumLeftFlowerbed", name: "非遗馆花坛", x: 1014, y: 690, width: 92, height: 76 },
  { id: "museumRightFlowerbed", name: "非遗馆花坛", x: 1344, y: 672, width: 72, height: 96 },

  // 右侧竹林
  { id: "rightBambooTop", name: "右侧竹林", x: 1345, y: 0, width: 191, height: 365 },
  { id: "rightBambooMiddle", name: "右侧竹林", x: 1420, y: 365, width: 116, height: 310 },
  { id: "rightBambooBottom", name: "右下竹林", x: 1372, y: 715, width: 164, height: 309 },

  // 下方摊位和花坛
  { id: "marketLeftStalls", name: "集市摊位", x: 530, y: 832, width: 112, height: 62 },
  { id: "marketRightStalls", name: "集市摊位", x: 872, y: 832, width: 108, height: 64 },
  { id: "marketCenterStatue", name: "小广场石台", x: 682, y: 828, width: 108, height: 96 },
  { id: "bottomForestLeft", name: "下方边缘树丛", x: 0, y: 945, width: 490, height: 79 },
  { id: "bottomForestRight", name: "下方边缘树丛", x: 1015, y: 940, width: 521, height: 84 }
];

const paperStats = {
  Perfect: { toughness: 85, ink: 88, evenness: 92, whiteness: 80, durability: 86 },
  Good: { toughness: 75, ink: 78, evenness: 80, whiteness: 76, durability: 78 },
  Miss: { toughness: 60, ink: 65, evenness: 55, whiteness: 70, durability: 62 }
};

// ========================================
// 工坊升级系统
// ========================================
const UPGRADES = {
  bambooMat: {
    id: "bambooMat",
    name: "竹帘品质",
    desc: "指针判定区域扩大，更容易出Perfect",
    cost: 200,
    effect: "perfectRange",
    icon: "🎋"
  },
  pulpRecipe: {
    id: "pulpRecipe",
    name: "纸浆配方",
    desc: "纸张基础属性+10%",
    cost: 150,
    effect: "baseBuff",
    icon: "🧪"
  },
  workbench: {
    id: "workbench",
    name: "工作台",
    desc: "制作动画加快20%",
    cost: 300,
    effect: "speedBuff",
    icon: "🔨"
  },
  barkStorage: {
    id: "barkStorage",
    name: "树皮仓库",
    desc: "每日树皮采集上限+10",
    cost: 250,
    effect: "storageBuff",
    icon: "🏠"
  }
};

// ========================================
// 扩展NPC订单系统 - 12位有故事的街坊
// 每一位NPC都有独特背景、需求对话和科普知识
// ========================================
const ORDER_TYPES = [
  // ---- 基础订单（声望0解锁） ----
  {
    id: "calligraphyMaster",
    name: "普通订单",
    npc: "书法家王大爷",
    paperType: "生宣",
    requirements: { ink: 75, evenness: 75, toughness: 70 },
    reward: { gold: 80, reputation: 10 },
    timeLimit: null,
    dialogue: '这张纸吸墨要稳，纸面得匀。写行草最怕纸面跳墨。',
    scienceTip: '生宣未经过胶矾加工，保留了原纸较强的吸水性和渗化性。青檀皮纤维较长，带来韧性与拉力；稻草纤维较短，帮助形成均匀细密的纸面。'
  },
  {
    id: "masterLi",
    name: "普通订单",
    npc: "画师李姐",
    paperType: "半熟宣",
    requirements: { ink: 70, evenness: 80, toughness: 75 },
    reward: { gold: 90, reputation: 12 },
    timeLimit: null,
    dialogue: '我画花鸟小写意，纸要半生不熟的，既有点墨韵又不能洇太大。',
    scienceTip: '半熟宣不是固定工艺名，而是"半生半熟"的纸性状态。它通常经过轻度施胶或压光处理，吸水速度介于生宣和熟宣之间，容错率高，尤其适合新手。'
  },
  {
    id: "academyStudent",
    name: "普通订单",
    npc: "书院学生小陈",
    paperType: "生宣",
    requirements: { ink: 70, evenness: 70, toughness: 65 },
    reward: { gold: 60, reputation: 8 },
    timeLimit: null,
    dialogue: '先生要我交一幅大字作业，我挑了半天纸，还是老街的宣纸最靠谱。',
    scienceTip: '宣纸有"千年寿纸"之称，因其纤维原料——青檀皮和沙田稻草——富含纤维素且杂质少，加上传统的碱性制浆工艺，纸张不易酸化老化，可以保存数百年。'
  },
  {
    id: "calligraphyApprentice",
    name: "普通订单",
    npc: "书法学徒小赵",
    paperType: "半熟宣",
    requirements: { ink: 65, evenness: 70, toughness: 65 },
    reward: { gold: 50, reputation: 6 },
    timeLimit: null,
    dialogue: '我才学书法半年，想买些不太贵的纸来练手。您推荐哪种？',
    scienceTip: '练习书法建议选半熟宣或机制毛边纸，性价比高且容错率好。熟练后再尝试生宣——生宣最考验控墨功力，一笔下去便无法修改。'
  },

  // ---- 精品订单（声望>=25解锁） ----
  {
    id: "premiumCourt",
    name: "精品订单",
    npc: "宫廷画师",
    paperType: "熟宣",
    requirements: { ink: 85, evenness: 85, toughness: 85, whiteness: 85, durability: 85 },
    reward: { gold: 200, reputation: 25 },
    timeLimit: null,
    unlockRep: 25,
    dialogue: '本官要画一幅工笔花鸟，线条必须纤毫毕现。纸不能洇，墨色边界要稳。',
    scienceTip: '熟宣是在生宣基础上经过胶矾加工而成。胶质在纸面和纤维之间形成阻隔，使水墨不易渗入；矾帮助固定胶料，让纸面的渗化性大大降低。尤其适合工笔画的精细勾线和反复设色。'
  },
  {
    id: "mountMaster",
    name: "精品订单",
    npc: "装裱匠人张叔",
    paperType: "生宣",
    requirements: { toughness: 88, evenness: 82, durability: 85 },
    reward: { gold: 180, reputation: 22 },
    timeLimit: null,
    unlockRep: 25,
    dialogue: '裱画的纸，韧性得好，耐久度得高。一张好裱能让画多传三代人。',
    scienceTip: '装裱是中国书画特有的保护工艺，用宣纸、绫绢等材料对原画进行托裱、覆背。宣纸之所以适合装裱，是因为其纤维弹性好、干湿收缩率小，能随画心一起"呼吸"，不易变形开裂。'
  },
  {
    id: "collectorChen",
    name: "精品订单",
    npc: "收藏家老陈",
    paperType: "熟宣",
    requirements: { whiteness: 90, durability: 88, evenness: 85 },
    reward: { gold: 220, reputation: 28 },
    timeLimit: null,
    unlockRep: 35,
    dialogue: '我收了一幅民国小楷，想配一张纸色相近、纸面细腻的老宣纸来衬托。',
    scienceTip: '宣纸的"洁白度"并非越白越好。传统宣纸呈自然的象牙白色，是因为原料未经过强漂白处理，保留了纤维本来的色泽。这种自然白度不刺眼，墨色落上去更柔和。'
  },

  // ---- 限时订单（声望>=45解锁） ----
  {
    id: "timedScholar",
    name: "限时订单",
    npc: "赶考书生",
    paperType: "半熟宣",
    requirements: { evenness: 80, durability: 78, toughness: 75 },
    reward: { gold: 150, reputation: 18 },
    timeLimit: 30,
    unlockRep: 45,
    dialogue: '明日便要赴京赶考，急需一批试卷用纸！拜托您快些！',
    scienceTip: '宣纸的"均匀度"取决于抄纸时纸浆在竹帘上的分布是否均匀。造纸工匠全凭手腕控制竹帘入水的角度和力度，让纤维在帘面上交错重叠，形成厚薄一致的纸胎。'
  },
  {
    id: "timedTeaMaster",
    name: "限时订单",
    npc: "日本茶人铃木",
    paperType: "生宣",
    requirements: { ink: 82, toughness: 80, whiteness: 78 },
    reward: { gold: 170, reputation: 20 },
    timeLimit: 35,
    unlockRep: 50,
    dialogue: '在下仰慕中国宣纸已久，想带一批回京都与茶友分享。请多关照！',
    scienceTip: '宣纸在日本被称为"画仙纸"，深受日本书道界推崇。唐代时中国造纸术传入日本，日本在和纸的基础上发展出了自己的造纸体系。但宣纸因青檀皮原料独特，至今仍是书画用纸中的上品。'
  },

  // ---- 定制订单（完成纸境千年问答后解锁） ----
  {
    id: "customPorcelain",
    name: "定制订单",
    npc: "瓷器商人白老爷",
    paperType: "半熟宣",
    requirements: { evenness: 82, durability: 80, toughness: 78 },
    reward: { gold: 250, reputation: 35 },
    timeLimit: null,
    unlockRep: 55,
    dialogue: '我新进了一批青花瓷，想画几幅宣纸上的"青花图"配在一起陈列。您说用什么纸好？',
    scienceTip: '青花瓷的蓝色来自钴料，而中国画中的"墨分五色"——焦、浓、重、淡、清——靠的是水和墨在宣纸上的渗化。瓷与纸，一刚一柔，都是中国美学的载体。'
  },
  {
    id: "customPoet",
    name: "定制订单",
    npc: "流浪诗人柳生",
    paperType: "生宣",
    requirements: { ink: 85, evenness: 80, toughness: 75 },
    reward: { gold: 300, reputation: 40 },
    timeLimit: null,
    unlockRep: 60,
    dialogue: '在下云游四海，每到一处便写诗记之。想买一种"让墨能自由奔跑"的纸。',
    scienceTip: '墨在宣纸上"跑"的过程，本质是液体在毛细管中的渗吸现象。生宣纤维间的微小孔隙形成天然"墨道"，墨汁沿纤维方向扩散，产生浓淡、干湿、虚实的丰富变化——这就是"墨韵"。'
  }
];

const legacyKnowledgeCardIds = [
  "青檀树皮",
  "沙田稻草",
  "抄纸手法",
  "晒纸工艺",
  "吸墨性",
  "纸寿千年",
  "生宣与熟宣",
  "七十二道工序",
  "泾县宣纸",
  "墨分五色",
  "非遗传承",
  "书画同源"
];

// 《纸谱十二笺》：主线把科普放回到“帮人用对纸”的过程里。
const STORY_ASSETS = Object.freeze({
  paperSlip: "assets/story/paper-slip.png",
  paperCodexBook: "assets/story/paper-codex-book.png",
  grandmaNote: "assets/story/grandma-note.png",
  qingtanBark: "assets/story/qingtan-bark.png",
  riceStraw: "assets/story/rice-straw.png",
  bambooScreen: "assets/story/bamboo-screen-paper.png",
  dryingWall: "assets/story/drying-paper-wall.png",
  inkSpread: "assets/story/ink-spread.png",
  glueAlum: "assets/story/glue-alum-bowl.png",
  museumDisplay: "assets/story/museum-display-lit.png",
  paperFlake: "assets/story/paper-flake.png",
  lockedSlip: "assets/story/paper-slip-locked.png"
});

const PAPER_SLIPS = Object.freeze([
  { id: "qingtan-bark", title: "青檀为骨", subtitle: "长纤维撑起纸的筋骨", icon: "qingtanBark", shortText: "青檀皮纤维较长，是宣纸韧性、拉力和耐久性的重要来源。", longText: "宣纸以青檀皮和沙田稻草为主要原料。青檀皮的韧皮纤维较长，能为纸张带来较好的拉力与韧性，也是其耐久性的重要原因之一。", unlockBy: "在青檀林回答装裱用纸的判断题", relatedLocation: "青檀林入口", question: "装裱匠人最看重宣纸的哪项性能？", options: ["香味", "韧性和耐久", "颜色越白越好"], answer: "韧性和耐久", wrongHint: "装裱要经受湿润、托裱与时间，纸的筋骨比香味更重要。", rewardText: "纸谱残页归位：青檀为骨" },
  { id: "rice-straw", title: "稻草为肌", subtitle: "短纤维织出细密纸面", icon: "riceStraw", shortText: "沙田稻草纤维较短，与青檀皮交织，有助于纸面细密、均匀。", longText: "沙田稻草纤维相对较短，与青檀皮纤维搭配后能帮助纸浆在帘面上形成较均匀、细密的结构。原料配比会影响纸张的纸面与使用感受。", unlockBy: "在水车旁回答稻草纸性判断题", relatedLocation: "水车", question: "沙田稻草主要帮助纸张形成什么特点？", options: ["更均匀细密的纸面", "更浓的香气", "更鲜艳的颜色"], answer: "更均匀细密的纸面", wrongHint: "想想短纤维在纸浆里能怎样填补纸面。", rewardText: "纸谱残页归位：稻草为肌" },
  { id: "bamboo-screen", title: "一帘成纸", subtitle: "稳住竹帘，稳住纸面", icon: "bambooScreen", shortText: "纸浆在竹帘上分布越均匀，纸张厚薄和纹理越稳定。", longText: "抄纸时，工匠以竹帘从纸浆中捞起纤维。入水的角度、提帘的力度和手腕的节奏，都会影响纤维在帘面上的分布，进而影响纸张厚薄与纹理。", unlockBy: "完成一次工坊制纸", relatedLocation: "宣纸工坊区", question: "竹帘上的纸浆最需要保持什么？", options: ["均匀分布", "越厚越好", "颜色越白越好"], answer: "均匀分布", wrongHint: "纸面稳定，先要让纤维在帘上铺得匀。", rewardText: "纸谱残页归位：一帘成纸" },
  { id: "drying", title: "晒纸定形", subtitle: "干燥决定平整与韧性", icon: "dryingWall", shortText: "晒纸或烘干会影响纸张平整度、韧性和后续书画表现。", longText: "湿纸在晒纸场或焙干过程中逐渐定形。温度、湿度与时间都要合适；干燥不匀可能影响纸面平整与韧性，也会影响后续书写、绘画的手感。", unlockBy: "完成一次晒纸场任务", relatedLocation: "晒纸场", question: "晒纸主要影响纸张的什么？", options: ["平整度和韧性", "纸的香味", "笔的颜色"], answer: "平整度和韧性", wrongHint: "湿纸变成可用的纸，关键在于干燥后的纸面状态。", rewardText: "纸谱残页归位：晒纸定形" },
  { id: "ink-door", title: "墨韵之门", subtitle: "让墨在纸上自然行走", icon: "inkSpread", shortText: "生宣吸水、渗化较强，适合表现书法和写意画的墨色变化。", longText: "宣纸的吸墨表现和纤维结构、孔隙、打浆程度等有关。生宣未经胶矾处理，渗化相对较强，常用于需要浓淡、干湿、虚实变化的书法与写意画。", unlockBy: "帮王大爷选择行草用纸", relatedLocation: "宣纸铺 / 书画铺", question: "王大爷写行草，想让墨色有浓淡变化，应该推荐哪种纸？", options: ["生宣", "熟宣", "粉蜡笺"], answer: "生宣", wrongHint: "行草要的是墨气活，不是把线条完全锁住。", rewardText: "纸谱残页归位：墨韵之门" },
  { id: "glue-alum", title: "胶矾定性", subtitle: "让线条更容易站稳", icon: "glueAlum", shortText: "熟宣经胶矾等加工，渗化减弱，适合工笔勾线和反复设色。", longText: "熟宣在原纸基础上经过胶矾等处理，水墨渗化会减弱，线条和设色更容易控制。因此它常被用于工笔勾线、小楷或需要反复设色的绘画。", unlockBy: "完成宫廷画师的工笔订单", relatedLocation: "书画铺", question: "工笔画师要反复设色、线条清楚，应该选哪种纸？", options: ["生宣", "熟宣", "洒金宣"], answer: "熟宣", wrongHint: "工笔需要可控性，想想哪种纸处理后更不易洇开。", rewardText: "纸谱残页归位：胶矾定性" },
  { id: "half-cooked", title: "半生半熟", subtitle: "在墨韵与控制之间", icon: "paperSlip", shortText: "半熟宣纸性介于生宣和熟宣之间，兼具一定墨韵和可控性。", longText: "半熟宣常指纸性介于生宣与熟宣之间的纸。它保留一些水墨渗化效果，同时又比生宣更容易控制，适合希望有墨韵又不想洇得太开的使用场景。", unlockBy: "完成李姐的花鸟小写意订单", relatedLocation: "书画铺", question: "花鸟小写意想留一点墨韵，又怕洇太开，应该选什么？", options: ["半熟宣", "熟宣", "粉蜡笺"], answer: "半熟宣", wrongHint: "这位画师要的是两种纸性之间的平衡。", rewardText: "纸谱残页归位：半生半熟" },
  { id: "millennium", title: "纸寿千年", subtitle: "一张纸也能陪书画很久", icon: "paperSlip", shortText: "宣纸绵韧耐久，适合书画保存、装裱和修复等用途。", longText: "宣纸因原料和传统制浆工艺等因素，具有较好的绵韧与耐久性。它适合书画装裱、修复和长期保存，但保存环境仍需注意湿度、光照与虫害。", unlockBy: "完成装裱匠人订单", relatedLocation: "书画铺 / 非遗馆", question: "托裱用纸最重要的品质是什么？", options: ["韧性和耐久", "金色装饰", "强烈香气"], answer: "韧性和耐久", wrongHint: "装裱是为了保护书画，纸需要经得住湿润与时间。", rewardText: "纸谱残页归位：纸寿千年" },
  { id: "crafts", title: "百工成纸", subtitle: "好纸离不开人的手感", icon: "paperSlip", shortText: "传统宣纸制作有多道手工工序，许多环节依赖工匠经验。", longText: "从制料、制浆到捞纸、晒纸、剪纸，传统宣纸制作包含多道工序。机器能提供辅助，但纸浆状态、提帘节奏和干燥判断等环节仍高度依赖人的经验与手感。", unlockBy: "完成集市匠人摊问答", relatedLocation: "纸境千年集市", question: "为什么传统宣纸制作不能只靠机器完全替代？", options: ["颜色越手工越白", "抄纸、晒纸等依赖经验和手感", "机器不能切纸"], answer: "抄纸、晒纸等依赖经验和手感", wrongHint: "重点不在机器会不会做动作，而在细微状态如何判断。", rewardText: "纸谱残页归位：百工成纸" },
  { id: "wax", title: "粉蜡细线", subtitle: "细腻纸面承住小楷", icon: "paperSlip", shortText: "粉蜡笺纸面细腻平滑，适合小楷和精细线条表现。", longText: "粉蜡笺通常经过填粉、涂蜡、砑光等处理，纸面较细腻平滑。它适合小楷、细线描绘等需要稳定线条的场景，使用时也要根据笔墨习惯调整。", unlockBy: "完成集市书画摊问答", relatedLocation: "纸境千年集市", question: "小楷需要线条稳定、纸面细腻，应选哪种纸？", options: ["生宣", "粉蜡笺", "洒金宣"], answer: "粉蜡笺", wrongHint: "小楷强调线条细稳，装饰感不是第一需要。", rewardText: "纸谱残页归位：粉蜡细线" },
  { id: "gold", title: "洒金入笺", subtitle: "把节令心意洒进纸面", icon: "paperSlip", shortText: "洒金宣纸面带装饰性金屑，适合礼品、题跋和雅致册页。", longText: "洒金宣会在纸面加入装饰性的金屑或金片，视觉效果华丽而雅致。它常用于题跋、册页、礼品与节令场景，重点是装饰性，而非替代普通书画用纸。", unlockBy: "完成集市文创摊问答", relatedLocation: "纸境千年集市", question: "想做有节日感的题字礼品，哪种纸更合适？", options: ["生宣", "熟宣", "洒金宣"], answer: "洒金宣", wrongHint: "这位客人要的是礼品的雅致与装饰感。", rewardText: "纸谱残页归位：洒金入笺" },
  { id: "zhuchui", title: "煮硾练纸", subtitle: "捶压让纸面更紧实", icon: "paperSlip", shortText: "煮硾宣经蒸煮、捶压等加工，纸面更紧实，吸水速度会降低。", longText: "煮硾宣通过润纸、蒸煮、捶压与压实等加工，让纤维结构更紧密。这样会改变纸面的吸水与渗化表现，使其更适合需要较稳纸性的使用场景。", unlockBy: "完成集市工艺摊问答", relatedLocation: "纸境千年集市", question: "不用重胶重矾，靠捶压让纸面更紧实的工艺是什么？", options: ["洒金", "煮硾", "染色"], answer: "煮硾", wrongHint: "题目说的是蒸煮、捶压与压实，不是装饰工艺。", rewardText: "纸谱残页归位：煮硾练纸" }
]);

const STORY_CHOICE_CASES = Object.freeze({
  ink: "ink-door",
  qingtan: "qingtan-bark",
  rice: "rice-straw"
});

// 七张纸页是本次游玩的轻量主线：不写入本地存档，刷新后从头开始。
const PAPER_PAGES = Object.freeze({
  qingtan: { title: "青檀纸页", asset: "assets/story/paper-page-qingtan.png", text: "青檀皮是宣纸重要原料之一。合理保护原料林，才能让手艺长期延续。", hint: "去青檀林入口，听护林老人讲一片林的来处。" },
  straw: { title: "稻草纸页", asset: "assets/story/paper-page-straw.png", text: "沙田稻草经处理后参与制浆，影响纸张的纸面与使用表现。", hint: "去集市，帮游客看懂一张纸背后的原料。" },
  water: { title: "水纹纸页", asset: "assets/story/paper-page-water.png", text: "纤维在水中分散得更均匀，有助于纸张厚薄和纸面更稳定。", hint: "去水车旁，帮师傅恢复纸浆的水路。" },
  craft: { title: "工艺纸页", asset: "assets/story/paper-page-craft.png", text: "原料加工、制浆、捞纸、晒纸、剪纸等环节都会影响成纸质量。", hint: "去工坊，让学徒明白每一道工序的意义。" },
  drying: { title: "晒纸纸页", asset: "assets/story/paper-page-drying.png", text: "晒纸与干燥会影响纸张的平整度、质感和后续整理效果。", hint: "去晒纸场，帮老人找出状态刚好的纸。" },
  paperNature: { title: "纸性纸页", asset: "assets/story/paper-page-nature.png", text: "生宣、熟宣、半熟宣的纸性不同，适合承接不同的笔墨与设色。", hint: "打开外婆的旧账本，替不同的用纸人配纸。" },
  heritage: { title: "传承纸页", asset: "assets/story/paper-page-heritage.png", text: "非遗保护不只在展柜里，也在原料保护、技艺传承与持续使用中。", hint: "让前六张纸页归位后，前往非遗馆。" }
});

const quests = Object.freeze({
  paperShop: { id: "paperShop", page: "paperNature", title: "外婆的旧账本", npc: "外婆", before: "纸不是摆在架上等人买的。先懂它要承接什么样的墨。", after: "你已经能替一张纸说话了。", question: "王大爷写行草，想让墨色有变化，应该先看重哪种纸性？", options: ["生宣", "熟宣", "粉蜡笺"], answer: "生宣", reason: "生宣吸水、渗化较强，更适合表现行草和写意中的墨色变化。" },
  marketPainter: { id: "marketPainter", page: "paperNature", title: "买错纸的小画师", npc: "小画师", before: "我的花瓣边缘怎么一下全晕开了？", after: "下次画工笔，我会记得选更容易控制的纸。", question: "观察到生宣标签和扩散墨迹后，最可能的原因是？", options: ["你用的是生宣，吸水渗化较强", "毛笔坏了", "墨太浓"], answer: "你用的是生宣，吸水渗化较强", reason: "细线与设色需要更可控的纸性；熟宣经胶矾等加工，渗化减弱。" },
  marketTourist: { id: "marketTourist", page: "straw", title: "一张纸为什么珍贵", npc: "游客", before: "不就是一张纸吗，为什么这么贵？", after: "原来我买到的是地方原料、时间和手艺。", question: "哪一组线索最能说明宣纸背后的成本？", options: ["青檀皮、稻草、捞纸手感", "更亮的包装", "更大的招牌"], answer: "青檀皮、稻草、捞纸手感", reason: "宣纸的价值来自地方原料、处理时间与手工经验，而不只是成品纸张。" },
  forest: { id: "forest", page: "qingtan", title: "不能随便砍的树", npc: "护林老人", before: "林子不是仓库，不能只取不养。", after: "你记住了，宣纸的根在山里。", question: "订单多时，为什么也不能过度采剥青檀皮？", options: ["会影响原料林恢复与长期利用", "树皮越多纸一定越好", "只要有稻草就行"], answer: "会影响原料林恢复与长期利用", reason: "青檀皮是重要原料之一，原料保护与可持续利用同样属于传承。" },
  waterwheel: { id: "waterwheel", page: "water", title: "水车停了", npc: "工坊师傅", before: "水路不顺，纸浆就难分得匀。", after: "你手里拿的不是纸浆，是时间。", question: "修好水车后，纸浆在水里最需要达到什么状态？", options: ["纤维分散均匀", "越稠越好", "颜色越深越好"], answer: "纤维分散均匀", reason: "纸浆分布是否均匀，会影响纸张厚薄、均匀度和成纸质量。" },
  workshopProcess: { id: "workshopProcess", page: "craft", title: "纸不是赶出来的", npc: "工坊师傅", before: "你看到的是最后几步，看不到的是前面的时间。", after: "每一道工序，都在替下一道工序铺路。", question: "请先点出制纸流程的第一步。", options: ["皮料加工", "捞纸", "晒纸"], answer: "皮料加工", reason: "原料处理、制浆、捞纸、晒纸、剪纸等环节相互关联，不能只看最后的捞纸。" },
  dryingYard: { id: "dryingYard", page: "drying", title: "纸晒到刚好", npc: "晒纸老人", before: "什么时候揭、什么时候整，都要靠眼力。", after: "能看懂纸的干湿，才算入门。", question: "哪一种状态最适合继续整纸？", options: ["刚好", "太湿", "过干起皱"], answer: "刚好", reason: "晒纸与干燥会影响纸张平整度和质感，需要根据纸的状态判断时机。" },
  museum: { id: "museum", page: "heritage", title: "七页点亮展柜", npc: "非遗馆馆长", before: "展柜里放的是物，故事要靠人讲。", after: "老街亮了，纸也有了声音。", question: "非遗传承除了展示，还要做什么？", options: ["保护原料、传承技艺并持续使用", "只把旧物锁起来", "只办一次展览"], answer: "保护原料、传承技艺并持续使用", reason: "非遗保护包括原料保护、技艺传承、活态使用与文化传播。" }
});

const introScreen = document.querySelector("#introScreen");
const gameScreen = document.querySelector("#gameScreen");
const mapViewport = document.querySelector("#mapViewport");
const mapWorld = document.querySelector("#mapWorld");
const streetMap = document.querySelector("#streetMap");
const streetForeground = document.querySelector("#streetForeground");
const playerEl = document.querySelector("#player");
const mapDebugLayer = document.querySelector("#mapDebugLayer");
const interactionPrompt = document.querySelector("#interactionPrompt");
const debugReadout = document.querySelector("#debugReadout");
const modalLayer = document.querySelector("#modalLayer");
const modalCard = document.querySelector("#modalCard");
const pauseLayer = document.querySelector("#pauseLayer");
const orientationHint = document.querySelector("#orientationHint");
const mobilePauseButton = document.querySelector("#mobilePauseButton");
const mobileControls = document.querySelector("#mobileControls");
const joystickBase = document.querySelector("#joystickBase");
const joystickStick = document.querySelector("#joystickStick");
const toast = document.querySelector("#toast");
const coinText = document.querySelector("#coinText");
const reputationText = document.querySelector("#reputationText");
const taskSteps = document.querySelector("#taskSteps");
const paperPagesButton = document.querySelector("#paperPagesButton");

// NPC 对话气泡 DOM 缓存，applyMapLayout 时重置
let _npcDialogueCache = null;

function paperPageCount() {
  return Object.values(state.paperPages).filter(Boolean).length;
}

function completeQuest(questId) {
  const quest = quests[questId];
  if (!quest || state.completedQuests.has(questId)) return false;
  state.completedQuests.add(questId);
  state.paperPages[quest.page] = true;
  state.coins += 15;
  updateHud();
  showToast(`纸页归位：${PAPER_PAGES[quest.page].title}`);
  // 完成"帮学徒理清工序"后解锁工坊小游戏
  if (questId === "workshopProcess") {
    state.flags.apprenticeProcessCleared = true;
    showToast("工序理清了，可以开始浸泡原料了。");
  }
  return true;
}

function isApprenticeProcessCleared() {
  return state.flags?.apprenticeProcessCleared === true
    || state.completedQuests?.has?.("workshopProcess") === true;
}

function requireApprenticeProcessCleared() {
  if (!state.flags) state.flags = {};
  // 兼容旧存档：如果 completedQuests 中已记录但 flags 未同步，自动补标
  if (state.completedQuests?.has?.("workshopProcess")) {
    state.flags.apprenticeProcessCleared = true;
    return true;
  }
  if (!isApprenticeProcessCleared()) {
    showToast("先帮学徒理清工序，才能开始制纸。");
    return false;
  }
  return true;
}

function openQuest(questId, feedback = "") {
  const quest = quests[questId];
  if (!quest) return;
  if (state.completedQuests.has(questId)) {
    openModal(`
      <section class="story-choice-card"><p class="story-choice-kicker">纸境千年 · 老街回音</p><h2>${quest.title}</h2><blockquote>${quest.after}</blockquote><button class="primary-btn" type="button" data-action="close">继续探索</button></section>
    `, "modal", "story-choice-modal");
    return;
  }
  const options = quest.options.map((option) => `<button class="story-choice-option" type="button" data-action="answerQuest" data-quest-id="${questId}" data-option="${option}">${option}</button>`).join("");
  openModal(`
    <section class="story-choice-card" aria-labelledby="questTitle">
      <p class="story-choice-kicker">${quest.npc} · 老街事件</p>
      <h2 id="questTitle">${quest.title}</h2>
      <blockquote>${quest.before}</blockquote>
      <p class="story-choice-question">${quest.question}</p>
      ${feedback ? `<p class="story-choice-hint">${feedback}</p>` : ""}
      <div class="story-choice-options">${options}</div>
      <button class="festival-text-btn" type="button" data-action="close">稍后再想</button>
    </section>
  `, "modal", "story-choice-modal");
}

function openQuestOnce(questId, completedMessage = "这个任务已经完成了。") {
  if (!questId) return false;
  if (state.completedQuests?.has?.(questId)) {
    showToast(completedMessage);
    return true;
  }
  openQuest(questId);
  return true;
}

function answerQuest(questId, option) {
  const quest = quests[questId];
  if (!quest) return;
  if (option !== quest.answer) {
    openQuest(questId, "再观察一下线索：这件事和纸的原料、纸性或工艺状态有关。 ");
    return;
  }
  const firstCompletion = completeQuest(questId);
  if (!firstCompletion) return openQuest(questId);
  if (questId === "museum" && paperPageCount() === 7) {
    openModal(`
      <section class="story-finale"><img src="assets/story/ui-paper-codex-panel.png" alt="" onerror="this.onerror=null;this.hidden=true"><p>纸境千年 · 纸页已归位</p><h2>七张纸页，唤醒老街</h2><blockquote>馆长说：‘你带回来的不是答案，是老街重新连起来的证据。’<br><br>外婆轻声道：‘宣纸是一片林、一条水、一双手，也是一代人传给下一代人的记忆。’</blockquote><div class="reward-items"><span>非遗馆展柜全部点亮</span><span>纸页 7 / 7</span></div><button class="primary-btn" type="button" data-action="openPaperPagesCodex">查看完整纸页图鉴</button></section>
    `, "modal", "story-finale-modal");
    return;
  }
  openModal(`
    <section class="paper-slip-reward-card"><img class="paper-slip-icon" src="${PAPER_PAGES[quest.page].asset}" alt="" onerror="this.onerror=null;this.hidden=true"><p class="paper-slip-kicker">七张纸页 · 老街苏醒</p><h2>纸页归位</h2><h3>${PAPER_PAGES[quest.page].title}</h3><p>${quest.reason}</p><div class="modal-actions"><button class="primary-btn" type="button" data-action="openWorkshop">进入工坊</button><button class="secondary-btn" type="button" data-action="openPaperPagesCodex">查看纸页</button></div></section>
  `, "modal", "paper-slip-reward-modal");
}

function openPaperPagesCodex() {
  const cards = Object.entries(PAPER_PAGES).map(([id, page]) => {
    const unlocked = state.paperPages[id];
    return `<article class="paper-codex-card ${unlocked ? "is-unlocked" : "paper-codex-locked"}"><img src="${page.asset}" alt="" onerror="this.onerror=null;this.hidden=true"><div><small>${unlocked ? "已归位" : "纸页尚未归位"}</small><h3>${unlocked ? page.title : "？？？"}</h3><p>${unlocked ? page.text : `线索：${page.hint}`}</p></div></article>`;
  }).join("");
  openModal(`
    <section class="paper-codex-panel" aria-labelledby="sevenPageTitle"><header class="paper-codex-header"><img src="assets/story/ui-paper-codex-panel.png" alt="" onerror="this.onerror=null;this.hidden=true"><div><p>外婆留下的《千年纸谱》</p><h2 id="sevenPageTitle">七张纸页</h2><span>纸页：<b>${paperPageCount()} / 7</b></span></div></header><p class="paper-codex-intro">本次游玩中，每帮一位老街的人解决一个与宣纸有关的小麻烦，就有一张纸页归位。</p><p class="paper-codex-session-state">本局进度仅在当前页面有效；刷新或重新打开游戏后会从头开始。</p><div class="paper-codex-grid">${cards}</div><div class="modal-actions"><button class="secondary-btn" type="button" data-action="openPaperCodex">查看纸谱十二笺</button>${closeBtn("返回老街")}</div></section>
  `, "modal", "paper-codex-modal");
}

function scaleRect(rect) {
  return {
    ...rect,
    x: rect.x * state.map.scaleX,
    y: rect.y * state.map.scaleY,
    width: rect.width * state.map.scaleX,
    height: rect.height * state.map.scaleY
  };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function rectsOverlap(a, b) {
  return a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y;
}

function pointInRect(point, rect) {
  return point.x >= rect.x &&
    point.x <= rect.x + rect.width &&
    point.y >= rect.y &&
    point.y <= rect.y + rect.height;
}

function playerMoveBounds() {
  const leftFoot = PLAYER_SPRITE.width / 2 - PLAYER_SPRITE.collisionOffsetX;
  const rightFoot = PLAYER_SPRITE.collisionOffsetX + PLAYER_SPRITE.collisionWidth - PLAYER_SPRITE.width / 2;
  const topFoot = PLAYER_SPRITE.height - PLAYER_SPRITE.collisionOffsetY;
  const mobileTopMargin = isMobileInput() ? PLAYER_SPRITE.height + 8 : topFoot;

  return {
    minX: leftFoot,
    maxX: state.map.width - rightFoot,
    minY: mobileTopMargin,
    maxY: state.map.height
  };
}

function playerBounds(x = state.player.x, y = state.player.y) {
  return {
    x: x - PLAYER_SPRITE.width / 2 + PLAYER_SPRITE.collisionOffsetX,
    y: y - PLAYER_SPRITE.height + PLAYER_SPRITE.collisionOffsetY,
    width: PLAYER_SPRITE.collisionWidth,
    height: PLAYER_SPRITE.collisionHeight
  };
}

function collidesAt(x, y) {
  const bounds = playerBounds(x, y);
  return collisionBoxes.some((box) => rectsOverlap(bounds, scaleRect(box)));
}

function startGame() {
  if (state.gameState !== "start") return;
  hideStartScreen();
  showToast("按 F2 可显示坐标调试层。");
}

function showStartScreen() {
  state.gameState = "start";
  state.introActive = true;
  state.modalOpen = false;
  state.pageStack = [];
  state.currentPage = "map";
  state.currentPageOptions = null;
  state.keys.clear();
  hideVirtualControls();
  modalLayer.classList.add("hidden");
  modalCard.innerHTML = "";
  pauseLayer.classList.add("hidden");
  interactionPrompt.classList.add("hidden");
  toast.classList.add("hidden");
  clearTimeout(state.toastTimer);
  introScreen.classList.remove("hidden");
  gameScreen.classList.add("hidden");
  detectPlatform(); // 开始界面也同步一次平台状态
}

function hideStartScreen() {
  state.gameState = "playing";
  state.introActive = false;
  state.pageStack = [];
  state.currentPage = "map";
  state.currentPageOptions = null;
  state.keys.clear();
  introScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
  detectPlatform(); // 进入游戏时确认平台
  resizeCamera();
  updateHud();
  updateMap();
  updateMobileControls();
}

function returnToStartScreen() {
  showStartScreen();
}

function setMobileVH() {
  document.documentElement.style.setProperty("--vh", `${window.innerHeight * 0.01}px`);
}

function resetJoystick() {
  joystickVector.x = 0;
  joystickVector.y = 0;
  state.joystickActive = false;
  state.joystickPointerId = null;
  if (joystickStick) joystickStick.style.transform = "translate(-50%, -50%)";
}

function updateJoystickFromPointer(event) {
  if (!joystickBase || state.gameState !== "playing") return;
  const rect = joystickBase.getBoundingClientRect();
  const centerX = rect.left + rect.width / 2;
  const centerY = rect.top + rect.height / 2;
  const maxRadius = rect.width * 0.34;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const rawDistance = Math.hypot(rawX, rawY);
  const distance = Math.min(maxRadius, rawDistance);
  const angle = Math.atan2(rawY, rawX);
  const stickX = distance * Math.cos(angle);
  const stickY = distance * Math.sin(angle);
  const distanceRatio = maxRadius ? distance / maxRadius : 0;
  const deadZone = 0.06;
  const activeRatio = distanceRatio <= deadZone
    ? 0
    : Math.min(1, Math.pow((distanceRatio - deadZone) / (1 - deadZone), 0.55) * 1.12);

  joystickVector.x = activeRatio * Math.cos(angle);
  joystickVector.y = activeRatio * Math.sin(angle);
  if (joystickStick) joystickStick.style.transform = `translate(${stickX - 24}px, ${stickY - 24}px)`;
}

function updateMobileControls() {
  // 仅在移动端执行，桌面端直接跳过
  if (currentPlatform === "desktop") {
    mobileControls?.classList.add("hidden");
    mobilePauseButton?.classList.add("hidden");
    orientationHint?.classList.add("hidden");
    resetJoystick();
    return;
  }
  const controlsEnabled = currentPlatform === "mobile" && state.gameState === "playing";
  const portrait = currentPlatform === "mobile" && window.innerHeight > window.innerWidth;

  mobileControls?.classList.toggle("hidden", !controlsEnabled);
  mobilePauseButton?.classList.toggle("hidden", !controlsEnabled);
  orientationHint?.classList.toggle("hidden", !portrait || state.gameState === "start");

  if (!controlsEnabled) resetJoystick();
}

function hideVirtualControls() {
  if (currentPlatform === "desktop") return; // 桌面端无需操作
  mobileControls?.classList.add("hidden");
  mobilePauseButton?.classList.add("hidden");
  orientationHint?.classList.add("hidden");
  resetJoystick();
}

function syncPageUi() {
  updateHud();
  state.keys.clear();
  interactionPrompt.classList.toggle("hidden", state.gameState !== "playing");
  if (state.gameState === "playing") updateMap();
  updateMobileControls();
}

function renderPage(pageName, options = {}) {
  const isPause = options.type === "pause" || pageName === "pause";
  if (pageName === "map") {
    state.gameState = "playing";
    state.modalOpen = false;
    state.miniGame = null;
    modalLayer.classList.add("hidden");
    modalCard.className = "modal-card";
    modalCard.innerHTML = "";
    pauseLayer.classList.add("hidden");
  } else if (isPause) {
    state.gameState = "paused";
    state.modalOpen = false;
    modalLayer.classList.add("hidden");
    pauseLayer.classList.remove("hidden");
  } else {
    state.gameState = options.nextState || "modal";
    state.modalOpen = true;
    pauseLayer.classList.add("hidden");
    modalCard.className = `modal-card${options.cardClass ? ` ${options.cardClass}` : ""}`;
    modalCard.innerHTML = options.html || "";
    modalLayer.classList.remove("hidden");
  }
  syncPageUi();
}

// 所有 UI 页面都从此处进入；栈内保存的是可重新渲染的页面描述，而不是 DOM 引用。
function openPage(pageName, options = {}) {
  const nextOptions = { ...options };
  const replaceCurrent = Boolean(nextOptions.replace) || state.currentPage === pageName;
  if (!replaceCurrent) {
    state.pageStack.push({
      pageName: state.currentPage,
      options: state.currentPageOptions ? { ...state.currentPageOptions } : {}
    });
  }
  state.currentPage = pageName;
  state.currentPageOptions = nextOptions;
  renderPage(pageName, nextOptions);
}

// 当前页优先退出，随后恢复栈顶页面；没有历史时才回到主地图。
function goBackPage() {
  const previous = state.pageStack.pop();
  if (previous) {
    state.currentPage = previous.pageName;
    state.currentPageOptions = previous.options || null;
    renderPage(previous.pageName, previous.options);
    return true;
  }
  if (state.currentPage !== "map") {
    state.currentPage = "map";
    state.currentPageOptions = null;
    renderPage("map");
    return true;
  }
  return false;
}

function openPauseMenu() {
  if (state.gameState !== "playing") return;
  openPage("pause", { type: "pause" });
}

function closePauseMenu() {
  if (state.currentPage !== "pause") return;
  goBackPage();
}

function getPaperSlip(id) {
  return PAPER_SLIPS.find((slip) => slip.id === id);
}

function getStoryChapterTitle() {
  return ({
    1: "第一章：一张纸的脾气",
    2: "第二章：一张纸的骨肉",
    3: "第三章：一张纸的手艺",
    4: "第四章：一张纸的去处"
  })[state.storyChapter] || "纸境千年";
}

function paperSlipCount() {
  return state.unlockedKnowledgeCards.size;
}

function unlockPaperSlip(id) {
  const slip = getPaperSlip(id);
  if (!slip || state.unlockedKnowledgeCards.has(id)) return false;
  state.unlockedKnowledgeCards.add(id);
  const legacyCard = {
    "qingtan-bark": "青檀树皮", "rice-straw": "沙田稻草", "bamboo-screen": "抄纸手法",
    drying: "晒纸工艺", "ink-door": "吸墨性", "glue-alum": "生宣与熟宣",
    "half-cooked": "生宣与熟宣", millennium: "纸寿千年", crafts: "七十二道工序",
    wax: "生宣与熟宣", gold: "墨分五色", zhuchui: "七十二道工序"
  }[id];
  if (legacyCard) state.unlockedCards.add(legacyCard);
  showToast(`纸谱残页归位：${slip.title}`);
  updateStoryTask();
  return true;
}

function openPaperSlipReward(slipId, afterAction = "close", replaceCurrent = false) {
  const slip = getPaperSlip(slipId);
  if (!slip) return;
  unlockPaperSlip(slipId);
  const chapterEvent = checkStoryProgress();
  if (chapterEvent) {
    openModal(chapterEvent, "modal", "story-chapter-modal");
    return;
  }
  openModal(`
    <section class="paper-slip-reward-card" aria-labelledby="paperSlipRewardTitle">
      <div class="paper-flake-burst" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <img class="paper-slip-icon" src="${STORY_ASSETS[slip.icon] || STORY_ASSETS.paperSlip}" alt="" onerror="this.onerror=null;this.hidden=true">
      <p class="paper-slip-kicker">《纸谱十二笺》</p>
      <h2 id="paperSlipRewardTitle">纸谱残页归位</h2>
      <h3>${slip.title}</h3>
      <p>${slip.shortText}</p>
      <div class="modal-actions">
        <button class="primary-btn" type="button" data-action="${afterAction}">${afterAction === "openPaperShop" ? "打开宣纸铺" : "收进纸谱"}</button>
        <button class="secondary-btn" type="button" data-action="openPaperCodex">前往非遗馆查看</button>
      </div>
    </section>
  `, "modal", "paper-slip-reward-modal", { replace: replaceCurrent });
}

function openStoryChoice(caseId, feedback = "") {
  const slipId = STORY_CHOICE_CASES[caseId] || caseId;
  const slip = getPaperSlip(slipId);
  if (!slip) return;
  const needs = {
    "ink-door": { title: "王大爷的行草纸", demand: "我要写一幅行草。纸不能太死，墨要能走得开。" },
    "qingtan-bark": { title: "山里的纸筋骨", demand: "装裱匠人要托一幅旧画，他最看重纸能经得住湿润与时间。" },
    "rice-straw": { title: "水车旁的纸面", demand: "匠人说，纸不只要韧，也要让纸面细密匀净。" }
  }[slip.id] || { title: slip.title, demand: slip.unlockBy };
  const choices = slip.options.map((option) => `<button class="story-choice-option" type="button" data-action="answerStoryChoice" data-slip-id="${slip.id}" data-option="${option}">${option}</button>`).join("");
  openModal(`
    <section class="story-choice-card" aria-labelledby="storyChoiceTitle">
      <p class="story-choice-kicker">纸境千年 · 用纸判断</p>
      <h2 id="storyChoiceTitle">${needs.title}</h2>
      <blockquote>${needs.demand}</blockquote>
      <p class="story-choice-question">${slip.question}</p>
      ${feedback ? `<p class="story-choice-hint">${feedback}</p>` : ""}
      <div class="story-choice-options">${choices}</div>
      <button class="festival-text-btn" type="button" data-action="close">稍后再想</button>
    </section>
  `, "modal", "story-choice-modal");
}

function answerStoryChoice(slipId, option) {
  const slip = getPaperSlip(slipId);
  if (!slip) return;
  if (option !== slip.answer) {
    openStoryChoice(slipId, `再想想：${slip.wrongHint}`);
    return;
  }
  if (slipId === "ink-door") state.storyMilestones.paperShopExam = true;
  if (slipId === "qingtan-bark") state.storyMilestones.qingtanVisited = true;
  if (slipId === "rice-straw") state.storyMilestones.riceVisited = true;
  if (slipId === "ink-door") completeQuest("paperShop");
  openPaperSlipReward(slipId, slipId === "ink-door" ? "openPaperShop" : "close", true);
}

function updateStoryTask() {
  updateHud();
}

function getChapterOneStep() {
  const m = state.storyMilestones;

  if (!m.grandmaTalked) return "find_grandma";
  if (!m.paperBookOpened) return "open_paper_book";
  if (!m.paperShopExam) return "paper_shop_exam";
  if (!m.workshopMade) return "make_paper";
  if (state.ordersCompleted < 1) return "deliver_order";

  return "chapter1_done";
}

function updateHud() {
  coinText.textContent = state.coins;
  reputationText.textContent = state.reputation;

  const ch = state.storyChapter;
  const steps = [{ text: `▶ ${getStoryChapterTitle()}`, done: false, chapter: true }];
  if (ch === 1) {
    const chapterOneMessages = {
      find_grandma: "→ 纸铺灯还亮着，外婆似乎在等你。",
      open_paper_book: "→ 打开外婆的纸样册，先认清三种纸性。",
      paper_shop_exam: "→ 替王大爷判断行草该用哪种纸。",
      make_paper: "→ 工坊水声未歇，去试着做第一张纸。",
      deliver_order: "→ 把做好的纸送到书画铺。",
      chapter1_done: "→ 第一张纸送出去了，老街有了新的传闻。"
    };
    const chapterOneStep = getChapterOneStep();
    steps.push({ text: chapterOneMessages[chapterOneStep], done: chapterOneStep === "chapter1_done" });
  } else if (ch === 2) {
    if (!state.storyMilestones.qingtanVisited) steps.push({ text: "→ 去青檀林入口，寻找纸的筋骨", done: false });
    else if (!state.storyMilestones.riceVisited) steps.push({ text: "→ 去水车旁，了解稻草与纸面的关系", done: false });
    else if (state.ordersCompleted < 2) steps.push({ text: `→ 完成两个用纸订单，积累老街信任（${state.ordersCompleted}/2）`, done: false });
  } else if (ch === 3) {
    if (!state.unlockedKnowledgeCards.has("bamboo-screen")) steps.push({ text: "→ 去工坊完成一次稳定抄纸", done: false });
    else if (!state.unlockedKnowledgeCards.has("drying")) steps.push({ text: "→ 去晒纸场观察湿纸定形", done: false });
    else if (!state.unlockedKnowledgeCards.has("crafts")) steps.push({ text: "→ 去集市请教非遗匠人", done: false });
    else steps.push({ text: `→ 让至少 6 张纸谱残页归位（${paperSlipCount()}/6）`, done: false });
  } else {
    if (paperSlipCount() < 12) steps.push({ text: `→ 让十二张纸谱残页全部归位（${paperSlipCount()}/12）`, done: false });
    else if (festivalProgress() < 4) steps.push({ text: `→ 完成集市四席问答（${festivalProgress()}/4）`, done: false });
    else if (state.ordersCompleted < 4) steps.push({ text: `→ 完成不同用途的用纸委托（${state.ordersCompleted}/4）`, done: false });
    else steps.push({ text: "→ 前往非遗馆，准备重新开馆", done: false });
  }
  if (state.coins >= 150 && Object.values(state.upgrades).some(v => !v)) {
    steps.push({ text: '💰 可升级工坊设备', done: false });
  }

  const stepsHtml = steps.map(s => {
    if (s.chapter) return `<span class="task-step task-step--active">${s.text}</span>`;
    return `<span class="task-step ${s.done ? 'task-step--done' : ''}">${s.text}</span>`;
  }).join('');
  taskSteps.innerHTML = stepsHtml;
  if (paperPagesButton) paperPagesButton.textContent = `纸页 ${paperPageCount()} / 7`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.remove("hidden");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => {
    toast.classList.add("hidden");
  }, 2200);
}

function applyMapLayout(preservePlayer = true) {
  const rect = mapViewport.getBoundingClientRect();
  const previousScaleX = state.map.scaleX || 1;
  const previousScaleY = state.map.scaleY || 1;
  const playerReference = state.map.ready && preservePlayer
    ? { x: state.player.x / previousScaleX, y: state.player.y / previousScaleY }
    : PLAYER_SPAWN;
  const fitScale = isMobileInput()
    ? 1
    : Math.max(
      1,
      rect.width / state.map.naturalWidth,
      rect.height / state.map.naturalHeight
    );

  state.map.width = state.map.naturalWidth * fitScale;
  state.map.height = state.map.naturalHeight * fitScale;
  state.map.scaleX = state.map.width / MAP_REFERENCE.width;
  state.map.scaleY = state.map.height / MAP_REFERENCE.height;
  document.querySelectorAll(".map-npc[data-map-x][data-map-y]").forEach((npc) => {
    const x = Number(npc.dataset.mapX) * state.map.scaleX;
    const y = Number(npc.dataset.mapY) * state.map.scaleY;
    npc.style.left = `${x}px`;
    npc.style.top = `${y}px`;
    npc.dataset.depthY = String(y);
  });
  state.camera.width = rect.width;
  state.camera.height = rect.height;
  const moveBounds = playerMoveBounds();
  state.player.x = clamp(playerReference.x * state.map.scaleX, moveBounds.minX, moveBounds.maxX);
  state.player.y = clamp(playerReference.y * state.map.scaleY, moveBounds.minY, moveBounds.maxY);
  mapWorld.style.width = `${state.map.width}px`;
  mapWorld.style.height = `${state.map.height}px`;
  streetMap.style.width = `${state.map.width}px`;
  streetMap.style.height = `${state.map.height}px`;
  if (streetForeground) {
    streetForeground.style.width = `${state.map.width}px`;
    streetForeground.style.height = `${state.map.height}px`;
  }
  _npcDialogueCache = null;
  state.map.ready = true;
  updateCamera();
}

function resizeCamera() {
  if (state.map.ready) {
    applyMapLayout(true);
    return;
  }
  const rect = mapViewport.getBoundingClientRect();
  state.camera.width = rect.width;
  state.camera.height = rect.height;
  updateCamera();
}

function initializeMap() {
  state.map.naturalWidth = streetMap.naturalWidth || MAP_REFERENCE.width;
  state.map.naturalHeight = streetMap.naturalHeight || MAP_REFERENCE.height;
  applyMapLayout(false);
}

function updateCamera() {
  if (updateMobileCamera()) return;

  state.camera.x = clamp(
    state.player.x - state.camera.width / 2,
    0,
    Math.max(0, state.map.width - state.camera.width)
  );
  state.camera.y = clamp(
    state.player.y - state.camera.height / 2,
    0,
    Math.max(0, state.map.height - state.camera.height)
  );
}

function updateMobileCamera() {
  if (!isMobileInput()) return false;

  const viewportWidth = state.camera.width || window.innerWidth;
  const viewportHeight = state.camera.height || window.innerHeight;

  if (state.map.width > viewportWidth) {
    state.camera.x = clamp(
      state.player.x - viewportWidth / 2,
      0,
      state.map.width - viewportWidth
    );
  } else {
    state.camera.x = (state.map.width - viewportWidth) / 2;
  }

  if (state.map.height > viewportHeight) {
    state.camera.y = clamp(
      state.player.y - viewportHeight / 2,
      0,
      state.map.height - viewportHeight
    );
  } else {
    state.camera.y = (state.map.height - viewportHeight) / 2;
  }

  return true;
}

function tryMove(dx, dy) {
  if (!state.map.ready) return;
  const moveBounds = playerMoveBounds();
  const nextX = clamp(state.player.x + dx, moveBounds.minX, moveBounds.maxX);
  const nextY = clamp(state.player.y + dy, moveBounds.minY, moveBounds.maxY);

  // 优先尝试对角线移动，避免墙角卡死
  if (!collidesAt(nextX, nextY)) {
    state.player.x = nextX;
    state.player.y = nextY;
    return;
  }
  // 对角被挡，分别尝试轴滑动（贴墙走）
  if (!collidesAt(nextX, state.player.y)) state.player.x = nextX;
  if (!collidesAt(state.player.x, nextY)) state.player.y = nextY;
}

function directionFromDelta(dx, dy) {
  if (Math.abs(dx) > Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

function setPlayerSprite(direction = state.player.direction, frame = state.player.frame) {
  state.player.direction = direction;
  state.player.frame = frame ? 1 : 0;
  playerEl.classList.remove("dir-down", "dir-right", "dir-left", "dir-up", "frame-0", "frame-1");
  playerEl.classList.add(`dir-${state.player.direction}`, `frame-${state.player.frame}`);
}

function updatePlayerAnimation(dx, dy, timestamp) {
  if (!dx && !dy) {
    setPlayerSprite(state.player.direction, 0);
    return;
  }

  const nextDirection = directionFromDelta(dx, dy);
  if (nextDirection !== state.player.direction) {
    state.player.lastFrameAt = timestamp;
    setPlayerSprite(nextDirection, 0);
  } else if (timestamp - state.player.lastFrameAt >= PLAYER_SPRITE.animationMs) {
    state.player.lastFrameAt = timestamp;
    setPlayerSprite(nextDirection, state.player.frame ? 0 : 1);
  } else {
    setPlayerSprite(nextDirection, state.player.frame);
  }
}

function getActiveZone() {
  const point = { x: state.player.x, y: state.player.y };
  return interactionZones.find((zone) => zone && pointInRect(point, scaleRect(zone))) || null;
}

function getZoneAtPoint(point) {
  return interactionZones.find((zone) => zone && pointInRect(point, scaleRect(zone))) || null;
}

function getInteractionPrompt(zone) {
  if (!zone) return "";
  if (!isMobileInput()) return `<span class="interaction-key">${INTERACT_KEY_LABEL}</span><span>${zone.prompt}</span>`;
  if (zone.mobilePrompt) return zone.mobilePrompt;
  return zone.prompt;
}

function getNearbyNpcDialogue() {
  if (!state.map.ready) return null;
  let nearest = null;
  document.querySelectorAll("[data-npc-dialogue]").forEach((npc) => {
    const id = npc.dataset.npcDialogue;
    const dialogue = MARKET_NPC_DIALOGUES[id];
    if (!dialogue) return;
    const range = (dialogue.interactionRange || NPC_DIALOGUE_RANGE) * Math.max(state.map.scaleX, state.map.scaleY);
    const x = Number.parseFloat(npc.style.left);
    const y = Number.parseFloat(npc.style.top);
    const distance = Math.hypot(state.player.x - x, state.player.y - y);
    if (distance <= range && (!nearest || distance < nearest.distance)) {
      nearest = { id, element: npc, distance };
    }
  });
  return nearest;
}

function updateNpcDialogueBubbles() {
  const nearby = getNearbyNpcDialogue();
  state.nearbyNpcDialogueId = nearby?.id || null;
  if (!_npcDialogueCache) {
    _npcDialogueCache = Array.from(document.querySelectorAll("[data-npc-dialogue]"));
  }
  _npcDialogueCache.forEach((npc) => {
    const id = npc.dataset.npcDialogue;
    const dialogue = MARKET_NPC_DIALOGUES[id];
    const bubble = npc.querySelector(".npc-dialogue-bubble");
    if (!dialogue || !bubble) return;
    const questId = { paperSeller: "marketPainter", craftsperson: "marketPainter", marketVisitor: "marketTourist", forestElder: "forest", workshopMaster: "workshopProcess", dryingElder: "dryingYard", galleryCurator: "museum" }[id];
    if (id === "grandmother") {
      bubble.textContent = state.paperPages.paperNature ? "宣屿，你已经能替一张纸说话了。" : "纸要慢慢看，人也要慢慢懂。";
    } else if (questId && quests[questId]) {
      bubble.textContent = state.completedQuests.has(questId) ? quests[questId].after : quests[questId].before;
    } else {
      const bubbleLines = dialogue.bubbleLines || dialogue.lines;
      const lineIndex = state.npcDialogueIndex[id] || 0;
      bubble.textContent = bubbleLines[lineIndex];
    }
    npc.classList.toggle("npc-dialogue--nearby", id === state.nearbyNpcDialogueId);
    bubble.dataset.hint = getNpcInteractionHint(id);
  });
  return nearby;
}

function getNpcInteractionHint(id) {
  const dialogue = MARKET_NPC_DIALOGUES[id];
  const actionLabel = dialogue?.promptLabel || "交互 NPC";
  return `按 ${NPC_INTERACT_KEY_LABEL} ${actionLabel}`;
}

function getNpcInteractionPrompt(id) {
  const dialogue = MARKET_NPC_DIALOGUES[id];
  const actionLabel = dialogue?.promptLabel || "交互 NPC";
  return `<span class="interaction-key">${NPC_INTERACT_KEY_LABEL}</span><span>${actionLabel}</span>`;
}

function advanceNpcDialogue(id) {
  const dialogue = MARKET_NPC_DIALOGUES[id];
  if (!dialogue) return false;
  if (id === "marketVisitor") {
    return openQuestOnce("marketTourist", "这页纸背后的价值已经讲清了。");
  }
  if (id === "paperSeller" || id === "craftsperson") {
    return openQuestOnce("marketPainter", "纸性已经认清了。");
  }
  if (id === "forestElder") {
    return openQuestOnce("forest", "青檀原料已经了解了。");
  }
  if (id === "workshopMaster") {
    if (state.storyChapter === 1) {
      const step = getChapterOneStep();
      if (step === "find_grandma") {
        openModal(`<section class="story-choice-card"><p class="story-choice-kicker">纸境千年 · 工坊提醒</p><h2>先去见外婆</h2><blockquote>外婆还在宣纸铺门口等你。</blockquote>${closeBtn("我先去纸铺")}</section>`, "modal", "story-choice-modal");
        return true;
      }
      if (step === "open_paper_book" || step === "paper_shop_exam") {
        openModal(`<section class="story-choice-card"><p class="story-choice-kicker">纸境千年 · 工坊提醒</p><h2>先认纸性</h2><blockquote>先认清纸性，再来工坊试纸。</blockquote>${closeBtn("去宣纸铺")}</section>`, "modal", "story-choice-modal");
        return true;
      }
    }

    return openQuestOnce("workshopProcess", "工序已经理清了，去工坊开始制纸吧。");
  }
  if (id === "dryingElder") {
    return openQuestOnce("dryingYard", "晒纸要点已经记住了。");
  }
  if (id === "galleryCurator") {
    if (paperPageCount() >= 6) openQuestOnce("museum", "这页图鉴已经收好了。");
    else openPaperPagesCodex();
    return true;
  }
  if (dialogue.randomRumors) {
    openNpcRumorDialogue(id);
    return true;
  }
  if (dialogue.storyLines) {
    openNpcStoryDialogue(id);
    return true;
  }
  const current = state.npcDialogueIndex[id] || 0;
  state.npcDialogueIndex[id] = (current + 1) % dialogue.lines.length;
  updateNpcDialogueBubbles();
  return true;
}

function openNpcRumorDialogue(id) {
  const dialogue = MARKET_NPC_DIALOGUES[id];
  if (!dialogue?.randomRumors) return;
  const rumor = dialogue.randomRumors[Math.floor(Math.random() * dialogue.randomRumors.length)];
  openModal(`
    <section class="npc-rumor-dialogue" aria-labelledby="npcRumorTitle">
      <div class="npc-rumor-portrait npc-rumor-portrait--teahouse" aria-hidden="true"></div>
      <p class="npc-rumor-kicker">茶馆门口 · 老街传闻</p>
      <h2 id="npcRumorTitle">${dialogue.name}</h2>
      <blockquote>${rumor}</blockquote>
      <div class="npc-rumor-actions"><button class="paper-realm-secondary" type="button" data-action="close">继续逛老街</button></div>
    </section>
  `, "modal", "npc-rumor-dialogue-card");
}

function openNpcStoryDialogue(id) {
  const dialogue = MARKET_NPC_DIALOGUES[id];
  if (!dialogue?.storyLines) return;
  const chapterLines = {
    1: ["宣屿，这间铺子不是缺纸，是缺一个真正懂纸的人。", "先认纸性。写行草的人，要墨气活；画工笔的人，要线条稳。你先从生宣、熟宣、半熟宣认起。"],
    2: ["光会卖纸还不够。纸有骨肉：青檀是骨，稻草是肌。", "去山里和水车旁看看，知道它们从哪里来，才知道一张纸为什么不一样。"],
    3: ["手艺不是步骤表。每一帘、每一晒，都要靠人的经验。", "这次不是比快，是比稳。纸浆在竹帘上分布匀，纸面才站得住。"],
    4: ["纸做出来，是要去到人手里的。有人写，有人画，有人珍藏，纸才算真正活过。", "等十二张纸谱都回来，去非遗馆看看这条老街留下了什么。"],
    // 兜底：章节超出 1-4 时使用最终章对话，避免回退到初始 storyLines
    _fallback: ["老街已经重新热闹起来了。每一张纸，都有它的去处。", "十二张纸谱归位，非遗馆也重新开馆了。这条老街的故事，还在继续。"]
  };
  const lines = chapterLines[state.storyChapter] || chapterLines._fallback;
  state.storyMilestones.grandmaTalked = true;
  updateStoryTask();
  const paragraphs = lines.map((line) => `<p>${line}</p>`).join("");
  openModal(`
    <section class="grandmother-dialogue" aria-labelledby="grandmotherDialogueTitle">
      <div class="grandmother-dialogue-portrait" aria-hidden="true"></div>
      <p class="grandmother-dialogue-kicker">宣纸铺 · 传承</p>
      <h2 id="grandmotherDialogueTitle">${dialogue.name}</h2>
      <div class="grandmother-dialogue-copy">${paragraphs}</div>
      <div class="grandmother-dialogue-actions">
        <button class="paper-realm-primary" type="button" data-action="openPaperShop">打开外婆的纸样册</button>
        <button class="paper-realm-secondary" type="button" data-action="close">稍后再说</button>
      </div>
    </section>
  `, "modal", "grandmother-dialogue-card");
}

function mapPointFromClient(clientX, clientY) {
  const rect = mapViewport.getBoundingClientRect();
  return {
    x: clientX - rect.left + state.camera.x,
    y: clientY - rect.top + state.camera.y
  };
}

function updateDepthSortedEntities() {
  document.querySelectorAll("[data-depth-sort], .map-entity, .npc").forEach((entity) => {
    const depthY = Number(entity.dataset.depthY);
    const fallbackY = Number.parseFloat(entity.style.top) || 0;
    const y = Number.isFinite(depthY) ? depthY : fallbackY;
    entity.style.zIndex = String(1000 + Math.round(y));
  });
}

function updateMap() {
  try {
    updateCamera();
    mapWorld.style.transform = `translate(${-state.camera.x}px, ${-state.camera.y}px)`;
    playerEl.style.left = `${state.player.x}px`;
    playerEl.style.top = `${state.player.y}px`;
    playerEl.dataset.depthY = String(state.player.y);
    updateDepthSortedEntities();

    state.activeZone = getActiveZone();
    const nearbyNpc = updateNpcDialogueBubbles();
    if (nearbyNpc && state.gameState === "playing") {
      interactionPrompt.innerHTML = isMobileInput()
        ? `点击${MARKET_NPC_DIALOGUES[nearbyNpc.id]?.name || "NPC"}`
        : getNpcInteractionPrompt(nearbyNpc.id);
      interactionPrompt.classList.remove("hidden");
    } else if (state.activeZone && state.gameState === "playing") {
      interactionPrompt.innerHTML = getInteractionPrompt(state.activeZone);
      interactionPrompt.classList.remove("hidden");
    } else {
      interactionPrompt.classList.add("hidden");
    }

    if (state.debugMode) renderDebugLayer();
    // updateMobileControls() 不再每帧调用，仅在平台切换/resize/状态变更时调用
  } catch (e) {
    console.warn("updateMap error:", e);
  }
}


function gameLoop(timestamp = 0) {
  try {
    if (state.gameState === "playing") {
      let inputX = 0;
      let inputY = 0;
      if (state.keys.has("ArrowLeft") || state.keys.has("KeyA")) inputX -= 1;
      if (state.keys.has("ArrowRight") || state.keys.has("KeyD")) inputX += 1;
      if (state.keys.has("ArrowUp") || state.keys.has("KeyW")) inputY -= 1;
      if (state.keys.has("ArrowDown") || state.keys.has("KeyS")) inputY += 1;

      if (inputX || inputY) {
        const length = Math.hypot(inputX, inputY);
        tryMove((inputX / length) * state.player.speed, (inputY / length) * state.player.speed);
      } else if (joystickVector.x || joystickVector.y) {
        inputX = joystickVector.x;
        inputY = joystickVector.y;
        tryMove(inputX * state.player.speed, inputY * state.player.speed);
      }
      updatePlayerAnimation(inputX, inputY, timestamp);
      updateMap();
    } else {
      setPlayerSprite(state.player.direction, 0);
    }

    if (state.miniGame?.running) advanceMiniGame(timestamp);
  } catch (e) {
    console.error("gameLoop error:", e);
  }
  requestAnimationFrame(gameLoop);
}

function openComingSoon(zone) {
  openModal(`
    <h2>${zone.name}</h2>
    <p>${zone.name}将在后续版本开放。</p>
    <div class="modal-actions">${closeBtn("返回地图")}</div>
  `);
}

function interact() {
  if (state.gameState !== "playing") return;
  const zone = state.activeZone;
  if (!zone) {
    showToast(isMobileInput() ? "靠近交互区域后点击。" : `靠近交互区域后按 ${INTERACT_KEY_LABEL}。`);
    return;
  }
  activateZone(zone);
}

function activateZone(zone) {
  if (zone.id === "paperShop") openPaperShop();
  else if (zone.id === "market") openFestivalEntrance();
  else if (zone.id === "workshop") openWorkshop();
  else if (zone.id === "calligraphyShop") openOrderBoard();
  else if (zone.id === "museum") openMuseum();
  else if (zone.id === "qingtanForest" || zone.id === "qingtanForestTrail") openQuestOnce("forest", "青檀原料已经了解了。");
  else if (zone.id === "waterWheel") openQuestOnce("waterwheel", "水车和纸浆要点已经记住了。");
  else if (zone.id === "paperFestival") openPaperFestival();
  else if (zone.id === "dryingYard" || zone.id.startsWith("dryingRacks")) openDryingYard();
  else openComingSoon(zone);
}

function openModal(html, nextState = "modal", cardClass = "", pageOptions = {}) {
  // 保留原有调用点，实际入口统一转交给页面栈。
  const pageId = html.match(/aria-labelledby="([^"]+)"/)?.[1];
  const heading = html.match(/<h[1-3][^>]*>\s*([^<]+)/)?.[1]?.trim();
  const pageName = pageId
    ? `${cardClass || "modal"}:${pageId}`
    : `${cardClass || "modal"}:${heading || "page"}`;
  openPage(pageName, { type: "modal", html, nextState, cardClass, ...pageOptions });
}

function closeModal() {
  if (state.modalOpen || state.currentPage !== "map") goBackPage();
}

function closeBtn(label, variant = "primary-btn") {
  return `<button class="${variant}" type="button" data-action="close">${label}</button>`;
}

const paperShowcaseData = [
  {
    id: "shengxuan",
    name: "生宣",
    seal: "生",
    tagline: "墨韵自然，水墨易化开",
    highlights: ["墨韵强", "吸水快", "适合写意"],
    useTags: ["写意画", "泼墨山水", "大字书法", "草书行书"],
    characterTags: ["吸水快", "易洇墨", "墨韵强"],
    processSteps: ["原料", "制浆", "捞纸", "晒纸"],
    use: "适合写意画、泼墨山水、大字书法、草书、行书。",
    character: "吸水快，洇墨明显。墨落纸面后，会顺着纤维孔隙自然扩散，形成浓淡、干湿、虚实变化。",
    process: "生宣不经过胶矾等熟化加工，保留原纸较强的吸水性和渗化性。传统制作以青檀皮和沙田稻草为主要原料，经制料、制浆、捞纸、晒纸、剪纸等工序形成基础性能。较长的青檀皮纤维带来韧性与拉力，较短的稻草纤维帮助形成均匀细密的纸面；两类纤维交织留下细小孔隙，水墨便更容易进入纸内并自然扩散。",
    trivia: [
      "生宣不是“没加工好”，而是保留了宣纸原本的吸墨特点。",
      "墨落在生宣上，边缘会慢慢散开，像水在纸里“走路”。",
      "写意画常用生宣，因为它能表现墨色浓淡和水墨层次。",
      "生宣很考验控水，下笔太湿容易洇成一片。",
      "它适合泼墨、破墨、积墨，不太适合特别精细的工笔线描。"
    ],
    tip: "想要墨色自然散开，就选生宣。"
  },
  {
    id: "shuxuan",
    name: "熟宣",
    seal: "熟",
    tagline: "线条清楚，颜色更好控制",
    highlights: ["控墨稳", "线条清", "适合工笔"],
    useTags: ["工笔画", "小楷", "设色画", "精细线描"],
    characterTags: ["吸水慢", "线条稳", "易控墨"],
    processSteps: ["原纸", "胶矾", "控水", "细绘"],
    use: "适合工笔画、小楷、设色画、白描、精细线描。",
    character: "吸水慢，不容易洇墨。墨线边缘更清楚，颜色边界更稳定，适合反复勾线和设色。",
    process: "熟宣是在生宣基础上经过后续熟化加工形成的纸。常见处理包括施胶、加矾，使纸面吸水速度降低，墨色不再像生宣那样快速扩散。胶能在纸面和纤维之间形成一定阻隔，减少水墨迅速进入纸内；矾有助于固定胶料，使纸面渗化减弱。部分熟宣还会经过填粉、涂蜡、砑光等工艺，让纸面更细腻平滑，更适合细线条和设色创作。",
    trivia: [
      "熟宣不是“煮熟的纸”，而是经过熟化加工的宣纸。",
      "它的关键不在更厚，而在吸水速度被控制住了。",
      "工笔画喜欢熟宣，因为线条不容易“跑出去”。",
      "熟宣适合反复上色，颜色边界更稳定。",
      "生宣像会流动的水墨，熟宣像给水墨加了一道“边界”。",
      "熟宣能画得细，但自然洇化效果通常弱于生宣。"
    ],
    tip: "想画细线条、上颜色，就选熟宣。"
  },
  {
    id: "banshuxuan",
    name: "半熟宣",
    seal: "半",
    tagline: "介于生熟之间，兼有墨韵与控制",
    highlights: ["生熟之间", "新手友好", "墨色适中"],
    useTags: ["花鸟画", "小写意", "人物画", "控墨练习"],
    characterTags: ["吸水适中", "洇墨适度", "容易掌握"],
    processSteps: ["原纸", "轻加工", "慢渗墨", "易控制"],
    use: "适合花鸟画、小写意、人物画、山水局部渲染，也适合新手练习控墨。",
    character: "吸水速度适中。它有一定洇墨和墨色层次，但扩散范围比生宣小；比熟宣更活，又比生宣更稳。",
    process: "半熟宣不是一种固定工艺名，而是书画用纸里常见的纸性说法。它介于生宣和熟宣之间，吸水和渗墨速度适中。制作时通常会经过轻度加工，比如轻度施胶、轻度矾处理，或通过压实、砑光等方式改变纸面状态。它不会像熟宣那样强烈控制墨色扩散，但又比生宣更容易掌握。",
    trivia: [
      "半熟宣像宣纸里的“中间性格”：不太野，也不太板。",
      "它比生宣好控制，比熟宣更有水墨变化。",
      "新手练习花鸟、小写意时，半熟宣容错率更高。",
      "它不是严格固定的一种工艺名，更像“半生半熟”的纸性状态。",
      "想要一点洇墨，又不想墨散得太开，半熟宣正合适。",
      "若说生宣像山泉、熟宣像静水，半熟宣就像缓缓流动的小溪。"
    ],
    tip: "想要既有墨韵又不太洇，就选半熟宣。"
  }
];

const processedPaperData = [
  {
    id: "sajin",
    name: "洒金宣",
    seal: "金",
    tagline: "金屑映纸，纸面生辉",
    highlights: ["装饰感", "礼品纸", "金点纸面"],
    useTags: ["书法题字", "册页扇面", "节庆礼品", "文创展示"],
    characterTags: ["金点纸面", "装饰强", "落墨看原纸"],
    processSteps: ["原纸", "洒金", "固着", "成笺"],
    use: "适合书法题字、册页、扇面、请柬、节庆礼品、文创展示和装饰性作品。",
    character: "更突出纸面的装饰效果。它保留宣纸作为书写材料的基本属性，但纸面多了金色点片，视觉上更华丽、更有仪式感。具体吸墨效果会受原纸纸性和后期加工方式影响。",
    process: "洒金宣是在宣纸原纸基础上进行装饰加工形成的加工宣。制作时，会将金色箔片、金属色材料或类似装饰材料，以点状、片状方式分布在纸面上，使纸面出现星点般的光泽。洒金的大小、疏密和分布方式不同，纸面效果也会不同。它和普通宣纸的差别，不是原料完全改变，而是在纸面增加了装饰性处理。洒金宣既可以用于书写，也常用于礼品、题字和展示场景。",
    trivia: [
      "洒金宣不是整张纸都变金，而是在纸面留下金色点片。",
      "金点稀疏时更雅致，金点密集时装饰感更强。",
      "它常用于题字和礼品纸，因为第一眼就有仪式感。",
      "写在洒金宣上，字和金点会一起成为画面的一部分。",
      "选洒金宣不能只看金点，还要看纸面是否适合落墨。",
      "普通宣纸像素衣，洒金宣像给纸面缀上星光。"
    ],
    tip: "想让作品更精致、更有节庆感或礼品感，就选洒金宣。"
  },
  {
    id: "zhuchui",
    name: "煮硾宣",
    seal: "硾",
    tagline: "捶压成纸，慢渗见功夫",
    highlights: ["物理压实", "慢渗墨", "老工艺"],
    useTags: ["小写意", "题跋", "控墨练习", "水墨作品"],
    characterTags: ["纸面紧实", "慢渗墨", "控墨较稳"],
    processSteps: ["润纸", "捶压", "纤维紧实", "慢渗墨"],
    use: "适合需要一定控墨效果的书画练习、小写意、题跋、线条较稳的水墨作品，也适合展示传统手工加工的剧情内容。",
    character: "纸面通常更紧实、平滑，吸水和渗墨速度比普通生宣慢。它不完全依靠胶矾来控制纸性，而是通过物理方式让纸张纤维更紧密，从而形成较慢洇、较好控制的使用效果。",
    process: "煮硾宣属于偏物理加工的加工宣，重点在“煮”和“硾”。“硾”读作 chuí，意思接近捶打、锤击。制作时，纸张经过润湿、整理后，通过反复捶打、压实等方式，让纸面纤维受压靠拢，纸张变得更紧密、更平整。纤维之间的空隙变小后，水墨进入纸内的速度会变慢，所以煮硾宣常呈现出介于生宣和熟宣之间的纸性效果：保留一定墨韵，又比普通生宣更容易控制。",
    trivia: [
      "“硾”读作 chuí，意思接近捶打、锤击。",
      "它不是单靠胶矾，而是靠捶压改变纸性。",
      "纸被反复捶打后，纤维更紧密，墨不容易一下子散开。",
      "它很适合老匠人剧情，因为工艺动作感很强。",
      "煮硾宣像被“练过筋骨”的宣纸，纸面更紧实。",
      "生宣像松软的土地，煮硾宣像被压实过的小路，墨走得更慢。"
    ],
    tip: "想保留一点墨韵，又想让纸面更稳、更好控制，就选煮硾宣。"
  },
  {
    id: "fenlajian",
    name: "粉蜡笺",
    seal: "笺",
    tagline: "细腻如玉，线条更稳",
    highlights: ["细腻平滑", "适合小楷", "砑光工艺"],
    useTags: ["小楷", "工笔", "精细线描", "雅致册页"],
    characterTags: ["纸面平滑", "不易洇墨", "线条清楚"],
    processSteps: ["填粉", "涂蜡", "砑光", "细密平滑"],
    use: "适合小楷、工笔、题跋、册页、精细线描和装饰性书写。",
    character: "纸面较细腻、平滑，吸水性较弱，不容易洇墨。它更适合清楚、稳定、精细的线条表现，不适合追求强烈泼墨和大面积自然洇化的作品。",
    process: "粉蜡笺属于加工层次较高的笺纸类宣纸制品。制作时通常会在纸面进行填粉、涂蜡、砑光等处理。填粉可以让纸面更加细密，涂蜡可以降低纸面对水分的吸收，砑光则通过摩擦、压光等方式让纸面更平滑。经过这些处理后，纸面会更紧致、更光洁，墨色不容易迅速进入纸内，因此更适合写小字、画细线和制作精致册页。",
    trivia: [
      "粉蜡笺的“粉”不是灰尘，而是让纸面更细腻的填料。",
      "“蜡”能降低纸面的吸水速度，让墨线更稳。",
      "砑光像给纸面慢慢打磨，让它变得更平滑。",
      "粉蜡笺适合细致书写，不适合大面积泼墨。",
      "它更像宣纸里的“精装纸”，适合雅致、精细的作品。",
      "生宣让墨自己奔跑，粉蜡笺让墨规规矩矩走路。"
    ],
    tip: "想写小楷、画细线、做精致册页，就选粉蜡笺。"
  }
];

const paperBookGroups = [
  { label: "", papers: paperShowcaseData },
  { label: "加工宣", papers: processedPaperData }
];

function renderPaperBook(paperId = "shengxuan") {
  const papers = paperBookGroups.flatMap((group) => group.papers);
  const paper = papers.find((item) => item.id === paperId) || papers[0];
  const isProcessedPaper = processedPaperData.some((item) => item.id === paper.id);

  const navigation = paperBookGroups.map((group) => `
    ${group.label ? `<p class="paper-type-group">${group.label}</p>` : ""}
    ${group.papers.map((item) => `
      <button class="paper-type-tab${item.id === paper.id ? " active" : ""}" type="button" data-action="switchPaperType" data-paper-id="${item.id}" aria-pressed="${item.id === paper.id}">
        <span>${item.seal}</span>${item.name}
      </button>
    `).join("")}
  `).join("");

  const quickTags = paper.highlights.map((tag) => `<span>${tag}</span>`).join("");
  const processFlow = paper.processSteps.map((step, index) => `
    <li><span class="process-icon process-icon--${index + 1}" aria-hidden="true"></span><b>${step}</b></li>
  `).join("");

  const detailSections = [
    ["用途", paper.use, paper.useTags, "use"],
    ["纸性", paper.character, paper.characterTags, "character"],
    ["工艺", paper.process, [], "process"]
  ].map(([label, content, tags, type]) => `
    <section class="paper-detail-row paper-detail-${type}">
      <div class="paper-module-heading"><span class="paper-module-mark paper-module-mark--${type}" aria-hidden="true"></span><h4>${label}</h4></div>
      ${tags.length ? `<div class="paper-module-tags">${tags.map((tag) => `<span>${tag}</span>`).join("")}</div>` : ""}
      ${type === "process" ? `<ol class="process-flow">${processFlow}</ol>` : ""}
      <p>${content}</p>
    </section>
  `).join("");

  const triviaNotes = paper.trivia.map((item, index) => `
    <li class="paper-trivia-note"><span>${String(index + 1).padStart(2, "0")}</span><p>${item}</p></li>
  `).join("");

  openModal(`
    <section class="paper-showcase" aria-labelledby="paperShowcaseTitle">
      <header class="paper-showcase-header">
        <p class="paper-showcase-seal">宣纸铺</p>
        <div>
          <h2 id="paperShowcaseTitle">外婆的纸样册</h2>
          <p>认懂纸性，才算真正走进这条老街。</p>
        </div>
      </header>

      <div class="paper-showcase-body">
        <nav class="paper-type-nav paper-type-nav--catalog" aria-label="宣纸分类">${navigation}</nav>
        <article class="paper-detail paper-detail--${paper.id}" aria-live="polite">
          <div class="paper-detail-title">
            <span class="paper-detail-seal">${paper.seal}</span>
            <h3>${paper.name}<b aria-hidden="true">｜</b><em>${paper.tagline}</em></h3>
          </div>
          <div class="paper-quick-tags" aria-label="纸性重点标签">${quickTags}</div>
          <div class="paper-detail-content">
            <div class="paper-detail-sections">${detailSections}</div>
            <aside class="paper-trivia" aria-label="纸铺趣识">
              <h4>纸铺趣识</h4>
              <ol>${triviaNotes}</ol>
            </aside>
            <section class="paper-detail-tip">
              <span class="paper-tip-origami" aria-hidden="true"></span>
              <h4>宣屿小贴士</h4>
              <p>${paper.tip}</p>
            </section>
          </div>
        </article>
      </div>

      <footer class="paper-showcase-footer">
        <p>${isProcessedPaper ? "洒金重装饰，煮硾重纸性，粉蜡重细密。" : "生宣重墨韵，熟宣重控制，半熟重平衡。"}</p>
        ${state.storyChapter === 1 && !state.storyMilestones.paperShopExam ? `<button class="primary-btn" type="button" data-action="openStoryChoice" data-case-id="ink">替王大爷选纸</button>` : ""}
        <button class="catalog-close" type="button" data-action="close">我知道了</button>
      </footer>
    </section>
  `, "modal", "paper-showcase-card");
}

function openPaperShop(paperId = "shengxuan") {
  const paper = paperBookGroups.flatMap((group) => group.papers).find((item) => item.id === paperId) || paperShowcaseData[0];
  if (state.storyChapter === 1 && !state.storyMilestones.paperShopExam) {
    openStoryChoice("ink");
    return;
  }
  state.hasVisitedPaperShop = true;
  state.unlockedPaperCategories.add(paper.id);
  state.unlockedPaperItems.add(`paper-type:${paper.id}`);
  if (state.paperShopStoryStage === 0) state.paperShopStoryStage = 1;
  state.storyMilestones.paperBookOpened = true;
  updateStoryTask();
  renderPaperBook(paper.id);
}

const festivalTasks = [
  {
    id: "gift-paper",
    stall: "文创摊",
    npc: "游客",
    icon: "gift",
    brief: "游客想买一张有节日感的礼品纸。",
    dialogue: "我想买一张看起来精致、有节日感的宣纸，准备送给朋友。最好一眼看上去就很特别。",
    options: ["生宣", "熟宣", "洒金宣"],
    answer: "洒金宣",
    correctText: "选得好！洒金宣纸面有金色点片，装饰感强，适合题字、礼品和节庆场景。",
    hintText: "这张纸也有它的用处，但和这位客人的需求还不太合适。再想想“装饰感”和“礼品感”。",
    stamp: "金屑映纸", slipId: "gold"
  },
  {
    id: "small-regular-script",
    stall: "书画摊",
    npc: "书生",
    icon: "brush",
    brief: "书生想写一页线条稳定的小楷。",
    dialogue: "我想写一页小楷，字要细，线条要稳，墨不能一下子洇开。该选哪种纸？",
    options: ["生宣", "粉蜡笺", "洒金宣"],
    answer: "粉蜡笺",
    correctText: "没错。粉蜡笺经过填粉、涂蜡、砑光等处理，纸面更细腻平滑，适合小楷和精细线条。",
    hintText: "这张纸不一定适合小楷。小楷更需要线条稳定、纸面细腻、不容易洇墨。",
    stamp: "细腻如玉"
  },
  {
    id: "ink-landscape",
    stall: "非遗匠人摊",
    npc: "非遗匠人",
    icon: "paper",
    brief: "匠人想知道你是否理解手工制纸的关键。",
    dialogue: "为什么传统宣纸制作不能只靠机器完全替代？",
    options: ["因为颜色越手工越白", "因为抄纸、晒纸等环节高度依赖经验和手感", "因为机器不能切纸"],
    answer: "因为抄纸、晒纸等环节高度依赖经验和手感",
    correctText: "答得好。传统工艺的难处，在于纸浆状态、提帘节奏和干燥判断都需要长期积累的手感。",
    hintText: "重点不在机器能否做动作，而在细微状态如何判断。",
    stamp: "百工成纸", slipId: "crafts"
  },
  {
    id: "zhuchui-demo",
    stall: "匠人演示台",
    npc: "老匠人",
    icon: "mallet",
    brief: "老匠人演示如何用捶压改变纸性。",
    dialogue: "年轻人，你知道不用重胶重矾，也能让纸慢一点洇墨吗？靠的不是涂满东西，而是让纸面更紧实。",
    options: ["洒金", "煮硾", "染色"],
    answer: "煮硾",
    correctText: "对，煮硾重在润纸、捶压和压实。纤维更紧密后，水墨进入纸内的速度会变慢，纸性也更容易控制。",
    hintText: "这个工艺也能改变纸面效果，但老匠人说的是通过捶压、压实来改变纸性。",
    stamp: "捶压成纸"
  }
];

function getFestivalTask(taskId) {
  return festivalTasks.find((task) => task.id === taskId);
}

function festivalProgress() {
  return state.completedFestivalTasks.size;
}

function openFestivalEntrance() {
  openModal(`
    <section class="paper-realm-entry" aria-labelledby="festivalEntryTitle">
      <span class="paper-realm-entry-lantern paper-realm-entry-lantern--left" aria-hidden="true"></span>
      <span class="paper-realm-entry-lantern paper-realm-entry-lantern--right" aria-hidden="true"></span>
      <span class="paper-realm-entry-bamboo" aria-hidden="true"></span>
      <div class="paper-realm-entry-copy">
        <p class="paper-realm-eyebrow">纸境千年 · 节令雅集</p>
        <h2 id="festivalEntryTitle">纸境千年</h2>
        <p>循着墨香入市，与四席匠艺相会；集齐知识印章，读懂一张纸的来处与心意。</p>
        <div class="paper-realm-entry-tags" aria-label="纸境千年活动亮点">
          <span>四席匠艺</span><span>雅集探访</span><span>集印成册</span>
        </div>
        <div class="paper-realm-entry-actions">
          <button class="paper-realm-primary" type="button" data-action="enterFestival">开启雅集</button>
          <button class="paper-realm-secondary" type="button" data-action="close">暂不前往</button>
        </div>
      </div>
    </section>
  `, "modal", "festival-modal-card paper-realm-modal paper-realm-entry-card");
}

function openPaperFestival() {
  const completed = festivalProgress();
  const stalls = festivalTasks.map((task) => {
    const done = state.completedFestivalTasks.has(task.id);
    return `
      <button class="paper-realm-booth paper-realm-booth--${task.icon}${done ? " is-complete" : ""}" type="button" data-action="openFestivalTask" data-task-id="${task.id}" aria-label="探访${task.stall}：${task.npc}">
        <span class="paper-realm-booth-canopy" aria-hidden="true"></span>
        <span class="paper-realm-booth-lantern" aria-hidden="true"></span>
        <span class="paper-realm-booth-backdrop" aria-hidden="true"></span>
        <span class="paper-realm-booth-counter" aria-hidden="true"></span>
        <span class="paper-realm-booth-props" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="festival-npc festival-npc--${task.icon} festival-npc--image paper-realm-booth-character" aria-hidden="true"></span>
        <span class="paper-realm-booth-plaque"><small>雅集探访</small><strong>${task.stall}</strong><em>${task.npc}</em></span>
        <span class="paper-realm-booth-seal" aria-hidden="true">${done ? "已集印" : "探访"}</span>
      </button>
    `;
  }).join("");

  openModal(`
    <section class="paper-realm-market" aria-labelledby="paperFestivalTitle">
      <span class="paper-realm-market-leaves paper-realm-market-leaves--left" aria-hidden="true"></span>
      <span class="paper-realm-market-leaves paper-realm-market-leaves--right" aria-hidden="true"></span>
      <header class="paper-realm-market-header">
        <p>纸境千年 · 节令雅集</p>
        <h2 id="paperFestivalTitle">纸境千年</h2>
        <span>四席行家，以纸设问；答得出，才算懂纸。</span>
      </header>
      <div class="paper-realm-stalls" aria-label="纸境千年集市摊位">${stalls}</div>
      <footer class="paper-realm-statusbar">
        <div class="paper-realm-status" aria-label="纸境千年进度">
          <span><i class="paper-realm-status-icon paper-realm-status-icon--coin" aria-hidden="true"></i>行旅铜钱 <b>${state.paperCoins}</b></span>
          <span><i class="paper-realm-status-icon paper-realm-status-icon--stamp" aria-hidden="true"></i>纸市印章 <b>${state.earnedStamps.size} / ${festivalTasks.length}</b></span>
          <span><i class="paper-realm-status-icon paper-realm-status-icon--scroll" aria-hidden="true"></i>探访进度 <b>${completed} / ${festivalTasks.length}</b></span>
        </div>
        <button class="paper-realm-return" type="button" data-action="close">返回老街</button>
        <button class="paper-realm-return" type="button" data-action="openFestivalExchange" style="background:rgba(231,166,66,0.15);border-color:var(--gold);color:var(--gold);">🪙 集市兑换（${state.paperCoins || 0}铜钱）</button>
      </footer>
    </section>
  `, "modal", "festival-modal-card paper-realm-modal paper-realm-market-card");
}

function openFestivalExchange() {
  const coins = state.paperCoins || 0;
  openModal(`
    <section class="festival-task" aria-labelledby="exchangeTitle">
      <div class="festival-task-corner festival-task-corner-tl" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-tr" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-bl" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-br" aria-hidden="true"></div>
      <p class="festival-task-stall">集市铜钱铺</p>
      <h2 id="exchangeTitle">🪙 铜钱兑好物</h2>
      <p>答题赚的铜钱可在此兑换道具，带到工坊使用。</p>
      <p style="font-size:12px;color:var(--wood);margin:4px 0;">💰 余额：<strong style="color:var(--gold);">${coins}枚</strong></p>
      <div style="display:flex;flex-direction:column;gap:8px;margin:10px 0;">
        <button class="festival-option-card" type="button" data-action="buyFestivalItem" data-item-id="luckyCharm" ${coins < 5 ? 'disabled' : ''}>
          <span>🍀 幸运符</span><small>下一张纸全属性+5%</small><b>5铜钱</b>
        </button>
        <button class="festival-option-card" type="button" data-action="buyFestivalItem" data-item-id="craftsmanNote" ${coins < 10 ? 'disabled' : ''}>
          <span>📜 匠人手记</span><small>随机解锁科普卡</small><b>10铜钱</b>
        </button>
        <button class="festival-option-card" type="button" data-action="buyFestivalItem" data-item-id="bambooOil" ${coins < 8 ? 'disabled' : ''}>
          <span>🪣 竹帘护养油</span><small>下5张纸Perfect区+2%</small><b>8铜钱</b>
        </button>
      </div>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-action="close">返回集市</button>
      </div>
    </section>
  `);
}

function openFestivalTask(taskId, feedback = "") {
  const task = getFestivalTask(taskId);
  if (!task) return;
  const options = task.options.map((option) => `
    <button class="festival-option-card" type="button" data-action="answerFestivalTask" data-task-id="${task.id}" data-option="${option}">${option}</button>
  `).join("");
  const feedbackHtml = feedback === "wrong"
    ? `<p class="festival-feedback festival-feedback-gentle">${task.hintText}</p>`
    : state.completedFestivalTasks.has(task.id)
      ? `<p class="festival-feedback festival-feedback-calm">这件事你已经帮过忙了；再选一次也能温习纸性。</p>`
      : "";

  openModal(`
    <section class="festival-task" aria-labelledby="festivalTaskTitle">
      <div class="festival-task-corner festival-task-corner-tl" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-tr" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-bl" aria-hidden="true"></div>
      <div class="festival-task-corner festival-task-corner-br" aria-hidden="true"></div>
      <div class="festival-task-top-banner" aria-hidden="true"></div>
      <div class="festival-task-avatar festival-task-avatar--npc" aria-hidden="true"><i class="festival-npc festival-npc--${task.icon} festival-npc--image paper-realm-task-character"></i></div>
      <p class="festival-task-stall">${task.stall} · ${task.npc}</p>
      <h2 id="festivalTaskTitle">纸境千年问答</h2>
      <blockquote>${task.dialogue}</blockquote>
      ${feedbackHtml}
      <div class="festival-options" aria-label="选择一种纸">${options}</div>
      <button class="festival-text-btn" type="button" data-action="openPaperFestival">回到纸市</button>
    </section>
  `, "modal", "festival-modal-card festival-task-card");
}

function answerFestivalTask(taskId, option) {
  const task = getFestivalTask(taskId);
  if (!task) return;
  if (option !== task.answer) {
    openFestivalTask(taskId, "wrong");
    return;
  }

  const firstCompletion = !state.completedFestivalTasks.has(task.id);
  if (firstCompletion) {
    state.completedFestivalTasks.add(task.id);
    state.paperCoins += 5;
    state.earnedStamps.add(task.stamp);
    if (task.slipId) unlockPaperSlip(task.slipId);
  }
  const chapterEvent = checkStoryProgress();
  if (chapterEvent) {
    openModal(chapterEvent, "modal", "story-chapter-modal");
    return;
  }
  openFestivalReward(task, firstCompletion);
}

function openFestivalReward(task, firstCompletion) {
  const completed = festivalProgress();
  let milestone = "";
  if (completed === 3 && !state.festivalMilestoneShown) {
    state.festivalMilestoneShown = true;
    milestone = `<div class="festival-milestone"><strong>今日纸市节小有收获！</strong><span>你已经能根据用途判断宣纸了。</span></div>`;
  }
  if (completed === festivalTasks.length && !state.festivalCompleteShown) {
    state.festivalCompleteShown = true;
    milestone = `<div class="festival-milestone festival-milestone-final"><strong>纸境千年雅集圆满完成！</strong><span>你不只认识宣纸，也学会了根据用途选择纸张。</span><em>最终奖励：纸境千年纪念贴纸 · 宣屿表情包「认真选纸」· 雅集摊位装饰「小纸灯」</em></div>`;
  }

  openModal(`
    <section class="festival-reward" aria-labelledby="festivalRewardTitle">
      <div class="festival-reward-corner festival-reward-corner-tl" aria-hidden="true"></div>
      <div class="festival-reward-corner festival-reward-corner-tr" aria-hidden="true"></div>
      <div class="festival-reward-corner festival-reward-corner-bl" aria-hidden="true"></div>
      <div class="festival-reward-corner festival-reward-corner-br" aria-hidden="true"></div>
      <div class="festival-reward-lantern" aria-hidden="true"></div>
      <div class="festival-paper-flakes" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <p class="festival-reward-kicker">纸市回音</p>
      <h2 id="festivalRewardTitle">${firstCompletion ? "选得漂亮！" : "温故知新！"}</h2>
      <p>${task.correctText}</p>
      ${firstCompletion ? `<div class="festival-reward-items"><span class="reward-coin-icon">纸市铜钱 × 5</span><b>${task.stamp}</b></div>${task.slipId ? `<p class="paper-slip-inline">纸谱残页归位：${getPaperSlip(task.slipId)?.title || "新残页"}</p>` : ""}` : ""}
      ${milestone}
      <button class="festival-primary-btn" type="button" data-action="openPaperFestival">继续逛纸市</button>
    </section>
  `, "modal", "festival-modal-card festival-reward-card");
}

// ========================================
// 三阶段制纸工坊系统
// 阶段1：浸泡控制 → 阶段2：浓度平衡 → 阶段3：抄纸
// 每个阶段都有科普知识注入
// ========================================

function openApprenticeOnlyWorkshop() {
  // 工序题未完成时，工坊只显示任务面板，不启动小游戏
  openModal(`
    <section class="workshop-panel" aria-labelledby="workshopTitle">
      <header class="workshop-header">
        <span class="workshop-icon" aria-hidden="true"></span>
        <div>
          <p class="workshop-kicker">宣纸工坊</p>
          <h2 id="workshopTitle">三阶段制纸</h2>
          <span class="workshop-phase-hint">⚠️ 尚未通过工序考核</span>
        </div>
      </header>
      <p class="workshop-story-note">学徒小徐还分不清制纸的顺序。你如果不先帮他理清工序，原料就可能浪费——先帮他，再动手。</p>
      <div class="workshop-science-tip">💡 宣纸制作的传统顺序：皮料加工 → 草料加工 → 制浆 → 捞纸 → 晒纸 → 剪纸</div>
      ${state.completedQuests.has("workshopProcess")
        ? `<p class="workshop-science-tip">💡 工序已经理清。现在可以开始浸泡原料、浓度调配和抄纸了。</p>`
        : `<button class="primary-btn workshop-story-button" type="button" data-action="openQuest" data-quest-id="workshopProcess">先帮学徒理清工序</button>`}
      <div class="modal-actions">
        <button class="danger-btn" type="button" data-action="close">离开工坊</button>
      </div>
    </section>
  `);
}

function openWorkshop() {
  if (state.storyChapter === 1) {
    const step = getChapterOneStep();
    if (step === "find_grandma") {
      openModal(`<section class="story-choice-card"><p class="story-choice-kicker">纸境千年 · 工坊提醒</p><h2>做纸不急</h2><blockquote>你是宣屿吧？外婆刚才还在宣纸铺门口等你。做纸不急，先去听她说完这条老街的事。</blockquote>${closeBtn("去找外婆")}</section>`, "modal", "story-choice-modal");
      return;
    }
    if (step === "open_paper_book" || step === "paper_shop_exam") {
      openModal(`<section class="story-choice-card"><p class="story-choice-kicker">纸境千年 · 工坊提醒</p><h2>先懂纸性</h2><blockquote>纸还没认清就急着做？宣纸不是只看手快，要先懂纸性。先去宣纸铺看看生宣、熟宣、半熟宣吧。</blockquote>${closeBtn("去宣纸铺")}</section>`, "modal", "story-choice-modal");
      return;
    }
  }
  // 工序题未完成：只显示任务面板，不启动制纸小游戏
  if (!isApprenticeProcessCleared()) {
    openApprenticeOnlyWorkshop();
    return;
  }
  if (state.miniGame) state.miniGame.running = false;
  state.miniGame = null;
  state.orderComplete = false;

  const upgradeCount = Object.values(state.upgrades).filter(Boolean).length;
  const upgradeTotal = Object.keys(UPGRADES).length;

  // 科普知识轮播（每次进工坊随机显示一条）
  const scienceTips = [
    '💡 青檀树皮含韧皮纤维，是宣纸"千年寿纸"的关键。',
    '💡 沙田稻草纤维较短，与青檀皮纤维交织形成均匀纸面。',
    '💡 宣纸有"七十二道工序"之说，从原料到成品历时近一年。',
    '💡 捞纸、晒纸等环节依赖长期练习与对纸浆状态的判断。',
    '💡 宣纸始于唐代，安徽泾县是原产地，已有千年历史。',
    '💡 好宣纸能让墨色自然渗化，产生"墨分五色"的效果。'
  ];
  const tip = scienceTips[Math.floor(Math.random() * scienceTips.length)];

  openModal(`
    <section class="workshop-panel" aria-labelledby="workshopTitle">
      <header class="workshop-header">
        <span class="workshop-icon" aria-hidden="true"></span>
        <div>
          <p class="workshop-kicker">宣纸工坊</p>
          <h2 id="workshopTitle">三阶段制纸</h2>
          <span class="workshop-phase-hint" id="phaseHint">第1步 · 树皮浸泡</span>
        </div>
      </header>

      <!-- 阶段进度条 -->
      <div class="phase-progress">
        <div class="phase-step phase-step--active" data-phase="1">浸泡</div>
        <div class="phase-step" data-phase="2">调浆</div>
        <div class="phase-step" data-phase="3">抄纸</div>
      </div>
      <p class="workshop-story-note">这一次不是比快，是比稳。竹帘上的纸浆分布，决定纸面厚薄。</p>

      <!-- 科普提示 -->
      <div class="workshop-science-tip">${tip}</div>
      ${!state.completedQuests.has("workshopProcess") ? `<button class="secondary-btn workshop-story-button" type="button" data-action="openQuest" data-quest-id="workshopProcess">先帮学徒理清工序</button>` : ""}

      <!-- 阶段1：浸泡控制 -->
      <div id="phase1" class="phase-game">
        <p class="phase-desc">原料浸泡时需要控制水分、时间和纸浆状态，让纤维逐渐舒展。进度条进入绿色区域时点击。</p>
        <div class="meter-wrap">
          <div class="meter-label-row" aria-hidden="true">
            <span>未浸透</span><span class="meter-label-good">适中</span><span>过浸</span>
          </div>
          <div class="meter" aria-label="浸泡度判定条">
            <div class="success-zone" style="left:70%;width:15%"></div>
            <div id="soakBar" class="progress-fill" style="width:0%"></div>
          </div>
        </div>
        <div class="workshop-result-hint" id="phase1Hint" aria-live="polite">等待树皮浸泡...</div>
      </div>

      <!-- 阶段2：浓度平衡 -->
      <div id="phase2" class="phase-game hidden">
        <p class="phase-desc">调浆要留意水分、温度和纤维分散状态。青檀长纤维与稻草短纤维配合，有助于纸面更均匀。</p>
        <div class="conc-bars">
          <div class="conc-bar-wrap">
            <span class="conc-label">纸浆浓度</span>
            <div class="meter conc-meter" id="concMeter1">
              <div class="success-zone" style="left:60%;width:20%"></div>
              <div id="concPointer1" class="pointer" style="left:50%"></div>
            </div>
          </div>
          <div class="conc-bar-wrap">
            <span class="conc-label">水温</span>
            <div class="meter conc-meter" id="concMeter2">
              <div class="success-zone" style="left:60%;width:20%"></div>
              <div id="concPointer2" class="pointer" style="left:50%"></div>
            </div>
          </div>
        </div>
        <div class="workshop-result-hint" id="phase2Hint" aria-live="polite">用鼠标上下左右调整两项至绿色区域...</div>
      </div>

      <!-- 阶段3：抄纸（原有机制） -->
      <div id="phase3" class="phase-game hidden">
        <p class="phase-desc">竹帘入水角度决定<strong>纤维排列方向</strong>——这就是手工宣纸"帘纹"的来源。靠近绿色区域中心，纤维分布最均匀。</p>
        <div class="meter-wrap">
          <div class="meter-label-row" aria-hidden="true">
            <span>Miss</span><span class="meter-label-good">Good</span><span class="meter-label-perfect">Perfect</span><span class="meter-label-good">Good</span><span>Miss</span>
          </div>
          <div class="meter" aria-label="抄纸判定条">
            <div class="success-zone"></div>
            <div id="pointer" class="pointer"></div>
          </div>
        </div>
        <div class="workshop-result-hint" id="phase3Hint" aria-live="polite">等待竹帘...</div>
      </div>

      <!-- 工坊升级 -->
      <div class="workshop-upgrade-section">
        <p class="workshop-upgrade-title">🔧 工坊升级（${upgradeCount}/${upgradeTotal}）</p>
        <div class="workshop-upgrade-list">
          ${Object.values(UPGRADES).map(up => {
            const owned = state.upgrades[up.id];
            const canBuy = state.coins >= up.cost && !owned;
            return `
              <button class="workshop-upgrade-btn ${owned ? "owned" : ""} ${canBuy ? "can-buy" : ""}"
                type="button" data-action="buyUpgrade"
                data-upgrade-id="${up.id}" ${owned ? "disabled" : ""}>
                <span class="upgrade-icon">${up.icon}</span>
                <span class="upgrade-name">${up.name}</span>
                <span class="upgrade-desc">${up.desc}</span>
                ${owned ? '<span class="upgrade-owned">已升级</span>' : `<span class="upgrade-cost">${up.cost}金币</span>`}
              </button>
            `;
          }).join("")}
        </div>
      </div>


      <div class="modal-actions">
        <button class="primary-btn stop-mini-btn mobile-only" type="button" data-action="advancePhase">继续</button>
        <button class="danger-btn" type="button" data-action="close">离开工坊</button>
      </div>
    </section>
  `, "minigame");

  // 初始化阶段1
  state.miniGame = {
    phase: 1,
    running: true,
    soakProgress: 0,
    soakDir: 1,
    concBar1: 50,
    concBar2: 50,
    concBar1Dir: 1,
    concBar2Dir: -1,
    concStableTime: 0,
    pos: 0,
    dir: 1,
    speed: state.upgrades.workbench ? 1.15 : 1.45,
    pointer: null,
    phaseResults: { soak: null, concentration: null, stop: null }
  };
  // 科普卡片解锁
  if (!state.unlockedCards.has("七十二道工序")) {
    state.unlockedCards.add("七十二道工序");
  }
}

function miniGameCachedEl(g, key, selector) {
  if (!g._cachedEls) g._cachedEls = {};
  let el = g._cachedEls[key];
  // 缓存失效：不存在、已从 DOM 移除、或被替换
  if (!el || !el.isConnected) {
    el = document.querySelector(selector);
    g._cachedEls[key] = el || null;
  }
  return el;
}

function advanceMiniGame(timestamp = 0) {
  const g = state.miniGame;
  if (!g?.running) return;

  // 用真实时间差替代硬编码帧率假设
  const deltaMs = g._lastTimestamp ? timestamp - g._lastTimestamp : 16;
  g._lastTimestamp = timestamp;

  if (g.phase === "drying") {
    // 晒纸场：晾晒进度条
    g.dryProgress += 0.4 * g.dryDir;
    if (g.dryProgress >= 100) g.dryDir = -1;
    else if (g.dryProgress <= 0) g.dryDir = 1;
    const bar = miniGameCachedEl(g, "dryBar", "#dryBar");
    const hint = miniGameCachedEl(g, "dryHint", "#dryHint");
    if (bar) bar.style.width = `${g.dryProgress}%`;
    // 晾晒过程中不提示，完成后评价
  } else if (g.phase === 1) {
    // 阶段1：浸泡进度条自动走动
    g.soakProgress += 0.5 * g.soakDir;
    if (g.soakProgress >= 100) g.soakDir = -1;
    else if (g.soakProgress <= 0) g.soakDir = 1;
    const bar = miniGameCachedEl(g, "soakBar", "#soakBar");
    const hint = miniGameCachedEl(g, "phase1Hint", "#phase1Hint");
    if (bar) bar.style.width = `${g.soakProgress}%`;
    if (hint) { hint.innerHTML = ''; hint.style.color = 'var(--wood)'; }
  } else if (g.phase === 2) {
    // 阶段2：两个浓度bar独立移动
    g.concBar1 += 0.8 * g.concBar1Dir;
    g.concBar2 += 0.6 * g.concBar2Dir;
    if (g.concBar1 >= 100) { g.concBar1 = 100; g.concBar1Dir = -1; }
    if (g.concBar1 <= 0) { g.concBar1 = 0; g.concBar1Dir = 1; }
    if (g.concBar2 >= 100) { g.concBar2 = 100; g.concBar2Dir = -1; }
    if (g.concBar2 <= 0) { g.concBar2 = 0; g.concBar2Dir = 1; }

    const p1 = miniGameCachedEl(g, "concPointer1", "#concPointer1");
    const p2 = miniGameCachedEl(g, "concPointer2", "#concPointer2");
    const hint = miniGameCachedEl(g, "phase2Hint", "#phase2Hint");
    if (p1) p1.style.left = `calc(${g.concBar1}% - 6px)`;
    if (p2) p2.style.left = `calc(${g.concBar2}% - 6px)`;

    const bothInZone = g.concBar1 >= 60 && g.concBar1 <= 80 && g.concBar2 >= 60 && g.concBar2 <= 80;
    if (bothInZone) {
      g.concStableTime += deltaMs;
    } else {
      g.concStableTime = 0;
    }
    // 不提示，完成后评价
    if (hint) { hint.innerHTML = ''; hint.style.color = 'var(--wood)'; }
  } else if (g.phase === 3) {
    // 阶段3：原有指针移动逻辑
    g.pos += g.dir * g.speed;
    if (g.pos >= 100) { g.pos = 100; g.dir = -1; }
    if (g.pos <= 0) { g.pos = 0; g.dir = 1; }
    if (g.pointer) g.pointer.style.left = `calc(${g.pos}% - 6px)`;
    // 不提示，完成后评价
    const hint3 = miniGameCachedEl(g, "phase3Hint", "#phase3Hint");
    if (hint3) { hint3.innerHTML = ''; hint3.style.color = 'var(--wood)'; }
  }
}

function stopMiniGame() {
  if (!state.miniGame?.running) return;
  // 工序题未完成时禁止进入小游戏（深度防卫，按钮已被隐藏但仍加一道锁）
  if (!requireApprenticeProcessCleared()) return;
  const g = state.miniGame;

  if (g.phase === "drying") return dryPaper();
  if (g.phase === 1) {
    // 阶段1完成：记录浸泡结果
    const progress = g.soakProgress;
    if (progress >= 70 && progress <= 85) g.phaseResults.soak = "perfect";
    else if (progress >= 60 && progress <= 90) g.phaseResults.soak = "good";
    else g.phaseResults.soak = "miss";

    // 进入阶段2
    g.phase = 2;
    document.querySelector("#phase1").classList.add("hidden");
    document.querySelector("#phase2").classList.remove("hidden");
    document.querySelector("#phaseHint").textContent = "第2步 · 纸浆调配";
    document.querySelectorAll(".phase-step")[0].classList.replace("phase-step--active", "phase-step--done");
    document.querySelectorAll(".phase-step")[1].classList.add("phase-step--active");
    showToast("✅ 浸泡完成！现在调节纸浆浓度和水温。");
    // 解锁科普卡
    if (!state.unlockedCards.has("青檀树皮")) state.unlockedCards.add("青檀树皮");

  } else if (g.phase === 2) {
    // 阶段2完成：需要两项都稳定在绿色区域1.5秒
    const bothStable = g.concStableTime >= 1500;
    const inRange1 = g.concBar1 >= 60 && g.concBar1 <= 80;
    const inRange2 = g.concBar2 >= 60 && g.concBar2 <= 80;
    if (bothStable && inRange1 && inRange2) g.phaseResults.concentration = "perfect";
    else if (inRange1 && inRange2) g.phaseResults.concentration = "good";
    else g.phaseResults.concentration = "miss";

    // 进入阶段3
    g.phase = 3;
    document.querySelector("#phase2").classList.add("hidden");
    document.querySelector("#phase3").classList.remove("hidden");
    document.querySelector("#phaseHint").textContent = "第3步 · 抄纸定形";
    document.querySelectorAll(".phase-step")[1].classList.replace("phase-step--active", "phase-step--done");
    document.querySelectorAll(".phase-step")[2].classList.add("phase-step--active");
    g.pointer = document.querySelector("#pointer");
    showToast("✅ 浓度已调好！准备抄纸。");
    if (!state.unlockedCards.has("吸墨性")) state.unlockedCards.add("吸墨性");

  } else if (g.phase === 3) {
    // 阶段3完成：抄纸判定
    const distance = Math.abs(g.pos - 50);
    let result = "Miss";
    let perfectRange = 6;
    if (state.upgrades.bambooMat) perfectRange = 9;
    if (state.festivalBuffs.bambooOil > 0) perfectRange += 2; // 竹帘护养油
    if (distance <= perfectRange) result = "Perfect";
    else if (distance <= 13) result = "Good";
    g.phaseResults.stop = result;

    // 计算最终纸张属性（三阶段综合）
    g.running = false;
    state.gameState = "modal";
    state.orderComplete = false;
    state.paperDried = false; // 新纸需要晾晒

    const baseStats = { ...paperStats[result] };
    // 阶段1 buff：浸泡好 → 韧性+10，均匀度+10
    if (g.phaseResults.soak === "perfect") { baseStats.toughness += 10; baseStats.evenness += 10; }
    else if (g.phaseResults.soak === "good") { baseStats.toughness += 5; baseStats.evenness += 5; }
    else { baseStats.toughness -= 8; baseStats.evenness -= 8; }
    // 阶段2 buff：浓度好 → 吸墨+10，白度+10
    if (g.phaseResults.concentration === "perfect") { baseStats.ink += 10; baseStats.whiteness += 10; }
    else if (g.phaseResults.concentration === "good") { baseStats.ink += 5; baseStats.whiteness += 5; }
    else { baseStats.ink -= 8; baseStats.whiteness -= 8; }
    // 纸浆配方升级
    if (state.upgrades.pulpRecipe) {
      Object.keys(baseStats).forEach(key => { baseStats[key] = Math.min(100, Math.round(baseStats[key] * 1.10)); });
    }
    // 集市幸运符
    if (state.festivalBuffs.luckyCharm > 0) {
      Object.keys(baseStats).forEach(key => { baseStats[key] = Math.min(100, Math.round(baseStats[key] * 1.05)); });
      state.festivalBuffs.luckyCharm -= 1;
    }
    // 竹帘护养油消耗
    if (state.festivalBuffs.bambooOil > 0) state.festivalBuffs.bambooOil -= 1;
    // 限幅
    Object.keys(baseStats).forEach(key => { baseStats[key] = Math.max(10, Math.min(100, baseStats[key])); });

    const finalResult = baseStats.toughness >= 85 && baseStats.ink >= 85 && baseStats.evenness >= 85 ? "Perfect"
      : baseStats.toughness >= 70 && baseStats.ink >= 70 && baseStats.evenness >= 70 ? "Good" : "Miss";

    state.lastPaper = {
      result: finalResult,
      stats: baseStats,
      soakResult: g.phaseResults.soak,
      concResult: g.phaseResults.concentration,
      stopResult: g.phaseResults.stop,
      dried: false,
      createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
    };
    state.task = "去书画铺查看订单";
    state.storyMilestones.workshopMade = true;
    completeQuest("workshopProcess");
    unlockPaperSlip("bamboo-screen");
    if (state.storyChapter >= 3 && !state.unlockedKnowledgeCards.has("zhuchui")) {
      unlockPaperSlip("zhuchui");
    }
    const chapterEvent = checkStoryProgress();
    if (chapterEvent) {
      openModal(chapterEvent, "modal", "story-chapter-modal");
      updateMobileControls();
      return;
    }
    updateHud();
    renderReport(finalResult);
    updateMobileControls();
    // 解锁科普卡
    if (!state.unlockedCards.has("抄纸手法")) state.unlockedCards.add("抄纸手法");
  }
}

function renderReport(result) {
  const p = state.lastPaper;
  const resultInfo = {
    Perfect: { label: "卓越", badge: "result-badge--perfect", desc: "三阶段都拿捏到位，这张宣纸堪称上品！" },
    Good: { label: "精良", badge: "result-badge--good", desc: "纸张达到了可用水准，部分环节还有提升空间。" },
    Miss: { label: "未达标", badge: "result-badge--miss", desc: "纸浆分布不均或工艺不到位，建议回工坊再试。" }
  }[result];

  const phaseLabels = { perfect: "✅ 完美", good: "👍 合格", miss: "❌ 失误" };
  const phaseDetails = {
    soak: { perfect: "浸泡恰到好处，木质素充分溶解而纤维骨架完好——韧性与均匀度俱佳。", good: "浸泡基本到位，纤维已软化，可继续下一步。", miss: "浸泡不当：纤维细胞壁受损或木质素残留过多，导致韧性下降、纸面不均匀。" },
    concentration: { perfect: "浆浓度与水温均在黄金范围内，青檀长纤维与稻草短纤维完美交联——吸墨性与白度最优。", good: "调浆基本合格，纤维分布尚可。", miss: "浓度或水温偏离最佳区间：纤维交联不足或排列紊乱，影响了纸的吸墨性和洁白度。" },
    stop: { Perfect: "抄纸时机精准，竹帘角度完美——纤维均匀铺展，帘纹清晰美观，这是一张好纸的根基。", Good: "抄纸基本稳定，尚可进一步提升竹帘控制精度。", Miss: "抄纸偏离中心：纤维分布不够均匀，纸张厚薄不一，影响整体品质。" }
  };

  openPage("workshop-report", {
    type: "modal",
    nextState: "modal",
    cardClass: "workshop-report-card",
    replace: true,
    html: `
    <section class="report-panel" aria-labelledby="reportTitle">
      <header class="report-header">
        <p class="report-kicker">宣纸检测报告</p>
        <h2 id="reportTitle">
          <span class="result-badge ${resultInfo.badge}">${resultInfo.label}</span>
        </h2>
        <p class="report-desc">${resultInfo.desc}</p>
      </header>
      <div class="phase-review">
        <span>浸泡：${phaseLabels[p.soakResult] || "—"}</span>
        <span>调浆：${phaseLabels[p.concResult] || "—"}</span>
        <span>抄纸：${phaseLabels[p.stopResult] || "—"}</span>
      </div>
      <div class="phase-detail-review">
        ${p.soakResult !== "perfect" && p.soakResult !== "good" ? `<div class="phase-feedback phase-feedback--miss">${phaseDetails.soak.miss}</div>` : ""}
        ${p.concResult !== "perfect" && p.concResult !== "good" ? `<div class="phase-feedback phase-feedback--miss">${phaseDetails.concentration.miss}</div>` : ""}
        ${p.stopResult !== "Perfect" && p.stopResult !== "Good" ? `<div class="phase-feedback phase-feedback--miss">${phaseDetails.stop.Miss}</div>` : ""}
      </div>
      ${makeReportHtml(p)}
      ${p.dried ? '<p style="text-align:center;color:var(--jade);font-weight:700;font-size:14px;padding:10px;border:2px solid var(--jade);background:rgba(58,138,104,0.08);">☀️ 已晾晒 — 纸张品质已提升</p>' : '<p style="text-align:center;color:var(--gold);font-weight:700;font-size:15px;padding:12px 16px;border:2px dashed var(--gold);background:rgba(231,166,66,0.08);margin:12px 0;">💡 晾晒可提升品质 → 去老街「晒纸场」试试</p>'}
      <div class="modal-actions">
        <button class="primary-btn" type="button" data-action="close">带着报告去书画铺</button>
        <button class="secondary-btn" type="button" data-action="retryWorkshop">再做一张</button>
      </div>
    </section>
    `
  });
}

function makeReportHtml(paper) {
  const stats = paper.stats;
  const params = [
    { label: "韧性", key: "toughness", icon: "💪" },
    { label: "吸墨性", key: "ink", icon: "🖌️" },
    { label: "均匀度", key: "evenness", icon: "⚖️" },
    { label: "洁白度", key: "whiteness", icon: "✨" },
    { label: "耐久性", key: "durability", icon: "🛡️" }
  ];
  const bars = params.map(({ label, key }) => {
    const val = stats[key];
    const grade = val >= 85 ? "bar--high" : val >= 70 ? "bar--mid" : "bar--low";
    return `
      <div class="report-bar-item">
        <div class="report-bar-label"><span>${label}</span><strong>${val}</strong></div>
        <div class="report-bar-track"><div class="report-bar-fill ${grade}" style="width:${val}%"></div></div>
      </div>
    `;
  }).join("");
  return `<div class="report-bars" aria-label="宣纸参数">${bars}</div>`;
}

// ========================================
// 晒纸场系统
// 制纸完成后可来此晾晒，提升品质
// 天气随机（晴天/阴天/雨天），影响晾晒效果
// ========================================

function openDryingYard() {
  if (!state.lastPaper) {
    openModal(`
      <h2>☀️ 晒纸场</h2>
      <p>晒纸场是宣纸制作的重要环节。湿纸需要在阳光下晾晒或焙笼上烤干。</p>
      <p class="workshop-science-tip">传统晒纸使用焙笼——加热的弧形墙面，将湿纸一张张贴在焙笼上烘干。晒纸的温度、湿度、时间都会影响纸张的最终平整度和韧性。</p>
      <p>你还没有可以晾晒的湿纸，先去<strong>工坊</strong>制作一张吧。</p>
      <div class="modal-actions">${closeBtn("返回地图")}</div>
    `);
    return;
  }
  if (state.lastPaper.dried) {
    openModal(`
      <h2>☀️ 晒纸场</h2>
      <p>这张纸已经晒过了，品质提升效果还在。</p>
      ${makeReportHtml(state.lastPaper)}
      <p style="color:var(--jade);font-weight:700;">☀️ 已晾晒 — 当前属性已经是最佳状态</p>
      <div class="modal-actions">${closeBtn("返回地图")}</div>
    `);
    return;
  }

  // 随机天气
  const weathers = [
    { name: "☀️ 晴天", zone: { min: 80, max: 90 }, buff: 0.08, tip: "阳光正好，是晾晒的好日子。绿色区域较宽，容易把握。" },
    { name: "☁️ 阴天", zone: { min: 70, max: 85 }, buff: 0.05, tip: "云层较厚，晾晒需要更早收纸。绿色区域偏左。" },
    { name: "🌧️ 雨天", zone: null, buff: 0, tip: "今日下雨，不宜晾晒。建议先去书画铺交付，或者等天晴再来。" }
  ];
  const weather = weathers[Math.floor(Math.random() * weathers.length)];

  if (!weather.zone) {
    // 雨天 — 无法晾晒
    openModal(`
      <h2>🌧️ 晒纸场 · 雨天</h2>
      <p class="workshop-science-tip">传统的晒纸场大多在室外。泾县的气候温和湿润，但雨天和梅雨季节会影响晒纸。所以造纸匠人也会使用焙笼——在室内用加热的弧形墙面烘干纸张。</p>
      <p style="color:var(--brick);font-weight:700;">${weather.tip}</p>
      <div class="modal-actions">
        ${closeBtn("先去交付", "primary-btn")}
        <button class="secondary-btn" type="button" data-action="refreshDryingWeather">🔄 等天晴</button>
      </div>
    `);
    return;
  }

  // 开始晾晒小游戏
  if (state.miniGame) state.miniGame.running = false;
  state.miniGame = null;

  openModal(`
    <section class="workshop-panel" aria-labelledby="dryTitle">
      <header class="workshop-header">
        <span class="workshop-icon">☀️</span>
        <div>
          <p class="workshop-kicker">晒纸场 · ${weather.name}</p>
          <h2 id="dryTitle">晾晒湿纸</h2>
        </div>
      </header>
      <p class="phase-desc">${weather.tip}<br>进度条进入<strong>绿色区域</strong>时点击停止。收得太早纸会发霉，收得太晚纸会脆裂。</p>
      <div class="meter-wrap">
        <div class="meter-label-row" aria-hidden="true">
          <span>太湿</span><span class="meter-label-good">最佳</span><span>过干</span>
        </div>
        <div class="meter" aria-label="晾晒度判定条">
          <div class="success-zone" style="left:${weather.zone.min}%;width:${weather.zone.max - weather.zone.min}%"></div>
          <div id="dryBar" class="progress-fill" style="width:0%;background:var(--gold);"></div>
        </div>
      </div>
      <div class="workshop-result-hint" id="dryHint" aria-live="polite">等待晾晒中...</div>
      <div class="workshop-science-tip">💡 宣纸晾晒不只是"晒干"——温度、湿度、时间三者配合，才能让纸张平整、柔韧、不翘不裂。老匠人说："晒纸三分工，晾出十年功。"</div>
      <div class="modal-actions">
        <button class="primary-btn stop-mini-btn mobile-only" type="button" data-action="dryPaper">收纸</button>
        <button class="danger-btn" type="button" data-action="close">离开晒纸场</button>
      </div>
    </section>
  `, "minigame");

  state.miniGame = {
    phase: "drying",
    running: true,
    dryProgress: 0,
    dryDir: 1,
    weather: weather
  };
}

function dryPaper() {
  const g = state.miniGame;
  if (!g?.running || g.phase !== "drying") return;
  const prog = g.dryProgress;
  const zone = g.weather.zone;
  g.running = false;
  state.gameState = "modal";

  let result;
  if (prog >= zone.min && prog <= zone.max) {
    result = "perfect";
  } else if (prog >= zone.min - 10 && prog <= zone.max + 10) {
    result = "good";
  } else {
    result = "miss";
  }

  // 应用晾晒效果
  const buff = g.weather.buff;
  const p = state.lastPaper;
  if (result === "perfect") {
    Object.keys(p.stats).forEach(k => { p.stats[k] = Math.min(100, Math.round(p.stats[k] * (1 + buff))); });
    p.dried = true;
    state.paperDried = true;
    showToast("☀️ 晾晒完美！纸张品质大幅提升！");
  } else if (result === "good") {
    Object.keys(p.stats).forEach(k => { p.stats[k] = Math.min(100, Math.round(p.stats[k] * (1 + buff * 0.5))); });
    p.dried = true;
    state.paperDried = true;
    showToast("👍 晾晒完成，纸张品质有小幅提升。");
  } else {
    // 失败：收太早发霉，收太晚脆裂
    if (prog < zone.min) {
      p.stats.evenness = Math.max(10, Math.round(p.stats.evenness * 0.85));
      showToast("⚠️ 收得太早！纸张发霉，均匀度下降。");
    } else {
      p.stats.toughness = Math.max(10, Math.round(p.stats.toughness * 0.85));
      showToast("⚠️ 收得太晚！纸张脆裂，韧性下降。");
    }
  }

  updateHud();
  state.storyMilestones.dryingDone = true;
  if (result !== "miss") completeQuest("dryingYard");
  unlockPaperSlip("drying");
  const chapterEvent = checkStoryProgress();
  if (chapterEvent) {
    openModal(chapterEvent, "modal", "story-chapter-modal");
    return;
  }
  const zoneDisplay = zone ? `${zone.min}% - ${zone.max}%` : "—";
  const actualProg = Math.round(prog);
  const resultText = {
    perfect: `<span style="color:var(--jade);">✅ 晾晒得当（收在${zoneDisplay}）— 湿纸平稳定形，纸面更平整、韧性更好。</span>`,
    good: `<span style="color:var(--gold);">👍 晾晒合格（收在${actualProg}%）— 纸张基本干燥，品质有小幅提升。</span>`,
    miss: `<span style="color:var(--brick);">❌ ${prog < zone.min ? '收得太早！纸还偏湿，纸面不够稳定。' : '收得太晚！纸张过干，韧性可能受影响。'}</span>`
  }[result];

  openModal(`
    <h2>☀️ 晒纸场 · 晾晒结果</h2>
    <p>${resultText}</p>
    ${result === "perfect" ? `<p style="color:var(--jade);font-weight:700;">干燥状态合适，纸面更平整柔韧，品质得到提升。</p>` : ""}
    ${makeReportHtml(state.lastPaper)}
    <div class="modal-actions">
      <button class="primary-btn" type="button" data-action="close">带着好纸去书画铺</button>
    </div>
  `);
  // 解锁科普卡
  if (!state.unlockedCards.has("晒纸工艺")) state.unlockedCards.add("晒纸工艺");
}

// ========================================
// 工坊升级购买
// ========================================
function buyUpgrade(upgradeId) {
  if (state.miniGame?.running) {
    showToast("请先完成当前制纸，再升级工坊。");
    return;
  }
  const def = UPGRADES[upgradeId];
  if (!def || state.upgrades[upgradeId]) return;
  if (state.coins < def.cost) {
    showToast(`金币不足！需要 ${def.cost} 金币，当前只有 ${state.coins}。`);
    return;
  }
  state.coins -= def.cost;
  state.upgrades[upgradeId] = true;
  updateHud();
  showToast(`✅ 升级成功：${def.name}！`);
  // 刷新工坊面板
  openWorkshop();
}

function buyFestivalItem(itemId) {
  const items = {
    luckyCharm: { cost: 5, name: "幸运符", msg: "下一张纸全属性+5%！" },
    craftsmanNote: { cost: 10, name: "匠人手记", msg: "随机解锁一张科普卡！" },
    bambooOil: { cost: 8, name: "竹帘护养油", msg: "下5张纸Perfect判定区扩大！" }
  };
  const item = items[itemId];
  if (!item || (state.paperCoins || 0) < item.cost) return;

  const locked = itemId === "craftsmanNote"
    ? legacyKnowledgeCardIds.filter((id) => !state.unlockedCards.has(id))
    : [];
  if (itemId === "craftsmanNote" && locked.length === 0) {
    showToast("科普卡已全部解锁");
    return;
  }

  state.paperCoins -= item.cost;
  if (itemId === "luckyCharm") state.festivalBuffs.luckyCharm += 1;
  if (itemId === "bambooOil") state.festivalBuffs.bambooOil += 5;
  if (itemId === "craftsmanNote") {
    state.unlockedCards.add(locked[Math.floor(Math.random() * locked.length)]);
  }
  updateHud();
  showToast(`🪙 ${item.msg}`);
  openFestivalExchange();
}

// ========================================
// 订单系统：生成 + 接单 + 交付
// ========================================
function generateOrder(excludeNpcs = []) {
  // 根据声望过滤可用订单，排除已有NPC
  const available = ORDER_TYPES.filter(o => {
    if (!o.unlockRep) return true;
    return state.reputation >= o.unlockRep;
  }).filter(o => !excludeNpcs.includes(o.npc));
  // 如果排除后空了，回退到全部可用
  const pool = available.length > 0 ? available : ORDER_TYPES.filter(o => {
    if (!o.unlockRep) return true;
    return state.reputation >= o.unlockRep;
  });
  const order = JSON.parse(JSON.stringify(pool[Math.floor(Math.random() * pool.length)]));
  order.baseId = order.id;
  order.id = order.id + "_" + Date.now() + "_" + Math.random().toString(36).slice(2, 6);
  return order;
}

function openOrderBoard() {
  // 首次打开时生成订单列表
  if (state.orderQueue.length === 0) {
    const usedNpcs = [];
    if (state.storyChapter === 1 && state.ordersCompleted === 0) {
      const introOrder = JSON.parse(JSON.stringify(ORDER_TYPES.find((order) => order.id === "calligraphyMaster")));
      introOrder.baseId = introOrder.id;
      introOrder.id = `${introOrder.id}_${Date.now()}_intro`;
      state.orderQueue.push(introOrder);
      usedNpcs.push(introOrder.npc);
    }
    for (let i = state.orderQueue.length; i < 3; i++) {
      const order = generateOrder(usedNpcs);
      state.orderQueue.push(order);
      usedNpcs.push(order.npc);
    }
  }
  const orderHtml = state.orderQueue.map((order, idx) => {
    const canDeliver = state.lastPaper && checkOrderRequirements(order, state.lastPaper.stats);
    const judged = state.orderJudgments.has(order.id);
    const locked = order.unlockRep && state.reputation < order.unlockRep;
    const baseId = getOrderBaseId(order);
    const typeClass = baseId.includes("timed") ? "order-type--timed" : baseId.includes("premium") || order.unlockRep >= 25 ? "order-type--premium" : "";
    return `
      <div class="order-card ${locked ? "order-locked" : ""}">
        <div class="order-header">
          <span class="order-type ${typeClass}">${order.name}</span>
          <span class="order-npc">👤 ${order.npc}</span>
        </div>
        ${order.dialogue ? `<blockquote class="order-npc-dialogue">"${order.dialogue}"</blockquote>` : ""}
        ${judged ? `<p class="order-paper-case"><b>判断正确：</b>${order.paperType || "按纸性制作"}<br><span><b>工艺原因：</b>${order.scienceTip || "根据用途判断纸性。"}</span></p>` : ""}
        <div class="order-req">
          ${Object.entries(order.requirements).map(([k, v]) => {
            const labels = { toughness: "韧性", ink: "吸墨", evenness: "均匀", whiteness: "洁白", durability: "耐久" };
            return `<span>${labels[k]} ≥ ${v}</span>`;
          }).join("")}
        </div>
        <div class="order-reward">
          <span>💰 ${order.reward.gold}</span>
          <span>⭐ ${order.reward.reputation}</span>
        </div>
        ${locked ? `<button class="primary-btn order-accept-btn" type="button" disabled>🔒 需要声望${order.unlockRep}</button>` : !judged ? `<button class="primary-btn order-accept-btn" type="button" data-action="openOrderPaperChoice" data-order-id="${order.id}">判断用纸</button>` : `<button class="primary-btn order-accept-btn" type="button" data-action="acceptOrder" data-order-id="${order.id}">${canDeliver ? "📦 交付此单" : "去工坊按要求制纸"}</button>`}
      </div>
    `;
  }).join("");

  openModal(`
    <section class="order-board" aria-labelledby="orderBoardTitle">
      <header class="order-board-header">
        <p class="order-board-kicker">📜 书画铺 · 订单看板</p>
        <h2 id="orderBoardTitle">老街坊的订单</h2>
        <p>每一单都是一道用纸案例：先听需求，再判断纸性，做对纸才真正帮得上老街坊。</p>
        <p style="font-size:12px;color:var(--wood);margin:0;">📖 完成关键委托会让《纸谱十二笺》归位。</p>
      </header>
      <div class="order-list-scroll">${orderHtml}</div>
      <div class="modal-actions">
        <button class="secondary-btn" type="button" data-action="close">返回地图</button>
        <button class="primary-btn" type="button" data-action="refreshOrders">🔄 刷新订单</button>
      </div>
    </section>
  `);
}

function refreshOrders() {
  state.orderQueue = [];
  const usedNpcs = [];
  for (let i = 0; i < 3; i++) {
    const order = generateOrder(usedNpcs);
    state.orderQueue.push(order);
    usedNpcs.push(order.npc);
  }
  openOrderBoard();
}

function checkOrderRequirements(order, stats) {
  return Object.entries(order.requirements).every(([key, val]) => (stats[key] || 0) >= val);
}

function getOrderBaseId(order) {
  if (!order) return "";
  if (order.baseId) return order.baseId;
  if (typeof order.id === "string") return order.id.split("_")[0];
  return "";
}

const ORDER_SLIP_MAP = {
  "calligraphyMaster": "ink-door",
  "masterLi": "half-cooked",
  "premiumCourt": "glue-alum",
  "mountMaster": "millennium"
};

function getOrderSlipId(order) {
  return ORDER_SLIP_MAP[getOrderBaseId(order)] || null;
}

function tryUnlockWaxSlipFromOrder(order) {
  const baseId = getOrderBaseId(order);
  if (
    state.storyChapter >= 2 &&
    order &&
    (baseId === "collectorChen" || baseId === "premiumCourt") &&
    !state.unlockedKnowledgeCards.has("wax")
  ) {
    unlockPaperSlip("wax");
    showToast("纸谱残页归位：粉蜡细线");
  }
}

function openOrderPaperChoice(orderId, feedback = "") {
  const order = state.orderQueue.find((item) => item.id === orderId);
  if (!order) return;
  const options = ["生宣", "熟宣", "半熟宣"].map((paper) => `<button class="story-choice-option" type="button" data-action="answerOrderPaperChoice" data-order-id="${order.id}" data-paper-type="${paper}">${paper}</button>`).join("");
  openModal(`
    <section class="story-choice-card" aria-labelledby="orderChoiceTitle">
      <p class="story-choice-kicker">纸境千年 · 用纸判断</p>
      <h2 id="orderChoiceTitle">${order.npc}的用纸委托</h2>
      <blockquote>${order.dialogue || "这位街坊需要一张合适的纸。"}</blockquote>
      <p class="story-choice-question">应该为他推荐哪种纸？</p>
      ${feedback ? `<p class="story-choice-hint">${feedback}</p>` : ""}
      <div class="story-choice-options">${options}</div>
      <button class="festival-text-btn" type="button" data-action="openOrderBoard">回到订单看板</button>
    </section>
  `, "modal", "story-choice-modal");
}

function answerOrderPaperChoice(orderId, paperType) {
  const order = state.orderQueue.find((item) => item.id === orderId);
  if (!order) return;
  if (paperType !== order.paperType) {
    openOrderPaperChoice(orderId, "再想想：先看这位客人要的是墨色变化、线条稳定，还是两者之间的平衡。");
    return;
  }
  state.orderJudgments.add(orderId);
  showToast("判断正确：现在可以按需求制作并交付。");
  openOrderBoard();
}

function acceptOrder(orderId) {
  const order = state.orderQueue.find(o => o.id === orderId);
  if (!order) return;
  if (!state.orderJudgments.has(orderId)) {
    showToast("先完成“判断用纸”，再准备交付。");
    return;
  }
  if (!state.lastPaper) {
    showToast("你还没有制作的宣纸！先去工坊制作一张。");
    return;
  }
  if (!checkOrderRequirements(order, state.lastPaper.stats)) {
    showToast("这张纸不符合订单要求，请重新制作！");
    return;
  }
  // 交付成功
  state.coins += order.reward.gold;
  state.reputation += order.reward.reputation;
  state.ordersCompleted += 1;
  const slipId = getOrderSlipId(order);
  if (slipId) unlockPaperSlip(slipId);
  tryUnlockWaxSlipFromOrder(order);
  state.orderQueue = state.orderQueue.filter(o => o.id !== orderId);
  state.orderJudgments.delete(orderId);
  state.task = "继续制作或查看非遗馆";
  state.lastPaper = null;
  updateHud();

  // 主线章节推进检查
  const chapterEvent = checkStoryProgress();
  if (chapterEvent) {
    openModal(chapterEvent, "modal", "story-chapter-modal");
    return;
  }

  // NPC专属对话与科普
  const npcDialogue = order.dialogue || '"这张纸不错，正合我用。"';
  const scienceTip = order.scienceTip || '宣纸有"千年寿纸"之誉，因其原料富含纤维素、采用碱性制浆，不易酸化。';

  openModal(`
    <section class="reward-panel" aria-labelledby="rewardTitle">
      <div class="reward-lantern" aria-hidden="true"></div>
      <p class="reward-kicker">📜 ${order.npc}</p>
      <h2 id="rewardTitle">订单完成！</h2>
      <blockquote class="reward-quote">${npcDialogue}</blockquote>
      <div class="reward-items">
        <span class="result-badge result-badge--perfect">金币 +${order.reward.gold}</span>
        <span class="result-badge result-badge--good">声望 +${order.reward.reputation}</span>
      </div>
      <div class="reward-science">
        <span class="reward-science-icon">📖</span>
        <p>${scienceTip}</p>
      </div>
      <div class="modal-actions">
        ${closeBtn("继续制作", "primary-btn")}
        <button class="secondary-btn" type="button" data-action="openOrderBoard">查看新订单</button>
      </div>
    </section>
  `);
}

// ========================================
// 主线剧情章节推进
// ========================================
function storyChapterEvent(label, text) {
  return `
    <section class="story-chapter-banner" aria-labelledby="storyChapterTitle">
      <img src="${STORY_ASSETS.grandmaNote}" alt="" onerror="this.onerror=null;this.hidden=true">
      <p>《纸谱十二笺》 · ${label}</p>
      <h2 id="storyChapterTitle">${getStoryChapterTitle()}</h2>
      <blockquote>${text}</blockquote>
      <button class="primary-btn" type="button" data-action="close">继续走走</button>
    </section>
  `;
}

function checkStoryProgress() {
  const has = (id) => state.unlockedKnowledgeCards.has(id);
  if (state.storyChapter === 1 && state.storyMilestones.paperBookOpened && state.storyMilestones.paperShopExam && state.storyMilestones.workshopMade && state.ordersCompleted >= 1) {
    state.storyChapter = 2;
    updateStoryTask();
    return storyChapterEvent("第一章完", "王大爷接过纸，轻轻抖了抖：‘纸面匀，墨也吃得住。你外婆这铺子，后继有人了。’外婆站在门口笑了笑：‘老街开始听见你的名字了。’");
  }
  if (state.storyChapter === 2 && state.storyMilestones.qingtanVisited && state.storyMilestones.riceVisited && state.ordersCompleted >= 2) {
    state.storyChapter = 3;
    updateStoryTask();
    return storyChapterEvent("第二章完", "宣屿把纸轻轻摊开，第一次觉得它不像一件商品。它有山里的筋骨，也有田里的肌理。");
  }
  if (state.storyChapter === 3 && has("bamboo-screen") && has("drying") && has("crafts") && paperSlipCount() >= 6) {
    state.storyChapter = 4;
    updateStoryTask();
    return storyChapterEvent("第三章完", "非遗馆最里面的展柜亮了一半。玻璃上浮现出外婆年轻时的字迹：‘纸有筋骨，人有手艺。若有人愿意继续做，老街便不会老。’");
  }
  if (state.storyChapter === 4 && paperSlipCount() === PAPER_SLIPS.length && festivalProgress() === festivalTasks.length && state.ordersCompleted >= 4 && state.storyMilestones.museumVisited && !state.finaleShown) {
    state.finaleShown = true;
    state.coins += 300;
    state.reputation += 100;
    updateStoryTask();
    return `
      <section class="story-finale" aria-labelledby="storyFinaleTitle">
        <img src="${STORY_ASSETS.museumDisplay}" alt="非遗馆展柜亮起" onerror="this.onerror=null;this.hidden=true">
        <p>纸境千年 · 重新开馆</p>
        <h2 id="storyFinaleTitle">十二笺归位，老街重亮</h2>
        <blockquote>非遗馆的十二个展柜一盏盏亮起。有人看原料，有人看工艺，有孩子趴在柜台前问：‘宣纸为什么能保存这么久？’<br><br>外婆没有回答，只是看向宣屿。宣屿把第一张自己做的纸放进展柜旁边，轻声说：‘因为有人记得，也有人继续做。’</blockquote>
        <div class="reward-items"><span>获得称号：新一代守纸人</span><span>老街声望 +100</span><span>金币 +300</span></div>
        <div class="modal-actions"><button class="primary-btn" type="button" data-action="close">继续探索老街</button><button class="secondary-btn" type="button" data-action="openPaperCodex">查看纸谱十二笺</button></div>
      </section>
    `;
  }
  return null;
}

function renderDebugLayer() {
  mapDebugLayer.innerHTML = "";
  [...collisionBoxes.map((box) => ({ ...scaleRect(box), type: "collision", label: box.name || box.id })),
   ...interactionZones.map((zone) => ({ ...scaleRect(zone), type: "interaction", label: zone.name || zone.id }))].forEach((box) => {
    const el = document.createElement("div");
    el.className = `debug-box ${box.type}`;
    el.style.left = `${box.x}px`;
    el.style.top = `${box.y}px`;
    el.style.width = `${box.width}px`;
    el.style.height = `${box.height}px`;
    el.textContent = box.label;
    mapDebugLayer.appendChild(el);
  });
  const currentZone = state.activeZone ? `${state.activeZone.name} (${state.activeZone.id})` : "无";
  debugReadout.textContent = [
    `player x:${Math.round(state.player.x)} y:${Math.round(state.player.y)}`,
    `camera x:${Math.round(state.camera.x)} y:${Math.round(state.camera.y)}`,
    `interactionZone: ${currentZone}`,
    "F2 显示/隐藏 | F3 打印坐标"
  ].join("\n");
}

function setDebugMode(enabled) {
  state.debugMode = enabled;
  mapDebugLayer.classList.toggle("visible", enabled);
  debugReadout.classList.toggle("hidden", !enabled);
  if (!enabled) mapDebugLayer.innerHTML = "";
  updateMap();
}

function openPaperCodex() {
  const count = paperSlipCount();
  const slips = PAPER_SLIPS.map((slip) => {
    const unlocked = state.unlockedKnowledgeCards.has(slip.id);
    const art = unlocked ? (STORY_ASSETS[slip.icon] || STORY_ASSETS.paperSlip) : STORY_ASSETS.lockedSlip;
    return `
      <article class="paper-codex-card ${unlocked ? "is-unlocked" : "paper-codex-locked"}">
        <img src="${art}" alt="" onerror="this.onerror=null;this.hidden=true">
        <div><small>${unlocked ? "已归位" : "未归位"}</small><h3>${unlocked ? slip.title : "残页未现"}</h3><p>${unlocked ? slip.shortText : `线索：${slip.unlockBy}`}</p>${unlocked ? `<span>${slip.relatedLocation}</span>` : ""}</div>
      </article>`;
  }).join("");
  openModal(`
    <section class="paper-codex-panel" aria-labelledby="paperCodexTitle">
      <header class="paper-codex-header">
        <img src="${STORY_ASSETS.paperCodexBook}" alt="打开的纸谱" onerror="this.onerror=null;this.hidden=true">
        <div><p>非遗馆 · 外婆手录</p><h2 id="paperCodexTitle">《纸谱十二笺》</h2><span>纸谱归位：<b>${count} / ${PAPER_SLIPS.length}</b></span></div>
      </header>
      <p class="paper-codex-intro">十二张残页散在老街的人、手艺与记忆里。懂得纸性，才能替人用对纸，也才能让它们归位。</p>
      <div class="paper-codex-grid">${slips}</div>
      <div class="modal-actions">${closeBtn("返回老街")}</div>
    </section>
  `, "modal", "paper-codex-modal");
}

function openMuseum() {
  state.storyMilestones.museumVisited = true;
  if (paperPageCount() >= 6 && !state.completedQuests.has("museum")) {
    openQuest("museum");
    return;
  }
  const chapterEvent = checkStoryProgress();
  if (chapterEvent) {
    openModal(chapterEvent, "modal", "story-chapter-modal");
    return;
  }
  openPaperPagesCodex();
}

function handleAction(action, dataset = {}) {
  if (action === "close") { closeModal(); return; }
  if (action === "retryWorkshop") { openWorkshop(); return; }
  if (action === "stopMiniGame" || action === "advancePhase") { stopMiniGame(); return; }
  if (action === "openWorkshop") { openWorkshop(); return; }
  if (action === "openPaperShop") { openPaperShop(); return; }
  if (action === "openPaperCodex") { openPaperCodex(); return; }
  if (action === "openPaperPagesCodex") { openPaperPagesCodex(); return; }
  if (action === "openQuest") { openQuestOnce(dataset.questId); return; }
  if (action === "answerQuest") { answerQuest(dataset.questId, dataset.option); return; }
  if (action === "openStoryChoice") { openStoryChoice(dataset.caseId); return; }
  if (action === "answerStoryChoice") { answerStoryChoice(dataset.slipId, dataset.option); return; }
  if (action === "switchPaperType") { openPaperShop(dataset.paperId); return; }
  if (action === "enterFestival" || action === "openPaperFestival") { openPaperFestival(); return; }
  if (action === "openFestivalTask") { openFestivalTask(dataset.taskId); return; }
  if (action === "answerFestivalTask") { answerFestivalTask(dataset.taskId, dataset.option); return; }
  if (action === "buyUpgrade") { buyUpgrade(dataset.upgradeId); return; }
  if (action === "buyFestivalItem") { buyFestivalItem(dataset.itemId); return; }
  if (action === "openFestivalExchange") { openFestivalExchange(); return; }
  if (action === "openOrderBoard") { openOrderBoard(); return; }
  if (action === "openOrderPaperChoice") { openOrderPaperChoice(dataset.orderId); return; }
  if (action === "answerOrderPaperChoice") { answerOrderPaperChoice(dataset.orderId, dataset.paperType); return; }
  if (action === "acceptOrder") { acceptOrder(dataset.orderId); return; }
  if (action === "refreshOrders") { refreshOrders(); return; }
  if (action === "openDryingYard") { openDryingYard(); return; }
  if (action === "dryPaper") { dryPaper(); return; }
  if (action === "refreshDryingWeather") { openDryingYard(); return; }
  console.warn("handleAction: unknown action:", action, dataset);
}

function handlePauseAction(action) {
  if (action === "resume") { closePauseMenu(); return; }
  if (action === "returnStart") { returnToStartScreen(); return; }
  console.warn("handlePauseAction: unknown action:", action);
}

introScreen.addEventListener("click", startGame);

modalCard.addEventListener("click", (event) => {
  if (event.target.closest(".meter") && state.miniGame?.running) {
    stopMiniGame();
    return;
  }
  const button = event.target.closest("[data-action]");
  if (!button) return;
  handleAction(button.dataset.action, button.dataset);
});

pauseLayer.addEventListener("click", (event) => {
  const button = event.target.closest("[data-pause-action]");
  if (!button) return;
  handlePauseAction(button.dataset.pauseAction);
});

mobilePauseButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.gameState === "playing") openPauseMenu();
});

paperPagesButton?.addEventListener("click", () => openPaperPagesCodex());

interactionPrompt.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.gameState !== "playing") return;
  const nearbyNpc = getNearbyNpcDialogue();
  if (nearbyNpc) advanceNpcDialogue(nearbyNpc.id);
  else if (state.activeZone) activateZone(state.activeZone);
});

document.querySelectorAll("[data-npc-dialogue]").forEach((npc) => {
  npc.addEventListener("click", (event) => {
    if (state.gameState !== "playing") return;
    event.preventDefault();
    event.stopPropagation();
    advanceNpcDialogue(npc.dataset.npcDialogue);
  });
  npc.addEventListener("keydown", (event) => {
    if (event.code !== "Enter" && event.code !== "Space") return;
    event.preventDefault();
    event.stopPropagation();
    if (state.gameState === "playing") advanceNpcDialogue(npc.dataset.npcDialogue);
  });
});

mapViewport.addEventListener("click", (event) => {
  if (state.gameState !== "playing") return;
  const clickedZone = getZoneAtPoint(mapPointFromClient(event.clientX, event.clientY));
  if (!clickedZone) return;
  if (!state.activeZone || state.activeZone.id !== clickedZone.id) {
    showToast("请靠近后再交互");
    return;
  }
  activateZone(clickedZone);
});

mobileControls?.addEventListener("pointerdown", (event) => {
  if (state.gameState !== "playing") return;
  event.preventDefault();
  event.stopPropagation();
  state.joystickActive = true;
  state.joystickPointerId = event.pointerId;
  mobileControls.setPointerCapture?.(event.pointerId);
  updateJoystickFromPointer(event);
});

mobileControls?.addEventListener("mousedown", (event) => {
  if (state.gameState !== "playing") return;
  event.preventDefault();
  event.stopPropagation();
  state.joystickActive = true;
  state.joystickPointerId = "mouse";
  updateJoystickFromPointer(event);
});

mobileControls?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
});

window.addEventListener("pointermove", (event) => {
  if (!state.joystickActive || state.joystickPointerId !== event.pointerId) return;
  event.preventDefault();
  updateJoystickFromPointer(event);
});

window.addEventListener("pointerup", (event) => {
  if (state.joystickPointerId !== event.pointerId) return;
  event.preventDefault();
  resetJoystick();
});

window.addEventListener("pointercancel", (event) => {
  if (state.joystickPointerId !== event.pointerId) return;
  resetJoystick();
});

window.addEventListener("mousemove", (event) => {
  if (!state.joystickActive || state.joystickPointerId !== "mouse") return;
  event.preventDefault();
  updateJoystickFromPointer(event);
});

window.addEventListener("mouseup", (event) => {
  if (state.joystickPointerId !== "mouse") return;
  event.preventDefault();
  resetJoystick();
});

streetMap.addEventListener("load", initializeMap);
if (streetMap.complete) initializeMap();
setMobileVH();
window.addEventListener("resize", () => {
  invalidateMobileCache();
  detectPlatform();
  setMobileVH();
  resizeCamera();
  if (state.gameState === "playing") updateMap();
});
window.addEventListener("orientationchange", () => {
  invalidateMobileCache();
  detectPlatform();
  setMobileVH();
  resizeCamera();
  if (state.gameState === "playing") updateMap();
});

document.addEventListener("touchmove", (event) => {
  if (currentPlatform === "desktop" || event.target.closest(".modal-card")) return;
  event.preventDefault();
}, { passive: false });

function isTextEntryTarget(target = document.activeElement) {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || target.matches("input, textarea, select, [contenteditable='true']");
}

window.addEventListener("keydown", (event) => {
  // 输入框中的 Esc 交给控件自身处理，不能意外退出当前页面。
  if (event.code === "Escape" && isTextEntryTarget(event.target)) return;

  if (["ArrowLeft", "ArrowRight", "ArrowUp", "ArrowDown", "Space", "F2", "F3", "Escape"].includes(event.code)) {
    event.preventDefault();
  }
  if (state.gameState === "start") {
    startGame();
    return;
  }
  if (event.code === "F2") {
    setDebugMode(!state.debugMode);
    return;
  }
  if (event.code === "F3") {
    console.log(`player position: { x: ${Math.round(state.player.x)}, y: ${Math.round(state.player.y)} }`);
    return;
  }
  if (event.code === "Escape") {
    if (state.currentPage !== "map") goBackPage();
    else if (state.gameState === "playing") openPauseMenu();
    return;
  }
  if (state.gameState === "paused") return;
  if (event.code === "Space" && state.miniGame?.running) {
    stopMiniGame();
    return;
  }
  if (state.gameState !== "playing") return;
  if (event.code === NPC_INTERACT_KEY_CODE) {
    const nearbyNpc = getNearbyNpcDialogue();
    if (nearbyNpc) advanceNpcDialogue(nearbyNpc.id);
    return;
  }
  if (event.code === INTERACT_KEY_CODE) {
    interact();
    return;
  }
  state.keys.add(event.code);
});

window.addEventListener("keyup", (event) => {
  state.keys.delete(event.code);
});

// 窗口失去焦点时清空所有按键，避免键位残留导致"走不动"
window.addEventListener("blur", () => {
  state.keys.clear();
});

// 移动端/触屏：点击地图区域让窗口获取焦点（确保键盘事件生效）
mapViewport.addEventListener("mousedown", () => {
  window.focus();
});

updateHud();
detectPlatform();       // 初始化时判定平台
resizeCamera();          // 触发一次地图布局
requestAnimationFrame(gameLoop);

// ========================================
// 全局错误处理：避免 gameLoop 之外的异常静默丢失
// ========================================
var _lastErrorToastTime = 0;
function _showErrorToast(msg) {
  var now = Date.now();
  if (now - _lastErrorToastTime < 3000) return; // 3秒内不重复
  _lastErrorToastTime = now;
  try { showToast(msg); } catch (_) { /* ignore */ }
}

window.onerror = function (msg, source, lineno, colno, error) {
  console.error("全局错误:", { msg: msg, source: source, lineno: lineno, colno: colno, error: error });
  _showErrorToast("游戏出现异常，请刷新页面或查看控制台（F12）");
  return true;
};

window.onunhandledrejection = function (event) {
  console.error("未捕获的 Promise 拒绝:", event.reason);
  _showErrorToast("游戏出现异常，请刷新页面或查看控制台（F12）");
  event.preventDefault();
};
