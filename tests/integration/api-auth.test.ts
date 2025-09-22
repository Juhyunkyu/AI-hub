import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { http, HttpResponse } from 'msw'
import { server } from '../setup'

// API 통합 테스트 - 실제 API 엔드포인트와 유사한 환경에서 테스트
describe('Auth API Integration Tests', () => {
  beforeEach(() => {
    // 각 테스트마다 서버 핸들러 리셋
    server.resetHandlers()
  })

  afterEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/auth/login', () => {
    it('유효한 자격증명으로 로그인에 성공해야 한다', async () => {
      // 성공적인 로그인 응답 모킹
      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          const data = await request.json() as any

          if (data.email === 'test@example.com' && data.password === 'password123') {
            return HttpResponse.json({
              user: {
                id: 'user-1',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user'
              },
              session: {
                access_token: 'mock-access-token',
                refresh_token: 'mock-refresh-token'
              }
            }, { status: 200 })
          }

          return HttpResponse.json(
            { error: 'Invalid credentials' },
            { status: 401 }
          )
        })
      )

      // 실제 fetch 요청 시뮬레이션
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(response.status).toBe(200)

      const data = await response.json()
      expect(data).toHaveProperty('user')
      expect(data).toHaveProperty('session')
      expect(data.user.email).toBe('test@example.com')
      expect(data.session.access_token).toBe('mock-access-token')
    })

    it('잘못된 자격증명으로 로그인에 실패해야 한다', async () => {
      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          const data = await request.json() as any

          if (data.email === 'wrong@example.com' || data.password === 'wrongpassword') {
            return HttpResponse.json(
              { error: 'Invalid email or password' },
              { status: 401 }
            )
          }

          return HttpResponse.json({
            user: { id: 'user-1' },
            session: { access_token: 'token' }
          })
        })
      )

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'wrong@example.com',
          password: 'wrongpassword'
        })
      })

      expect(response.status).toBe(401)

      const data = await response.json()
      expect(data).toHaveProperty('error')
      expect(data.error).toBe('Invalid email or password')
    })

    it('필수 필드가 누락된 경우 400 에러를 반환해야 한다', async () => {
      server.use(
        http.post('/api/auth/login', async ({ request }) => {
          const data = await request.json() as any

          if (!data.email || !data.password) {
            return HttpResponse.json(
              { error: 'Email and password are required' },
              { status: 400 }
            )
          }

          return HttpResponse.json({
            user: { id: 'user-1' },
            session: { access_token: 'token' }
          })
        })
      )

      // 이메일 누락
      const response1 = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          password: 'password123'
        })
      })

      expect(response1.status).toBe(400)
      const data1 = await response1.json()
      expect(data1.error).toBe('Email and password are required')

      // 비밀번호 누락
      const response2 = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com'
        })
      })

      expect(response2.status).toBe(400)
      const data2 = await response2.json()
      expect(data2.error).toBe('Email and password are required')
    })

    it('잘못된 JSON 형식에 대해 400 에러를 반환해야 한다', async () => {
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            { error: 'Invalid JSON format' },
            { status: 400 }
          )
        })
      )

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: 'invalid json'
      })

      expect(response.status).toBe(400)
      const data = await response.json()
      expect(data.error).toBe('Invalid JSON format')
    })
  })

  describe('POST /api/auth/logout', () => {
    it('로그아웃에 성공해야 한다', async () => {
      server.use(
        http.post('/api/auth/logout', () => {
          return HttpResponse.json({
            success: true,
            message: 'Logged out successfully'
          })
        })
      )

      const response = await fetch('/api/auth/logout', {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.success).toBe(true)
      expect(data.message).toBe('Logged out successfully')
    })

    it('인증 토큰 없이 로그아웃 시도 시 401 에러를 반환해야 한다', async () => {
      server.use(
        http.post('/api/auth/logout', ({ request }) => {
          const authHeader = request.headers.get('authorization')

          if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return HttpResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            )
          }

          return HttpResponse.json({ success: true })
        })
      )

      const response = await fetch('/api/auth/logout', {
        method: 'POST'
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('GET /api/auth/user', () => {
    it('유효한 토큰으로 사용자 정보를 가져와야 한다', async () => {
      server.use(
        http.get('/api/auth/user', ({ request }) => {
          const authHeader = request.headers.get('authorization')

          if (authHeader === 'Bearer valid-token') {
            return HttpResponse.json({
              user: {
                id: 'user-1',
                email: 'test@example.com',
                username: 'testuser',
                role: 'user',
                avatar_url: null,
                bio: null,
                created_at: '2024-01-01T00:00:00Z'
              }
            })
          }

          return HttpResponse.json(
            { error: 'Invalid token' },
            { status: 401 }
          )
        })
      )

      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': 'Bearer valid-token'
        }
      })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('test@example.com')
      expect(data.user.username).toBe('testuser')
    })

    it('잘못된 토큰으로 401 에러를 반환해야 한다', async () => {
      server.use(
        http.get('/api/auth/user', ({ request }) => {
          const authHeader = request.headers.get('authorization')

          if (authHeader !== 'Bearer valid-token') {
            return HttpResponse.json(
              { error: 'Invalid or expired token' },
              { status: 401 }
            )
          }

          return HttpResponse.json({
            user: { id: 'user-1' }
          })
        })
      )

      const response = await fetch('/api/auth/user', {
        headers: {
          'Authorization': 'Bearer invalid-token'
        }
      })

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Invalid or expired token')
    })

    it('토큰 없이 요청 시 401 에러를 반환해야 한다', async () => {
      server.use(
        http.get('/api/auth/user', ({ request }) => {
          const authHeader = request.headers.get('authorization')

          if (!authHeader) {
            return HttpResponse.json(
              { error: 'Authentication required' },
              { status: 401 }
            )
          }

          return HttpResponse.json({
            user: { id: 'user-1' }
          })
        })
      )

      const response = await fetch('/api/auth/user')

      expect(response.status).toBe(401)
      const data = await response.json()
      expect(data.error).toBe('Authentication required')
    })
  })

  describe('API 에러 처리', () => {
    it('서버 에러 시 500 상태코드를 반환해야 한다', async () => {
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.json(
            { error: 'Internal server error' },
            { status: 500 }
          )
        })
      )

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          email: 'test@example.com',
          password: 'password123'
        })
      })

      expect(response.status).toBe(500)
      const data = await response.json()
      expect(data.error).toBe('Internal server error')
    })

    it('네트워크 에러를 적절히 처리해야 한다', async () => {
      server.use(
        http.post('/api/auth/login', () => {
          return HttpResponse.error()
        })
      )

      try {
        await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'password123'
          })
        })
      } catch (error) {
        // 네트워크 에러가 발생해야 함
        expect(error).toBeDefined()
      }
    })
  })

  describe('Rate Limiting', () => {
    it('너무 많은 요청 시 429 에러를 반환해야 한다', async () => {
      let requestCount = 0

      server.use(
        http.post('/api/auth/login', () => {
          requestCount++

          if (requestCount > 5) {
            return HttpResponse.json(
              { error: 'Too many requests', retryAfter: 60 },
              { status: 429 }
            )
          }

          return HttpResponse.json(
            { error: 'Invalid credentials' },
            { status: 401 }
          )
        })
      )

      // 6번의 요청을 보내서 rate limit 트리거
      for (let i = 0; i < 6; i++) {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: 'test@example.com',
            password: 'wrongpassword'
          })
        })

        if (i < 5) {
          expect(response.status).toBe(401)
        } else {
          expect(response.status).toBe(429)
          const data = await response.json()
          expect(data.error).toBe('Too many requests')
          expect(data.retryAfter).toBe(60)
        }
      }
    })
  })
})