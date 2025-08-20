import { create } from 'zustand'

export type Profile = {
  id: string
  username: string | null
  avatarUrl?: string | null
  bio?: string | null
}

export type ProfileState = {
  profile: Profile | null
  followsCount: number
  setProfile: (p: Profile | null) => void
  setFollowsCount: (n: number) => void
}

export const useProfileStore = create<ProfileState>((set) => ({
  profile: null,
  followsCount: 0,
  setProfile: (profile) => set({ profile }),
  setFollowsCount: (n) => set({ followsCount: n })
}))
