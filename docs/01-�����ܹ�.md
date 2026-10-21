# 技术架构

## 1. 网页版整体结构

网页版是一个无构建工具、无需后端的静态 Web 应用：

- `index.html`：页面结构
- `styles.css`：手机/桌面响应式样式
- `app.js`：状态管理、地图渲染、交互、传感器、导航流程、百度地图接力
- `data.js`：校园 POI、一号楼教室、楼梯节点和楼层图配置
- `nav-engine.js`：校园步道图最短路算法
- `walk-graph.js`：由 OpenStreetMap 校园道路简化得到的步行图
- `assets/map/campus-map.jpg`：浑南校区静态地图
- `assets/indoor/building1-*.jpg`：用户提供的一号楼 1F/2F 原始平面图

## 2. 地图渲染

校园地图不是在线瓦片实时加载，而是预下载 OpenStreetMap 瓦片后拼成静态图：

- 地图包围范围与瓦片编号在 `data.js` 的 `CAMPUS.map` 中
- 经纬度通过 Web Mercator 投影转换到图片像素
- 页面拖动修改地图中心点，缩放修改 `scale`
- 用户拖动地图后会关闭自动跟随，点击定位按钮恢复

## 3. 室内标准化地图

- 原始楼层图在浏览器 Canvas 中进行像素处理
- 去除浅灰色扫描背景，保留深色墙线和房间边界
- 叠加米色背景、楼层标签、教室热点、蓝色路线和当前位置点
- 当前只处理一号楼 1F/2F

## 4. 室内导航

`buildIndoorGuide()` 根据起点和终点生成楼层级步骤：

- 同层：当前教室 → 走廊 → 目标教室
- 跨层：当前教室 → 最近楼梯 → 上/下楼 → 目标教室
- 室外：当前教室 → 楼梯 → 1F → 出口

楼梯节点位于 `data.js` 的 `INDOOR_STAIRS`。

## 5. 定位方式

### 室外

- `navigator.geolocation.watchPosition()`
- 对异常跳点进行过滤
- 位置变化做平滑处理

### 室内

- 用户先校准到具体教室
- 使用 `deviceorientation` / `deviceorientationabsolute` 获取指南针
- 使用 `devicemotion` 做步态检测
- 步数 × 步长映射到路线进度
- 用户可人工点选位置、步长切换、±2 米调整和重新计步
- 位置点只沿规划路线移动，避免完全脱离路线

## 6. 室外导航接力

- 室内/室外切换条始终随导航显示
- 用户确认“已到室外”后，生成百度地图 URI
- 坐标从 WGS84 转换为 GCJ-02，再转换为 BD-09
- `location.href` 打开百度地图，后续室外导航由百度地图负责