# 《纸境千年》集市区域美术增强 — 变更概览

## 修改范围
仅修改集市区域（纸市非遗节），不动地图、玩家、工坊、订单、非遗馆、任务系统。

## JS 改动（game.js）

### openFestivalEntrance()
- 新增前景竹叶装饰：`.festival-entry-fg-leaves`（3片竹叶）
- 新增地面石子：`.festival-entry-ground`（4颗石子）

### openPaperFestival()
- 摊位新增纸堆：`.booth-paper-stack`（每个摊位底部都有宣纸卷）
- 场景新增 18 个装饰元素：
  - 灯笼：`market-lantern-three` + `market-lantern-string`（灯笼串）
  - 纸屑：`market-paper-four`
  - 竹竿：`market-bamboo-pole`（左右两根）
  - 竹架：`market-bamboo-shelf`（放纸卷）
  - 地面：石子、落叶、草丛
  - 宣纸道具：晾纸架、纸轴
  - 其他：木牌、稻草捆
  - 前景遮挡：竹叶边缘、右下角灯笼

## CSS 改动（style.css）

### 新增动画
- `lanternSway`：灯笼微晃，3.2s~4s 周期
- `paperDrift`：纸屑飘动，5.2s 周期

### 新增样式（全部程序化 CSS 绘制）
- 入口竹叶/石子
- 第三个灯笼 + 灯笼串（3个）
- 第四张飘纸
- 左右竹竿 + 竹架（3层搁板）
- 地面石子（3颗）、落叶（4片）、草丛（2簇）
- 晾纸架（2层横杆）
- 纸轴（2卷）
- 木牌（竖杆+牌面）
- 稻草捆（绑绳纹理）
- 前景竹叶（3片，遮挡效果）
- 前景灯笼（右下角）
- 摊位纸堆（每个摊位都有，不同摊位大小不同）
- NPC 细化：paper/brush/gift/mallet 衣服和肤色不同

### 场景氛围增强
- `.festival-market-scene` 背景加入 radial-gradient 光斑，模拟石板路反光
- 任务弹窗加宣纸纹理背景
- 奖励弹窗纸屑飘落增强

### 响应式
- 移动端自动隐藏复杂装饰（竹竿、竹架、晾纸架、纸轴、木牌、稻草捆、前景遮挡）
- 保留灯笼、纸屑、地面基础元素
