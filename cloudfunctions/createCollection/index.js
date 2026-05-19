// 云函数：自动创建数据库集合
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()

exports.main = async (event, context) => {
  const collections = ['health_records']
  const results = []

  for (const name of collections) {
    try {
      // 尝试创建集合
      await db.createCollection(name)
      results.push({ name, status: 'created' })
    } catch (err) {
      if (err.errCode === -502003 || err.message.includes('already exists')) {
        results.push({ name, status: 'already_exists' })
      } else {
        results.push({ name, status: 'error', error: err.message })
      }
    }
  }

  // 设置集合权限：仅创建者可读写
  for (const name of collections) {
    try {
      await db.collection(name).setPermission({
        read: 'doc._openid == auth.openid',
        write: 'doc._openid == auth.openid'
      })
    } catch (e) {
      // 忽略权限设置错误
    }
  }

  return { success: true, results }
}
