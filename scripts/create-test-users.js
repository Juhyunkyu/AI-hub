#!/usr/bin/env node

/**
 * E2E 테스트용 사용자 생성 스크립트
 *
 * 이메일 인증 없이 바로 사용 가능한 테스트 사용자를 생성합니다.
 * Supabase Admin API를 사용하여 email_confirmed_at을 자동으로 설정합니다.
 */

// 환경 변수 로드
const fs = require('fs');
const path = require('path');

// .env.local 파일 읽기
const envPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      const [key, ...valueParts] = trimmed.split('=');
      if (key && valueParts.length > 0) {
        process.env[key.trim()] = valueParts.join('=').trim();
      }
    }
  });
}

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ 환경 변수가 설정되지 않았습니다.');
  console.error('   .env.local 파일에 다음 변수들이 있는지 확인하세요:');
  console.error('   - NEXT_PUBLIC_SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Admin Client 생성 (Service Role Key 사용)
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

const TEST_USERS = [
  {
    email: 'test-user-a@example.com',
    password: 'TestPassword123!',
    username: 'UserA'
  },
  {
    email: 'test-user-b@example.com',
    password: 'TestPassword123!',
    username: 'UserB'
  }
];

async function createTestUser(userInfo) {
  console.log(`\n🔄 ${userInfo.email} 생성 중...`);

  try {
    // 1. Admin API로 사용자 생성 (이메일 인증 자동 완료)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: userInfo.email,
      password: userInfo.password,
      email_confirm: true,  // ✅ 이메일 자동 인증!
      user_metadata: {
        username: userInfo.username
      }
    });

    if (authError) {
      console.error(`   ❌ Auth 오류:`, JSON.stringify(authError, null, 2));

      // 이미 존재하는 사용자인 경우
      if (authError.message.includes('already registered')) {
        console.log(`⚠️  ${userInfo.email} - 이미 존재하는 사용자입니다.`);

        // 기존 사용자의 profiles 확인
        const { data: existingUser } = await supabaseAdmin.auth.admin.listUsers();
        const user = existingUser.users.find(u => u.email === userInfo.email);

        if (user) {
          // profiles 테이블 확인 및 생성
          const { data: profile } = await supabaseAdmin
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();

          if (!profile) {
            console.log(`   📝 profiles 레코드 생성 중...`);
            const { error: profileError } = await supabaseAdmin
              .from('profiles')
              .insert({
                id: user.id,
                username: userInfo.username,
                role: 'user'
              });

            if (profileError) {
              console.error(`   ❌ profiles 생성 실패:`, profileError.message);
            } else {
              console.log(`   ✅ profiles 레코드 생성 완료`);
            }
          } else {
            console.log(`   ✅ profiles 레코드 이미 존재`);
          }

          return { success: true, exists: true };
        }
      }

      throw authError;
    }

    console.log(`✅ ${userInfo.email} 생성 완료 (ID: ${authData.user.id})`);

    // 2. profiles 테이블 확인 (트리거로 자동 생성되어야 함)
    const { data: profile, error: profileError } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', authData.user.id)
      .single();

    if (profileError || !profile) {
      console.log(`   ⚠️  profiles 자동 생성 안됨, 수동 생성 중...`);

      const { error: insertError } = await supabaseAdmin
        .from('profiles')
        .insert({
          id: authData.user.id,
          username: userInfo.username,
          role: 'user'
        });

      if (insertError) {
        console.error(`   ❌ profiles 수동 생성 실패:`, insertError.message);
      } else {
        console.log(`   ✅ profiles 수동 생성 완료`);
      }
    } else {
      console.log(`   ✅ profiles 레코드 확인됨 (username: ${profile.username})`);
    }

    return { success: true, exists: false };

  } catch (error) {
    console.error(`❌ ${userInfo.email} 생성 실패:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  console.log('='.repeat(60));
  console.log('🚀 E2E 테스트 사용자 생성 스크립트');
  console.log('='.repeat(60));

  const results = [];

  for (const userInfo of TEST_USERS) {
    const result = await createTestUser(userInfo);
    results.push({ ...userInfo, ...result });
  }

  console.log('\n' + '='.repeat(60));
  console.log('📊 생성 결과 요약');
  console.log('='.repeat(60));

  results.forEach(result => {
    const status = result.success
      ? (result.exists ? '✅ 기존' : '✅ 신규')
      : '❌ 실패';
    console.log(`${status} ${result.email} (${result.username})`);
  });

  const successCount = results.filter(r => r.success).length;
  console.log(`\n총 ${successCount}/${TEST_USERS.length}명 생성/확인 완료`);

  if (successCount === TEST_USERS.length) {
    console.log('\n✅ E2E 테스트 준비 완료! 이제 테스트를 실행할 수 있습니다:');
    console.log('   npx playwright test chat-realtime-sync --project=chromium-desktop');
  } else {
    console.log('\n⚠️  일부 사용자 생성에 실패했습니다. 위 오류를 확인하세요.');
  }

  console.log('='.repeat(60));
}

main().catch(error => {
  console.error('💥 스크립트 실행 중 오류 발생:', error);
  process.exit(1);
});
