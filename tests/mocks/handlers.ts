import { http, HttpResponse } from 'msw'
import { mockUser, mockPost, mockMessage } from '../setup'

export const handlers = [
  // Auth endpoints
  http.post('/api/auth/login', () => {
    return HttpResponse.json({
      user: mockUser,
      session: {
        access_token: 'mock-access-token',
        refresh_token: 'mock-refresh-token'
      }
    })
  }),

  http.post('/api/auth/logout', () => {
    return HttpResponse.json({ success: true })
  }),

  http.get('/api/auth/user', () => {
    return HttpResponse.json({ user: mockUser })
  }),

  // Posts endpoints
  http.get('/api/posts', ({ request }) => {
    const url = new URL(request.url)
    const page = url.searchParams.get('page') || '1'
    const limit = url.searchParams.get('limit') || '10'

    return HttpResponse.json({
      posts: Array.from({ length: parseInt(limit) }, (_, i) => ({
        ...mockPost,
        id: `post-${i + 1}`,
        title: `Test Post ${i + 1}`
      })),
      totalPages: 5,
      currentPage: parseInt(page)
    })
  }),

  http.post('/api/posts', async ({ request }) => {
    const data = await request.json()
    return HttpResponse.json({
      ...mockPost,
      ...(data as any),
      id: 'new-post-id'
    }, { status: 201 })
  }),

  http.get('/api/posts/:id', ({ params }) => {
    return HttpResponse.json({
      ...mockPost,
      id: params.id
    })
  }),

  http.put('/api/posts/:id', async ({ params, request }) => {
    const data = await request.json()
    return HttpResponse.json({
      ...mockPost,
      id: params.id,
      ...(data as any),
      updated_at: new Date().toISOString()
    })
  }),

  http.delete('/api/posts/:id', () => {
    return HttpResponse.json({ success: true })
  }),

  // Chat/Messages endpoints
  http.get('/api/chat/messages', ({ request }) => {
    const url = new URL(request.url)
    const userId = url.searchParams.get('userId')

    return HttpResponse.json({
      messages: Array.from({ length: 5 }, (_, i) => ({
        ...mockMessage,
        id: `message-${i + 1}`,
        content: `Test message ${i + 1}`,
        to_user_id: userId || 'another-user-id'
      }))
    })
  }),

  http.post('/api/chat/messages', async ({ request }) => {
    const data = await request.json()
    return HttpResponse.json({
      ...mockMessage,
      ...(data as any),
      id: 'new-message-id'
    }, { status: 201 })
  }),

  // Admin endpoints
  http.get('/api/admin/users', () => {
    return HttpResponse.json({
      users: Array.from({ length: 3 }, (_, i) => ({
        ...mockUser,
        id: `user-${i + 1}`,
        username: `user${i + 1}`,
        email: `user${i + 1}@example.com`
      }))
    })
  }),

  http.get('/api/admin/stats', () => {
    return HttpResponse.json({
      totalUsers: 100,
      totalPosts: 250,
      totalMessages: 500,
      activeUsers: 75
    })
  }),

  // Profile endpoints
  http.get('/api/profile/:username', ({ params }) => {
    return HttpResponse.json({
      ...mockUser,
      username: params.username
    })
  }),

  http.put('/api/profile', async ({ request }) => {
    const data = await request.json()
    return HttpResponse.json({
      ...mockUser,
      ...(data as any),
      updated_at: new Date().toISOString()
    })
  }),

  // Error simulation endpoints
  http.get('/api/error/500', () => {
    return HttpResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    )
  }),

  http.get('/api/error/404', () => {
    return HttpResponse.json(
      { error: 'Not Found' },
      { status: 404 }
    )
  }),

  http.get('/api/error/401', () => {
    return HttpResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    )
  })
]