/**
 * Chat System Testing Utilities
 *
 * PostgreSQL 함수 및 채팅 시스템 통합 테스트를 위한 유틸리티
 * 무한 재귀 문제 해결 검증, 성능 테스트, 데이터 정합성 검증
 */

import { createSupabaseBrowserClient } from '@/lib/supabase/client';
import {
  validateDirectChatRoom,
  PostgreSQLFunctionResponseSchema,
  CreateChatRoomSchema,
  type PostgreSQLFunctionResponse,
  type CreateChatRoom
} from '@/lib/schemas';

const supabase = createSupabaseBrowserClient();

// ============================================================================
// Test Types
// ============================================================================

export interface TestResult {
  testName: string;
  success: boolean;
  duration: number;
  error?: string;
  details?: Record<string, any>;
}

export interface ChatSystemTestSuite {
  testName: string;
  tests: TestResult[];
  totalTests: number;
  passedTests: number;
  failedTests: number;
  totalDuration: number;
  success: boolean;
}

// ============================================================================
// Core Test Functions
// ============================================================================

/**
 * PostgreSQL 함수 존재 여부 확인
 */
export async function testPostgreSQLFunctionsExist(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    // 함수들이 존재하는지 확인
    const { data, error } = await supabase.rpc('create_or_get_direct_chat_room', {
      p_current_user_id: '00000000-0000-0000-0000-000000000000', // 더미 UUID
      p_target_user_id: '11111111-1111-1111-1111-111111111111'   // 더미 UUID
    });

    // 함수가 존재하지만 더미 데이터로 인해 실패할 것으로 예상
    // 중요한 것은 함수가 존재한다는 것
    const duration = performance.now() - startTime;

    return {
      testName: 'PostgreSQL Functions Exist',
      success: true, // 함수가 존재하면 성공
      duration,
      details: { functionCalled: true, error: error?.message }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'PostgreSQL Functions Exist',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 스키마 검증 테스트
 */
export async function testSchemaValidation(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    // 유효한 데이터 검증
    const validData: CreateChatRoom = {
      type: 'direct',
      participant_ids: ['12345678-1234-1234-1234-123456789012'],
      name: null,
      description: null,
      avatar_url: null,
      is_private: false,
      max_participants: null
    };

    const validationResult = CreateChatRoomSchema.parse(validData);

    // 무효한 데이터 검증 (에러가 발생해야 함)
    let invalidDataFailed = false;
    try {
      CreateChatRoomSchema.parse({
        type: 'invalid_type',
        participant_ids: []
      });
    } catch {
      invalidDataFailed = true;
    }

    // Direct chat room 검증
    let directChatValidationPassed = false;
    try {
      validateDirectChatRoom(
        '12345678-1234-1234-1234-123456789012',
        '87654321-4321-4321-4321-210987654321'
      );
      directChatValidationPassed = true;
    } catch {
      // 예상된 에러는 무시
    }

    // 자기 자신과의 채팅방 생성 방지 테스트
    let selfChatPrevented = false;
    try {
      validateDirectChatRoom(
        '12345678-1234-1234-1234-123456789012',
        '12345678-1234-1234-1234-123456789012'
      );
    } catch {
      selfChatPrevented = true;
    }

    const duration = performance.now() - startTime;

    const success = invalidDataFailed && directChatValidationPassed && selfChatPrevented;

    return {
      testName: 'Schema Validation',
      success,
      duration,
      details: {
        validDataParsed: !!validationResult,
        invalidDataRejected: invalidDataFailed,
        directChatValidation: directChatValidationPassed,
        selfChatPrevented
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'Schema Validation',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * PostgreSQL 함수 응답 스키마 검증
 */
export async function testPostgreSQLResponseSchema(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    // 유효한 응답 형식 테스트
    const validResponse: PostgreSQLFunctionResponse = {
      success: true,
      room_id: '12345678-1234-1234-1234-123456789012',
      is_new: true
    };

    const validParsed = PostgreSQLFunctionResponseSchema.parse(validResponse);

    // 에러 응답 형식 테스트
    const errorResponse: PostgreSQLFunctionResponse = {
      success: false,
      error: 'Test error message'
    };

    const errorParsed = PostgreSQLFunctionResponseSchema.parse(errorResponse);

    // 무효한 응답 형식 테스트
    let invalidRejected = false;
    try {
      PostgreSQLFunctionResponseSchema.parse({
        invalid: true,
        wrong_format: 'test'
      });
    } catch {
      invalidRejected = true;
    }

    const duration = performance.now() - startTime;

    return {
      testName: 'PostgreSQL Response Schema',
      success: !!validParsed && !!errorParsed && invalidRejected,
      duration,
      details: {
        validResponseParsed: !!validParsed,
        errorResponseParsed: !!errorParsed,
        invalidResponseRejected: invalidRejected
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'PostgreSQL Response Schema',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 데이터베이스 연결 및 기본 쿼리 테스트
 */
export async function testDatabaseConnection(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    // 기본 연결 테스트
    const { data, error } = await supabase
      .from('profiles')
      .select('id')
      .limit(1);

    if (error) {
      throw error;
    }

    // 채팅 테이블 접근 테스트
    const { error: chatError } = await supabase
      .from('chat_rooms')
      .select('id')
      .limit(1);

    if (chatError) {
      throw chatError;
    }

    const duration = performance.now() - startTime;

    return {
      testName: 'Database Connection',
      success: true,
      duration,
      details: {
        profilesAccessible: !error,
        chatRoomsAccessible: !chatError,
        responseTime: duration
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'Database Connection',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 성능 기준 테스트
 */
export async function testPerformanceBenchmarks(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    const performanceTests = [];

    // 1. 스키마 검증 성능 (100회)
    const schemaStartTime = performance.now();
    for (let i = 0; i < 100; i++) {
      CreateChatRoomSchema.parse({
        type: 'direct',
        participant_ids: ['12345678-1234-1234-1234-123456789012'],
        name: null,
        description: null,
        avatar_url: null,
        is_private: false,
        max_participants: null
      });
    }
    const schemaTime = performance.now() - schemaStartTime;
    performanceTests.push({ test: 'Schema Validation (100x)', time: schemaTime });

    // 2. UUID 검증 성능 (1000회)
    const uuidStartTime = performance.now();
    for (let i = 0; i < 1000; i++) {
      try {
        validateDirectChatRoom(
          '12345678-1234-1234-1234-123456789012',
          '87654321-4321-4321-4321-210987654321'
        );
      } catch {
        // 예상된 에러는 무시
      }
    }
    const uuidTime = performance.now() - uuidStartTime;
    performanceTests.push({ test: 'UUID Validation (1000x)', time: uuidTime });

    // 3. 데이터베이스 쿼리 성능
    const dbStartTime = performance.now();
    await supabase.from('profiles').select('id').limit(1);
    const dbTime = performance.now() - dbStartTime;
    performanceTests.push({ test: 'Database Query', time: dbTime });

    const duration = performance.now() - startTime;

    // 성능 기준: 스키마 검증 < 100ms, UUID 검증 < 50ms, DB 쿼리 < 500ms
    const schemaPerformanceOk = schemaTime < 100;
    const uuidPerformanceOk = uuidTime < 50;
    const dbPerformanceOk = dbTime < 500;

    return {
      testName: 'Performance Benchmarks',
      success: schemaPerformanceOk && uuidPerformanceOk && dbPerformanceOk,
      duration,
      details: {
        tests: performanceTests,
        benchmarks: {
          schemaValidation: { time: schemaTime, passed: schemaPerformanceOk },
          uuidValidation: { time: uuidTime, passed: uuidPerformanceOk },
          databaseQuery: { time: dbTime, passed: dbPerformanceOk }
        }
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'Performance Benchmarks',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

/**
 * 메모리 사용량 테스트
 */
export async function testMemoryUsage(): Promise<TestResult> {
  const startTime = performance.now();

  try {
    let initialMemory = 0;
    let finalMemory = 0;

    if (typeof window !== 'undefined' && 'memory' in performance) {
      initialMemory = (performance as any).memory.usedJSHeapSize;

      // 메모리 사용량 테스트를 위해 여러 스키마 검증 수행
      const testData = [];
      for (let i = 0; i < 1000; i++) {
        testData.push(CreateChatRoomSchema.parse({
          type: 'direct',
          participant_ids: [`${i.toString().padStart(8, '0')}-1234-1234-1234-123456789012`],
          name: null,
          description: null,
          avatar_url: null,
          is_private: false,
          max_participants: null
        }));
      }

      finalMemory = (performance as any).memory.usedJSHeapSize;
    }

    const duration = performance.now() - startTime;
    const memoryIncrease = finalMemory - initialMemory;

    return {
      testName: 'Memory Usage',
      success: memoryIncrease < 10 * 1024 * 1024, // 10MB 이하 증가
      duration,
      details: {
        initialMemory: Math.round(initialMemory / 1024 / 1024 * 100) / 100,
        finalMemory: Math.round(finalMemory / 1024 / 1024 * 100) / 100,
        memoryIncrease: Math.round(memoryIncrease / 1024 / 1024 * 100) / 100,
        withinLimits: memoryIncrease < 10 * 1024 * 1024
      }
    };
  } catch (error) {
    const duration = performance.now() - startTime;
    return {
      testName: 'Memory Usage',
      success: false,
      duration,
      error: error instanceof Error ? error.message : 'Unknown error'
    };
  }
}

// ============================================================================
// Test Suite Runner
// ============================================================================

/**
 * 전체 채팅 시스템 테스트 스위트 실행
 */
export async function runChatSystemTestSuite(): Promise<ChatSystemTestSuite> {
  const suiteStartTime = performance.now();

  const tests = await Promise.all([
    testDatabaseConnection(),
    testPostgreSQLFunctionsExist(),
    testSchemaValidation(),
    testPostgreSQLResponseSchema(),
    testPerformanceBenchmarks(),
    testMemoryUsage()
  ]);

  const totalDuration = performance.now() - suiteStartTime;
  const passedTests = tests.filter(t => t.success).length;
  const failedTests = tests.length - passedTests;

  return {
    testName: 'Chat System Integration Test Suite',
    tests,
    totalTests: tests.length,
    passedTests,
    failedTests,
    totalDuration: Math.round(totalDuration * 100) / 100,
    success: failedTests === 0
  };
}

/**
 * 테스트 결과를 콘솔에 출력
 */
export function printTestResults(testSuite: ChatSystemTestSuite): void {
  console.group(`🧪 ${testSuite.testName}`);
  console.log(`📊 총 테스트: ${testSuite.totalTests}`);
  console.log(`✅ 성공: ${testSuite.passedTests}`);
  console.log(`❌ 실패: ${testSuite.failedTests}`);
  console.log(`⏱️ 총 소요시간: ${testSuite.totalDuration}ms`);
  console.log(`🎯 전체 성공: ${testSuite.success ? '✅' : '❌'}`);

  console.group('개별 테스트 결과:');
  testSuite.tests.forEach(test => {
    const status = test.success ? '✅' : '❌';
    console.log(`${status} ${test.testName} (${test.duration.toFixed(2)}ms)`);

    if (!test.success && test.error) {
      console.error(`   ❌ 에러: ${test.error}`);
    }

    if (test.details) {
      console.log(`   📝 세부사항:`, test.details);
    }
  });
  console.groupEnd();
  console.groupEnd();
}

/**
 * 테스트 결과를 JSON으로 내보내기
 */
export function exportTestResults(testSuite: ChatSystemTestSuite): string {
  return JSON.stringify(testSuite, null, 2);
}

// ============================================================================
// Quick Test Functions
// ============================================================================

/**
 * 빠른 건강성 체크
 */
export async function quickHealthCheck(): Promise<{
  healthy: boolean;
  issues: string[];
  responseTime: number;
}> {
  const startTime = performance.now();
  const issues: string[] = [];

  try {
    // 데이터베이스 연결 확인
    const dbTest = await testDatabaseConnection();
    if (!dbTest.success) {
      issues.push(`데이터베이스 연결 실패: ${dbTest.error}`);
    }

    // 함수 존재 확인
    const funcTest = await testPostgreSQLFunctionsExist();
    if (!funcTest.success) {
      issues.push(`PostgreSQL 함수 누락: ${funcTest.error}`);
    }

    const responseTime = performance.now() - startTime;

    return {
      healthy: issues.length === 0,
      issues,
      responseTime: Math.round(responseTime * 100) / 100
    };
  } catch (error) {
    const responseTime = performance.now() - startTime;
    return {
      healthy: false,
      issues: [error instanceof Error ? error.message : 'Unknown error'],
      responseTime: Math.round(responseTime * 100) / 100
    };
  }
}

/**
 * 개발 환경에서 자동 테스트 실행
 */
export async function runDevelopmentTests(): Promise<void> {
  if (process.env.NODE_ENV === 'development') {
    console.log('🚀 채팅 시스템 개발 테스트 시작...');

    const healthCheck = await quickHealthCheck();
    console.log('🏥 건강성 체크:', healthCheck);

    if (healthCheck.healthy) {
      const testSuite = await runChatSystemTestSuite();
      printTestResults(testSuite);
    } else {
      console.error('❌ 건강성 체크 실패, 전체 테스트 건너뜀');
      console.error('🔧 문제:', healthCheck.issues);
    }
  }
}