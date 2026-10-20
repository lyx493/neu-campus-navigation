App({
  globalData: {
    favoriteIds: [],
    recentIds: ['library', 'canteen', 'building_1'],
    routeTarget: null,
    currentLocation: null,
    routeCount: 12,
    visitedIds: ['library', 'canteen'],
    user: {
      nickname: '林同学',
      college: '东北大学',
      grade: '浑南校区'
    }
  },

  onLaunch() {
    const favoriteIds = wx.getStorageSync('neu_favorite_ids')
    const recentIds = wx.getStorageSync('neu_recent_ids')
    const routeCount = wx.getStorageSync('neu_route_count')
    const visitedIds = wx.getStorageSync('neu_visited_ids')

    if (Array.isArray(favoriteIds)) this.globalData.favoriteIds = favoriteIds
    if (Array.isArray(recentIds) && recentIds.length) this.globalData.recentIds = recentIds
    if (typeof routeCount === 'number') this.globalData.routeCount = routeCount
    if (Array.isArray(visitedIds) && visitedIds.length) this.globalData.visitedIds = visitedIds
  },

  isFavorite(id) {
    return this.globalData.favoriteIds.indexOf(id) > -1
  },

  toggleFavorite(id) {
    const ids = this.globalData.favoriteIds.slice()
    const index = ids.indexOf(id)
    if (index > -1) ids.splice(index, 1)
    else ids.unshift(id)
    this.globalData.favoriteIds = ids
    wx.setStorageSync('neu_favorite_ids', ids)
    return index === -1
  },

  addRecent(id) {
    const ids = this.globalData.recentIds.filter(item => item !== id)
    ids.unshift(id)
    this.globalData.recentIds = ids.slice(0, 8)
    wx.setStorageSync('neu_recent_ids', this.globalData.recentIds)
  },

  markVisited(id) {
    const ids = this.globalData.visitedIds.slice()
    if (ids.indexOf(id) === -1) {
      ids.unshift(id)
      this.globalData.visitedIds = ids
      wx.setStorageSync('neu_visited_ids', ids)
    }
  },

  increaseRouteCount() {
    this.globalData.routeCount += 1
    wx.setStorageSync('neu_route_count', this.globalData.routeCount)
  }
})