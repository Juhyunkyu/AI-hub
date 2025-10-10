# 알려진 문제점 및 개선사항

**문서 업데이트**: 2025-10-04

---

## ✅ 최근 해결된 문제

### 1. 위치 공유 지도 렌더링 완성 (2025-10-01)

**문제:** 지도 영역만 생성되고 카카오맵 SDK 초기화 없음

**해결:**
```typescript
const LocationMessage = memo(({ message, locationData }) => {
  useEffect(() => {
    const kakaoAPI = await loadKakaoMaps();
    const map = new kakaoAPI.maps.Map(container, options);
    const marker = new kakaoAPI.maps.Marker({ position, map });
  }, [message.id, locationData]);
});
```

---

### 2. 이미지 펜 캔버스 크기 문제 (2025-10-02)

**문제:** 그린 위치와 전송 후 위치 불일치

**해결:**
```typescript
// 실제 렌더링 크기 측정
const handleImageLoad = () => {
  const width = imageRef.current.offsetWidth;
  const height = imageRef.current.offsetHeight;
  setCanvasSize({ width, height });
};

// 스케일 비율 적용
const scaleX = img.width / canvasSize.width;
const scaleY = img.height / canvasSize.height;
ctx.scale(scaleX, scaleY);
```

---

### 3. DOMPurify XSS 보안 강화 (2025-10-02)

**문제:** `dangerouslySetInnerHTML` 사용으로 XSS 취약점

**해결:**
- `src/lib/sanitize.ts` 중앙화
- 게시물: 리치 HTML 안전하게 허용
- 채팅: TEXT_ONLY 모드

---

### 4. 이미지 편집 툴바 Event Propagation (2025-10-03)

**문제:** 버튼 클릭 시 부모 핸들러로 이벤트 전파

**해결:**
```typescript
onClick={(e) => {
  e.stopPropagation();  // 모든 툴바 버튼에 추가
  onClick?.();
}}
```

---

### 5. 펜 툴바 "전체 지우기" 미작동 (2025-10-04)

**문제:** state는 초기화되나 캔버스 픽셀 남아있음

**해결:**
```typescript
const handleClearAllDrawing = () => {
  setLines([]);

  layers.forEach((layer) => {
    layer.destroyChildren();  // 노드 제거
    layer.clear();             // 픽셀 클리어 ← 핵심!
    layer.draw();              // 재렌더링
  });
};
```

---

## 🔴 높은 우선순위

### 6. 다중 파일 업로드 불완전

**현재 상태:**
```typescript
const handleFileSelect = (files: File[]) => {
  setSelectedFile(files[0]); // ⚠️ 첫 번째만 사용
};
```

**해결 방안:**
```typescript
const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

const handleFileSelect = (files: File[]) => {
  setSelectedFiles(prev => [...prev, ...files].slice(0, 5));
};

// 순차 전송
for (const file of selectedFiles) {
  await sendMessage(content, roomId, file);
}
```

---

## 🟡 중간 우선순위

### 7. 타이핑 인디케이터 최적화

**현재 문제:** 매 호출마다 API 요청

**해결 방안:**
```typescript
const debouncedUpdateTyping = debounce(updateTyping, 500);

// 3초 후 자동 정지
const stopTypingTimer = useRef<NodeJS.Timeout>();
const updateTyping = () => {
  debouncedUpdateTyping();

  clearTimeout(stopTypingTimer.current);
  stopTypingTimer.current = setTimeout(() => {
    stopTyping();
  }, 3000);
};
```

---

### 8. 이미지 로딩 최적화

**현재:**
```typescript
<ClickableImage unoptimized={true} />  // ⚠️ 최적화 비활성화
```

**개선 방안:**
```typescript
<ClickableImage
  unoptimized={false}
  loading="lazy"
  placeholder="blur"
  quality={85}
/>
```

---

### 9. 읽음 표시 UI 미흡

**현재:** DB에 `read_by` 배열 있으나 UI 없음

**추가 권장:**
```typescript
{isOwnMessage && (
  <div className="text-xs text-muted-foreground">
    {(() => {
      const unreadCount = participants.length - message.read_by.length - 1;
      if (unreadCount === 0) return "읽음";
      return `${unreadCount}`;
    })()}
  </div>
)}
```

---

## 🟢 낮은 우선순위

### 10. 메시지 검색 기능
- 현재 게시물만 검색 가능
- 채팅 메시지 검색 필요

### 11. 메시지 편집/삭제 UI
- DB 로직 있음
- 사용자 인터페이스 미구현

### 12. 음성 메시지 지원
- 녹음 기능
- 오디오 플레이어

---

[← 데이터베이스](DATABASE.md) | [개발 가이드 →](DEVELOPMENT.md)
