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
  orderComplete: false,
  modalOpen: false,
  miniGame: null,
  debugMode: false,
  toastTimer: null,
  joystickVector,
  joystickActive: false,
  joystickPointerId: null
};

const interactionZones = [
  { id: "qingtanForest", name: "青檀林入口", prompt: "按 E 前往青檀林入口", x: 150, y: 80, width: 130, height: 90 },
  { id: "dryingYard", name: "晒纸场", prompt: "按 E 查看晒纸场", x: 744, y: 250, width: 76, height: 118 },
  { id: "calligraphyShop", name: "书画铺", prompt: "按 E 进入书画铺", x: 566, y: 408, width: 88, height: 60 },
  { id: "teaHouse", name: "茶馆", prompt: "按 E 进入茶馆", x: 922, y: 362, width: 110, height: 52 },
  { id: "workshop", name: "宣纸工坊区", prompt: "按 E 进入工坊", x: 1200, y: 374, width: 116, height: 54 },
  { id: "waterWheel", name: "水车", prompt: "按 E 查看水车", x: 318, y: 618, width: 96, height: 74 },
  { id: "paperShop", name: "宣纸铺", prompt: "按 E 进入宣纸铺", x: 650, y: 716, width: 182, height: 86 },
  { id: "museum", name: "非遗馆", prompt: "按 E 进入非遗馆", x: 1160, y: 714, width: 158, height: 84 },
  { id: "market", name: "小广场 / 集市", prompt: "按 E 查看集市", x: 620, y: 790, width: 280, height: 78 },
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
const mobileInteractButton = document.querySelector("#mobileInteractButton");
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

  return {
    minX: leftFoot,
    maxX: state.map.width - rightFoot,
    minY: topFoot,
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
  updateMobileControls();
}

function hideStartScreen() {
  state.gameState = "playing";
  state.introActive = false;
  state.keys.clear();
  introScreen.classList.add("hidden");
  gameScreen.classList.remove("hidden");
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

function isMobileInput() {
  return window.matchMedia("(pointer: coarse)").matches || window.innerWidth <= 768;
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
  const maxRadius = rect.width * 0.38;
  const rawX = event.clientX - centerX;
  const rawY = event.clientY - centerY;
  const distance = Math.min(maxRadius, Math.hypot(rawX, rawY));
  const angle = Math.atan2(rawY, rawX);
  const stickX = distance * Math.cos(angle);
  const stickY = distance * Math.sin(angle);

  joystickVector.x = maxRadius ? stickX / maxRadius : 0;
  joystickVector.y = maxRadius ? stickY / maxRadius : 0;
  if (joystickStick) joystickStick.style.transform = `translate(${stickX - 24}px, ${stickY - 24}px)`;
}

function updateMobileControls() {
  const mobile = isMobileInput();
  const controlsEnabled = mobile && state.gameState === "playing";
  const portrait = mobile && window.innerHeight > window.innerWidth;

  mobileControls?.classList.toggle("hidden", !controlsEnabled);
  mobilePauseButton?.classList.toggle("hidden", !controlsEnabled);
  mobileInteractButton?.classList.toggle("hidden", !controlsEnabled || !state.activeZone);
  orientationHint?.classList.toggle("hidden", !portrait || state.gameState === "start");

  if (!controlsEnabled) resetJoystick();
}

function hideVirtualControls() {
  document.querySelectorAll(".virtual-joystick, .mobile-joystick, .touch-controls, .mobile-controls").forEach((control) => {
    control.classList.add("hidden");
  });
  mobilePauseButton?.classList.add("hidden");
  mobileInteractButton?.classList.add("hidden");
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
      interactionPrompt.textContent = state.activeZone.prompt;
      interactionPrompt.classList.remove("hidden");
    } else {
      interactionPrompt.classList.add("hidden");
    }

    if (state.debugMode) renderDebugLayer();
    updateMobileControls();
  } catch (e) {
    // 不崩溃 — 常见原因是交互区数组里有空洞元素
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
    showToast("靠近蓝色交互区域后按 E。");
    return;
  }
  activateZone(zone);
}

function activateZone(zone) {
  if (zone.id === "workshop") openWorkshop();
  else if (zone.id === "calligraphyShop") openArtShop();
  else if (zone.id === "museum") openMuseum();
  else if (zone.id === "paperShop") openPaperShop();
  else openComingSoon(zone);
}

function openModal(html, nextState = "modal") {
  state.gameState = nextState;
  state.modalOpen = true;
  modalCard.innerHTML = html;
  modalLayer.classList.remove("hidden");
  interactionPrompt.classList.add("hidden");
  updateMobileControls();
}

function closeModal() {
  state.modalOpen = false;
  state.gameState = "playing";
  modalLayer.classList.add("hidden");
  modalCard.innerHTML = "";
  state.miniGame = null;
  updateMap();
  updateMobileControls();
}

function closeBtn(label, variant = "primary-btn") {
  return `<button class="${variant}" type="button" data-action="close">${label}</button>`;
}

function openPaperShop() {
  const inventory = state.lastPaper ? `已有一张${state.lastPaper.result}宣纸。` : "还没有可出售的宣纸。";
  openModal(`
    <h2>宣纸铺</h2>
    <p>这是玩家自己的店，可以查看金币、声望、当前任务和纸张库存。</p>
    <div class="order-list">
      <span>金币 <strong>${state.coins}</strong></span>
      <span>声望 <strong>${state.reputation}</strong></span>
      <span>当前任务 <strong>${state.task}</strong></span>
      <span>纸张库存 <strong>${inventory}</strong></span>
    </div>
    ${state.lastPaper ? makeReportHtml(state.lastPaper) : ""}
    <div class="modal-actions">${closeBtn("返回地图", "secondary-btn")}</div>
  `);
}

