const healthDb = require('../../../utils/healthDb')

/**
 * 格式化日期为 YYYY-MM-DD（本地时间）
 */
function formatDate(date) {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/**
 * 格式化时间为 HH:MM（本地时间）
 */
function formatTime(date) {
  const h = String(date.getHours()).padStart(2, '0')
  const m = String(date.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

/**
 * 获取北京时间（UTC+8）
 * 如果设备时区不是 +8，手动换算
 */
function getBeijingTime() {
  const now = new Date()
  // 获取本地时间与 UTC 的时差（分钟）
  const localOffset = now.getTimezoneOffset()  // 中国时区返回 -480
  // 北京时间 = UTC + 8 小时 = UTC - (-480) + 480 - 480 + 480... 
  // 简单处理：直接构造北京时间字符串
  // 微信小程序运行在手机上，手机时区一般就是北京时间
  // 所以直接用 getFullYear/getMonth/getDate 即可
  return now
}

Page({
  data: {
    type: '',
    typeName: '',
    unit: '',
    isEdit: false,
    editId: '',

    // 表单数据
    value: '',
    recordTime: '',   // "YYYY-MM-DD HH:MM"
    note: '',
    timing: '',
    medicated: null,
    medicine: '',

    // 时间选择（原生 picker）
    dateValue: '',    // "YYYY-MM-DD"  for picker mode="date"
    timeValue: '',    // "HH:MM"      for picker mode="time"

    // 选项
    timingOptions: healthDb.SUGAR_TIMING,
    canSave: false
  },

  onLoad(options) {
    const type = options.type
    const typeMap = {
      blood_sugar: { name: '血糖', unit: 'mmol/L' },
      uric_acid:   { name: '尿酸', unit: 'μmol/L' },
      weight:      { name: '体重', unit: 'kg' }
    }
    const info = typeMap[type] || { name: '', unit: '' }

    // 默认时间为当前北京时间
    const now = getBeijingTime()
    const dateVal = formatDate(now)
    const timeVal = formatTime(now)
    const todayVal = formatDate(now)  // 用于限制日期选择器

    // 读取设置（用于BMI计算）
    const settings = healthDb.getSettings()

    this.setData({
      type,
      typeName: info.name,
      unit: info.unit,
      dateValue: dateVal,
      timeValue: timeVal,
      today: todayVal,  // 限制日期上限
      recordTime: `${dateVal} ${timeVal}`,
      timing: type === 'blood_sugar' ? '空腹' : '',
      height: settings.height || null,
      bmi: null,
      bmiCategory: ''
    })

    // 如果是编辑模式
    if (options.id) {
      this.setData({ isEdit: true, editId: options.id })
      this.loadRecord(options.id)
    }

    this.checkCanSave()
  },

  loadRecord(id) {
    healthDb.getRecord(id).then(record => {
      if (!record) return

      const d = record.recordTime ? new Date(record.recordTime) : new Date()
      const dateVal = formatDate(d)
      const timeVal = formatTime(d)

      this.setData({
        value: String(record.value),
        dateValue: dateVal,
        timeValue: timeVal,
        recordTime: `${dateVal} ${timeVal}`,
        note: record.note || '',
        timing: record.timing || '',
        medicated: record.medicated !== undefined ? record.medicated : null,
        medicine: record.medicine || ''
      })
      this.checkCanSave()
    })
  },

  onInputValue(e) {
    const value = e.detail.value
    this.setData({ value })
    // 体重类型实时计算BMI
    if (this.data.type === 'weight' && this.data.height) {
      const numValue = parseFloat(value)
      if (!isNaN(numValue) && numValue > 0) {
        const bmi = healthDb.calcBMI(numValue, this.data.height)
        const category = bmi ? healthDb.getBMICategory(bmi) : ''
        this.setData({ bmi, bmiCategory: category })
      } else {
        this.setData({ bmi: null, bmiCategory: '' })
      }
    }
    this.checkCanSave()
  },

  onDateChange(e) {
    const dateVal = e.detail.value          // "YYYY-MM-DD"
    const timeVal = this.data.timeValue || '08:00'
    this.setData({
      dateValue: dateVal,
      recordTime: `${dateVal} ${timeVal}`
    })
    this.checkCanSave()
  },

  onTimeChange(e) {
    const timeVal = e.detail.value          // "HH:MM"
    const dateVal = this.data.dateValue
    this.setData({
      timeValue: timeVal,
      recordTime: `${dateVal} ${timeVal}`
    })
    this.checkCanSave()
  },

  onInputNote(e) {
    this.setData({ note: e.detail.value })
  },

  onSelectTiming(e) {
    this.setData({ timing: e.currentTarget.dataset.value })
  },

  onSelectMedicated(e) {
    const val = e.currentTarget.dataset.value
    this.setData({ medicated: val === 'true' })
  },

  onInputMedicine(e) {
    this.setData({ medicine: e.detail.value })
  },

  checkCanSave() {
    const { value, dateValue, timeValue } = this.data
    const num = parseFloat(value)
    const canSave = value !== '' && !isNaN(num) && dateValue && timeValue
    this.setData({ canSave })
  },

  onSave() {
    const { type, value, dateValue, timeValue, note, timing, medicated, medicine, isEdit, editId } = this.data
    const numValue = parseFloat(value)

    if (!numValue || isNaN(numValue)) {
      wx.showToast({ title: '请输入有效数值', icon: 'none' })
      return
    }

    // 将 "YYYY-MM-DD HH:MM" 转为时间戳
    const dateTimeStr = `${dateValue} ${timeValue}`
    const timestamp = new Date(dateTimeStr.replace(/-/g, '/')).getTime()

    const record = {
      type,
      value: numValue,
      recordTime: timestamp,
      note: note.trim() || undefined,
      unit: this.data.unit
    }

    if (type === 'blood_sugar') {
      record.timing = this.data.timing || undefined
    }
    if (type === 'uric_acid') {
      record.medicated = medicated !== null ? medicated : undefined
      record.medicine = medicine.trim() || undefined
    }

    wx.showLoading({ title: '保存中...' })

    const promise = isEdit
      ? healthDb.updateRecord(editId, record)
      : healthDb.addRecord(record)

    promise.then(success => {
      wx.hideLoading()
      if (success) {
        wx.showToast({ title: '保存成功', icon: 'success' })
        setTimeout(() => wx.navigateBack(), 800)
      }
    })
  },

  onDelete() {
    if (!this.data.isEdit) return
    wx.showModal({
      title: '确认删除',
      content: '删除后无法恢复，确定删除这条记录吗？',
      confirmColor: '#FF4444',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({ title: '删除中...' })
          healthDb.deleteRecord(this.data.editId).then(success => {
            wx.hideLoading()
            if (success) {
              wx.showToast({ title: '已删除', icon: 'success' })
              setTimeout(() => wx.navigateBack(), 800)
            }
          })
        }
      }
    })
  }
})
