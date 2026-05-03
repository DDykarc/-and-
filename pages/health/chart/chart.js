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
    settings: {},
    tooltipShow: false,
    tooltipX: 0,
    tooltipY: 0,
    tooltipText: ''
  },

  // 交互状态
  _canvas: null,
  _ctx: null,
  _width: 0,
  _height: 0,
  _dpr: 1,
  _padding: { top: 40, right: 30, bottom: 60, left: 60 },
  _offsetX: 0,
  _scale: 1,
  _isDragging: false,
  _lastX: 0,
  _lastY: 0,
  _pinchStartDist: 0,
  _pinchCenterX: 0,
  _pinchCenterY: 0,
  _touchStartTime: 0,
  _touchStartX: 0,
  _touchStartY: 0,

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

  onReady() {
    this.initCanvas()
  },

  onShow() {
    this.loadData()
  },

  initCanvas() {
    const query = wx.createSelectorQuery()
    query.select('#trendChart')
      .fields({ node: true, size: true })
      .exec((res) => {
        if (!res[0]) return
        const canvas = res[0].node
        const ctx = canvas.getContext('2d')
        const dpr = wx.getWindowInfo().pixelRatio
        canvas.width = res[0].width * dpr
        canvas.height = res[0].height * dpr
        ctx.scale(dpr, dpr)
        this._canvas = canvas
        this._ctx = ctx
        this._width = res[0].width
        this._height = res[0].height
        this._dpr = dpr
        this.drawChart()
      })
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
      this.resetView()
      this.drawChart()
    })
  },

  resetView() {
    this._offsetX = 0
    this._scale = 1
  },

  drawChart() {
    const { records, type, settings } = this.data
    if (records.length < 2) return
    if (!this._ctx) return

    const ctx = this._ctx
    const width = this._width
    const height = this._height
    const padding = this._padding
    const chartW = width - padding.left - padding.right
    const chartH = height - padding.top - padding.bottom

    // 计算Y轴范围
    const values = records.map(r => r.value)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range = maxVal - minVal
    let yPadding = range * 0.2
    if (yPadding < 1) yPadding = 1
    let yMin = minVal - yPadding
    let yMax = maxVal + yPadding

    if (yMax - yMin < 2) {
      const center = (minVal + maxVal) / 2
      yMin = center - 1
      yMax = center + 1
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
    ctx.font = '12px sans-serif'
    ctx.textAlign = 'right'
    for (let i = 0; i <= 5; i++) {
      const y = padding.top + chartH * (1 - i / 5)
      const val = yMin + (yMax - yMin) * (i / 5)
      ctx.fillText(val.toFixed(1), padding.left - 10, y + 4)
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
    const itemWidth = chartW / (records.length - 1) * this._scale
    const startIdx = Math.max(0, Math.floor(-this._offsetX / itemWidth))
    const endIdx = Math.min(records.length - 1, Math.ceil((-this._offsetX + chartW) / itemWidth))
    for (let i = startIdx; i <= endIdx; i += step) {
      const x = padding.left + (i * itemWidth) + this._offsetX
      const date = new Date(records[i].recordTime)
      const label = (date.getMonth() + 1) + '/' + date.getDate()
      ctx.fillText(label, x, height - padding.bottom + 20)
    }

    // 折线
    ctx.strokeStyle = '#00C853'
    ctx.lineWidth = 2
    ctx.lineJoin = 'round'
    ctx.beginPath()
    records.forEach((r, i) => {
      const x = padding.left + (i * itemWidth) + this._offsetX
      const y = padding.top + chartH * (1 - (r.value - yMin) / (yMax - yMin))
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    })
    ctx.stroke()

    // 数据点
    records.forEach((r, i) => {
      const x = padding.left + (i * itemWidth) + this._offsetX
      const y = padding.top + chartH * (1 - (r.value - yMin) / (yMax - yMin))
      let color = '#00C853'
      const status = this.getRecordStatus(r, type, settings)
      if (status === 'high') color = '#F44336'
      else if (status === 'low') color = '#FF9800'
      ctx.fillStyle = color
      ctx.beginPath()
      ctx.arc(x, y, 4, 0, Math.PI * 2)
      ctx.fill()
      ctx.fillStyle = '#fff'
      ctx.beginPath()
      ctx.arc(x, y, 2, 0, Math.PI * 2)
      ctx.fill()
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
  },

  // 触摸事件处理
  onTouchStart(e) {
    const touches = e.touches
    this._touchStartTime = Date.now()
    this._touchStartX = touches[0].x
    this._touchStartY = touches[0].y

    if (touches.length === 1) {
      this._isDragging = false
      this._lastX = touches[0].x
    } else if (touches.length === 2) {
      const dx = touches[0].x - touches[1].x
      const dy = touches[0].y - touches[1].y
      this._pinchStartDist = Math.sqrt(dx * dx + dy * dy)
      this._pinchCenterX = (touches[0].x + touches[1].x) / 2
      this._pinchCenterY = (touches[0].y + touches[1].y) / 2
    }
  },

  onTouchMove(e) {
    const touches = e.touches

    if (touches.length === 1 && !this._isDragging) {
      const dx = touches[0].x - this._touchStartX
      const dy = touches[0].y - this._touchStartY
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        this._isDragging = true
      }
    }

    if (touches.length === 1 && this._isDragging) {
      const dx = touches[0].x - this._lastX
      this._offsetX += dx
      this._lastX = touches[0].x
      this.drawChart()
    } else if (touches.length === 2) {
      const dx = touches[0].x - touches[1].x
      const dy = touches[0].y - touches[1].y
      const dist = Math.sqrt(dx * dx + dy * dy)
      const scaleChange = dist / this._pinchStartDist
      this._scale *= scaleChange
      this._pinchStartDist = dist
      this.drawChart()
    }
  },

  onTouchEnd(e) {
    const endTime = Date.now()
    const duration = endTime - this._touchStartTime
    const moveX = Math.abs(e.changedTouches[0].x - this._touchStartX)
    const moveY = Math.abs(e.changedTouches[0].y - this._touchStartY)

    // 判断为点击（时间短、移动距离小）
    if (duration < 300 && moveX < 10 && moveY < 10 && !this._isDragging) {
      this.handleTap(e.changedTouches[0].x, e.changedTouches[0].y)
    }

    this._isDragging = false
  },

  handleTap(x, y) {
    const { records } = this.data
    if (records.length < 2) return

    const padding = this._padding
    const chartW = this._width - padding.left - padding.right
    const chartH = this._height - padding.top - padding.bottom
    const values = records.map(r => r.value)
    const minVal = Math.min(...values)
    const maxVal = Math.max(...values)
    const range = maxVal - minVal
    let yPadding = range * 0.2
    if (yPadding < 1) yPadding = 1
    let yMin = minVal - yPadding
    let yMax = maxVal + yPadding
    if (yMax - yMin < 2) {
      const center = (minVal + maxVal) / 2
      yMin = center - 1
      yMax = center + 1
    }

    const itemWidth = chartW / (records.length - 1) * this._scale
    let closest = null
    let closestDist = 20

    for (let i = 0; i < records.length; i++) {
      const px = padding.left + (i * itemWidth) + this._offsetX
      const py = padding.top + chartH * (1 - (records[i].value - yMin) / (yMax - yMin))
      const dist = Math.sqrt(Math.pow(x - px, 2) + Math.pow(y - py, 2))
      if (dist < closestDist) {
        closestDist = dist
        closest = { idx: i, x: px, y: py }
      }
    }

    if (closest) {
      const record = records[closest.idx]
      const date = new Date(record.recordTime)
      const dateStr = (date.getMonth() + 1) + '/' + date.getDate()
      const text = dateStr + '\n数值: ' + record.value
      this.setData({
        tooltipShow: true,
        tooltipX: closest.x,
        tooltipY: closest.y - 30,
        tooltipText: text
      })
      // 3秒后隐藏
      if (this._tooltipTimer) clearTimeout(this._tooltipTimer)
      this._tooltipTimer = setTimeout(() => {
        this.setData({ tooltipShow: false })
      }, 3000)
    } else {
      this.setData({ tooltipShow: false })
    }
  }
})
