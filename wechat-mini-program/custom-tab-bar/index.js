Component({
  data: {
    selected: 0,
    list: [
      { pagePath: '/pages/home/index', text: '地图', icon: '⌖' },
      { pagePath: '/pages/route/index', text: '导航', icon: '➤' },
      { pagePath: '/pages/favorites/index', text: '收藏', icon: '♡' },
      { pagePath: '/pages/profile/index', text: '我的', icon: '◉' }
    ]
  },

  methods: {
    switchTab(e) {
      const index = Number(e.currentTarget.dataset.index)
      const item = this.data.list[index]
      if (!item || index === this.data.selected) return
      wx.switchTab({ url: item.pagePath })
    }
  }
})