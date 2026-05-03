const healthDb = require('../../../utils/healthDb')

Page({
  data: {
    type: '',
    typeName: '',
    unit: '',
    records: [],
    loading: true
  },

  onLoad(options) {
    const type = options.type
    const typeMap = {
      blood_sugar: { name: '血糖', unit: 'mmol/L' },
      uric_acid: { name: '尿酸', unit: 'μmol/L' },
      weight: { name: '体重', unit: 'kg' }
    }
    const info = typeMap[type] || { name: '', unit: '' }
    this.setData({ type, typeName: info.name, unit: info.unit })
    wx.setNavigationBarTitle({ title: info.name + '记录' })
  },

  onShow() {
    this.loadData()
  },

  loadData() {
    const { type } = this.data
    this.setData({ loading: true })
    healthDb.getRecords(type).then(records => {
      // 按时间倒序
      records.sort((a, b) => b.recordTime - a.recordTime)
      this.setData({ records, loading: false })
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
