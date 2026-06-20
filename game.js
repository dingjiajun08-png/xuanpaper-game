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
  coins: 0,
  reputation: 0,
  task: "去工坊制作第一张宣纸",
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
  earnedStamps: new Set(),
  completedFestivalTasks: new Set(),
  festivalMilestoneShown: false,
  festivalCompleteShown: false,
  orderComplete: false,
  modalOpen: false,
  miniGame: null,
  debugMode: false,
  toastTimer: null,
  joystickVector,
  joystickActive: false,
  joystickPointerId: null
};

// 根据宣纸铺柜台位置调整此坐标：用于打开“宣纸铺·分类图鉴”。
const paperShopInteractZone = { x: 650, y: 716, width: 182, height: 86 };

const interactionZones = [
  { id: "qingtanForest", name: "青檀林入口", prompt: "按 E 前往青檀林入口", x: 150, y: 80, width: 130, height: 90 },
  { id: "dryingYard", name: "晒纸场", prompt: "按 E 查看晒纸场", x: 744, y: 250, width: 76, height: 118 },
  { id: "calligraphyShop", name: "书画铺", prompt: "按 E 进入书画铺", x: 566, y: 408, width: 88, height: 60 },
  { id: "teaHouse", name: "茶馆", prompt: "按 E 进入茶馆", x: 922, y: 362, width: 110, height: 52 },
  { id: "workshop", name: "宣纸工坊区", prompt: "按 E 进入工坊", x: 1200, y: 374, width: 116, height: 54 },
  { id: "waterWheel", name: "水车", prompt: "按 E 查看水车", x: 318, y: 618, width: 96, height: 74 },
  {
    id: "paperShop",
    name: "宣纸铺·分类图鉴",
    prompt: "按 E 查看宣纸分类图鉴",
    mobilePrompt: "查看宣纸分类图鉴",
    ...paperShopInteractZone
  },
  { id: "museum", name: "非遗馆", prompt: "按 E 进入非遗馆", x: 1160, y: 714, width: 158, height: 84 },
  { id: "market", name: "纸市非遗节", prompt: "按 E 前往纸市非遗节", mobilePrompt: "进入纸市非遗节", x: 620, y: 790, width: 280, height: 78 },
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

const cardData = [
  {
    id: "青檀树皮",
    icon: "icon-bark",
    title: "青檀树皮",
    text: "青檀树皮中的韧皮纤维较长，是宣纸具有较好韧性和耐久性的重要原因之一。"
  },
  {
    id: "抄纸手法",
    icon: "icon-scoop",
    title: "抄纸手法",
    text: "抄纸时纸浆在竹帘上的分布是否均匀，会影响纸张厚薄、纹理和书写效果。"
  },
  {
    id: "吸墨性",
    icon: "icon-ink",
    title: "吸墨性",
    text: "宣纸的吸墨效果与纤维结构、纸张孔隙和打浆程度有关。好的宣纸不是单纯吸水快，而是能让墨色自然渗化。"
  }
];

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
const taskText = document.querySelector("#taskText");

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
  showToast("去工坊制作第一张宣纸。按 F2 可显示坐标调试层。");
}