function openWorkshop() {
  openModal(`
    <h2>工坊：抄纸小游戏</h2>
    <p>看准竹帘入水后纸浆最均匀的时机，按空格停止指针。越接近绿色区域中心，纸张参数越好。</p>
    <div class="mini-game">
      <div class="paper-vat" aria-hidden="true"></div>
      <div class="meter" aria-label="抄纸判定条">
        <div class="success-zone"></div>
        <div id="pointer" class="pointer"></div>
      </div>
    </div>
    <p><span class="tag">空格</span> 停止指针并生成检测报告</p>
    <div class="modal-actions">
      <button class="primary-btn stop-mini-btn mobile-only" type="button" data-action="stopMiniGame">停止竹帘</button>
      <button class="danger-btn" type="button" data-action="close">离开工坊</button>
    </div>
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
  if (distance <= 4) result = "Perfect";
  else if (distance <= 8) result = "Good";

  state.miniGame.running = false;
  state.gameState = "modal";
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
  const resultText = result === "Perfect" ? "Perfect：竹帘起落很稳，纸浆分布漂亮。" :
    result === "Good" ? "Good：纸张达到了可用水准，还有打磨空间。" :
    "Miss：纸浆分布不均，建议再试一次。";
  modalCard.innerHTML = `
    <h2>宣纸检测报告</h2>
    <p><span class="result-badge">${result}</span></p>
    <p>${resultText}</p>
    ${makeReportHtml(state.lastPaper)}
    <div class="modal-actions">
      <button class="primary-btn" type="button" data-action="close">带着报告去书画铺</button>
      <button class="secondary-btn" type="button" data-action="retryWorkshop">再抄一张</button>
    </div>
  `;
}

function makeReportHtml(paper) {
  const stats = paper.stats;
  return `
    <h3>参数</h3>
    <div class="report-grid">
      <div class="report-item"><span>韧性</span><strong>${stats.toughness}</strong></div>
      <div class="report-item"><span>吸墨性</span><strong>${stats.ink}</strong></div>
      <div class="report-item"><span>均匀度</span><strong>${stats.evenness}</strong></div>
      <div class="report-item"><span>洁白度</span><strong>${stats.whiteness}</strong></div>
      <div class="report-item"><span>耐久性</span><strong>${stats.durability}</strong></div>
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
    <h2>顾客满意</h2>
    <p>书法家铺纸试笔，墨色自然铺开，行草的转折也没有洇成一团。</p>
    <p>评价：“这张纸吸墨稳定，纸面也匀。老街还有这样的手艺，真难得。”</p>
    <p><span class="result-badge">金币 +100</span> <span class="result-badge">声望 +10</span></p>
    <p>已解锁科普卡：抄纸手法</p>
    <div class="modal-actions">${closeBtn("去非遗馆看看")}</div>
  `);
}

function failOrder() {
  openModal(`
    <h2>还差一点</h2>
    <p>书法家轻轻摇头：“这张纸还不够稳定。行草落笔快，纸面和吸墨都要更稳些。”</p>
    <p>回工坊重新制作，争取让吸墨性、均匀度和韧性都达标。</p>
    ${makeReportHtml(state.lastPaper)}
    <div class="modal-actions">${closeBtn("回工坊重新制作")}</div>
  `);
}

function openMuseum() {
  const cardsHtml = cardData.map((card) => {
    const unlocked = state.unlockedCards.has(card.id);
    return `
      <article class="science-card ${unlocked ? "" : "locked"}">
        <div>
          <div class="card-icon ${card.icon}" aria-hidden="true"></div>
          <h3>${unlocked ? card.title : "未解锁"}</h3>
          <p>${unlocked ? card.text : "完成对应任务后，这张科普卡会在非遗馆亮起。"}</p>
        </div>
        <span class="tag">${unlocked ? "已解锁" : "待解锁"}</span>
      </article>
    `;
  }).join("");

  openModal(`
    <h2>非遗馆：科普图鉴</h2>
    <p>馆里的小展台记录着宣纸的材料、工艺和书写特性。完成老街任务后，更多卡片会被点亮。</p>
    <div class="cards-grid">${cardsHtml}</div>
    <div class="modal-actions">${closeBtn("返回地图")}</div>
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

function handleAction(action) {
  if (action === "close") closeModal();
  if (action === "retryWorkshop") openWorkshop();
  if (action === "deliverOrder") deliverOrder();
  if (action === "failOrder") failOrder();
  if (action === "stopMiniGame") stopMiniGame();
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
  handleAction(button.dataset.action);
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

mobileInteractButton?.addEventListener("click", (event) => {
  event.preventDefault();
  event.stopPropagation();
  interact();
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
  setMobileVH();
  resizeCamera();
  updateMobileControls();
});
window.addEventListener("orientationchange", () => {
  setMobileVH();
  resizeCamera();
  updateMobileControls();
});

document.addEventListener("touchmove", (event) => {
  if (!isMobileInput() || event.target.closest(".modal-card")) return;
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
updateMobileControls();
requestAnimationFrame(gameLoop);
