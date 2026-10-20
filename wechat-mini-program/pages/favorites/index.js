const app = getApp()
const { campus, locations } = require('../../data/campus')
const nav = require('../../utils/navigation')

Page({
  data: { favorites: [], recent: [], currentLocation: null },
  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 2 })
    this.refresh()
    wx.getLocation({
      type: 'gcj02', isHighAccuracy: true,
      success: res => {
        this.setData({ currentLocation: res })
        this.refresh(res)
      }
    })
  },
  refresh(current) {
    const origin = current || this.data.currentLocation || campus.center
    const decorate = item => Object.assign({}, item, { distanceText: nav.formatDistance(nav.distanceBetween(origin, item)) })
    const favorites = app.globalData.favoriteIds.map(id => locations.find(item => item.id === id)).filter(Boolean).map(decorate)
    const recent = app.globalData.recentIds.map(id => locations.find(item => item.id === id)).filter(Boolean).slice(0, 4).map(decorate)
    this.setData({ favorites, recent })
  },
  openDetail(e) {
    app.addRecent(e.currentTarget.dataset.id)
    wx.navigateTo({ url: `/pages/detail/index?id=${e.currentTarget.dataset.id}` })
  },
  startRoute(e) {
    const location = locations.find(item => item.id === e.currentTarget.dataset.id)
    if (!location) return
    app.globalData.routeTarget = location
    wx.switchTab({ url: '/pages/route/index' })
  },
  goHome() { wx.switchTab({ url: '/pages/home/index' }) }
})