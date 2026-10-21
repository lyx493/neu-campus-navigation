# 东北大学浑南校区导航网页版

版本：`v0.2.0`  
当前范围：校园室外地图 + 一号楼 1F/2F 标准化室内地图 + 百度地图室外接力。

## 打开方式

Windows 下双击 `start.bat`，浏览器会打开：

`http://127.0.0.1:8765/`

也可以在本目录执行：

```powershell
python -m http.server 8765 --bind 127.0.0.1
```

手机测试必须使用 HTTPS 地址，或让手机与电脑处于同一网络后访问电脑局域网地址。直接打开 `file://` 页面通常无法授权定位和传感器。

## v0.2.0 关键修复

- 浏览器不再根据步数、计时器或指南针自动推算并移动用户位置。
- 室内“我”的位置只来自两种权威来源：用户明确校准，或外部 UWB / 蓝牙 / Wi-Fi 定位数据。
- 外部定位的 `x/y` 会原样显示在楼层图上，不再投影到路线后伪造位置。
- 人工校准、教室选择、平面图点选、±2 米微调都会同步更新位置和定位来源。
- 2F 到室外会先导航到楼梯、下到 1F，再前往 A105 教室右侧的东南出口门。
- 到达出口阶段后开始监听 GPS；用户确认到室外后切换到百度地图。
- 地图拖动后保持自由浏览，不会自动回弹；点击定位后才恢复跟随。
- 指南针未启用或只有相对方向时，不再显示可能误导用户的固定方向箭头。

## 室内定位说明

浏览器本身不能获得厘米级室内坐标。当前网页提供：

1. 一号楼 1F/2F 教室与区域选择。
2. 标准化平面图上直接点选“我”的位置。
3. 导航路线节点校准与前后 2 米微调。
4. 外部定位系统实时坐标接口。
5. 指南针方向辅助，只用于显示朝向，不用于推算位置。

步数会显示，但不会改变定位点。这是为了避免“手机在走、地图上的人也自己走”的假定位。

## 外部定位接口

外部系统可以在页面控制台、原生壳或 WebView 中调用：

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

- `floor`：只能是 `1` 或 `2`
- `x/y`：标准化楼层图左上角起算的百分比坐标，范围 `0-100`
- `accuracy`：米
- `source`：`uwb`、`ble`、`wifi` 或 `external`
- `roomCode`：可选，用于同步教室名称

同时支持 WebSocket：

```js
window.CampusIndoorPositioning.connect('wss://example.com/indoor-position');
```

服务端每次发送一行 JSON：

```json
{"floor":1,"x":90,"y":88,"accuracy":1.1,"source":"ble","roomCode":"A105"}
```

室外事件：

```json
{"outdoor":true}
```

也可以派发浏览器事件：

```js
window.dispatchEvent(new CustomEvent('campus-indoor-position', {
  detail: { floor: 1, x: 90, y: 88, source: 'uwb', accuracy: 1.0 }
}));
```

调试方法：

```js
window.CampusIndoorPositioning.getState()
window.CampusIndoorPositioning.getNavigationState()
```

## 手机诊断

“我的 → 手机诊断”可查看：

- HTTPS 安全环境
- GPS 精度与更新时间
- 方向和运动传感器事件数
- 地图拖动次数
- 当前定位来源
- 最近一次外部定位更新时间
- JavaScript 运行错误

诊断数据可一键复制，便于团队成员定位手机兼容性问题。

## 地图与路线

- 校园地图和步道数据本地化，不依赖地图 Key。
- 一号楼 1F/2F 平面图位于 `assets/indoor/`。
- 室内到室内支持同层直达和跨楼层楼梯换层。
- 室外路线使用确认过的 1F 东南出口门，不再只导航到一号楼建筑中心。
- 出楼后通过百度地图 URI 继续步行或骑行导航。

## 当前限制

- 真正的连续精准室内定位必须接入 UWB、蓝牙信标或 Wi-Fi 指纹定位基础设施。
- 平面图房间坐标和东南出口门位置仍需用学校官方图纸和现场实测复核。
- iOS、Android 对指南针“绝对方向/相对方向”的支持不同，必要时需要点击“校准方向”。
- 百度地图接力依赖网络和手机已安装或可访问的百度地图服务。
- 当前临时 Cloudflare 链接会失效；长期二维码应使用 GitHub Pages 固定地址。
