const app = getApp()
const { campus, locations } = require('../../data/campus')

Page({
  data: { campus, user: app.globalData.user, favoriteCount: 0, routeCount: 0, visitedCount: 0, recent: [] },
  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 3 })
    const recent = app.globalData.recentIds.map(id => locations.find(item => item.id === id)).filter(Boolean).slice(0, 3)
    this.setData({
      favoriteCount: app.globalData.favoriteIds.length,
      routeCount: app.globalData.routeCount,
      visitedCount: app.globalData.visitedIds.length,
      recent
    })
  },
  openFavorites() { wx.switchTab({ url: '/pages/favorites/index' }) },
  openCampus() { wx.openLocation({ latitude: campus.center.latitude, longitude: campus.center.longitude, scale: 16, name: campus.name, address: campus.address }) },
  showTip(e) { wx.showToast({ title: e.currentTarget.dataset.text, icon: 'none' }) },
  showAbout() { wx.showModal({ title: '东大浑南校园导航', content: '实时定位与校园步道导航原型。地图坐标为 GCJ-02，校园路网来自 OpenStreetMap。', showCancel: false, confirmText: '知道了' }) }
})