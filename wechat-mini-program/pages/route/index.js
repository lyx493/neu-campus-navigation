const app = getApp()
const { campus, locations, defaultDestinationId, getLocation } = require('../../data/campus')
const nav = require('../../utils/navigation')

Page({
  data: {
    campus,
    locations,
    destination: getLocation(defaultDestinationId),
    mode: 'walk',
    modeName: '步行',
    currentLocation: null,
    locationStatus: '正在获取实时位置',
    permissionDenied: false,
    route: null,
    routeSteps: [],
    polyline: [],
    markers: [],
    mapCenter: campus.center,
    mapScale: 17,
    isNavigating: false,
    instruction: {
      title: '正在规划路线',
      detail: '获取位置后自动生成校园路线',
      distanceText: '--',
      symbol: '↑'
    },
    showSteps: false,
    arrived: false
  },

  onLoad() {
    this.refreshMarkers()
  },

  onReady() {
    this.mapCtx = wx.createMapContext('routeMap', this)
  },

  onShow() {
    if (this.getTabBar && this.getTabBar()) this.getTabBar().setData({ selected: 1 })
    const target = app.globalData.routeTarget
    if (target) {
      app.globalData.routeTarget = null
      this.setData({
        destination: target,
        isNavigating: false,
        showSteps: false,
        arrived: false
      }, () => {
        this.refreshMarkers()
        this.getInitialLocation()
      })
      return
    }
    if (!this.data.route) this.getInitialLocation()
  },

  onHide() {
    if (this.data.isNavigating) this.stopNavigation(true)
  },

  onUnload() {
    if (this.data.isNavigating) this.stopNavigation(true)
  },

  getInitialLocation() {
    this.setData({ locationStatus: '正在获取实时位置' })
    wx.getLocation({
      type: 'gcj02',
      isHighAccuracy: true,
      highAccuracyExpireTime: 5000,
      success: res => {
        const current = this.toLocation(res)
        app.globalData.currentLocation = current
        this.setData({
          currentLocation: current,
          mapCenter: { latitude: current.latitude, longitude: current.longitude },
          locationStatus: '实时定位已开启',
          permissionDenied: false
        })
        this.recalculateRoute(current)
      },
      fail: () => {
        const fallback = Object.assign({}, campus.center, { accuracy: 0 })
        this.setData({
          currentLocation: fallback,
          mapCenter: campus.center,
          locationStatus: '定位未开启，当前为校园预览',
          permissionDenied: true
        })
        this.recalculateRoute(fallback)
      }
    })
  },

  toLocation(res) {
    return {
      latitude: res.latitude,
      longitude: res.longitude,
      accuracy: res.accuracy || 0,
      speed: res.speed || 0
    }
  },

  recalculateRoute(start, callback) {
    const origin = start || this.data.currentLocation || campus.center
    const destination = this.data.destination
    const route = nav.planCampusRoute(origin, destination, this.data.mode)
    if (!route) {
      wx.showToast({ title: '暂时无法规划路线', icon: 'none' })
      return
    }
    this._lastRouteStart = origin
    const instruction = nav.navigationInstruction(route, this._heading)
    this.setData({
      route,
      routeSteps: route.guidance.list,
      polyline: nav.routeToPolyline(route.points),
      instruction,
      mapCenter: this.data.isNavigating
        ? { latitude: origin.latitude, longitude: origin.longitude }
        : this.data.mapCenter
    }, () => {
      if (!this.data.isNavigating && this.mapCtx) this.includeRoutePoints(origin, destination)
      if (callback) callback()
    })
  },

  includeRoutePoints(start, destination) {
    if (!this.mapCtx) return
    this.mapCtx.includePoints({
      points: [
        { latitude: start.latitude, longitude: start.longitude },
        { latitude: destination.latitude, longitude: destination.longitude }
      ],
      padding: [180, 70, 390, 70]
    })
  },

  refreshMarkers() {
    const destination = this.data.destination
    if (!destination) return
    this.setData({
      markers: [{
        id: 1,
        latitude: destination.latitude,
        longitude: destination.longitude,
        iconPath: '/assets/pins/selected.png',
        width: 42,
        height: 53,
        anchor: { x: 0.5, y: 1 },
        zIndex: 10,
        callout: {
          content: destination.shortName || destination.name,
          color: '#14233a',
          fontSize: 12,
          borderRadius: 8,
          padding: 8,
          bgColor: '#ffffff',
          display: 'ALWAYS'
        }
      }]
    })
  },

  onDestinationChange(e) {
    const index = Number(e.detail.value)
    const destination = this.data.locations[index]
    if (!destination) return
    this.setData({ destination, arrived: false, showSteps: false }, () => {
      this.refreshMarkers()
      this.recalculateRoute()
    })
  },

  chooseDestinationOnMap() {
    wx.chooseLocation({
      latitude: campus.center.latitude,
      longitude: campus.center.longitude,
      success: res => {
        const destination = {
          id: 'map_point',
          name: res.name || '地图选点',
          shortName: res.name || '地图选点',
          subtitle: res.address || '地图选择的目的地',
          category: 'service',
          categoryName: '地图选点',
          emoji: '⌖',
          color: '#1e66e8',
          softColor: '#e9f0ff',
          latitude: res.latitude,
          longitude: res.longitude,
          open: '—',
          floor: res.address || '地图选点',
          tags: ['地图选点'],
          aliases: [],
          description: res.address || '',
          facilities: [],
          tips: ''
        }
        this.setData({ destination, arrived: false, showSteps: false }, () => {
          this.refreshMarkers()
          this.recalculateRoute()
        })
      }
    })
  },

  onModeChange(e) {
    const mode = e.currentTarget.dataset.mode
    if (mode === this.data.mode) return
    this.setData({ mode, modeName: mode === 'bike' ? '骑行' : '步行' }, () => {
      this.recalculateRoute()
    })
  },

  toggleSteps() {
    this.setData({ showSteps: !this.data.showSteps })
  },

  startNavigation() {
    if (this._startingNavigation) return
    this._startingNavigation = true
    this._arrived = false
    wx.startLocationUpdate({
      type: 'gcj02',
      success: () => {
        this._locationHandler = res => this.handleLocationChange(res)
        wx.onLocationChange(this._locationHandler)
        wx.setKeepScreenOn({ keepScreenOn: true })
        app.addRecent(this.data.destination.id)
        app.increaseRouteCount()
        this.setData({
          isNavigating: true,
          showSteps: false,
          arrived: false,
          mapScale: 18,
          locationStatus: '导航中 · 实时定位'
        })
        wx.getLocation({
          type: 'gcj02',
          isHighAccuracy: true,
          success: res => this.handleLocationChange(res)
        })
        wx.vibrateShort({ type: 'medium' })
      },
      fail: () => {
        this.handlePermissionHelp()
      },
      complete: () => {
        this._startingNavigation = false
      }
    })
  },

  handleLocationChange(res) {
    if (!this.data.isNavigating) return
    const current = this.toLocation(res)
    let heading = this._heading
    if (this._previousLocation) {
      const moved = nav.distanceBetween(this._previousLocation, current)
      if (moved > 1.8) heading = nav.bearingBetween(this._previousLocation, current)
    }
    this._previousLocation = current
    this._heading = heading
    app.globalData.currentLocation = current

    this.setData({
      currentLocation: current,
      mapCenter: { latitude: current.latitude, longitude: current.longitude }
    })

    const lastOrigin = this._lastRouteStart
    if (!lastOrigin || nav.distanceBetween(lastOrigin, current) > 4) {
      this.recalculateRoute(current, () => this.updateNavigationFeedback(heading))
      return
    }
    this.updateNavigationFeedback(heading)
  },

  updateNavigationFeedback(heading) {
    const route = this.data.route
    if (!route) return
    const instruction = nav.navigationInstruction(route, heading)
    this.setData({ instruction })
    if (instruction.title !== this._lastInstruction) {
      this._lastInstruction = instruction.title
    }

    if (route.distance < 16 && !this._arrived) {
      this._arrived = true
      app.markVisited(this.data.destination.id)
      wx.vibrateLong()
      this.setData({
        arrived: true,
        instruction: {
          title: '已到达目的地',
          detail: `${this.data.destination.shortName || this.data.destination.name}就在你附近`,
          distanceText: route.distanceText,
          symbol: '终'
        }
      })
      wx.showModal({
        title: '已到达目的地',
        content: `你已到达${this.data.destination.name}。`,
        confirmText: '完成',
        showCancel: false,
        success: () => this.stopNavigation()
      })
    }
  },

  stopNavigation(silent) {
    if (this._locationHandler) {
      wx.offLocationChange(this._locationHandler)
      this._locationHandler = null
    }
    wx.stopLocationUpdate()
    wx.setKeepScreenOn({ keepScreenOn: false })
    this._previousLocation = null
    this._heading = null
    this.setData({
      isNavigating: false,
      locationStatus: this.data.permissionDenied ? '定位未开启' : '实时定位已开启'
    })
    if (!silent) wx.showToast({ title: '已结束导航', icon: 'none' })
  },

  endNavigation() {
    if (this.data.arrived) {
      this.stopNavigation()
      return
    }
    wx.showModal({
      title: '结束导航？',
      content: '当前导航进度将停止。',
      confirmText: '结束',
      cancelText: '继续导航',
      success: res => {
        if (res.confirm) this.stopNavigation()
      }
    })
  },

  recenter() {
    if (this.mapCtx) {
      this.mapCtx.moveToLocation({
        latitude: this.data.currentLocation ? this.data.currentLocation.latitude : campus.center.latitude,
        longitude: this.data.currentLocation ? this.data.currentLocation.longitude : campus.center.longitude
      })
    }
  },

  openSystemNavigation() {
    const destination = this.data.destination
    if (!destination) return
    wx.openLocation({
      latitude: destination.latitude,
      longitude: destination.longitude,
      scale: 18,
      name: destination.name,
      address: destination.subtitle || campus.address
    })
  },

  handlePermissionHelp() {
    wx.showModal({
      title: '打开实时定位',
      content: '导航需要持续获取你的位置。请允许位置权限，并在系统设置中开启精确定位。',
      confirmText: '去设置',
      success: res => {
        if (res.confirm) wx.openSetting()
      }
    })
  },

  onShareAppMessage() {
    return {
      title: `东北大学浑南校区 · 导航到${this.data.destination.shortName}`,
      path: '/pages/route/index'
    }
  }
})