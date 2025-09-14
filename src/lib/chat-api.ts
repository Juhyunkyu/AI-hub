import { createSupabaseBrowserClient } from '@/lib/supabase/client'

const supabase = createSupabaseBrowserClient()

export interface DeleteChatRoomsResult {
  success: boolean
  deletedCount: number
  error?: string
}

export interface User {
  id: string
  username: string
  avatar_url?: string
  bio?: string
}

export interface SearchUsersResult {
  users: User[]
  hasMore: boolean
  nextPage?: number
  error?: string
}

export interface FollowResult {
  success: boolean
  isFollowing: boolean
  error?: string
}

export interface CreateChatRoomResult {
  success: boolean
  roomId?: string
  error?: string
}

/**
 * 선택된 채팅방들을 삭제합니다.
 * 현재 사용자가 참여자인 채팅방만 삭제 가능합니다.
 */
export async function deleteChatRooms(roomIds: string[]): Promise<DeleteChatRoomsResult> {
  try {
    if (roomIds.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 채팅방이 없습니다." }
    }

    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, deletedCount: 0, error: "로그인이 필요합니다." }
    }

    // 사용자가 참여 중인 채팅방만 필터링
    const { data: userRooms, error: roomsError } = await supabase
      .from('chat_room_participants')
      .select('room_id')
      .eq('user_id', user.id)
      .in('room_id', roomIds)

    if (roomsError) {
      console.error('Error fetching user rooms:', roomsError)
      return { success: false, deletedCount: 0, error: "채팅방 권한 확인 중 오류가 발생했습니다." }
    }

    const authorizedRoomIds = userRooms?.map(room => room.room_id) || []

    if (authorizedRoomIds.length === 0) {
      return { success: false, deletedCount: 0, error: "삭제할 수 있는 채팅방이 없습니다." }
    }

    // 트랜잭션으로 삭제 작업 수행
    // 1. 메시지 읽음 상태 삭제
    const { error: readsError } = await supabase
      .from('chat_message_reads')
      .delete()
      .in('message_id',
        supabase
          .from('chat_messages')
          .select('id')
          .in('room_id', authorizedRoomIds)
      )

    if (readsError) {
      console.error('Error deleting message reads:', readsError)
    }

    // 2. 메시지 삭제
    const { error: messagesError } = await supabase
      .from('chat_messages')
      .delete()
      .in('room_id', authorizedRoomIds)

    if (messagesError) {
      console.error('Error deleting messages:', messagesError)
    }

    // 3. 타이핑 상태 삭제
    const { error: typingError } = await supabase
      .from('chat_typing_status')
      .delete()
      .in('room_id', authorizedRoomIds)

    if (typingError) {
      console.error('Error deleting typing status:', typingError)
    }

    // 4. 채팅방 참여자 삭제
    const { error: participantsError } = await supabase
      .from('chat_room_participants')
      .delete()
      .in('room_id', authorizedRoomIds)

    if (participantsError) {
      console.error('Error deleting participants:', participantsError)
      return { success: false, deletedCount: 0, error: "참여자 정보 삭제 중 오류가 발생했습니다." }
    }

    // 5. 채팅방 삭제
    const { error: roomsDeleteError } = await supabase
      .from('chat_rooms')
      .delete()
      .in('id', authorizedRoomIds)

    if (roomsDeleteError) {
      console.error('Error deleting chat rooms:', roomsDeleteError)
      return { success: false, deletedCount: 0, error: "채팅방 삭제 중 오류가 발생했습니다." }
    }

    return {
      success: true,
      deletedCount: authorizedRoomIds.length,
      error: authorizedRoomIds.length < roomIds.length ?
        `${roomIds.length - authorizedRoomIds.length}개 채팅방은 권한이 없어 삭제되지 않았습니다.` :
        undefined
    }

  } catch (error) {
    console.error('Unexpected error during chat room deletion:', error)
    return {
      success: false,
      deletedCount: 0,
      error: "채팅방 삭제 중 예상치 못한 오류가 발생했습니다."
    }
  }
}

/**
 * 사용자를 검색합니다 (무한 스크롤 지원)
 */
