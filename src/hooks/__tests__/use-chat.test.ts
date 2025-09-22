import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, waitFor } from '@testing-library/react'
import { useChatHook } from '../use-chat'
import { useAuthStore } from '@/stores/auth'
import { toast } from 'sonner'
import { server } from '../../../tests/setup'
import { http, HttpResponse } from 'msw'

// Mock dependencies
vi.mock('@/stores/auth')
vi.mock('sonner')
vi.mock('../use-realtime-chat', () => ({
  useRealtimeChat: vi.fn(() => ({
    isConnected: true,
    connectionState: 'connected',
    error: null,
    reconnect: vi.fn()
  })),
  useTypingIndicator: vi.fn(() => ({
    typingUsers: [],
    updateTyping: vi.fn(),
    startTyping: vi.fn(),
    stopTyping: vi.fn()
  }))
}))

const mockUser = {
  id: 'user-1',
  username: 'testuser',
  email: 'test@example.com',
  avatar_url: null,
  role: 'user' as const,
  created_at: '2024-01-01T00:00:00Z'
}

const mockRoom = {
  id: 'room-1',
  name: 'Test Room',
  description: 'Test room description',
  created_by: 'user-1',
  is_private: false,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  participants: [
    {
      id: 'participant-1',
      room_id: 'room-1',
      user_id: 'user-1',
      joined_at: '2024-01-01T00:00:00Z',
      user: mockUser
    }
  ],
  last_message: null
}

const mockMessage = {
  id: 'message-1',
  room_id: 'room-1',
  sender_id: 'user-1',
  content: 'Test message',
  message_type: 'text' as const,
  created_at: '2024-01-01T00:00:00Z',
  updated_at: '2024-01-01T00:00:00Z',
  sender: {
    id: 'user-1',
    username: 'testuser',
    avatar_url: null
  },
  file_url: null,
  file_name: null,
  file_size: null,
  reply_to_id: null,
  reply_to: null,
  reads: [],
  read_by: ['user-1']
}

