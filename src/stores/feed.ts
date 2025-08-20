import { create } from 'zustand'

export type FeedSort = 'latest' | 'popular'

export type FeedFilters = {
  sort: FeedSort
  topicSlug?: string
  tagSlugs?: string[]
}

export type FeedItem = {
  id: string
  title: string
  authorId: string
  createdAt: string
}

export type FeedState = {
  filters: FeedFilters
  items: FeedItem[]
  cursor: string | null
  setFilters: (filters: Partial<FeedFilters>) => void
  setItems: (items: FeedItem[], cursor: string | null) => void
  appendItems: (items: FeedItem[], cursor: string | null) => void
  reset: () => void
}

export const useFeedStore = create<FeedState>((set) => ({
  filters: { sort: 'latest' },
  items: [],
  cursor: null,
  setFilters: (partial) => set((s) => ({ filters: { ...s.filters, ...partial } })),
  setItems: (items, cursor) => set({ items, cursor }),
  appendItems: (items, cursor) => set((s) => ({ items: [...s.items, ...items], cursor })),
  reset: () => set({ filters: { sort: 'latest' }, items: [], cursor: null })
}))
