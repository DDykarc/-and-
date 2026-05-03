const healthDb = require('../../../utils/healthDb')

Page({
  data: {
    type: '',
    typeName: '',
    unit: '',
    records: [],
    loading: true,
    settings: {}
  },

  onLoad(options) {
    const type = options.type
    const typeMap = {
      blood_sugar: { name: '血糖', unit: 'mmol/L' },
      uric_acid: { name: '尿酸', unit: 'μmol/L' },
      weight: { name: '体重', unit: 'kg' }
    }
    const info = typeMap[type] || { name: '', unit: '' }
    const settings = healthDb.getSettings()
    this.setData({ type, typeName: info.name, unit: info.unit, settings })
    wx.setNavigationBarTitle({ title: info.name + '记录' })
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const { type, settings } = this.data
    this.setData({ loading: true })
    healthDb.getRecords(type).then(records => {
      // 按时间倒序
      records.sort((a, b) => b.recordTime - a.recordTime)

      // 为每个记录计算状态和格式化时间
      const enrichedRecords = records.map(r => {
        // 计算状态
        let status = 'unknown'
        if (type === 'blood_sugar') {
          status = healthDb.getStatus(type, r.value, { timing: r.timing })
        } else if (type === 'uric_acid') {
          status = healthDb.getStatus(type, r.value, { gender: settings.gender || 'male' })
        }

        // 格式化时间
        const d = new Date(r.recordTime)
        const month = d.getMonth() + 1
        const day = d.getDate()
        const hour = String(d.getHours()).padStart(2, '0')
        const minute = String(d.getMinutes()).padStart(2, '0')
        const timeStr = month + '/' + day + ' ' + hour + ':' + minute

        return {
          ...r,
          status,
          timeStr
        }
      })

      this.setData({ records: enrichedRecords, loading: false })
    })
  },

  onTapRecord(e) {
    const id = e.currentTarget.dataset.id
    wx.navigateTo({
      url: `/pages/health/record/record?type=${this.data.type}&id=${id}`
    })
  },

  onDelete(e) {
    const id = e.currentTarget.dataset.id
    wx.showModal({
      title: '确认删除',
      content: '删除后不可恢复，是否继续？',
      success: (res) => {
        if (res.confirm) {
          healthDb.deleteRecord(id).then(() => {
            wx.showToast({ title: '已删除', icon: 'success' })
            this.loadData()
          })
        }
      }
    })
  }
})
