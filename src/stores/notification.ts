import { create } from 'zustand'

export type NotificationItem = {
  id: string
  type: string
  isRead: boolean
  createdAt: string
}

export type NotificationState = {
  items: NotificationItem[]
  unreadCount: number
  setItems: (items: NotificationItem[]) => void
  markAsRead: (id: string) => void
  clear: () => void
}

export const useNotificationStore = create<NotificationState>((set) => ({
  items: [],
  unreadCount: 0,
  setItems: (items) => set({ items, unreadCount: items.filter((i) => !i.isRead).length }),
  markAsRead: (id) => set((s) => {
    const items = s.items.map((i) => (i.id === id ? { ...i, isRead: true } : i))
    const unreadCount = items.filter((i) => !i.isRead).length
    return { items, unreadCount }
  }),
  clear: () => set({ items: [], unreadCount: 0 })
}))
