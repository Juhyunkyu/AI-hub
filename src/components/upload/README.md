# 파일 업로드 컴포넌트 시스템

카카오톡 스타일의 재사용 가능한 파일 업로드 컴포넌트 시스템입니다.

## 📋 개요

이 시스템은 다음과 같은 컴포넌트들로 구성되어 있습니다:

- **ChatAttachmentMenu**: 메인 첨부 메뉴 (+ 버튼 클릭 시 나타나는 옵션들)
- **GalleryOption**: 갤러리에서 이미지 선택
- **CameraOption**: 카메라로 사진 촬영
- **FileOption**: 모든 파일 타입 선택
- **LocationOption**: 위치 정보 공유

## 🎯 주요 특징

### ✅ 완전한 재사용성
- 각 컴포넌트는 독립적으로 사용 가능
- 다른 프로젝트에서도 쉽게 재활용
- TypeScript로 완전한 타입 안정성 제공

### 📱 반응형 디자인
- **모바일**: Bottom Sheet UI (하단에서 슬라이드업)
- **데스크톱**: Popover UI (드롭다운 메뉴)
- 자동으로 화면 크기에 따라 UI 변경

### 🛡️ 강력한 검증
- 파일 크기 제한
- 파일 타입 검증
- 개수 제한
- 사용자 친화적 에러 메시지

### 🎨 현대적 UI
- shadcn/ui 기반
- Tailwind CSS 스타일링
- 접근성(a11y) 준수
- 일관된 디자인 시스템

## 🚀 빠른 시작

### 기본 사용법

```tsx
import { ChatAttachmentMenu } from "@/components/upload";

function ChatInput() {
  const handleFileSelect = (files: File[]) => {
    console.log("선택된 파일들:", files);
  };

  const handleLocationSelect = (location: LocationData) => {
    console.log("선택된 위치:", location);
  };

  return (
    <div className="flex items-center gap-2">
      <ChatAttachmentMenu
        onFileSelect={handleFileSelect}
        onLocationSelect={handleLocationSelect}
        onError={(error) => console.error(error)}
      />
      <input type="text" placeholder="메시지 입력..." />
      <button>전송</button>
    </div>
  );
}
```

### 개별 컴포넌트 사용

```tsx
import {
  GalleryOption,
  CameraOption,
  FileOption,
  LocationOption
} from "@/components/upload";

function CustomUploadForm() {
  return (
    <div className="space-y-4">
      {/* 갤러리만 필요한 경우 */}
      <GalleryOption
        onFileSelect={(files) => console.log(files)}
        multiple={true}
        maxFiles={5}
      />

      {/* 카메라만 필요한 경우 */}
      <CameraOption
        onFileSelect={(files) => console.log(files)}
        captureMode="environment" // 후면 카메라
      />

      {/* 문서 파일만 필요한 경우 */}
      <FileOption
        onFileSelect={(files) => console.log(files)}
        accept=".pdf,.doc,.docx"
        maxSize={50 * 1024 * 1024} // 50MB
      />

      {/* 위치 공유 */}
      <LocationOption
        onLocationSelect={(location) => console.log(location)}
      />
    </div>
  );
}
```

## 📖 컴포넌트 상세

### ChatAttachmentMenu

메인 첨부 메뉴 컴포넌트입니다.

```tsx
interface ChatAttachmentMenuProps {
  onFileSelect: (files: File[]) => void;
  onLocationSelect?: (location: LocationData) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  className?: string;
}
```

### GalleryOption

갤러리에서 이미지를 선택하는 컴포넌트입니다.

```tsx
interface GalleryOptionProps {
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  accept?: string; // 기본값: 'image/*'
  multiple?: boolean; // 기본값: true
  maxFiles?: number; // 기본값: 10
  maxSize?: number; // 기본값: 10MB
}
```

**변형 컴포넌트:**
- `SimpleGalleryButton`: 간단한 형태의 갤러리 버튼

### CameraOption

카메라로 사진을 촬영하는 컴포넌트입니다.

```tsx
interface CameraOptionProps {
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  captureMode?: 'user' | 'environment'; // 전면/후면 카메라
  accept?: string; // 기본값: 'image/*'
}
```

**변형 컴포넌트:**
- `SelfieCamera`: 전면 카메라용 (셀카)
- `BackCamera`: 후면 카메라용 (일반 촬영)

### FileOption

모든 파일 타입을 선택하는 컴포넌트입니다.

```tsx
interface FileOptionProps {
  onFileSelect: (files: File[]) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
  accept?: string; // 기본값: '*' (모든 파일)
  multiple?: boolean; // 기본값: true
  maxFiles?: number; // 기본값: 5
  maxSize?: number; // 기본값: 25MB
}
```

