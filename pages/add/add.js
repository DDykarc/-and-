// 预设分类（名称 + 图标）
const CATEGORIES = [
  { name: '电子设备', icon: '📱' },
  { name: '家居生活', icon: '🏠' },
  { name: '服装鞋包', icon: '👕' },
  { name: '租房住房', icon: '🏢' },
  { name: '技能培训', icon: '📚' },
  { name: '交通出行', icon: '🚗' },
  { name: '餐饮美食', icon: '🍜' },
  { name: '娱乐休闲', icon: '🎮' },
  { name: '其他', icon: '📦' }
]

const db = require('../../utils/db')

Page({
  data: {
    isEdit: false,
    editId: null,

    name: '',
    price: '',
    buyDate: '',
    category: '',
    note: '',

    categories: CATEGORIES,

    previewDays: 0,
    previewDailyCost: '0.0',

    today: '',
    canSave: false,
    saving: false
  },

  onLoad(options) {
    const now = new Date()
    const y = now.getFullYear()
    const m = String(now.getMonth() + 1).padStart(2, '0')
    const d = String(now.getDate()).padStart(2, '0')
    this.setData({ today: `${y}-${m}-${d}` })

    // 编辑模式：从云端加载
    if (options.id) {
      wx.showLoading({ title: '加载中...' })
      db.getItem(options.id).then(item => {
        wx.hideLoading()
        if (item) {
          wx.setNavigationBarTitle({ title: '编辑物品' })
          this.setData({
            isEdit: true,
            editId: item._id,
            name: item.name,
            price: String(item.price),
            buyDate: item.buyDate,
            category: item.category || '',
            note: item.note || ''
          })
          this.updatePreview()
          this.checkCanSave()
        }
      })
    }
  },

  onNameInput(e) {
    this.setData({ name: e.detail.value })
    this.checkCanSave()
    this.updatePreview()
  },

  onPriceInput(e) {
    this.setData({ price: e.detail.value })
    this.checkCanSave()
    this.updatePreview()
  },

  onDateChange(e) {
    this.setData({ buyDate: e.detail.value })
    this.checkCanSave()
    this.updatePreview()
  },

  onCategorySelect(e) {
    this.setData({ category: e.currentTarget.dataset.name })
    this.checkCanSave()
  },

  onNoteInput(e) {
    this.setData({ note: e.detail.value })
  },

  checkCanSave() {
    const { name, price, buyDate } = this.data
    this.setData({
      canSave: !!(name.trim() && parseFloat(price) > 0 && buyDate)
    })
  },

  updatePreview() {
    const { name, price, buyDate } = this.data
    if (!name.trim() || !parseFloat(price) || !buyDate) {
      this.setData({ previewDays: 0, previewDailyCost: '0.0' })
      return
    }

    const now = Date.now()
    const buyDateTime = new Date(buyDate).getTime()
    const diff = now - buyDateTime
    const daysUsed = Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
    const dailyCost = (parseFloat(price) / daysUsed).toFixed(1)

    this.setData({
      previewDays: daysUsed > 0 ? daysUsed : 1,
      previewDailyCost: dailyCost
    })
  },

  // 保存到云端
  onSave() {
    const { isEdit, editId, name, price, buyDate, category, note } = this.data
    if (!this.data.canSave) return

    this.setData({ saving: true })

    const itemData = {
      name: name.trim(),
      price: parseFloat(price),
      buyDate,
      category: category || '其他',
      note: note.trim()
    }

    if (isEdit) {
      // 更新到云端
      db.updateItem(editId, itemData).then(success => {
        this.setData({ saving: false })
        if (success) {
          wx.showToast({ title: '已更新', icon: 'success', duration: 1500 })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          this.setData({ saving: false })
        }
      })
    } else {
      // 新增到云端
      itemData.createdAt = new Date().toISOString()

      db.addItem(itemData).then(newId => {
        this.setData({ saving: false })
        if (newId) {
          wx.showToast({ title: '已添加', icon: 'success', duration: 1500 })
          setTimeout(() => wx.navigateBack(), 1500)
        } else {
          this.setData({ saving: false })
        }
      })
    }
  },

  // 从云端删除
  onDelete() {
    const { editId, name } = this.data
    wx.showModal({
      title: '删除物品',
      content: `确定要永久删除「${name}」吗？`,
      confirmText: '删除',
      confirmColor: '#FF3B30',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          db.deleteItem(editId).then(success => {
            if (success) {
              wx.showToast({
                title: '已删除',
                icon: 'success',
                duration: 1500,
                success: () => setTimeout(() => wx.navigateBack(), 1500)
              })
            }
          })
        }
      }
    })
  }
})
