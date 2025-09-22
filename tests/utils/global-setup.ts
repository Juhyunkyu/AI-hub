import { chromium, FullConfig } from '@playwright/test'

async function globalSetup(config: FullConfig) {
  console.log('🚀 Setting up E2E test environment...')

  // Supabase 로컬 환경이 실행 중인지 확인
  try {
    const response = await fetch('http://localhost:54321/rest/v1/', {
      headers: {
        'apikey': process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'test-key'
      }
    })

    if (!response.ok) {
      console.warn('⚠️  Supabase local server not responding. Make sure to run `npm run db:start`')
    } else {
      console.log('✅ Supabase local server is running')
    }
  } catch (error) {
    console.warn('⚠️  Could not connect to Supabase local server:', error)
  }

  // 테스트 데이터베이스 초기화
  await initializeTestDatabase()

  console.log('✅ E2E test environment setup complete')
}

async function initializeTestDatabase() {
  // 테스트용 사용자 및 데이터 생성
  // 실제 구현에서는 Supabase client를 사용하여 테스트 데이터를 생성합니다
  console.log('📊 Initializing test database...')

  // 예시: 테스트 사용자 생성
  // const { data, error } = await supabase.auth.admin.createUser({
  //   email: 'test@example.com',
  //   password: 'testpassword123',
  //   email_confirm: true
  // })
}

export default globalSetup