function showStartScreen() {
  state.gameState = "start";
  state.introActive = true;
  state.modalOpen = false;
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

function resetGame() {
  // Reserved for a future restart option.
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

function openPauseMenu() {
  if (state.gameState !== "playing") return;
  state.gameState = "paused";
  state.keys.clear();
  interactionPrompt.classList.add("hidden");
  pauseLayer.classList.remove("hidden");
  updateMobileControls();
}

function closePauseMenu() {
  if (state.gameState !== "paused") return;
  state.gameState = "playing";
  pauseLayer.classList.add("hidden");
  state.keys.clear();
  updateMap();
  updateMobileControls();
}

function updateHud() {
  coinText.textContent = state.coins;
  reputationText.textContent = state.reputation;
  taskText.textContent = state.task;
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
  if (!isMobileInput()) return zone.prompt;
  if (zone.mobilePrompt) return zone.mobilePrompt;
  return zone.prompt.replace(/^按 E /, "点击");
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
    if (state.activeZone && state.gameState === "playing") {
      interactionPrompt.textContent = getInteractionPrompt(state.activeZone);
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

  if (state.miniGame?.running) advanceMiniGame();
  requestAnimationFrame(gameLoop);
}

function openComingSoon(zone) {
  openModal(`
    <h2>${zone.name}</h2>
    <p>${zone.name}将在后续版本开放。</p>
    <p>这里会逐步加入宣纸材料、工艺、人物剧情和经营事件。</p>
    <div class="modal-actions">${closeBtn("返回地图")}</div>
  `);
}

function interact() {
  if (state.gameState !== "playing") return;
  const zone = state.activeZone;
  if (!zone) {
    showToast(isMobileInput() ? "靠近交互区域后点击。" : "靠近蓝色交互区域后按 E。");
    return;
  }
  activateZone(zone);
}

function activateZone(zone) {
  if (zone.id === "workshop") openWorkshop();
  else if (zone.id === "calligraphyShop") openArtShop();
  else if (zone.id === "museum") openMuseum();
  else if (zone.id === "paperShop") openPaperShop();
  else if (zone.id === "market") openFestivalEntrance();
  else openComingSoon(zone);
}

function openModal(html, nextState = "modal", cardClass = "") {
  state.gameState = nextState;
  state.modalOpen = true;
  modalCard.className = `modal-card${cardClass ? ` ${cardClass}` : ""}`;
  modalCard.innerHTML = html;
  modalLayer.classList.remove("hidden");
  interactionPrompt.classList.add("hidden");
  updateMobileControls();
}

function closeModal() {
  state.modalOpen = false;
  state.gameState = "playing";
  modalLayer.classList.add("hidden");
  modalCard.className = "modal-card";
  modalCard.innerHTML = "";
  state.miniGame = null;
  updateMap();
  updateMobileControls();
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
          <h2 id="paperShowcaseTitle">纸境千年 · 宣纸铺图鉴</h2>
          <p>从纸性到工艺，读懂一张宣纸的脾气。</p>
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
        <button class="catalog-close" type="button" data-action="close">我知道了</button>
      </footer>
    </section>
  `, "modal", "paper-showcase-card");
}

function openPaperShop(paperId = "shengxuan") {
  const paper = paperBookGroups.flatMap((group) => group.papers).find((item) => item.id === paperId) || paperShowcaseData[0];
  state.hasVisitedPaperShop = true;
  state.unlockedPaperCategories.add(paper.id);
  state.unlockedPaperItems.add(`paper-type:${paper.id}`);
  if (state.paperShopStoryStage === 0) state.paperShopStoryStage = 1;
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
    stamp: "金屑映纸"
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
    stall: "宣纸摊",
    npc: "画师",
    icon: "paper",
    brief: "画师要画墨色自然散开的泼墨山水。",
    dialogue: "我要画一幅泼墨山水，想让墨色自然散开，有浓淡变化。你觉得用哪种纸好？",
    options: ["生宣", "熟宣", "粉蜡笺"],
    answer: "生宣",
    correctText: "选得准！生宣吸水快，洇墨明显，适合写意、泼墨和表现水墨层次。",
    hintText: "这张纸更适合控制线条，但泼墨山水需要更自然的墨色扩散。再想想哪种纸最容易洇墨。",
    stamp: "墨韵自然"
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
    <section class="festival-entry" aria-labelledby="festivalEntryTitle">
      <div class="festival-entry-border" aria-hidden="true"></div>
      <div class="festival-entry-lantern festival-entry-lantern-left" aria-hidden="true">
        <span class="lantern-tassel"><i></i><i></i><i></i></span>
      </div>
      <div class="festival-entry-lantern festival-entry-lantern-right" aria-hidden="true">
        <span class="lantern-tassel"><i></i><i></i><i></i></span>
      </div>
      <div class="festival-entry-top-banner" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="festival-entry-fg-leaves" aria-hidden="true"><i></i><i></i><i></i></div>
      <div class="festival-entry-ground" aria-hidden="true"><i></i><i></i><i></i><i></i><i></i></div>
      <div class="festival-entry-corner festival-entry-corner-tl" aria-hidden="true"></div>
      <div class="festival-entry-corner festival-entry-corner-tr" aria-hidden="true"></div>
      <div class="festival-entry-corner festival-entry-corner-bl" aria-hidden="true"></div>
      <div class="festival-entry-corner festival-entry-corner-br" aria-hidden="true"></div>
      <p class="festival-entry-kicker">宣纸老街 · 节令雅集</p>
      <h2 id="festivalEntryTitle">纸市非遗节</h2>
      <p class="festival-entry-lead">一张纸，藏着山水与匠心。循着墨香入市，与四位行家交换一枚纸上的答案。</p>
      <div class="festival-entry-highlights" aria-label="纸市活动亮点">
        <span>四席匠艺</span><span>限时探访</span><span>集印成册</span>
      </div>
      <div class="festival-entry-actions">
        <button class="festival-primary-btn" type="button" data-action="enterFestival">开启纸市之旅</button>
        <button class="festival-secondary-btn" type="button" data-action="close">暂不前往</button>
      </div>
    </section>
  `, "modal", "festival-modal-card");
}

function openPaperFestival() {
  const completed = festivalProgress();
  const stalls = festivalTasks.map((task) => {
    const done = state.completedFestivalTasks.has(task.id);
    return `
      <button class="festival-booth festival-booth--${task.icon}${done ? " completed" : ""}" type="button" data-action="openFestivalTask" data-task-id="${task.id}" aria-label="${task.stall}：${task.npc}，${task.brief}">
        <span class="booth-awning" aria-hidden="true"></span>
        <span class="booth-awning-edge" aria-hidden="true"></span>
        <span class="booth-pole booth-pole-left" aria-hidden="true"></span>
        <span class="booth-pole booth-pole-right" aria-hidden="true"></span>
        <span class="booth-backdrop" aria-hidden="true"></span>
        <span class="booth-counter" aria-hidden="true"></span>
        <span class="booth-counter-edge" aria-hidden="true"></span>
        <span class="booth-props" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="booth-hanging-art" aria-hidden="true"></span>
        <span class="booth-paper-stack" aria-hidden="true"><i></i><i></i></span>
        <span class="festival-npc festival-npc--${task.icon} festival-npc--image" aria-hidden="true"></span>
        <span class="booth-label"><i aria-hidden="true"></i><strong>${task.stall}</strong><em>${task.npc}</em></span>
        ${done ? `<b class="festival-done-stamp">已完成</b>` : `<span class="booth-warm-glow" aria-hidden="true"></span>`}
      </button>
    `;
  }).join("");

  openModal(`
    <section class="paper-festival" aria-labelledby="paperFestivalTitle">
      <header class="paper-festival-header">
        <span class="festival-header-lantern" aria-hidden="true"></span>
        <div>
          <p>宣纸老街 · 节令雅集</p>
          <h2 id="paperFestivalTitle">纸市非遗节</h2>
          <span>四席匠艺，以纸会友；集齐四枚知识印章。</span>
        </div>
        <span class="festival-header-leaves" aria-hidden="true"></span>
      </header>
      <div class="festival-market-scene" aria-label="纸市非遗节集市场景">
        <span class="market-canopy market-canopy-left" aria-hidden="true"></span>
        <span class="market-canopy market-canopy-right" aria-hidden="true"></span>
        <span class="market-lantern market-lantern-one" aria-hidden="true"></span>
        <span class="market-lantern market-lantern-two" aria-hidden="true"></span>
        <span class="market-lantern market-lantern-three" aria-hidden="true"></span>
        <span class="market-lantern-string" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="market-paper-piece market-paper-one" aria-hidden="true"></span>
        <span class="market-paper-piece market-paper-two" aria-hidden="true"></span>
        <span class="market-paper-piece market-paper-three" aria-hidden="true"></span>
        <span class="market-paper-piece market-paper-four" aria-hidden="true"></span>
        <span class="market-parasol" aria-hidden="true"></span>
        <span class="market-center-table" aria-hidden="true"><i></i><i></i></span>
        <span class="market-flag-line" aria-hidden="true"></span>
        <span class="market-bamboo-pole market-bamboo-left" aria-hidden="true"></span>
        <span class="market-bamboo-pole market-bamboo-right" aria-hidden="true"></span>
        <span class="market-bamboo-shelf" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="market-ground-stone" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="market-ground-leaf" aria-hidden="true"><i></i><i></i><i></i><i></i></span>
        <span class="market-ground-grass" aria-hidden="true"><i></i><i></i></span>
        <span class="market-dryer-rack" aria-hidden="true"><i></i></span>
        <span class="market-paper-scroll" aria-hidden="true"><i></i><i></i></span>
        <span class="market-wooden-sign" aria-hidden="true"></span>
        <span class="market-straw-bundle" aria-hidden="true"><i></i></span>
        <span class="market-fg-leaf" aria-hidden="true"><i></i><i></i><i></i></span>
        <span class="market-fg-lantern" aria-hidden="true"><i></i></span>
        <div class="festival-stalls">${stalls}</div>
      </div>
      <footer class="paper-festival-footer">
        <div class="festival-counters">
          <span class="festival-counter-coins">行旅铜钱 <b>${state.paperCoins}</b></span>
          <span class="festival-counter-stamps">纸市印章 <b>${state.earnedStamps.size}</b> / ${festivalTasks.length}</span>
          <span>探访进度 <b>${completed}</b> / ${festivalTasks.length}</span>
        </div>
        <button class="festival-secondary-btn" type="button" data-action="close">返回老街</button>
      </footer>
    </section>
  `, "modal", "festival-modal-card");
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
      <div class="festival-task-avatar festival-stall-${task.icon}" aria-hidden="true"><span></span></div>
      <p class="festival-task-stall">${task.stall} · ${task.npc}</p>
      <h2 id="festivalTaskTitle">纸市选纸问答</h2>
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
    milestone = `<div class="festival-milestone festival-milestone-final"><strong>纸市非遗节圆满完成！</strong><span>你不只认识宣纸，也学会了根据用途选择纸张。</span><em>最终奖励：纸市节纪念贴纸 · 宣屿表情包「认真选纸」· 节日摊位装饰「小纸灯」</em></div>`;
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
      ${firstCompletion ? `<div class="festival-reward-items"><span class="reward-coin-icon">纸市铜钱 × 5</span><b>${task.stamp}</b></div>` : ""}
      ${milestone}
      <button class="festival-primary-btn" type="button" data-action="openPaperFestival">继续逛纸市</button>
    </section>
  `, "modal", "festival-modal-card festival-reward-card");
}

function openWorkshop() {
  if (state.miniGame) state.miniGame.running = false;
  state.miniGame = null;
  openModal(`
    <section class="workshop-panel" aria-labelledby="workshopTitle">
      <header class="workshop-header">
        <span class="workshop-icon" aria-hidden="true"></span>
        <div>
          <p class="workshop-kicker">宣纸工坊</p>
          <h2 id="workshopTitle">抄纸小游戏</h2>
        </div>
      </header>
      <p class="workshop-tip">看准竹帘入水后纸浆最均匀的时机，<strong>按空格</strong>停止指针。越接近绿色区域中心，纸张参数越好。</p>
      <div class="mini-game">
        <div class="paper-vat" aria-hidden="true">
          <span class="vat-bubble vat-bubble-1" aria-hidden="true"></span>
          <span class="vat-bubble vat-bubble-2" aria-hidden="true"></span>
          <span class="vat-bubble vat-bubble-3" aria-hidden="true"></span>
        </div>
        <div class="meter-wrap">
          <div class="meter-label-row" aria-hidden="true">
            <span>Miss</span><span class="meter-label-good">Good</span><span class="meter-label-perfect">Perfect</span><span class="meter-label-good">Good</span><span>Miss</span>
          </div>
          <div class="meter" aria-label="抄纸判定条">
            <div class="success-zone"></div>
            <div id="pointer" class="pointer"></div>
          </div>
        </div>
      </div>
      <div class="workshop-result-hint" aria-live="polite" id="workshopResultHint"></div>
      <div class="modal-actions">
        <button class="primary-btn stop-mini-btn mobile-only" type="button" data-action="stopMiniGame">停止竹帘</button>
        <button class="danger-btn" type="button" data-action="close">离开工坊</button>
      </div>
    </section>
  `, "minigame");
  state.miniGame = {
    running: true,
    pos: 0,
    dir: 1,
    speed: 1.45,
    pointer: document.querySelector("#pointer")
  };
}

function advanceMiniGame() {
  const game = state.miniGame;
  game.pos += game.dir * game.speed;
  if (game.pos >= 100) {
    game.pos = 100;
    game.dir = -1;
  }
  if (game.pos <= 0) {
    game.pos = 0;
    game.dir = 1;
  }
  if (game.pointer) game.pointer.style.left = `calc(${game.pos}% - 6px)`;
}

function stopMiniGame() {
  if (!state.miniGame?.running) return;
  const distance = Math.abs(state.miniGame.pos - 50);
  let result = "Miss";
  if (distance <= 6) result = "Perfect";
  else if (distance <= 12) result = "Good";

  state.miniGame.running = false;
  state.gameState = "modal";
  // 每次制纸都重置订单完成状态，支持多轮循环
  state.orderComplete = false;
  state.lastPaper = {
    result,
    stats: paperStats[result],
    createdAt: new Date().toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit" })
  };
  state.task = "去书画铺接待书法家";
  updateHud();
  renderReport(result);
  updateMobileControls();
}

function renderReport(result) {
  const resultInfo = {
    Perfect: { label: "完美", badge: "result-badge--perfect", desc: "竹帘起落很稳，纸浆分布漂亮。这是一张好纸。" },
    Good: { label: "合格", badge: "result-badge--good", desc: "纸张达到了可用水准，还有打磨空间。" },
    Miss: { label: "未达标", badge: "result-badge--miss", desc: "纸浆分布不均，建议回工坊再试一次。" }
  }[result];

  modalCard.innerHTML = `
    <section class="report-panel" aria-labelledby="reportTitle">
      <header class="report-header">
        <p class="report-kicker">宣纸检测报告</p>
        <h2 id="reportTitle">
          <span class="result-badge ${resultInfo.badge}">${resultInfo.label}</span>
        </h2>
        <p class="report-desc">${resultInfo.desc}</p>
      </header>
      ${makeReportHtml(state.lastPaper)}
      <div class="modal-actions">
        <button class="primary-btn" type="button" data-action="close">带着报告去书画铺</button>
        <button class="secondary-btn" type="button" data-action="retryWorkshop">再抄一张</button>
      </div>
    </section>
  `;
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
    const grade = val >= 85 ? "bar--high" : val >= 75 ? "bar--mid" : "bar--low";
    return `
      <div class="report-bar-item">
        <div class="report-bar-label"><span>${label}</span><strong>${val}</strong></div>
        <div class="report-bar-track"><div class="report-bar-fill ${grade}" style="width:${val}%"></div></div>
      </div>
    `;
  }).join("");
  return `
    <div class="report-bars" aria-label="宣纸参数">
      ${bars}
    </div>
  `;
}

function openArtShop() {
  if (!state.lastPaper) {
    openModal(`
      <h2>书画铺</h2>
      <p>书法家正在挑纸，但你还没有可交付的宣纸。</p>
      <p>先去工坊完成抄纸，拿到检测报告后再来接待顾客。</p>
      <div class="modal-actions">${closeBtn("返回地图")}</div>
    `);
    return;
  }

  const stats = state.lastPaper.stats;
  const enough = stats.ink >= 75 && stats.evenness >= 75 && stats.toughness >= 70;
  const current = `
    <div class="order-list">
      <span>吸墨性 >= 75 <strong>当前 ${stats.ink}</strong></span>
      <span>均匀度 >= 75 <strong>当前 ${stats.evenness}</strong></span>
      <span>韧性 >= 70 <strong>当前 ${stats.toughness}</strong></span>
    </div>
  `;

  if (state.orderComplete) {
    openModal(`
      <h2>书画铺</h2>
      <p>书法家正在试墨，对你的纸很满意。</p>
      <p>下一站可以去非遗馆查看已经解锁的科普卡。</p>
      ${current}
      <div class="modal-actions">${closeBtn("返回地图")}</div>
    `);
    return;
  }

  openModal(`
    <h2>书画铺：书法家订单</h2>
    <p>书法家说：“我想买一张适合写行草的宣纸。纸要吸墨稳定，纸面均匀，也不能太容易破。”</p>
    <h3>订单要求</h3>
    ${current}
    <div class="modal-actions">
      <button class="primary-btn" type="button" data-action="${enough ? "deliverOrder" : "failOrder"}">交付这张宣纸</button>
      <button class="secondary-btn" type="button" data-action="close">稍后再来</button>
    </div>
  `);
}

function deliverOrder() {
  if (state.orderComplete) return;
  state.coins += 100;
  state.reputation += 10;
  state.orderComplete = true;
  state.unlockedCards.add("抄纸手法");
  state.task = "去非遗馆查看科普卡";
  updateHud();
  openModal(`
    <section class="reward-panel" aria-labelledby="rewardTitle">
      <div class="reward-lantern" aria-hidden="true"></div>
      <p class="reward-kicker">顾客满意</p>
      <h2 id="rewardTitle">书法家称赞了你！</h2>
      <blockquote class="reward-quote">"这张纸吸墨稳定，纸面也匀。老街还有这样的手艺，真难得。"</blockquote>
      <div class="reward-items">
        <span class="result-badge result-badge--perfect">金币 +100</span>
        <span class="result-badge result-badge--good">声望 +10</span>
      </div>
      <p class="reward-unlock">🔓 已解锁科普卡：<strong>抄纸手法</strong></p>
      <div class="modal-actions">
        ${closeBtn("去非遗馆看看")}
        <button class="secondary-btn" type="button" data-action="retryWorkshop">继续制纸</button>
      </div>
    </section>
  `);
}

function failOrder() {
  state.task = "回工坊再试一张";
  updateHud();
  openModal(`
    <h2>还差一点</h2>
    <p>书法家轻轻摇头："这张纸还不够稳定。行草落笔快，纸面和吸墨都要更稳些。"</p>
    <p>回工坊重新制作，争取让吸墨性、均匀度和韧性都达标。</p>
    ${makeReportHtml(state.lastPaper)}
    <div class="modal-actions">
      <button class="primary-btn" type="button" data-action="retryWorkshop">回工坊再做一张</button>
      ${closeBtn("返回地图", "danger-btn")}
    </div>
  `);
}

function openMuseum() {
  const cardsHtml = cardData.map((card) => {
    const unlocked = state.unlockedCards.has(card.id);
    return `
      <article class="science-card ${unlocked ? "unlocked" : "locked"}" aria-label="${unlocked ? card.title : "未解锁科普卡"}">
        <div class="science-card-icon-wrap">
          <div class="card-icon ${card.icon}" aria-hidden="true"></div>
          ${unlocked ? `<span class="science-card-unlocked-badge" aria-hidden="true">✓</span>` : ""}
        </div>
        <div class="science-card-content">
          <h3>${unlocked ? card.title : "？？？"}</h3>
          <p>${unlocked ? card.text : "完成对应任务后，这张科普卡会在非遗馆亮起。"}</p>
        </div>
        <span class="tag science-card-status">${unlocked ? "已解锁" : "待解锁"}</span>
      </article>
    `;
  }).join("");

  const unlockedCount = cardData.filter((c) => state.unlockedCards.has(c.id)).length;

  openModal(`
    <section class="museum-panel" aria-labelledby="museumTitle">
      <header class="museum-header">
        <p class="museum-kicker">非遗馆</p>
        <h2 id="museumTitle">宣纸科普图鉴</h2>
        <p>馆里的小展台记录着宣纸的材料、工艺和书写特性。</p>
        <div class="museum-progress">
          <span>已解锁 <strong>${unlockedCount}</strong> / ${cardData.length} 张</span>
          <div class="museum-progress-bar"><div class="museum-progress-fill" style="width:${Math.round(unlockedCount / cardData.length * 100)}%"></div></div>
        </div>
      </header>
      <div class="cards-grid">${cardsHtml}</div>
      <div class="modal-actions">${closeBtn("返回地图")}</div>
    </section>
  `);
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

function handleAction(action, dataset = {}) {
  if (action === "close") closeModal();
  if (action === "retryWorkshop") openWorkshop();
  if (action === "deliverOrder") deliverOrder();
  if (action === "failOrder") failOrder();
  if (action === "stopMiniGame") stopMiniGame();
  if (action === "switchPaperType") openPaperShop(dataset.paperId);
  if (action === "enterFestival" || action === "openPaperFestival") openPaperFestival();
  if (action === "openFestivalTask") openFestivalTask(dataset.taskId);
  if (action === "answerFestivalTask") answerFestivalTask(dataset.taskId, dataset.option);
}

function handlePauseAction(action) {
  if (action === "resume") closePauseMenu();
  if (action === "returnStart") returnToStartScreen();
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

interactionPrompt.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  if (state.gameState === "playing" && state.activeZone) activateZone(state.activeZone);
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

window.addEventListener("keydown", (event) => {
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
    if (state.gameState === "modal" || state.gameState === "minigame") closeModal();
    else if (state.gameState === "paused") closePauseMenu();
    else if (state.gameState === "playing") openPauseMenu();
    return;
  }
  if (state.gameState === "paused") return;
  if (event.code === "Space" && state.miniGame?.running) {
    stopMiniGame();
    return;
  }
  if (state.gameState !== "playing") return;
  if (event.code === "KeyE") {
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
