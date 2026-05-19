# 回本清单

记录每件商品的日均使用成本，还有血糖、尿酸、体重等健康数据追踪。

## 功能

### 回本清单
- 记录商品价格、购买日期、分类
- 自动计算已用天数和日均成本
- 按分类筛选商品
- 成本趋势图表（支持拖动、缩放、点击查看详情）

### 健康记录
- 血糖记录（支持空腹/餐后等多种测量时机）
- 尿酸记录（支持服药标记）
- 体重记录（自动计算 BMI）
- 数据统计：最高/最低/平均值
- 趋势图表
- 数据导出 CSV

## 技术栈

- 微信小程序原生开发
- 微信云开发（CloudBase）
  - 云数据库：`items`、`health_records`、`version_info`
  - 云函数：`createCollection`

## 项目结构

```
├── app.js / app.json / app.wxss    # 小程序入口
├── cloudfunctions/                   # 云函数
│   └── createCollection/             # 自动创建数据库集合
├── images/                           # 图片资源
├── pages/
│   ├── index/                        # 商品列表主页
│   ├── add/                          # 添加/编辑商品
│   ├── chart/                        # 成本趋势图表
│   ├── health/
│   │   ├── index/                    # 健康记录主页
│   │   ├── record/                   # 添加健康记录
│   │   ├── history/                  # 历史记录
│   │   ├── chart/                    # 健康趋势图表
│   │   └── settings/                 # 设置（身高/目标体重/性别）
│   └── about/                        # 关于页面（版本信息）
└── utils/
    ├── db.js                         # 商品数据服务
    ├── healthDb.js                   # 健康记录数据服务
    └── version.js                    # 版本更新日志
```

## 使用

1. 使用微信开发者工具导入项目
2. 在云开发控制台开通环境，创建以下集合：
   - `items`（商品）
   - `health_records`（健康记录）
   - `version_info`（版本信息，添加一条 `_id: 任意值, version: 1.0.0` 的记录）
3. 编译运行
