const app = getApp()
const { campus, getLocation } = require('../../data/campus')
const nav = require('../../utils/navigation')

Page({
  data: { campus, location: null, marker: [], currentLocation: null, distanceText: '', isFavorite: false, mapCenter: campus.center },
  onLoad(options) {
    const location = getLocation(options.id)
    if (!location) {
      wx.showToast({ title: '地点不存在', icon: 'none' })
      setTimeout(() => wx.navigateBack(), 500)
      return
    }
    this.rawLocation = location
    app.addRecent(location.id)
    this.setData({
      location,
      isFavorite: app.isFavorite(location.id),
      mapCenter: { latitude: location.latitude, longitude: location.longitude },
      marker: [{ id: 1, latitude: location.latitude, longitude: location.longitude, iconPath: '/assets/pins/selected.png', width: 42, height: 53, anchor: { x: .5, y: 1 }, callout: { content: location.shortName, color: '#14233a', fontSize: 12, borderRadius: 8, padding: 8, bgColor: '#ffffff', display: 'ALWAYS' } }]
    })
    wx.getLocation({ type: 'gcj02', isHighAccuracy: true, success: res => {
      const current = { latitude: res.latitude, longitude: res.longitude }
      this.setData({ currentLocation: current, distanceText: nav.formatDistance(nav.distanceBetween(current, location)) })
    } })
  },
  goBack() { wx.navigateBack({ fail: () => wx.switchTab({ url: '/pages/home/index' }) }) },
  toggleFavorite() {
    const isFavorite = app.toggleFavorite(this.data.location.id)
    this.setData({ isFavorite })
    wx.showToast({ title: isFavorite ? '已收藏' : '已取消收藏', icon: 'none' })
  },
  startRoute() {
    app.globalData.routeTarget = this.rawLocation
    wx.switchTab({ url: '/pages/route/index' })
  },
  openSystemNavigation() {
    const location = this.data.location
    wx.openLocation({ latitude: location.latitude, longitude: location.longitude, scale: 18, name: location.name, address: campus.address })
  }
})