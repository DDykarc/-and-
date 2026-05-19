/**
 * 版本信息
 * changelog: 更新日志，每次发版在顶部追加新条目
 * version: 从云数据库 version_info 集合读取，此处为兜底值
 */
module.exports = {
  version: '1.0.0',
  changelog: [
    {
      version: '1.1.0',
      date: '2026-05-19',
      changes: [
        '新增版本信息页面',
        '优化体重卡片显示BMI分类',
      ]
    },
    {
      version: '1.0.0',
      date: '2026-04-30',
      changes: [
        '小程序上线',
        '支持商品日均成本计算',
        '支持血糖/尿酸/体重记录',
        '支持趋势图表',
      ]
    },
  ]
}