**변형 컴포넌트:**
- `DocumentFileOption`: 문서 파일 전용
- `AttachmentButton`: 간단한 첨부 버튼

### LocationOption

위치 정보를 공유하는 컴포넌트입니다.

```tsx
interface LocationOptionProps {
  onLocationSelect: (location: LocationData) => void;
  onError?: (error: string) => void;
  disabled?: boolean;
}

interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  mapUrl?: string;
}
```

**변형 컴포넌트:**
- `QuickLocationButton`: 다이얼로그 없이 바로 위치 공유

## 🔧 고급 설정

### 파일 타입 제한

```tsx
import { FileTypes } from "@/components/upload";

// 이미지만 허용
<GalleryOption accept={Object.keys(FileTypes.IMAGES).join(',')} />

// 문서만 허용
<FileOption accept={Object.keys(FileTypes.DOCUMENTS).join(',')} />

// 비디오만 허용
<FileOption accept={Object.keys(FileTypes.VIDEOS).join(',')} />
```

### 파일 크기 제한

```tsx
import { FILE_SIZE_LIMITS } from "@/components/upload";

<FileOption
  maxSize={FILE_SIZE_LIMITS.IMAGE} // 10MB
  maxFiles={3}
/>
```

### 커스텀 메뉴

```tsx
import { CustomAttachmentMenu } from "@/components/upload";

<CustomAttachmentMenu
  options={[
    {
      id: "gallery",
      label: "사진첩",
      icon: <Images className="w-4 h-4" />,
      onClick: () => console.log("갤러리 클릭"),
    },
    {
      id: "camera",
      label: "카메라",
      icon: <Camera className="w-4 h-4" />,
      onClick: () => console.log("카메라 클릭"),
    }
  ]}
/>
```

## 📱 모바일 지원

### HTML5 Input Attributes

모바일 기기에서 최적의 경험을 제공하기 위해 다음과 같은 HTML5 속성들을 사용합니다:

- `accept="image/*"`: 이미지 파일만 선택
- `capture="environment"`: 후면 카메라 실행
- `capture="user"`: 전면 카메라 실행
- `multiple`: 여러 파일 선택 가능

### 브라우저 호환성

- **iOS**: iOS 6+ 지원
- **Android**: Android 3.0+ 지원
- **Chrome**: HTTPS 환경에서만 geolocation 지원

## 🌍 위치 서비스

### 위치 권한

위치 공유 기능을 사용하려면 브라우저에서 위치 권한을 허용해야 합니다.

### Kakao Maps API (선택사항)

더 정확한 주소 정보를 위해 Kakao Maps API를 통합할 수 있습니다:

1. `.env.local`에 API 키 추가:
```
NEXT_PUBLIC_KAKAO_JS_KEY=your_api_key_here
```

2. `react-kakao-maps-sdk` 패키지 설치:
```bash
npm install react-kakao-maps-sdk
```

## 🛠️ 개발자 가이드

### 확장하기

새로운 업로드 옵션을 추가하려면:

1. `types.ts`에 새로운 Props 인터페이스 추가
2. 새 컴포넌트 파일 생성 (예: `video-option.tsx`)
3. `index.ts`에서 export
4. `ChatAttachmentMenu`에 통합

### 테스트

```tsx
import { render, screen, fireEvent } from "@testing-library/react";
import { GalleryOption } from "@/components/upload";

test("갤러리 옵션 클릭 시 파일 선택창 열림", () => {
  const handleFileSelect = jest.fn();
  render(<GalleryOption onFileSelect={handleFileSelect} />);

  const button = screen.getByLabelText("갤러리에서 이미지 선택");
  fireEvent.click(button);

  // 파일 input이 클릭되었는지 확인
});
```

## 🔍 문제 해결

### 일반적인 문제들

1. **파일이 선택되지 않음**
   - 브라우저 권한 확인
   - 파일 크기 제한 확인
   - accept 속성 확인

2. **카메라가 실행되지 않음**
   - HTTPS 환경인지 확인
   - 카메라 권한 허용 여부 확인
   - 모바일 기기에서 테스트

3. **위치 정보를 가져올 수 없음**
   - 위치 권한 허용 여부 확인
   - HTTPS 환경인지 확인
   - GPS가 활성화되어 있는지 확인

## 🔗 관련 링크

- [shadcn/ui 문서](https://ui.shadcn.com/)
- [Kakao Maps API](https://apis.map.kakao.com/)
- [HTML5 File API](https://developer.mozilla.org/en-US/docs/Web/API/File)
- [Geolocation API](https://developer.mozilla.org/en-US/docs/Web/API/Geolocation_API)

---

💡 **팁**: 이 컴포넌트들은 모두 독립적으로 사용할 수 있으므로, 프로젝트 요구사항에 맞게 필요한 것만 선택해서 사용하세요!