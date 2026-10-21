# 团队分工与接手建议

## 前端

- 接手 `web-app/app.js`
- 重点重构地图状态管理，拆分：
  - campus-map.js
  - indoor-map.js
  - navigation-state.js
  - sensors.js
  - baidu-handoff.js
- 增加路线动画、语音播报和偏航检测

## 地图数据

- 用官方图纸核对一号楼
- 形成 `building1-1f.svg`、`building1-2f.svg`
- 为每个房间建立多边形和中心点
- 用统一坐标系存储房间、门、楼梯、出口

## 定位硬件/算法

- 确认学校是否已有 BLE/UWB/Wi-Fi 定位服务
- 若无，优先选择 BLE Beacon 试点
- 在楼梯、楼门、走廊拐角部署校准点
- 输出统一的室内定位 SDK

## 后端

- 管理 POI、建筑、楼层、房间和路线
- 存储测试反馈和定位异常
- 提供版本发布能力

## 测试

- 桌面浏览器：定位、导航、首页布局
- Android Chrome：GPS、方向、运动、百度跳转
- iOS Safari：传感器授权、百度跳转
- 微信内置浏览器：兼容性
- 现场测试：1F/2F 同层、跨层、出楼、到图书馆