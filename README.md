# 东北大学浑南校区校园导航 · 团队交付包

版本：**v0.2.0**  
日期：2026-10-21  
目标：验证“校园总地图 + 一号楼 1F/2F 标准化室内地图 + 权威定位来源 + 室内导航 + 百度地图室外接力”。  
在线测试：https://lyx493.github.io/neu-campus-navigation/

## v0.2.0 重点

- 不再根据步数、计时器或指南针自动推算室内位置
- 支持外部 UWB / BLE / Wi-Fi 实时坐标直接注入
- 人工教室选择、平面图点选、±2 米微调均可校准位置
- 2F 到室外明确经过楼梯、1F 走廊和 A105 右侧东南出口门
- 定位来源、精度、外部更新时间和导航阶段写入诊断面板
- 出楼阶段监听 GPS，用户确认后自动切换百度地图

## 交付内容

| 目录 | 内容 |
| --- | --- |
| `web-app/` | 可直接运行的网页版 |
| `wechat-mini-program/` | 早期微信小程序源码 |
| `docs/` | 架构、数据、测试、已知问题、接口和分工 |
| `screenshots/` | 历史评审截图 |

## 快速启动

双击 `web-app/start.bat`，或执行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

访问 `http://127.0.0.1:8765/`。手机定位和传感器需要 HTTPS，固定测试入口为 `https://lyx493.github.io/neu-campus-navigation/`。

## 外部定位入口

```js
window.CampusIndoorPositioning.update({
  floor: 2,
  x: 76.0,
  y: 86.8,
  accuracy: 0.8,
  source: 'uwb',
  roomCode: 'A203'
});
```

完整 JSON、WebSocket 和调试接口见 `docs/06-positioning-api.md`。

## 当前核心限制

1. 浏览器自身不能提供精确连续室内坐标。
2. 必须接入 UWB、蓝牙信标、Wi-Fi 指纹或学校定位平台。
3. 平面图热点、楼梯和东南门仍需官方图纸与现场测量复核。
4. 百度地图接力依赖网络，不同手机可能唤起 App 或网页。
5. 临时 Cloudflare 地址不作为正式生产入口。

## 团队接手入口

- 页面：`web-app/index.html`
- 业务逻辑：`web-app/app.js`
- 室内数据：`web-app/data.js`
- 路网：`web-app/nav-engine.js`
- 平面图：`web-app/assets/indoor/`
- 已知问题：`docs/04-known-issues.md`
- 改进计划：`docs/05-roadmap.md`
