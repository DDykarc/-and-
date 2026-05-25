const versionInfo = require('../../utils/version')

Page({
  data: {
    version: versionInfo.version,
    changelog: versionInfo.changelog
  }
})
