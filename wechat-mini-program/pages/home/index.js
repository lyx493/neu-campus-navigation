const app = getApp()
const { campus, categories, locations, searchLocations } = require('../../data/campus')
const nav = require('../../utils/navigation')

const MARKER_ICONS = {
  study: '/assets/pins/study.png',
  food: '/assets/pins/food.png',
  life: '/assets/pins/life.png',
  sports: '/assets/pins/sports.png',
  service: '/assets/pins/service.png'
}

Page({
  data: {
    campus,
    categories,
    currentCategory: 'all',
    keyword: '',
    mapCenter: campus.center,
    mapScale: 17,
    markers: [],
    currentLocation: null,
    locationStatus: '正在获取实时位置',
    locationReady: false,
    permissionDenied: false,
    outsideCampus: false,
    campusDistanceText: '',
    selectedLocation: null,
    nearby: [],
    showSearch: false,
    searchResults: [],
    mapLoading: true
  },

  onLoad() {
    this.setData({ searchResults: locations.slice(0, 6) })
    this.refreshNearby()
    this.refreshMarkers()
    this.locateUser(true)
  },

  onReady() {
    this.mapCtx = wx.createMapContext('homeMap', this)
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 0 })
    const selected = this.data.selectedLocation
    if (selected) {
      this.setData({ selectedLocation: Object.assign({}, selected, { isFavorite: app.isFavorite(selected.id) }) })
    }
  },

  locateUser(centerOnMe) {
    this.setData({ locationStatus: '正在获取实时位置', mapLoading: true })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: res => {
        const current = {
          latitude: res.latitude,
          longitude: res.longitude,
          accuracy: res.accuracy || 0,
          speed: res.speed || 0
        }
        app.globalData.currentLocation = current
        const campusDistance = nav.distanceBetween(current, campus.center)
        const outsideCampus = campusDistance > 5000
        const shouldCenterOnMe = centerOnMe && !outsideCampus
        this.setData({
          currentLocation: current,
          mapCenter: shouldCenterOnMe ? { latitude: current.latitude, longitude: current.longitude } : campus.center,
          mapScale: shouldCenterOnMe ? 18 : campus.scale,
          locationStatus: outsideCampus ? '当前不在校园范围内' : '实时定位已开启',
          locationReady: true,
          permissionDenied: false,
          outsideCampus,
          campusDistanceText: nav.formatDistance(campusDistance),
          mapLoading: false
        })
        this.refreshNearby()
        this.refreshMarkers(this.data.selectedLocation && this.data.selectedLocation.id)
      },
      fail: () => {
        this.setData({
          mapCenter: campus.center,
          mapScale: campus.scale,
          locationStatus: '定位未开启，当前显示校园地图',
          locationReady: false,
          permissionDenied: true,
          mapLoading: false
        })
        this.refreshNearby()
      }
    })
  },

  refreshNearby() {
    const current = this.data.currentLocation || campus.center
    const nearby = locations
      .map(item => Object.assign({}, item, {
        distance: nav.distanceBetween(current, item),
        distanceText: nav.formatDistance(nav.distanceBetween(current, item))
      }))
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 4)
    this.setData({ nearby })
  },

  refreshMarkers(selectedId) {
    const filtered = this.getFilteredLocations()
    const markers = filtered.map((item, index) => ({
      id: index + 1,
      locationId: item.id,
      latitude: item.latitude,
      longitude: item.longitude,
      iconPath: item.id === selectedId ? '/assets/pins/selected.png' : MARKER_ICONS[item.category],
      width: item.id === selectedId ? 38 : 30,
      height: item.id === selectedId ? 48 : 38,
      anchor: { x: 0.5, y: 1 },
      zIndex: item.id === selectedId ? 10 : 1,
      callout: {
        content: item.shortName,
        color: '#16243a',
        fontSize: 12,
        borderRadius: 8,
        padding: 7,
        bgColor: '#ffffff',
        display: 'BYCLICK'
      }
    }))
    this.setData({ markers })
  },

  getFilteredLocations() {
    return searchLocations(this.data.keyword, this.data.currentCategory)
  },

  onCategoryTap(e) {
    const categoryId = e.currentTarget.dataset.id
    const selected = this.data.selectedLocation
    const nextSelected = selected && categoryId !== 'all' && selected.category !== categoryId ? null : selected
    this.setData({
      currentCategory: categoryId,
      selectedLocation: nextSelected,
      keyword: ''
    }, () => this.refreshMarkers(nextSelected && nextSelected.id))
  },

  onMarkerTap(e) {
    const markerId = Number(e.detail.markerId)
    const marker = this.data.markers.find(item => item.id === markerId)
    if (!marker) return
    const location = locations.find(item => item.id === marker.locationId)
    if (location) this.selectLocation(location, true)
  },

  onNearbyTap(e) {
    const id = e.currentTarget.dataset.id
    const location = locations.find(item => item.id === id)
    if (location) this.selectLocation(location, true)
  },

  selectLocation(location, moveMap) {
    const current = this.data.currentLocation || campus.center
    const distance = nav.distanceBetween(current, location)
    const selectedLocation = Object.assign({}, location, {
      distanceText: nav.formatDistance(distance),
      isFavorite: app.isFavorite(location.id)
    })
    this.setData({
      selectedLocation,
      mapCenter: moveMap ? { latitude: location.latitude, longitude: location.longitude } : this.data.mapCenter,
      mapScale: moveMap ? 18 : this.data.mapScale
    }, () => this.refreshMarkers(location.id))
  },

  clearSelectedLocation() {
    this.setData({ selectedLocation: null }, () => this.refreshMarkers())
  },

  locateMe() {
    this.locateUser(true)
    if (this.mapCtx) {
      this.mapCtx.moveToLocation({
        latitude: this.data.currentLocation ? this.data.currentLocation.latitude : campus.center.latitude,
        longitude: this.data.currentLocation ? this.data.currentLocation.longitude : campus.center.longitude
      })
    }
  },

  handlePermissionHelp() {
    wx.showModal({
      title: '需要位置权限',
      content: '请在设置中允许小程序使用位置信息，才能实时显示位置并开始导航。',
      confirmText: '去设置',
      success: res => {
        if (res.confirm) wx.openSetting()
      }
    })
  },

  openSearch() {
    this.setData({ showSearch: true, searchResults: this.getFilteredLocations() })
  },

  closeSearch() {
    this.setData({ showSearch: false, keyword: '' }, () => this.refreshMarkers(this.data.selectedLocation && this.data.selectedLocation.id))
  },

  onSearchInput(e) {
    const keyword = e.detail.value
    this.setData({
      keyword,
      searchResults: searchLocations(keyword, this.data.currentCategory)
    }, () => this.refreshMarkers(this.data.selectedLocation && this.data.selectedLocation.id))
  },

  onSearchResultTap(e) {
    const id = e.currentTarget.dataset.id
    const location = locations.find(item => item.id === id)
    if (!location) return
    this.setData({ showSearch: false, keyword: location.shortName }, () => {
      this.selectLocation(location, true)
    })
  },

  openDetail() {
    const selected = this.data.selectedLocation
    if (!selected) return
    app.addRecent(selected.id)
    wx.navigateTo({ url: `/pages/detail/index?id=${selected.id}` })
  },

  startRoute() {
    const selected = this.data.selectedLocation
    if (!selected) return
    app.addRecent(selected.id)
    app.globalData.routeTarget = selected
    wx.switchTab({ url: '/pages/route/index' })
  },

  openCampusInfo() {
    wx.showModal({
      title: campus.name,
      content: `${campus.address}\n校园地图使用真实经纬度定位，步行路线基于校园道路数据。`,
      showCancel: false,
      confirmText: '知道了'
    })
  },

  toggleMapLayer() {
    wx.showToast({ title: '当前为校园标准地图', icon: 'none' })
  },

  noop() {},

  onShareAppMessage() {
    return {
      title: '东北大学浑南校区校园导航',
      path: '/pages/home/index'
    }
  }
})