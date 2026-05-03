/**
 * 健康记录 - 云端数据服务
 * 封装血糖/尿酸/体重的增删改查
 * 集合名：health_records
 */

const CLOUD_ENV = 'cloud1-d5gt7eqr59e199765'

if (!wx.cloud._initCalled) {
  wx.cloud.init({ env: CLOUD_ENV })
  wx.cloud._initCalled = true
}

const db = wx.cloud.database()
const _ = db.command
const collection = db.collection('health_records')

/** 类型常量 */
const TYPE = {
  BLOOD_SUGAR: 'blood_sugar',
  URIC_ACID: 'uric_acid',
  WEIGHT: 'weight'
}

/** 血糖测量时机 */
const SUGAR_TIMING = [
  '空腹',
  '餐后1小时',
  '餐后2小时',
  '随机血糖',
  '睡前'
]

/** 参考范围 */
const REF_RANGE = {
  // 血糖按测量时机分类（单位：mmol/L）
  blood_sugar: {
    '空腹': { min: 3.9, max: 6.1 },
    '餐后1小时': { min: 0, max: 11.1 },
    '餐后2小时': { min: 0, max: 7.8 },
    '随机血糖': { min: 0, max: 11.1 },
    '睡前': { min: 3.9, max: 6.1 }
  },
  // 尿酸按性别分类（单位：μmol/L）
  uric_acid: {
    male: { min: 208, max: 428 },
    female: { min: 155, max: 357 }
  },
  weight: { unit: 'kg' }
}

/**
 * 添加记录
 * @param {Object} record - { type, value, recordTime, note, timing, medicated, medicine }
 * @returns {Promise<string>} _id
 */
function addRecord(record) {
  const data = {
    ...record,
    _openid: undefined, // 让云端自动填充
    createTime: db.serverDate()
  }
  return collection.add({ data })
    .then(res => res._id)
    .catch(err => {
      console.error('添加健康记录失败', err)
      wx.showToast({ title: '保存失败', icon: 'none' })
      return null
    })
}

/**
 * 查询某类型的所有记录（按记录时间倒序）
 * @param {string} type - TYPE 中的值
 * @param {number} days - 可选，限定最近N天
 * @returns {Promise<Array>}
 */
function getRecords(type, days) {
  let query = collection.where({ type })
  if (days) {
    const since = new Date()
    since.setDate(since.getDate() - days)
    query = query.where({ recordTime: _.gte(since.getTime()) })
  }
  return query.orderBy('recordTime', 'desc').get()
    .then(res => res.data || [])
    .catch(err => {
      console.error('查询健康记录失败', err)
      return []
    })
}

/**
 * 获取单条记录
 * @param {string} id - _id
 * @returns {Promise<Object|null>}
 */
function getRecord(id) {
  return collection.doc(id).get()
    .then(res => res.data || null)
    .catch(err => {
      console.error('获取记录失败', err)
      return null
    })
}

/**
 * 更新记录
 * @param {string} id - _id
 * @param {Object} data
 * @returns {Promise<boolean>}
 */
function updateRecord(id, data) {
  return collection.doc(id).update({ data })
    .then(() => true)
    .catch(err => {
      console.error('更新记录失败', err)
      wx.showToast({ title: '更新失败', icon: 'none' })
      return false
    })
}

/**
 * 删除记录
 * @param {string} id - _id
 * @returns {Promise<boolean>}
 */
function deleteRecord(id) {
  return collection.doc(id).remove()
    .then(() => true)
    .catch(err => {
      console.error('删除记录失败', err)
      wx.showToast({ title: '删除失败', icon: 'none' })
      return false
    })
}

/**
 * 计算统计数据
 * @param {Array} records - 记录数组
 * @returns {{ max, min, avg, latest, latestTime }}
 */
function calcStats(records) {
  if (!records || records.length === 0) {
    return { max: null, min: null, avg: null, latest: null, latestTime: null }
  }
  const values = records.map(r => r.value)
  const sorted = [...values].sort((a, b) => a - b)
  const sum = values.reduce((s, v) => s + v, 0)
  // 最近一条（按 recordTime 最新）
  const latest = [...records].sort((a, b) => b.recordTime - a.recordTime)[0]
  return {
    max: sorted[sorted.length - 1],
    min: sorted[0],
    avg: Math.round(sum / values.length * 100) / 100,
    latest: latest.value,
    latestTime: latest.recordTime
  }
}

/**
 * 判断数值是否正常
 * @param {string} type
 * @param {number} value
 * @param {Object} options - 额外参数 { timing, gender }
 * @returns {'normal'|'high'|'low'|'unknown'}
 */
function getStatus(type, value, options = {}) {
  if (type === 'blood_sugar') {
    const timing = options.timing || '空腹'
    const range = REF_RANGE.blood_sugar[timing]
    if (!range) return 'unknown'
    if (value < range.min) return 'low'
    if (value > range.max) return 'high'
    return 'normal'
  }
  if (type === 'uric_acid') {
    const gender = options.gender || 'male'
    const range = REF_RANGE.uric_acid[gender]
    if (!range) return 'unknown'
    if (value < range.min) return 'low'
    if (value > range.max) return 'high'
    return 'normal'
  }
  return 'unknown'
}

/**
 * 计算BMI
 * @param {number} weight - kg
 * @param {number} height - cm
 * @returns {number|null}
 */
function calcBMI(weight, height) {
  if (!weight || !height || height <= 0) return null
  return Math.round(weight / ((height / 100) ** 2) * 10) / 10
}

/**
 * 获取BMI分类
 * @param {number} bmi
 * @returns {string}
 */
function getBMICategory(bmi) {
  if (bmi < 18.5) return '偏瘦'
  if (bmi < 24) return '正常'
  if (bmi < 28) return '偏胖'
  return '肥胖'
}

/**
 * 读取设置（身高、目标体重、性别、对比天数），存在本地
 */
function getSettings() {
  try {
    const data = wx.getStorageSync('health_settings')
    return data || { height: null, targetWeight: null, compareDays: 1, gender: 'male' }
  } catch (e) {
    return { height: null, targetWeight: null, compareDays: 1, gender: 'male' }
  }
}

function saveSettings(settings) {
  wx.setStorageSync('health_settings', settings)
}

module.exports = {
  TYPE,
  SUGAR_TIMING,
  REF_RANGE,
  addRecord,
  getRecords,
  getRecord,
  updateRecord,
  deleteRecord,
  calcStats,
  getStatus,
  getSettings,
  saveSettings,
  calcBMI,
  getBMICategory
}
