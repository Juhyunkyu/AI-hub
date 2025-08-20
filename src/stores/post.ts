import { create } from 'zustand'

export type DraftPost = {
  title: string
  content?: string
  url?: string
  source?: string
  thumbnail?: string
  tags: string[]
  topics: string[]
}

export type CurrentPost = {
  id: string
  title: string
  content?: string
}

export type PostState = {
  draft: DraftPost
  currentPost: CurrentPost | null
  setDraft: (partial: Partial<DraftPost>) => void
  clearDraft: () => void
  setCurrentPost: (post: CurrentPost | null) => void
}

export const usePostStore = create<PostState>((set) => ({
  draft: { title: '', tags: [], topics: [] },
  currentPost: null,
  setDraft: (partial) => set((s) => ({ draft: { ...s.draft, ...partial } })),
  clearDraft: () => set({ draft: { title: '', tags: [], topics: [] } }),
  setCurrentPost: (post) => set({ currentPost: post })
}))
