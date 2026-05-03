const healthDb = require('../../../utils/healthDb')

Page({
  data: {
    type: '',
    typeName: '',
    unit: '',
    period: 'all',
    periods: [
      { key: 'all', label: '全部' },
      { key: '7', label: '7天' },
      { key: '30', label: '30天' }
    ],
    records: [],
    stats: { max: 0, min: 0, avg: 0 },
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
    wx.setNavigationBarTitle({ title: info.name + '趋势' })
  },

  onShow() {
    this.loadData()
  },

  onSelectPeriod(e) {
    const period = e.currentTarget.dataset.key
    this.setData({ period }, () => this.loadData())
  },

  loadData() {
    const { type, period } = this.data
    const days = period === 'all' ? null : parseInt(period)
    this.setData({ loading: true })

    healthDb.getRecords(type, days).then(records => {
      const sorted = records.sort((a, b) => a.recordTime - b.recordTime)
      const stats = healthDb.calcStats(sorted)
      this.setData({ records: sorted, stats, loading: false })
      this.drawChart()
    })
  },

  drawChart() {
    const { records, type, settings } = this.data
    if (records.length < 2) return

    const ctx = wx.createCanvasContext('trendChart')
    const query = wx.createSelectorQuery()
    query.select('#chart-container').boundingClientRect()
    query.exec(res => {
      if (!res[0]) return
      const width = res[0].width
      const height = 400
      const padding = { top: 40, right: 30, bottom: 60, left: 60 }
      const chartW = width - padding.left - padding.right
      const chartH = height - padding.top - padding.bottom

      // 计算Y轴范围
      const values = records.map(r => r.value)
      const minVal = Math.min(...values)
      const maxVal = Math.max(...values)
      const range = maxVal - minVal
      let yPadding = range * 0.2
      if (yPadding < 1) yPadding = 1
      let yMin = Math.floor(minVal - yPadding)
      let yMax = Math.ceil(maxVal + yPadding)

      if (yMax - yMin < 2) {
        const center = (minVal + maxVal) / 2
        yMin = Math.floor(center - 1)
        yMax = Math.ceil(center + 1)
      }

      const refRange = this.getRefRange(type, records, settings)

      // 清空
      ctx.clearRect(0, 0, width, height)

      // 坐标轴
      ctx.strokeStyle = '#E0E0E0'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(padding.left, padding.top)
      ctx.lineTo(padding.left, height - padding.bottom)
      ctx.lineTo(width - padding.right, height - padding.bottom)
      ctx.stroke()

      // 参考线
      if (refRange) {
        ctx.strokeStyle = '#00C853'
        ctx.setLineDash([5, 5])
        ctx.lineWidth = 2
        ;[refRange.min, refRange.max].forEach(refVal => {
          if (refVal >= yMin && refVal <= yMax) {
            const y = padding.top + chartH * (1 - (refVal - yMin) / (yMax - yMin))
            ctx.beginPath()
            ctx.moveTo(padding.left, y)
            ctx.lineTo(width - padding.right, y)
            ctx.stroke()
          }
        })
        ctx.setLineDash([])
      }

      // Y轴
      ctx.fillStyle = '#999'
      ctx.font = '22rpx sans-serif'
      ctx.textAlign = 'right'
      for (let i = 0; i <= 5; i++) {
        const y = padding.top + chartH * (1 - i / 5)
        const val = yMin + (yMax - yMin) * (i / 5)
        ctx.fillText(val.toFixed(1), padding.left - 10, y + 6)
        if (i > 0) {
          ctx.strokeStyle = '#F0F0F0'
          ctx.beginPath()
          ctx.moveTo(padding.left, y)
          ctx.lineTo(width - padding.right, y)
          ctx.stroke()
        }
      }

      // X轴标签
      ctx.fillStyle = '#999'
      ctx.textAlign = 'center'
      const step = Math.max(1, Math.floor(records.length / 5))
      for (let i = 0; i < records.length; i += step) {
        const x = padding.left + (chartW / (records.length - 1)) * i
        const date = new Date(records[i].recordTime)
        const label = (date.getMonth() + 1) + '/' + date.getDate()
        ctx.fillText(label, x, height - padding.bottom + 30)
      }

      // 折线
      ctx.strokeStyle = '#00C853'
      ctx.lineWidth = 3
      ctx.lineJoin = 'round'
      ctx.beginPath()
      records.forEach((r, i) => {
        const x = padding.left + (chartW / (records.length - 1)) * i
        const y = padding.top + chartH * (1 - (r.value - yMin) / (yMax - yMin))
        if (i === 0) ctx.moveTo(x, y)
        else ctx.lineTo(x, y)
      })
      ctx.stroke()

      // 数据点
      records.forEach((r, i) => {
        const x = padding.left + (chartW / (records.length - 1)) * i
        const y = padding.top + chartH * (1 - (r.value - yMin) / (yMax - yMin))
        let color = '#00C853'
        const status = this.getRecordStatus(r, type, settings)
        if (status === 'high') color = '#F44336'
        else if (status === 'low') color = '#FF9800'
        ctx.fillStyle = color
        ctx.beginPath()
        ctx.arc(x, y, 6, 0, Math.PI * 2)
        ctx.fill()
        ctx.fillStyle = '#fff'
        ctx.beginPath()
        ctx.arc(x, y, 3, 0, Math.PI * 2)
        ctx.fill()
      })

      ctx.draw()
    })
  },

  getRefRange(type, records, settings) {
    if (type === 'blood_sugar') {
      const timing = records[0]?.timing || '空腹'
      return healthDb.REF_RANGE.blood_sugar[timing]
    }
    if (type === 'uric_acid') {
      const gender = settings.gender || 'male'
      return healthDb.REF_RANGE.uric_acid[gender]
    }
    return null
  },

  getRecordStatus(record, type, settings) {
    if (type === 'blood_sugar') {
      return healthDb.getStatus(type, record.value, { timing: record.timing })
    }
    if (type === 'uric_acid') {
      return healthDb.getStatus(type, record.value, { gender: settings.gender })
    }
    return 'normal'
  }
})
