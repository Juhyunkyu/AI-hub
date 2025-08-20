import { create } from 'zustand'

export type ThemeMode = 'light' | 'dark' | 'system'

export type UIState = {
  theme: ThemeMode
  modals: Record<string, boolean>
  setTheme: (mode: ThemeMode) => void
  openModal: (key: string) => void
  closeModal: (key: string) => void
}

export const useUIStore = create<UIState>((set) => ({
  theme: 'system',
  modals: {},
  setTheme: (theme) => set({ theme }),
  openModal: (key) => set((s) => ({ modals: { ...s.modals, [key]: true } })),
  closeModal: (key) => set((s) => ({ modals: { ...s.modals, [key]: false } }))
}))
