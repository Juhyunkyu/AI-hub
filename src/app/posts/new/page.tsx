"use client";

import { useEffect, useMemo, useRef, useState, lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { z } from "zod";
import { safeSlug } from "@/lib/slugify";
const TiptapEditor = dynamic(() => import("./Editor"), { ssr: false });
import {
  Bold,
  Italic,
  Strikethrough,
  Quote,
  AlignCenter,
  AlignLeft,
  AlignRight,
  Image as ImageIcon,
  Video,
  CheckSquare,
  Code2,
} from "lucide-react";

const POSTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_POSTS || "posts";

const PostSchema = z.object({
  title: z.string().min(1, "제목은 필수입니다"),
  contentHtml: z.string().optional(),
  categoryId: z.string().optional(),
  topicIds: z.array(z.string()).default([]),
  tagIds: z.array(z.string()).default([]),
});

export default function NewPostPage() {
  const [title, setTitle] = useState("");
  const editorHtmlRef = useRef<string>("");
  // 제거된 표 로직 잔여 ref 삭제
  const ImagePicker = useMemo(() => lazy(() => import("./image-picker")), []);
  const editorApiRef = useRef<{
    toggleBold: () => void;
    toggleItalic: () => void;
    toggleStrike: () => void;
    alignLeft: () => void;
    alignCenter: () => void;
    alignRight: () => void;
    insertCodeBlock: () => void;
    toggleBlockquote: () => void;
    toggleTaskList: () => void;
    insertHtml: (html: string) => void;
  } | null>(null);
  const imagePickerRef = useRef<{ open: () => void } | null>(null);
  const videoPickerRef = useRef<{ open: () => void } | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<{ id: string; name: string; slug: string }[]>([]);
  const [topics, setTopics] = useState<{ id: string; name: string; category_id?: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string }[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selTopics, setSelTopics] = useState<string[]>([]);
  const [selTags, setSelTags] = useState<string[]>([]);
  const [newTopicName, setNewTopicName] = useState("");
  const [newTagName, setNewTagName] = useState("");
  const [quoteOpen, setQuoteOpen] = useState(false);

  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  // If not signed in, redirect to login preserving next
  useEffect(() => {
    if (isLoading) return;
    if (user === null) {
      router.replace(`/login?next=${encodeURIComponent("/posts/new")}`);
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    async function load() {
      const [{ data: c1 }, { data: t1 }, { data: t2 }] = await Promise.all([
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        supabase.from("topics").select("id,name,category_id").order("name"),
        supabase.from("tags").select("id,name").order("name"),
      ]);
      setCategories(c1 ?? []);
      setTopics(t1 ?? []);
      setTags(t2 ?? []);
    }
    load();
  }, [supabase]);

  // 카테고리가 변경되면 해당 카테고리의 주제들만 필터링
  const filteredTopics = useMemo(() => {
    if (!selectedCategoryId) return topics;
    return topics.filter(topic => topic.category_id === selectedCategoryId);
  }, [topics, selectedCategoryId]);

  useEffect(() => {}, []);

  // exec/insertHtml는 TipTap 명령으로 대체됨
  const exec = (cmd: string) => {
    const api = editorApiRef.current;
    if (!api) return;
    if (cmd === "bold") return api.toggleBold();
    if (cmd === "italic") return api.toggleItalic();
    if (cmd === "strikeThrough") return api.toggleStrike();
    if (cmd === "justifyLeft") return api.alignLeft();
    if (cmd === "justifyCenter") return api.alignCenter();
    if (cmd === "justifyRight") return api.alignRight();
  };

  // 표 관련 잔여 코드 완전 제거(주석 포함)

  // (표 관련 로직 제거)

  const insertHtml = (html: string): Node | null => {
    editorApiRef.current?.insertHtml(html);
    return null;
  };

  async function compressImage(
    file: File,
    max = 1280,
    quality = 0.85
  ): Promise<Blob> {
    const img = document.createElement("img");
    const reader = new FileReader();
    const dataUrl: string = await new Promise<string>((res, rej) => {
      reader.onerror = () => rej(new Error("read error"));
      reader.onload = () => res(reader.result as string);
      reader.readAsDataURL(file);
    });
    await new Promise<void>((res) => {
      img.onload = () => res();
      img.src = dataUrl;
    });
    const canvas = document.createElement("canvas");
    const scale = Math.min(1, max / Math.max(img.width, img.height));
    canvas.width = Math.max(1, Math.round(img.width * scale));
    canvas.height = Math.max(1, Math.round(img.height * scale));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("canvas ctx");
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
    const mime = file.type.includes("png") ? "image/png" : "image/jpeg";
    return await new Promise((res) =>
      canvas.toBlob((b) => res(b as Blob), mime, quality)
    );
  }

  async function uploadImage(file: File): Promise<string | null> {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return null;
    }
    if (!/^image\//.test(file.type)) {
      toast.error("이미지 파일만 업로드할 수 있습니다");
      return null;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("이미지는 최대 10MB까지 지원합니다");
      return null;
    }
    try {
      const blob = await compressImage(file);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `${user.id}/posts/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(POSTS_BUCKET)
        .upload(path, blob, { upsert: true, contentType: blob.type });
      if (error) throw error;
      const { data } = supabase.storage.from(POSTS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "업로드 실패");
      toast.error(msg);
      return null;
    }
  }

  async function uploadVideo(file: File): Promise<string | null> {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return null;
    }
    if (!/^video\//.test(file.type)) {
      toast.error("동영상 파일만 업로드할 수 있습니다");
      return null;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error("동영상은 최대 50MB까지 지원합니다");
      return null;
    }
    try {
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `${user.id}/posts/video-${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from(POSTS_BUCKET)
        .upload(path, file, { upsert: true, contentType: file.type });
      if (error) throw error;
      const { data } = supabase.storage.from(POSTS_BUCKET).getPublicUrl(path);
      return data.publicUrl;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : String(err ?? "업로드 실패");
      toast.error(msg);
      return null;
    }
  }

  function handleDrag(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragover") setDragOver(true);
    if (e.type === "dragleave") setDragOver(false);
  }

  async function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
    const files = Array.from(e.dataTransfer.files ?? []);
    for (const f of files) {
      if (f.type.startsWith("image/")) {
        const url = await uploadImage(f);
        if (url) insertHtml(`<p><img src="${url}" alt="image" /></p>`);
      } else if (f.type.startsWith("video/")) {
        const url = await uploadVideo(f);
        if (url) insertHtml(`<p><video controls src="${url}"></video></p>`);
      }
    }
  }

  // TipTap 내부에서 paste 처리로 대체 예정. 외부 핸들러 제거.
  /* async function handlePaste(e: React.ClipboardEvent<HTMLDivElement>) {
    let pending = 0;
    const begin = () => {
      if (pending === 0) toast.info("업로드 시작", { id: "paste-upload" });
      pending += 1;
    };
    const done = () => {
      pending -= 1;
      if (pending <= 0) toast.success("업로드 완료", { id: "paste-upload" });
    };
    const items = Array.from(e.clipboardData.items ?? []);
    for (const it of items) {
      if (it.kind === "file") {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          begin();
          try {
            const url = file.type.startsWith("image/")
              ? await uploadImage(file)
              : file.type.startsWith("video/")
                ? await uploadVideo(file)
                : null;
            if (url) {
              insertHtml(
                file.type.startsWith("image/")
                  ? `<p><img src="${url}" alt="image" /></p>`
                  : `<p><video controls src="${url}"></video></p>`
              );
            }
          } finally {
            done();
          }
        }
      }
    }
  } */

  async function onPickImageFile(file: File) {
    const url = await uploadImage(file);
    if (url) insertHtml(`<p><img src="${url}" alt="image" /></p>`);
  }

  async function onPickVideoFile(file: File) {
    const url = await uploadVideo(file);
    if (url) insertHtml(`<p><video controls src="${url}"></video></p>`);
  }

  async function createTopic() {
    if (!newTopicName.trim()) return;
    if (!selectedCategoryId) {
      toast.error("카테고리를 먼저 선택해주세요");
      return;
    }
    try {
      const slug = safeSlug(newTopicName, "topic");
      const res = await fetch("/api/meta/topics", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          name: newTopicName, 
          slug,
          category_id: selectedCategoryId 
        }),
      });
      const j: unknown = await res.json().catch(() => null);
      const message =
        j && typeof j === "object" && j !== null && "message" in j
          ? (j as { message?: string }).message
          : undefined;
      if (!res.ok) {
        toast.error(message ?? "주제 추가 실패");
        return;
      }
      const data = j as { id: string; name: string; category_id: string };
      setTopics((prev) => [...prev, data]);
      setSelTopics((prev) => [...prev, data.id]);
      setNewTopicName("");
    } catch {
      toast.error("네트워크 오류");
    }
  }

  async function createTag() {
    if (!newTagName.trim()) return;
    try {
      const slug = safeSlug(newTagName, "tag");
      const res = await fetch("/api/meta/tags", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newTagName, slug }),
      });
      const j: unknown = await res.json().catch(() => null);
      const message =
        j && typeof j === "object" && j !== null && "message" in j
          ? (j as { message?: string }).message
          : undefined;
      if (!res.ok) {
        toast.error(message ?? "태그 추가 실패");
        return;
      }
      const data = j as { id: string; name: string };
      setTags((prev) => [...prev, data]);
      setSelTags((prev) => [...prev, data.id]);
      setNewTagName("");
    } catch {
      toast.error("네트워크 오류");
    }
  }

  // 인용문은 TipTap 명령으로 처리

  async function submit() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    const contentHtml = editorHtmlRef.current ?? "";
    const parsed = PostSchema.safeParse({
      title,
      contentHtml,
      categoryId: selectedCategoryId || undefined,
      topicIds: selTopics,
      tagIds: selTags,
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "유효성 오류");
      return;
    }

    setLoading(true);
    const { data, error } = await supabase
      .from("posts")
      .insert({ title, content: contentHtml, author_id: user.id })
      .select("id")
      .single();
    if (error) {
      setLoading(false);
      toast.error(error.message);
      return;
    }

    const postId = data!.id as string;

    if (selTopics.length) {
      const rows = selTopics.map((topic_id) => ({ post_id: postId, topic_id }));
      const { error: e1 } = await supabase.from("post_topics").insert(rows);
      if (e1) console.error(e1);
    }
    if (selTags.length) {
      const rows = selTags.map((tag_id) => ({ post_id: postId, tag_id }));
      const { error: e2 } = await supabase.from("post_tags").insert(rows);
      if (e2) console.error(e2);
    }

    setLoading(false);
    toast.success("게시 완료");
    router.push(`/posts/${postId}`);
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6 space-y-4">
      <h1 className="text-xl font-semibold">새 게시물</h1>
      <Input
        placeholder="제목"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <div className="space-y-2">
        <div className="flex flex-wrap gap-1">
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("bold");
            }}
            aria-label="굵게"
            title="굵게 (Ctrl+B)"
          >
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("italic");
            }}
            aria-label="기울임"
            title="기울임 (Ctrl+I)"
          >
            <Italic className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("strikeThrough");
            }}
            aria-label="취소선"
            title="취소선"
          >
            <Strikethrough className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              editorApiRef.current?.toggleBlockquote?.();
            }}
            aria-label="인용문"
            title="인용문"
          >
            <Quote className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              editorApiRef.current?.insertCodeBlock?.();
            }}
            aria-label="코드 블록"
            title="코드 블록"
          >
            <Code2 className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              editorApiRef.current?.toggleTaskList?.();
            }}
            aria-label="체크리스트"
            title="체크리스트"
          >
            <CheckSquare className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("justifyLeft");
            }}
            aria-label="왼쪽 정렬"
            title="왼쪽 정렬"
          >
            <AlignLeft className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("justifyCenter");
            }}
            aria-label="가운데 정렬"
            title="가운데 정렬"
          >
            <AlignCenter className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              exec("justifyRight");
            }}
            aria-label="오른쪽 정렬"
            title="오른쪽 정렬"
          >
            <AlignRight className="h-4 w-4" />
          </Button>
          <Suspense fallback={null}>
            <ImagePicker
              ref={imagePickerRef}
              accept="image/*"
              onPick={onPickImageFile}
            />
            <ImagePicker
              ref={videoPickerRef}
              accept="video/*"
              onPick={onPickVideoFile}
            />
          </Suspense>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              imagePickerRef.current?.open();
            }}
            aria-label="이미지 업로드"
            title="이미지 업로드"
          >
            <ImageIcon className="h-4 w-4" />
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="h-8"
            onMouseDown={(e) => {
              e.preventDefault();
              videoPickerRef.current?.open();
            }}
            aria-label="동영상 업로드"
            title="동영상 업로드"
          >
            <Video className="h-4 w-4" />
          </Button>
        </div>
        <div
          className={`rounded border p-3 bg-background ${dragOver ? "ring-2 ring-ring" : ""}`}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
        >
          <TiptapEditor
            onUpdate={(html) => (editorHtmlRef.current = html)}
            placeholder="내용을 입력하세요..."
            ref={editorApiRef}
            onUploadImage={uploadImage}
            onUploadVideo={uploadVideo}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="text-xs block mb-1">카테고리 선택</label>
          <select
            className="w-full rounded border p-2 bg-background"
            value={selectedCategoryId}
            onChange={(e) => {
              setSelectedCategoryId(e.target.value);
              setSelTopics([]); // 카테고리가 변경되면 선택된 주제 초기화
            }}
          >
            <option value="">카테고리를 선택하세요</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs block mb-1">주제 선택</label>
          <select
            multiple
            className="min-h-28 w-full rounded border p-2 bg-background"
            value={selTopics}
            onChange={(e) =>
              setSelTopics(
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
            disabled={!selectedCategoryId}
          >
            {filteredTopics.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="새 주제"
              value={newTopicName}
              onChange={(e) => setNewTopicName(e.target.value)}
              disabled={!selectedCategoryId}
            />
            <Button type="button" onClick={createTopic} disabled={!selectedCategoryId}>
              추가
            </Button>
          </div>
        </div>
        <div>
          <label className="text-xs block mb-1">태그 선택</label>
          <select
            multiple
            className="min-h-28 w-full rounded border p-2 bg-background"
            value={selTags}
            onChange={(e) =>
              setSelTags(
                Array.from(e.target.selectedOptions).map((o) => o.value)
              )
            }
          >
            {tags.map((t) => (
              <option key={t.id} value={t.id}>
                {t.name}
              </option>
            ))}
          </select>
          <div className="mt-2 flex gap-2">
            <Input
              placeholder="새 태그"
              value={newTagName}
              onChange={(e) => setNewTagName(e.target.value)}
            />
            <Button type="button" onClick={createTag}>
              추가
            </Button>
          </div>
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={submit} disabled={loading}>
          {loading ? "게시 중..." : "게시"}
        </Button>
      </div>
    </div>
  );
}
