const db = require('../../utils/db')

const CHART_COLORS = {
  green: '#2E7D32',
  orange: '#E65100',
  red: '#C62828',
  primary: '#00C853',
  grid: '#F0F0F0',
  axis: '#DDD',
  label: '#999',
  white: '#FFFFFF'
}

Page({
  data: {
    isAllMode: false,
    item: {},
    allItems: [],
    allTotal: '0',
    allHighest: '0',
    dataPoints: []
  },

  onLoad(options) {
    if (options.all === 'true') {
      this.pendingMode = 'all'
      this.loadAllMode()
    } else if (options.id) {
      this.pendingMode = 'single'
      this.loadSingleMode(options.id)
    } else {
      wx.showToast({ title: '参数错误', icon: 'none' })
      wx.navigateBack()
    }
  },

  onReady() {
    // 记录页面已就绪，数据加载完成后自动绘制
    this.pageReady = true
    this.tryDraw()
  },

  // 数据就绪 + 页面就绪 后绘制
  tryDraw() {
    if (!this.pageReady) return
    if (this.pendingMode === 'all' && this.data.allItems.length > 0) {
      this.drawAllChart()
    } else if (this.pendingMode === 'single' && this.data.item._id) {
      this.drawSingleChart()
    }
  },

  // ====== 全部物品模式（从云端加载） ======
  loadAllMode() {
    wx.setNavigationBarTitle({ title: '全部物品对比' })
    wx.showLoading({ title: '加载中...' })
    db.getAllItems().then(raw => {
      wx.hideLoading()
      if (raw.length === 0) {
        wx.showToast({ title: '还没有物品', icon: 'none' })
        wx.navigateBack()
        return
      }

      const processed = raw.map(item => this.calcItem(item))
        .sort((a, b) => parseFloat(b.dailyCost) - parseFloat(a.dailyCost))

      const total = processed.reduce((s, i) => s + parseFloat(i.dailyCost), 0).toFixed(1)
      const highest = processed.length > 0 ? processed[0].dailyCost : '0'

      this.setData({
        isAllMode: true,
        allItems: processed,
        allTotal: total,
        allHighest: highest
      })
      this.tryDraw()
    })
  },

  // ====== 单个物品模式（从云端加载） ======
  loadSingleMode(id) {
    wx.showLoading({ title: '加载中...' })
    db.getItem(id).then(raw => {
      wx.hideLoading()
      if (!raw) {
        wx.showToast({ title: '物品不存在', icon: 'none' })
        wx.navigateBack()
        return
      }

      const item = this.calcItem(raw)
      const points = this.generateDataPoints(item.price, item.daysUsed)
      this.setData({ item, dataPoints: points })
      this.tryDraw()
    })
  },

  calcItem(item) {
    const now = Date.now()
    const buyDate = new Date(item.buyDate)
    const diff = now - buyDate.getTime()
    const daysUsed = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
    const dailyCost = (item.price / daysUsed).toFixed(1)

    let costLevel = 'cost-green'
    if (daysUsed <= 30 && dailyCost >= 10) costLevel = 'cost-red'
    else if (dailyCost >= 5) costLevel = 'cost-orange'

    return { ...item, daysUsed, dailyCost, costLevel }
  },

  generateDataPoints(price, totalDays) {
    const samples = [1, 7, 30, 90]
    for (let d = 180; d < totalDays; d += 90) samples.push(d)
    if (samples[samples.length - 1] < totalDays) samples.push(totalDays)

    return samples.map(d => {
      const cost = (price / d).toFixed(1)
      const saved = (price - cost * d).toFixed(1)
      return {
        label: d >= 365 ? `${(d / 365).toFixed(1)}年` : `${d}天`,
        cost, saved, days: d
      }
    })
  },

  // ====== Canvas 通用初始化 ======
  initCanvas(callback, retry = true) {
    wx.createSelectorQuery()
      .select('#costChart')
      .fields({ node: true, size: true })
      .exec(res => {
        if (res?.[0]?.node) {
          const canvas = res[0].node
          const ctx = canvas.getContext('2d')
          const dpr = wx.getSystemInfoSync().pixelRatio
          canvas.width = res[0].width * dpr
          canvas.height = res[0].height * dpr
          ctx.scale(dpr, dpr)
          callback(ctx, res[0].width, res[0].height)
        } else if (retry) {
          setTimeout(() => this.initCanvas(callback, false), 300)
        }
      })
  },

  drawAllChart() {
    this.initCanvas((ctx, w, h) => this.renderAllChart(ctx, w, h))
  },

  renderAllChart(ctx, width, height) {
    const { allItems } = this.data
    const margin = { top: 20, right: 20, bottom: 30, left: 110 }
    const chartW = width - margin.left - margin.right
    const chartH = height - margin.top - margin.bottom
    ctx.clearRect(0, 0, width, height)

    const maxVal = Math.max(...allItems.map(i => parseFloat(i.dailyCost)), 0.1)
    const yMax = Math.ceil(maxVal / 5) * 5 || 5
    const barH = Math.min(36, (chartH - (allItems.length - 1) * 8) / allItems.length)
    const gap = barH + 8

    const yTicks = []
    for (let y = 0; y <= yMax; y += Math.ceil(yMax / 4)) yTicks.push(y)
    if (yTicks[yTicks.length - 1] < yMax) yTicks.push(yMax)

    ctx.strokeStyle = CHART_COLORS.grid
    ctx.lineWidth = 1
    yTicks.forEach(y => {
      const py = margin.top + chartH - (y / yMax) * chartH
      ctx.beginPath()
      ctx.moveTo(margin.left, py)
      ctx.lineTo(width - margin.right, py)
      ctx.stroke()
    })

    allItems.forEach((item, i) => {
      const y = margin.top + i * gap
      const barW = (parseFloat(item.dailyCost) / yMax) * chartW

      ctx.fillStyle = CHART_COLORS.label
      ctx.font = '12px sans-serif'
      ctx.textAlign = 'right'
      ctx.textBaseline = 'middle'
      ctx.fillText(item.name, margin.left - 8, y + barH / 2)

      const color = item.costLevel === 'cost-red' ? CHART_COLORS.red
        : item.costLevel === 'cost-orange' ? CHART_COLORS.orange
        : CHART_COLORS.green
      const grad = ctx.createLinearGradient(margin.left, 0, margin.left + barW, 0)
      grad.addColorStop(0, color)
      grad.addColorStop(1, color + '88')
      ctx.fillStyle = grad

      const rx = 4
      const bw = Math.max(barW, 4)
      ctx.beginPath()
      ctx.moveTo(margin.left + rx, y)
      ctx.lineTo(margin.left + bw, y)
      ctx.lineTo(margin.left + bw, y + barH)
      ctx.lineTo(margin.left + rx, y + barH)
      ctx.quadraticCurveTo(margin.left, y + barH, margin.left, y + barH - rx)
      ctx.lineTo(margin.left, y + rx)
      ctx.quadraticCurveTo(margin.left, y, margin.left + rx, y)
      ctx.fill()

      ctx.fillStyle = color
      ctx.font = 'bold 12px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'middle'
      ctx.fillText(`¥${item.dailyCost}/天  (${item.daysUsed}天)`, margin.left + bw + 8, y + barH / 2)
    })
  },

  drawSingleChart() {
    this.initCanvas((ctx, w, h) => this.renderSingleChart(ctx, w, h))
  },

  renderSingleChart(ctx, width, height) {
    const { item } = this.data
    const price = item.price
    const totalDays = item.daysUsed
    const margin = { top: 30, right: 30, bottom: 50, left: 70 }
    const chartW = width - margin.left - margin.right
    const chartH = height - margin.top - margin.bottom
    ctx.clearRect(0, 0, width, height)

    const xTicks = this.calcXTicks(totalDays)
    const yMax = Math.ceil(price / 10) * 10 || 10
    const yTicks = []
    for (let y = 0; y <= yMax; y += Math.max(1, Math.ceil(yMax / 4 / 10) * 10)) yTicks.push(y)
    if (yTicks[yTicks.length - 1] < yMax) yTicks.push(yMax)

    const xPos = d => margin.left + (d / totalDays) * chartW
    const yPos = c => margin.top + chartH - (c / yMax) * chartH

    ctx.strokeStyle = CHART_COLORS.grid
    ctx.lineWidth = 1
    yTicks.forEach(y => { const py = yPos(y); ctx.beginPath(); ctx.moveTo(margin.left, py); ctx.lineTo(width - margin.right, py); ctx.stroke() })
    xTicks.forEach(d => { const px = xPos(d); ctx.beginPath(); ctx.moveTo(px, margin.top); ctx.lineTo(px, height - margin.bottom); ctx.stroke() })

    ctx.strokeStyle = CHART_COLORS.axis; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(margin.left, margin.top); ctx.lineTo(margin.left, height - margin.bottom); ctx.lineTo(width - margin.right, height - margin.bottom); ctx.stroke()

    ctx.fillStyle = CHART_COLORS.label; ctx.font = '11px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'middle'
    yTicks.forEach(y => ctx.fillText(`¥${y}`, margin.left - 8, yPos(y)))
    ctx.textAlign = 'center'; ctx.textBaseline = 'top'
    xTicks.forEach(d => ctx.fillText(d >= 365 ? `${(d / 365).toFixed(1)}年` : `第${d}天`, xPos(d), height - margin.bottom + 8))

    const points = []
    const step = Math.max(1, Math.floor(totalDays / 300))
    for (let d = 1; d <= totalDays; d += step) points.push({ x: xPos(d), y: yPos(price / d) })
    if (!points.length || points[points.length - 1].x < xPos(totalDays)) points.push({ x: xPos(totalDays), y: yPos(price / totalDays) })

    const grad = ctx.createLinearGradient(0, margin.top, 0, height - margin.bottom)
    grad.addColorStop(0, 'rgba(0, 200, 83, 0.15)')
    grad.addColorStop(1, 'rgba(0, 200, 83, 0.01)')
    ctx.beginPath(); ctx.moveTo(points[0].x, height - margin.bottom)
    points.forEach(p => ctx.lineTo(p.x, p.y))
    ctx.lineTo(points[points.length - 1].x, height - margin.bottom); ctx.closePath()
    ctx.fillStyle = grad; ctx.fill()

    ctx.strokeStyle = CHART_COLORS.primary; ctx.lineWidth = 3; ctx.lineJoin = 'round'
    ctx.beginPath(); ctx.moveTo(points[0].x, points[0].y)
    for (let i = 1; i < points.length; i++) {
      const cx = (points[i - 1].x + points[i].x) / 2
      ctx.quadraticCurveTo(points[i - 1].x, points[i - 1].y, cx, (points[i - 1].y + points[i].y) / 2)
    }
    ctx.stroke()

    const dotStep = Math.max(1, Math.floor(points.length / 8))
    for (let i = 0; i < points.length; i += dotStep) {
      ctx.beginPath(); ctx.arc(points[i].x, points[i].y, 4, 0, Math.PI * 2)
      ctx.fillStyle = CHART_COLORS.white; ctx.fill()
      ctx.strokeStyle = CHART_COLORS.primary; ctx.lineWidth = 2; ctx.stroke()
    }

    const last = points[points.length - 1]
    ctx.beginPath(); ctx.arc(last.x, last.y, 8, 0, Math.PI * 2)
    ctx.fillStyle = CHART_COLORS.primary; ctx.fill()
    ctx.strokeStyle = CHART_COLORS.white; ctx.lineWidth = 3; ctx.stroke()
    ctx.fillStyle = CHART_COLORS.primary; ctx.font = 'bold 12px sans-serif'
    ctx.textAlign = 'center'; ctx.textBaseline = 'bottom'
    ctx.fillText(`今天 ¥${(price / totalDays).toFixed(1)}/天`, last.x, last.y - 14)

    const first = points[0]
    ctx.fillStyle = CHART_COLORS.label; ctx.font = '11px sans-serif'
    ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'
    ctx.fillText(`第1天 ¥${price}`, first.x + 4, first.y - 6)
  },

  calcXTicks(totalDays) {
    if (totalDays <= 7) return Array.from({ length: totalDays }, (_, i) => i + 1)
    if (totalDays <= 30) return [...Array.from({ length: 7 }, (_, i) => i + 1), totalDays]
    const ticks = [1, 7, 30]
    if (totalDays > 90) ticks.push(90)
    if (totalDays > 180) ticks.push(180)
    if (totalDays > 365) ticks.push(365)
    ticks.push(totalDays)
    return ticks
  }
})