export async function searchUsers(query: string, page = 0, limit = 20): Promise<SearchUsersResult> {
  try {
    if (query.length < 2) {
      return { users: [], hasMore: false, error: "검색어는 2글자 이상 입력해주세요." }
    }

    // 현재 사용자 확인
    const { data: { user: currentUser } } = await supabase.auth.getUser()
    if (!currentUser) {
      return { users: [], hasMore: false, error: "로그인이 필요합니다." }
    }

    const offset = page * limit

    // 사용자 검색 (현재 사용자 제외)
    const { data, count, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio', { count: 'exact' })
      .or(`username.ilike.%${query}%,bio.ilike.%${query}%`)
      .neq('id', currentUser.id) // 현재 사용자 제외
      .range(offset, offset + limit - 1)
      .order('username')

    if (error) {
      console.error('Error searching users:', error)
      return { users: [], hasMore: false, error: "사용자 검색 중 오류가 발생했습니다." }
    }

    return {
      users: data || [],
      hasMore: (count || 0) > offset + limit,
      nextPage: (count || 0) > offset + limit ? page + 1 : undefined
    }

  } catch (error) {
    console.error('Unexpected error during user search:', error)
    return { users: [], hasMore: false, error: "검색 중 예상치 못한 오류가 발생했습니다." }
  }
}

/**
 * 사용자를 팔로우/언팔로우합니다
 */
export async function toggleFollow(targetUserId: string): Promise<FollowResult> {
  try {
    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, isFollowing: false, error: "로그인이 필요합니다." }
    }

    // 현재 팔로우 상태 확인
    const { data: existingFollow, error: checkError } = await supabase
      .from('follows')
      .select('id')
      .eq('follower_id', user.id)
      .eq('following_id', targetUserId)
      .single()

    if (checkError && checkError.code !== 'PGRST116') { // PGRST116은 "not found" 에러
      console.error('Error checking follow status:', checkError)
      return { success: false, isFollowing: false, error: "팔로우 상태 확인 중 오류가 발생했습니다." }
    }

    const isCurrentlyFollowing = !!existingFollow

    if (isCurrentlyFollowing) {
      // 언팔로우
      const { error: unfollowError } = await supabase
        .from('follows')
        .delete()
        .eq('follower_id', user.id)
        .eq('following_id', targetUserId)

      if (unfollowError) {
        console.error('Error unfollowing user:', unfollowError)
        return { success: false, isFollowing: true, error: "언팔로우 중 오류가 발생했습니다." }
      }

      return { success: true, isFollowing: false }
    } else {
      // 팔로우
      const { error: followError } = await supabase
        .from('follows')
        .insert({
          follower_id: user.id,
          following_id: targetUserId
        })

      if (followError) {
        console.error('Error following user:', followError)
        return { success: false, isFollowing: false, error: "팔로우 중 오류가 발생했습니다." }
      }

      return { success: true, isFollowing: true }
    }

  } catch (error) {
    console.error('Unexpected error during follow toggle:', error)
    return { success: false, isFollowing: false, error: "처리 중 예상치 못한 오류가 발생했습니다." }
  }
}

/**
 * 팔로우한 사용자 목록을 가져옵니다
 */
export async function getFollowingUsers(): Promise<{ users: User[], error?: string }> {
  try {
    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { users: [], error: "로그인이 필요합니다." }
    }

    // 팔로우한 사용자 목록 조회 - 두 단계로 수행
    const { data: followData, error: followError } = await supabase
      .from('follows')
      .select('following_id')
      .eq('follower_id', user.id)

    if (followError) {
      console.error('Error fetching follow relationships:', followError)
      return { users: [], error: "팔로우 관계 조회 중 오류가 발생했습니다." }
    }

    if (!followData || followData.length === 0) {
      return { users: [] }
    }

    const followingIds = followData.map(follow => follow.following_id)

    // 팔로우한 사용자들의 프로필 정보 조회
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, avatar_url, bio')
      .in('id', followingIds)

    if (error) {
      console.error('Error fetching following users:', error)
      return { users: [], error: "팔로우 사용자 조회 중 오류가 발생했습니다." }
    }

    const users: User[] = data?.map(profile => ({
      id: profile.id,
      username: profile.username,
      avatar_url: profile.avatar_url,
      bio: profile.bio
    })) || []

    return { users }

  } catch (error) {
    console.error('Unexpected error during following users fetch:', error)
    return { users: [], error: "팔로우 사용자 조회 중 예상치 못한 오류가 발생했습니다." }
  }
}

/**
 * 1:1 채팅방을 생성합니다
 */
export async function createDirectChatRoom(targetUserId: string): Promise<CreateChatRoomResult> {
  try {
    // 현재 사용자 확인
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      return { success: false, error: "로그인이 필요합니다." }
    }

    // 이미 존재하는 1:1 채팅방 확인
    const { data: existingRooms, error: checkError } = await supabase
      .from('chat_room_participants')
      .select(`
        room_id,
        chat_rooms!inner (
          id,
          type
        )
      `)
      .eq('user_id', user.id)
      .eq('chat_rooms.type', 'direct')

    if (checkError) {
      console.error('Error checking existing rooms:', checkError)
      return { success: false, error: "기존 채팅방 확인 중 오류가 발생했습니다." }
    }

    // 기존 채팅방 중에 대상 사용자와의 1:1 채팅방이 있는지 확인
    for (const roomParticipant of existingRooms || []) {
      const { data: participants, error: participantsError } = await supabase
        .from('chat_room_participants')
        .select('user_id')
        .eq('room_id', roomParticipant.room_id)

      if (participantsError) continue

      const participantIds = participants?.map(p => p.user_id) || []

      // 정확히 2명이고, 현재 사용자와 대상 사용자만 있는 경우
      if (participantIds.length === 2 &&
          participantIds.includes(user.id) &&
          participantIds.includes(targetUserId)) {
        return { success: true, roomId: roomParticipant.room_id }
      }
    }

    // 새 채팅방 생성
    const { data: newRoom, error: roomError } = await supabase
      .from('chat_rooms')
      .insert({
        type: 'direct'
      })
      .select()
      .single()

    if (roomError) {
      console.error('Error creating chat room:', roomError)
      return { success: false, error: "채팅방 생성 중 오류가 발생했습니다." }
    }

    // 참여자 추가
    const { error: participantsError } = await supabase
      .from('chat_room_participants')
      .insert([
        { room_id: newRoom.id, user_id: user.id },
        { room_id: newRoom.id, user_id: targetUserId }
      ])

    if (participantsError) {
      console.error('Error adding participants:', participantsError)
      // 생성된 채팅방 삭제
      await supabase.from('chat_rooms').delete().eq('id', newRoom.id)
      return { success: false, error: "참여자 추가 중 오류가 발생했습니다." }
    }

    return { success: true, roomId: newRoom.id }

  } catch (error) {
    console.error('Unexpected error during chat room creation:', error)
    return { success: false, error: "채팅방 생성 중 예상치 못한 오류가 발생했습니다." }
  }
}