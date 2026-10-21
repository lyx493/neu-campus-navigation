# 室内定位接口接入建议

网页已实现统一入口，不需要修改 `app.js` 即可注入位置。

## JavaScript API

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

字段：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| `floor` | 是 | `1` 或 `2` |
| `x` | 是 | 楼层图从左到右的百分比，`0-100` |
| `y` | 是 | 楼层图从上到下的百分比，`0-100` |
| `accuracy` | 否 | 定位精度，单位米 |
| `source` | 否 | `uwb` / `ble` / `wifi` / `external` |
| `roomCode` | 否 | 教室编号，例如 `A105` |

成功返回：

```js
{ ok: true, floor: 2, x: 76, y: 86.8, accuracy: 0.8, source: 'uwb' }
```

## WebSocket

```js
window.CampusIndoorPositioning.connect('wss://example.com/indoor-position');
```

服务端每次发送一条 JSON：

```json
{"floor":1,"x":90,"y":88,"accuracy":1.1,"source":"ble","roomCode":"A105"}
```

室外消息：

```json
{"outdoor":true}
```

断开：

```js
window.CampusIndoorPositioning.disconnect();
```

## 浏览器事件

```js
window.dispatchEvent(new CustomEvent('campus-indoor-position', {
  detail: { floor: 1, x: 90, y: 88, source: 'uwb', accuracy: 1.0 }
}));
```

## 调试接口

```js
window.CampusIndoorPositioning.getState()
window.CampusIndoorPositioning.getNavigationState()
```

## 接入验收

1. 外部坐标和平面图“我”点误差小于现场要求。
2. 楼层更新后，平面图自动切换正确楼层。
3. 导航阶段随位置跨楼层更新，不出现反向跳转。
4. 外部定位断开后保留最后位置，并在诊断面板显示更新时间。
5. 人工校准可以随时接管，并且来源标签变为“人工校准”。
