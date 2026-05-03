/**
 * 云端数据服务
 * 封装微信云数据库的增删改查操作
 * ====================================
 * 首次使用前请确保已在开发者工具中：
 * 1. 点击「云开发」开通环境
 * 2. 在数据库中创建集合「items」
 */

const CLOUD_ENV = 'cloud1-d5gt7eqr59e199765'

// 初始化云开发（只执行一次）
if (!wx.cloud._initCalled) {
  wx.cloud.init({ env: CLOUD_ENV })
  wx.cloud._initCalled = true
}

const db = wx.cloud.database()
const collection = db.collection('items')

/**
 * 获取所有物品
 * @returns {Promise<Array>}
 */
function getAllItems() {
  return collection.get()
    .then(res => res.data || [])
    .catch(err => {
      console.error('云端读取失败', err)
      wx.showToast({ title: '读取数据失败', icon: 'none' })
      return []
    })
}

/**
 * 获取单个物品
 * @param {string} id - 云数据库 _id
 * @returns {Promise<Object|null>}
 */
function getItem(id) {
  return collection.doc(id).get()
    .then(res => res.data || null)
    .catch(err => {
      console.error('云端查询失败', err)
      return null
    })
}

/**
 * 添加物品
 * @param {Object} item
 * @returns {Promise<string>} 返回云 _id
 */
function addItem(item) {
  return collection.add({ data: item })
    .then(res => res._id)
    .catch(err => {
      console.error('云端添加失败', err)
      wx.showToast({ title: '保存失败，请重试', icon: 'none' })
      return null
    })
}

/**
 * 更新物品
 * @param {string} id - 云数据库 _id
 * @param {Object} data - 要更新的字段
 * @returns {Promise<boolean>}
 */
function updateItem(id, data) {
  return collection.doc(id).update({ data })
    .then(() => true)
    .catch(err => {
      console.error('云端更新失败', err)
      wx.showToast({ title: '更新失败，请重试', icon: 'none' })
      return false
    })
}

/**
 * 删除物品
 * @param {string} id - 云数据库 _id
 * @returns {Promise<boolean>}
 */
function deleteItem(id) {
  return collection.doc(id).remove()
    .then(() => true)
    .catch(err => {
      console.error('云端删除失败', err)
      wx.showToast({ title: '删除失败，请重试', icon: 'none' })
      return false
    })
}

module.exports = {
  getAllItems,
  getItem,
  addItem,
  updateItem,
  deleteItem
}
