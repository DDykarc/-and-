const versionInfo = require('../../utils/version')

const CLOUD_ENV = 'cloud1-d5gt7eqr59e199765'

Page({
  data: {
    version: versionInfo.version,
    changelog: versionInfo.changelog
  },

  onLoad() {
    this.loadVersionFromCloud()
  },

  // 从云数据库读取最新版本号
  loadVersionFromCloud() {
    if (!wx.cloud) return
    const db = wx.cloud.database()
    db.collection('version_info').limit(1).get()
      .then(res => {
        if (res.data && res.data[0] && res.data[0].version) {
          this.setData({ version: res.data[0].version })
        }
      })
      .catch(() => {
        // 集合不存在或读取失败，使用本地兜底版本号
      })
  }
})
