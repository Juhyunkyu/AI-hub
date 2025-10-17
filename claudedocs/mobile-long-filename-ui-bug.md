# Mobile UI Bug: Long Filename Hides Send Button

**Issue Date**: 2025-10-17
**Severity**: High (사용자가 메시지를 전송할 수 없음)
**Platform**: Mobile viewport (375x667)

## 🐛 Bug Description

채팅방에서 긴 파일명의 이미지를 업로드할 때, 파일명이 너무 길면 전송 버튼이 화면 밖으로 밀려나서 사용자가 메시지를 전송할 수 없습니다.

## 📸 Evidence

### Test Setup
- **Browser**: Playwright (Chrome)
- **Viewport**: 375x667 (iPhone 6/7/8 size)
- **Test File**: `this_is_a_very_very_very_very_very_very_very_very_very_very_very_very_long_filename_for_mobile_ui_button_overflow_test_image_file.png` (151 characters)
- **Screenshots**:
  - Before: `.playwright-mcp/mobile-chat-before-upload.png`
  - After (Bug): `.playwright-mcp/mobile-long-filename-bug-test.png`

### Observed Behavior
1. ✅ 파일 업로드 성공
2. ✅ 파일명 표시: `this_is_a_very_very_very_very_very_very...` (잘림)
3. ✅ 파일 크기 표시: `186.46 KB`
4. ❌ **전송 버튼**: 화면에 보이지 않음 (오른쪽으로 밀려남)
5. ✅ 이모지 버튼 (😊): 보임
6. ✅ 사용자 아바타: 보임

### Expected Behavior
- 파일명이 길어도 전송 버튼은 항상 화면에 보여야 함
- 파일명은 적절히 잘리거나 줄바꿈되어야 함

## 🔍 Root Cause Analysis

### Current Implementation
파일 미리보기 영역이 `flex` 레이아웃을 사용하고 있으며, 파일명 텍스트가 `overflow: hidden`과 `text-overflow: ellipsis` 처리는 되어 있으나, 컨테이너 자체의 `max-width`가 설정되지 않아 화면을 벗어남.

### Affected Component
- **Location**: 채팅 입력 영역 (Message Input Area)
- **File**: 추정 위치 - `src/components/chat/` 또는 `src/app/(main)/chat/` 관련 컴포넌트

## 💡 Proposed Solutions

### Solution 1: Truncate Filename (권장)
```tsx
// 파일명 표시 부분에 max-width 제한 추가
<p className="truncate max-w-[200px] text-sm">
  {file.name}
</p>
```

### Solution 2: Wrap Filename
```tsx
// 파일명을 여러 줄로 표시 (단, 높이 제한 필요)
<p className="break-all line-clamp-2 text-sm">
  {file.name}
</p>
```

### Solution 3: Shorten Programmatically
```typescript
// 파일명을 프로그래밍적으로 축약
function shortenFilename(name: string, maxLength: number = 30): string {
  if (name.length <= maxLength) return name;
  const ext = name.split('.').pop();
  const nameWithoutExt = name.substring(0, name.lastIndexOf('.'));
  const shortened = nameWithoutExt.substring(0, maxLength - ext!.length - 4) + '...';
  return `${shortened}.${ext}`;
}

// 사용
<p className="text-sm">{shortenFilename(file.name)}</p>
```

### Solution 4: Container Max-Width (가장 간단)
```tsx
// 파일 프리뷰 컨테이너에 max-width 추가
<div className="flex items-center gap-2 max-w-[calc(100%-120px)]">
  {/* 파일 아이콘, 이름, 크기, 제거 버튼 */}
</div>
```

## 🔧 Recommended Fix

**Combination Approach** (Solution 1 + 4):
1. 파일 프리뷰 컨테이너에 `max-width` 설정
2. 파일명에 `truncate` + `max-w-*` 적용
3. `title` 속성으로 전체 파일명 툴팁 제공

```tsx
<div className="flex items-center gap-2 max-w-[calc(100%-100px)]">
  <span className="text-2xl">🖼️</span>
  <div className="flex-1 min-w-0">
    <p className="truncate text-sm" title={file.name}>
      {file.name}
    </p>
    <p className="text-xs text-muted-foreground">
      {formatFileSize(file.size)}
    </p>
  </div>
  <button onClick={removeFile}>×</button>
</div>
```

## 📋 Next Steps

1. ✅ Bug 확인 및 문서화 완료
2. ⏳ 관련 컴포넌트 파일 찾기
3. ⏳ 수정 구현
4. ⏳ 모바일 뷰포트에서 재테스트
5. ⏳ 다양한 파일명 길이로 테스트
6. ⏳ 데스크톱 뷰에서도 확인

## 🧪 Test Cases

### Edge Cases to Test
- ✅ Very long filename (151 chars) - Bug confirmed
- ⏳ Medium filename (50 chars)
- ⏳ Short filename (10 chars)
- ⏳ Filename with special characters
- ⏳ Filename with emoji
- ⏳ Multiple files with long names
- ⏳ Korean/Japanese/Chinese filenames

## 📝 Notes

- 이 버그는 모바일 사용자에게 치명적 (메시지 전송 불가)
- 데스크톱에서는 화면이 넓어 문제가 덜 심각할 수 있음
- iOS Safari, Android Chrome에서도 실제 테스트 필요