describe('useChatHook', () => {
  const mockUseAuthStore = vi.mocked(useAuthStore)
  const mockToast = vi.mocked(toast)

  beforeEach(() => {
    mockUseAuthStore.mockReturnValue({ user: mockUser })
    mockToast.error = vi.fn()

    // Reset and setup default API responses
    server.resetHandlers()
    server.use(
      http.get('/api/chat/rooms', () => {
        return HttpResponse.json({
          rooms: [mockRoom]
        }, { status: 200 })
      }),
      http.get('/api/chat/messages', ({ request }) => {
        const url = new URL(request.url)
        const roomId = url.searchParams.get('room_id')

        if (roomId) {
          return HttpResponse.json({
            messages: [mockMessage]
          }, { status: 200 })
        }

        return HttpResponse.json({
          messages: []
        }, { status: 200 })
      }),
      http.post('/api/chat/messages', async ({ request }) => {
        const body = await request.json() as any
        return HttpResponse.json({
          message: {
            ...mockMessage,
            id: 'new-message-id',
            content: body.content,
            created_at: new Date().toISOString()
          }
        }, { status: 200 })
      })
    )
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('초기 상태', () => {
    it('초기값들이 올바르게 설정되어야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      expect(result.current.rooms).toEqual([])
      expect(result.current.currentRoom).toBeNull()
      expect(result.current.messages).toEqual([])
      expect(result.current.messagesLoading).toBe(false)

      // loading 상태는 useEffect로 인해 즉시 true가 될 수 있으므로 대기
      await waitFor(() => {
        expect(result.current.loading).toBe(false)
      })
    })

    it('유저가 있을 때 채팅방을 자동으로 로드해야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await waitFor(() => {
        expect(result.current.rooms).toHaveLength(1)
        expect(result.current.rooms[0]).toEqual(mockRoom)
      })
    })

    it('유저가 없을 때는 채팅방을 로드하지 않아야 한다', () => {
      mockUseAuthStore.mockReturnValue({ user: null })

      const { result } = renderHook(() => useChatHook())

      expect(result.current.rooms).toEqual([])
      expect(result.current.loading).toBe(false)
    })
  })

  describe('채팅방 관리', () => {
    it('채팅방을 성공적으로 로드해야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        const rooms = await result.current.loadRooms()
        expect(rooms).toHaveLength(1)
        expect(rooms[0]).toEqual(mockRoom)
      })

      expect(result.current.loading).toBe(false)
      expect(result.current.rooms).toHaveLength(1)
    })

    it('채팅방 로드 실패 시 에러 토스트를 표시해야 한다', async () => {
      server.use(
        http.get('/api/chat/rooms', () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.loadRooms()
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('채팅방을 불러오는데 실패했습니다')
      })
    })

    it('채팅방을 선택할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.selectRoom(mockRoom)
      })

      expect(result.current.currentRoom).toEqual(mockRoom)
      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toEqual(mockMessage)
    })

    it('채팅방 선택을 해제할 수 있어야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.selectRoom(mockRoom)
      })

      expect(result.current.currentRoom).toEqual(mockRoom)

      await act(async () => {
        result.current.clearCurrentRoom()
      })

      expect(result.current.currentRoom).toBeNull()
      expect(result.current.messages).toEqual([])
    })
  })

  describe('메시지 관리', () => {
    it('메시지를 성공적으로 로드해야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.loadMessages('room-1')
      })

      expect(result.current.messages).toHaveLength(1)
      expect(result.current.messages[0]).toEqual(mockMessage)
      expect(result.current.messagesLoading).toBe(false)
    })

    it('메시지 로드 실패 시 에러 토스트를 표시해야 한다', async () => {
      server.use(
        http.get('/api/chat/messages', () => {
          return HttpResponse.error()
        })
      )

      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.loadMessages('room-1')
      })

      await waitFor(() => {
        expect(mockToast.error).toHaveBeenCalledWith('메시지를 불러오는데 실패했습니다')
      })
    })

    it('메시지를 성공적으로 전송해야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.selectRoom(mockRoom)
      })

      const initialMessageCount = result.current.messages.length

      await act(async () => {
        await result.current.sendMessage('Hello, world!', 'room-1')
      })

      // Optimistic update로 메시지가 즉시 추가되어야 함
      expect(result.current.messages.length).toBe(initialMessageCount + 1)

      // 마지막 메시지가 전송한 메시지여야 함
      const lastMessage = result.current.messages[result.current.messages.length - 1]
      expect(lastMessage.content).toBe('Hello, world!')
      expect(lastMessage.sender_id).toBe(mockUser.id)
    })

    it('빈 메시지는 전송하지 않아야 한다', async () => {
      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.selectRoom(mockRoom)
      })

      const initialMessageCount = result.current.messages.length

      await act(async () => {
        await result.current.sendMessage('   ', 'room-1')
      })

      expect(result.current.messages.length).toBe(initialMessageCount)
    })

    it('메시지 전송 실패 시 optimistic 메시지를 제거하고 에러 토스트를 표시해야 한다', async () => {
      server.use(
        http.post('/api/chat/messages', () => {
          return HttpResponse.json(
            { error: 'Server error' },
            { status: 500 }
          )
        })
      )

      const { result } = renderHook(() => useChatHook())

      await act(async () => {
        await result.current.selectRoom(mockRoom)
      })

      const initialMessageCount = result.current.messages.length

      await act(async () => {
        await result.current.sendMessage('Hello, world!', 'room-1')
      })

      // 실패 후 메시지 수가 원래대로 돌아가야 함
      await waitFor(() => {
        expect(result.current.messages.length).toBe(initialMessageCount)
      })

      expect(mockToast.error).toHaveBeenCalledWith('메시지 전송에 실패했습니다')
    })
  })

  describe('실시간 기능', () => {
    it('실시간 연결 상태를 제공해야 한다', () => {
      const { result } = renderHook(() => useChatHook())

      expect(result.current.isRealtimeConnected).toBe(true)
      expect(result.current.realtimeConnectionState).toBe('connected')
      expect(result.current.realtimeError).toBeNull()
      expect(typeof result.current.reconnectRealtime).toBe('function')
    })

    it('타이핑 기능들을 제공해야 한다', () => {
      const { result } = renderHook(() => useChatHook())

      expect(Array.isArray(result.current.typingUsers)).toBe(true)
      expect(typeof result.current.updateTyping).toBe('function')
      expect(typeof result.current.startTyping).toBe('function')
      expect(typeof result.current.stopTyping).toBe('function')
    })
  })

  describe('채팅방 정렬', () => {
    it('마지막 메시지 시간 순으로 채팅방을 정렬해야 한다', async () => {
      const room1 = {
        ...mockRoom,
        id: 'room-1',
        name: 'Room 1',
        last_message: {
          ...mockMessage,
          created_at: '2024-01-01T10:00:00Z'
        }
      }

      const room2 = {
        ...mockRoom,
        id: 'room-2',
        name: 'Room 2',
        last_message: {
          ...mockMessage,
          created_at: '2024-01-01T12:00:00Z' // 더 최근
        }
      }

      server.use(
        http.get('/api/chat/rooms', () => {
          return HttpResponse.json({
            rooms: [room1, room2] // 순서대로 전달
          })
        })
      )

      const { result } = renderHook(() => useChatHook())

      await waitFor(() => {
        expect(result.current.rooms).toHaveLength(2)
        // 더 최근 메시지가 있는 room2가 먼저 와야 함
        expect(result.current.rooms[0].id).toBe('room-2')
        expect(result.current.rooms[1].id).toBe('room-1')
      })
    })
  })
})