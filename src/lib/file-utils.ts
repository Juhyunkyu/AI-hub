/**
 * 파일 업로드 및 이미지 압축 유틸리티
 * posts/new 페이지에서 추출한 재사용 가능한 함수들
 */

import { createSupabaseBrowserClient } from "@/lib/supabase/client";

/**
 * 이미지 압축 함수
 * @param file 원본 이미지 파일
 * @param maxSize 최대 크기 (기본값: 1280px)
 * @param quality 압축 품질 (기본값: 0.85)
 * @returns 압축된 이미지 Blob
 */
export async function compressImage(
  file: File,
  maxSize = 1280,
  quality = 0.85
): Promise<Blob> {
  const img = document.createElement("img");
  const reader = new FileReader();

  const load = new Promise<string>((resolve, reject) => {
    reader.onerror = () => reject(new Error("read error"));
    reader.onload = () => resolve(reader.result as string);
  });

  reader.readAsDataURL(file);
  const dataUrl = await load;

  await new Promise<void>((res) => {
    img.onload = () => res();
    img.src = dataUrl;
  });

  const canvas = document.createElement("canvas");
  const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
  canvas.width = Math.max(1, Math.round(img.width * scale));
  canvas.height = Math.max(1, Math.round(img.height * scale));

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("canvas ctx");

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const type = file.type.includes("png") ? "image/png" : "image/jpeg";

  const blob: Blob = await new Promise((resolve) =>
    canvas.toBlob((b) => resolve(b as Blob), type, quality)
  );

  return blob;
}

/**
 * Supabase 스토리지에 이미지 업로드
 * @param file 이미지 파일
 * @param userId 사용자 ID
 * @param bucket 버킷 이름 (기본값: "posts")
 * @returns 업로드된 이미지의 공개 URL
 */
export async function uploadImageToSupabase(
  file: File,
  userId: string,
  bucket = "posts"
): Promise<string> {
  const supabase = createSupabaseBrowserClient();

  // 파일 압축
  const blob = await compressImage(file);
  const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
  const path = `posts/images/${userId}/${Date.now()}.${ext}`;

  // Supabase Storage에 업로드
  const { error: upErr } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      upsert: true,
      contentType: blob.type,
      cacheControl: "3600",
    });

  if (upErr) throw upErr;

  // 공개 URL 가져오기
  const { data: urlData } = supabase.storage
    .from(bucket)
    .getPublicUrl(path);

  return urlData.publicUrl;
}

/**
 * 비디오 업로드 (진행률 콜백 포함)
 * @param file 비디오 파일
 * @param userId 사용자 ID
 * @param onProgress 진행률 콜백 함수
 * @param bucket 버킷 이름 (기본값: "posts")
 * @returns 업로드된 비디오의 공개 URL과 취소 함수
 */
export async function uploadVideoToSupabase(
  file: File,
  userId: string,
  onProgress?: (progress: number) => void,
  bucket = "posts"
): Promise<{ url: string; cancel: () => void }> {
  const supabase = createSupabaseBrowserClient();
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  if (!SUPABASE_URL) throw new Error("SUPABASE_URL 미설정");

  const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
  const path = `posts/videos/${userId}/${Date.now()}.${ext}`;
  const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(bucket)}/${path}`;

  const { data: sess } = await supabase.auth.getSession();
  const accessToken = sess.session?.access_token;
  if (!accessToken) throw new Error("인증 토큰 없음");

  const xhr = new XMLHttpRequest();

  const cancel = () => {
    xhr.abort();
  };

  const url = await new Promise<string>((resolve, reject) => {
    xhr.open("POST", endpoint, true);
    xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
    xhr.setRequestHeader("x-upsert", "true");
    xhr.setRequestHeader("cache-control", "3600");
    xhr.setRequestHeader("content-type", file.type);

    xhr.upload.onprogress = (ev) => {
      if (ev.lengthComputable && onProgress) {
        const percent = Math.min(100, Math.round((ev.loaded / ev.total) * 100));
        onProgress(percent);
      }
    };

    xhr.onerror = () => reject(new Error("업로드 네트워크 오류"));
    xhr.onabort = () => reject(new Error("업로드가 취소되었습니다"));
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        const { data: urlData } = supabase.storage
          .from(bucket)
          .getPublicUrl(path);
        resolve(urlData.publicUrl);
      } else {
        reject(new Error(`업로드 실패(${xhr.status})`));
      }
    };

    xhr.send(file);
  });

  return { url, cancel };
}

/**
 * 이미지 HTML 생성 (에디터 삽입용)
 */
export function createImageHtml(url: string, alt = ""): string {
  return `<figure class="my-2"><img loading="lazy" class="max-w-full h-auto rounded border border-border" src="${url}" alt="${alt}" /><figcaption class="text-xs text-muted-foreground">이미지 설명</figcaption></figure>`;
}

/**
 * 비디오 HTML 생성 (에디터 삽입용)
 */
export function createVideoHtml(url: string): string {
  return `<figure class="my-2"><video class="max-w-full h-auto rounded" controls src="${url}"></video><figcaption class="text-xs text-muted-foreground">동영상 설명</figcaption></figure>`;
}

/**
 * 파일 크기 유효성 검사
 */
export function validateFileSize(file: File, maxSize: number): boolean {
  return file.size <= maxSize;
}

/**
 * 파일 타입 유효성 검사
 */
export function validateFileType(file: File, allowedTypes: string[]): boolean {
  return allowedTypes.some(type => file.type.startsWith(type));
}

/**
 * 이미지 파일 유효성 검사
 */
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  if (!validateFileType(file, ["image/"])) {
    return { valid: false, error: "이미지 파일만 업로드할 수 있습니다" };
  }

  if (!validateFileSize(file, 10 * 1024 * 1024)) {
    return { valid: false, error: "이미지는 최대 10MB까지 지원합니다" };
  }

  return { valid: true };
}

/**
 * 비디오 파일 유효성 검사
 */
export function validateVideoFile(file: File): { valid: boolean; error?: string } {
  if (!validateFileType(file, ["video/"])) {
    return { valid: false, error: "동영상 파일만 업로드할 수 있습니다" };
  }

  if (!validateFileSize(file, 200 * 1024 * 1024)) {
    return { valid: false, error: "동영상은 최대 200MB까지 지원합니다" };
  }

  return { valid: true };
}