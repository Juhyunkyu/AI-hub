"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
// dynamic import 제거됨
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { useAuthStore } from "@/stores/auth";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Hash,
  Bold,
  Italic,
  Strikethrough,
  List,
  Image as ImageIcon,
  Video as VideoIcon,
  Link2,
  Code2,
  Loader2,
  Home,
  ChevronRight,
  ChevronLeft,
  Calendar,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
// 임시: 에디터 제거 상태. 후속 PRD 에디터 반영 예정.


type Category = { id: string; name: string; slug: string };
type Topic = { id: string; name: string; category_id: string };

export default function NewPostPage() {
  const router = useRouter();
  const params = useSearchParams();
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);
  const user = useAuthStore((s) => s.user);
  const isLoading = useAuthStore((s) => s.isLoading);
  const editIdParam = params?.get("edit");
  const categorySlugParam = params?.get("category") || null;
  const isNoticeMode = useMemo(() => {
    const t = params?.get("tag") || "";
    return t.includes("공지");
  }, [params]);

  const [title, setTitle] = useState("");
  const editorHtmlRef = useRef<string>("");
  const editorRef = useRef<HTMLDivElement | null>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [loading, setLoading] = useState(false);

  // 업로드 입력
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const videoInputRef = useRef<HTMLInputElement | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingVideo, setIsUploadingVideo] = useState(false);
  const [videoUploadProgress, setVideoUploadProgress] = useState<number>(0);
  const videoXhrRef = useRef<XMLHttpRequest | null>(null);


  const [categories, setCategories] = useState<Category[]>([]);
  // 주제 목록(향후 수동 선택 UI 추가 예정). 현재는 기본 주제 자동 매핑만 사용
  const [, setTopics] = useState<Topic[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState("");
  const [tags, setTags] = useState<string[]>([]);
  const [allowComments, setAllowComments] = useState<boolean>(true);
  const [showInRecent, setShowInRecent] = useState<boolean>(true);
  // 수정 모드에서 응답의 공지 여부를 반영하기 위한 상태
  const [editNotice, setEditNotice] = useState<boolean>(false);
  const [isAnonymous, setIsAnonymous] = useState<boolean>(false);
  const activeNoticeMode = isNoticeMode || editNotice;
  // 수정 모드 초기 로딩 중에는 공지/일반 판단 전까지 UI 깜빡임 방지
  const [uiReady, setUiReady] = useState<boolean>(!Boolean(editIdParam));
  // 관리자 핀 UI 상태
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [isPinned, setIsPinned] = useState<boolean>(false);
  const [pinScope, setPinScope] = useState<"global" | "category">("global");
  const [pinnedUntil, setPinnedUntil] = useState<string>("");
  const [pinPriority, setPinPriority] = useState<number>(0);
  const [expiryOpen, setExpiryOpen] = useState<boolean>(false);
  const [expiryView, setExpiryView] = useState<Date>(() => new Date());
  const [holidayDatesByYear, setHolidayDatesByYear] = useState<
    Record<number, Set<string>>
  >({});

  function parsePinnedUntilToDate(
    value: string | null | undefined
  ): Date | null {
    if (!value) return null;
    const d = new Date(value);
    if (!isNaN(d.getTime())) return d;
    return null;
  }

  function formatDisplayDate(d: Date | null): string {
    if (!d) return "설정 안 함";
    return new Intl.DateTimeFormat("ko-KR", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(d);
  }

  function toLocalDateTimeString(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    const hh = String(d.getHours()).padStart(2, "0");
    const mm = String(d.getMinutes()).padStart(2, "0");
    return `${y}-${m}-${day}T${hh}:${mm}`;
  }

  function toLocalDateKey(d: Date): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  const ensureHolidaysForYear = useCallback(
    async (year: number): Promise<void> => {
      if (holidayDatesByYear[year]) return;
      try {
        const res = await fetch(
          `https://date.nager.at/api/v3/PublicHolidays/${year}/KR`,
          { cache: "force-cache" }
        );
        if (!res.ok) throw new Error("holiday fetch failed");
        const items = (await res.json()) as Array<{
          date: string;
          types?: string[];
          name?: string;
        }>;
        const setDates = new Set<string>();
        for (const it of items) {
          // Treat all returned public holidays as holidays; include substitute holidays
          const isPublic = Array.isArray(it.types)
            ? it.types.includes("Public")
            : true;
          if (!isPublic) continue;
          setDates.add(it.date);
        }
        setHolidayDatesByYear((prev) => ({ ...prev, [year]: setDates }));
      } catch {
        // ignore failures; holiday highlighting will be skipped
      }
    },
    [holidayDatesByYear]
  );

  const expirySelectedDate = useMemo<Date | null>(() => {
    return parsePinnedUntilToDate(pinnedUntil) ?? null;
  }, [pinnedUntil]);

  useEffect(() => {
    if (expiryOpen) {
      setExpiryView(expirySelectedDate || new Date());
    }
  }, [expiryOpen, expirySelectedDate]);

  useEffect(() => {
    if (!expiryOpen) return;
    const year = expiryView.getFullYear();
    void ensureHolidaysForYear(year);
    // Also prefetch adjacent years when viewing Dec/Jan navigation
    if (expiryView.getMonth() === 11) void ensureHolidaysForYear(year + 1);
    if (expiryView.getMonth() === 0) void ensureHolidaysForYear(year - 1);
  }, [expiryOpen, expiryView, ensureHolidaysForYear]);





  useEffect(() => {
    if (isLoading) return;
    if (user === null) {
      router.replace(`/login?next=${encodeURIComponent("/posts/new")}`);
    }
  }, [isLoading, user, router]);

  // 에디터 마운트 시 초기 선택 저장 (본문 시작)
  useEffect(() => {
    const root = editorRef.current;
    if (root) {
      const r = document.createRange();
      r.selectNodeContents(root);
      r.collapse(false);
      const s = window.getSelection();
      s?.removeAllRanges();
      s?.addRange(r);
      savedRangeRef.current = r.cloneRange();
    }
  }, []);


  useEffect(() => {
    async function load() {
      const [{ data: c1 }, { data: t1 }] = await Promise.all([
        supabase.from("categories").select("id,name,slug").order("sort_order"),
        supabase.from("topics").select("id,name,category_id").order("name"),
      ]);
      setCategories(c1 ?? []);
      setTopics((t1 ?? []) as Topic[]);

      // URL 기본 카테고리/편집 모드 처리
      const qCat = params?.get("category");
      if (qCat && Array.isArray(c1) && c1.length) {
        const found = c1.find((c) => c.slug === qCat);
        if (found) setSelectedCategoryId(found.id);
      }

      // 공지 모드: 기본 카테고리 자동 선택 + 태그 사용 안 함
      if (isNoticeMode && Array.isArray(c1) && c1.length) {
        const fallbackSlug =
          process.env.NEXT_PUBLIC_NOTICE_DEFAULT_CATEGORY_SLUG || "free";
        const found = c1.find((c) => c.slug === fallbackSlug) || c1[0]!;
        if (found) setSelectedCategoryId(found.id);
        setTags([]);
      }

      const editId = params?.get("edit");
      if (editId) {
        // 편집 모드: 기존 글 불러오기
        const res = await fetch(`/api/posts/${editId}`);
        const j = await res.json().catch(() => null);
        if (res.ok && j?.post) {
          setTitle(j.post.title || "");
          if (editorRef.current) {
            editorRef.current.innerHTML = j.post.content || "";
          }
          editorHtmlRef.current = j.post.content || "";
          // 프리필: 카테고리, 토픽, 태그
          if (j.categoryId && Array.isArray(c1)) {
            const found = c1.find((c) => c.id === j.categoryId);
            if (found) setSelectedCategoryId(found.id);
          }
          if (Array.isArray(j.topicIds)) {
            setSelectedTopicIds(j.topicIds);
          }
          if (Array.isArray(j.tags)) {
            setTags(j.tags);
          }
          // 공지 여부 및 옵션값 프리필
          if (typeof j.post.is_notice === "boolean") {
            setEditNotice(Boolean(j.post.is_notice));
          }
          if (typeof j.post.anonymous === "boolean") {
            setIsAnonymous(Boolean(j.post.anonymous));
          }
          if (typeof j.post.allow_comments === "boolean") {
            setAllowComments(Boolean(j.post.allow_comments));
          }
          if (typeof j.post.show_in_recent === "boolean") {
            setShowInRecent(Boolean(j.post.show_in_recent));
          }
          // 핀 프리필
          if (typeof j.post.pin_scope === "string") {
            setIsPinned(true);
            setPinScope(
              j.post.pin_scope === "category" ? "category" : "global"
            );
          }
          if (typeof j.post.pin_priority === "number") {
            setPinPriority(j.post.pin_priority);
          }
          if (typeof j.post.pinned_until === "string") {
            setPinnedUntil(j.post.pinned_until);
          }
        } else {
          toast.error(j?.error ?? "게시글 정보를 불러오지 못했습니다");
        }
        setUiReady(true);
      }

      // 관리자 여부 확인 (클라이언트 측 표시 제어용, 서버에서 최종 검증됨)
      try {
        const r = await fetch("/api/auth/is-admin", { cache: "no-store" });
        const j = await r.json();
        setIsAdmin(Boolean(j?.isAdmin));
      } catch {
        setIsAdmin(false);
      }
    }
    load();
  }, [supabase, params, isNoticeMode]);

  // 주제 선택 UI는 후속 개선 때 추가 예정 (현재는 자동 기본 주제로 매핑)

  const addTag = () => {
    const v = tagInput.trim();
    if (!v) return;
    if (tags.includes(v)) {
      setTagInput("");
      return;
    }
    setTags((prev) => [...prev, v]);
    setTagInput("");
  };

  const removeTag = (t: string) => {
    setTags((prev) => prev.filter((x) => x !== t));
  };

  async function submit() {
    if (!user) {
      toast.error("로그인이 필요합니다");
      return;
    }
    if (!title.trim()) {
      toast.error("제목을 입력해주세요");
      return;
    }
    if (!selectedCategoryId) {
      if (!activeNoticeMode) {
        toast.error("카테고리를 선택해주세요");
        return;
      }
    }

    setLoading(true);
    const contentHtml = editorHtmlRef.current ?? "";

    const editId = params?.get("edit");
    let res: Response;
    if (editId) {
      // 수정 요청
      res = await fetch(`/api/posts/${editId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: contentHtml,
          tags: activeNoticeMode || isAnonymous ? [] : tags,
          isNotice: activeNoticeMode,
          isAnonymous,
          allowComments,
          showInRecent: (activeNoticeMode || isAnonymous) ? showInRecent : true,
          // pin fields (관리자만 처리됨 - 서버에서 권한 검증)
          pinned: isPinned,
          pinScope,
          pinnedUntil,
          pinPriority,
          pinnedCategoryId:
            pinScope === "category"
              ? selectedCategoryId || undefined
              : undefined,
        }),
      });
    } else {
      // 신규 작성
      res = await fetch("/api/posts/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          content: contentHtml,
          categoryId: selectedCategoryId,
          topicIds: selectedTopicIds,
          tags: activeNoticeMode || isAnonymous ? [] : tags,
          isNotice: activeNoticeMode,
          isAnonymous,
          allowComments,
          showInRecent: (activeNoticeMode || isAnonymous) ? showInRecent : true,
          // pin fields (관리자만 처리됨 - 서버에서 권한 검증)
          pinned: isPinned,
          pinScope,
          pinnedUntil,
          pinPriority,
          pinnedCategoryId:
            pinScope === "category"
              ? selectedCategoryId || undefined
              : undefined,
        }),
      });
    }
    const j = await res.json().catch(() => null);
    if (!res.ok) {
      setLoading(false);
      const msg = j?.error ?? (editId ? "수정 실패" : "게시 실패");
      toast.error(msg);
      return;
    }

    const postId = editId ? editId : (j?.id as string);
    setLoading(false);
    toast.success(editId ? "수정 완료" : "게시 완료");
    router.push(`/posts/${postId}`);
  }

  // ----- 에디터 유틸 -----
  const POSTS_BUCKET = process.env.NEXT_PUBLIC_SUPABASE_BUCKET_POSTS || "posts";
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";

  function focusEditor() {
    if (editorRef.current) {
      editorRef.current.focus();
    }
  }

  function isRangeInsideEditor(range: Range | null): boolean {
    const root = editorRef.current;
    if (!root || !range) return false;
    return root.contains(range.commonAncestorContainer);
  }

  const saveCurrentSelection = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!isRangeInsideEditor(r)) return;
    // clone to avoid live range issues
    savedRangeRef.current = r.cloneRange();
  }, []);

  function restoreSavedSelection() {
    const r = savedRangeRef.current;
    if (!isRangeInsideEditor(r)) return false;
    const s = window.getSelection();
    s?.removeAllRanges();
    if (r) s?.addRange(r);
    return true;
  }

  // 선택 영역 저장: 편집 영역에서 커서 이동/입력 시 마지막 위치 저장
  useEffect(() => {
    const handler = () => saveCurrentSelection();
    document.addEventListener("mouseup", handler);
    document.addEventListener("keyup", handler);
    document.addEventListener("selectionchange", handler);
    return () => {
      document.removeEventListener("mouseup", handler);
      document.removeEventListener("keyup", handler);
      document.removeEventListener("selectionchange", handler);
    };
  }, [saveCurrentSelection]);

  // robust: capture clicks on remove button inside editor and prevent default/propagation so it doesn't act like text
  useEffect(() => {
    const root = editorRef.current;
    if (!root) return;
    const onMouseDown = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.getAttribute &&
        target.getAttribute("data-action") === "remove-figure"
      ) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const onClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        target.getAttribute &&
        target.getAttribute("data-action") === "remove-figure"
      ) {
        e.preventDefault();
        e.stopPropagation();
        const fig = target.closest("figure");
        if (fig && root.contains(fig)) {
          const next = fig.nextSibling;
          fig.remove();
          const r = document.createRange();
          if (next && root.contains(next)) {
            r.setStartBefore(next);
          } else if (root.lastChild) {
            r.selectNodeContents(root.lastChild as Node);
            r.collapse(false);
          } else {
            r.selectNodeContents(root);
            r.collapse(false);
          }
          const s = window.getSelection();
          s?.removeAllRanges();
          s?.addRange(r);
          const htmlNow = editorRef.current?.innerHTML || "";
          editorHtmlRef.current = sanitizeHtml(htmlNow);
        }
      }
    };
    root.addEventListener("mousedown", onMouseDown, true);
    root.addEventListener("click", onClick, true);
    return () => {
      root.removeEventListener("mousedown", onMouseDown, true);
      root.removeEventListener("click", onClick, true);
    };
  }, []);

  function sanitizeHtml(html: string): string {
    // 매우 보수적인 간단한 sanitize (DOMPurify 미사용)
    // 허용 태그와 속성만 통과
    const parser = new DOMParser();
    const doc = parser.parseFromString(`<div>${html}</div>`, "text/html");
    const allowedTags = new Set([
      "DIV",
      "P",
      "BR",
      "STRONG",
      "EM",
      "S",
      "UL",
      "LI",
      "A",
      "IMG",
      "VIDEO",
      "FIGURE",
      "FIGCAPTION",
      "PRE",
      "CODE",
      "SPAN",
      "BUTTON",
    ]);
    const allowedAttrs: Record<string, Set<string>> = {
      A: new Set(["href", "target", "rel"]),
      IMG: new Set(["src", "alt"]),
      VIDEO: new Set(["src", "controls"]),
      DIV: new Set([
        "data-placeholder",
        "class",
        "style",
      ]),
      FIGCAPTION: new Set(["class"]),
      BUTTON: new Set(["type", "data-action", "class", "contenteditable"]),
      SPAN: new Set([]),
      P: new Set([]),
      UL: new Set([]),
      LI: new Set([]),
      STRONG: new Set([]),
      EM: new Set([]),
      S: new Set([]),
      FIGURE: new Set([]),
      PRE: new Set([]),
      CODE: new Set([]),
      BR: new Set([]),
    };
    function traverse(node: Element | ChildNode): void {
      if (node.nodeType === Node.ELEMENT_NODE) {
        const el = node as HTMLElement;
        const tag = el.tagName.toUpperCase();
        if (!allowedTags.has(tag)) {
          el.replaceWith(...Array.from(el.childNodes));
          return;
        }
        // strip attributes
        const allowed =
          allowedAttrs[tag as keyof typeof allowedAttrs] || new Set<string>();
        Array.from(el.attributes).forEach((attr) => {
          if (!allowed.has(attr.name.toLowerCase())) {
            el.removeAttribute(attr.name);
          }
          if (attr.name.toLowerCase() === "href") {
            try {
              const url = new URL(el.getAttribute("href") || "");
              // no javascript: protocol
              if (url.protocol !== "http:" && url.protocol !== "https:") {
                el.removeAttribute("href");
              }
            } catch {
              el.removeAttribute("href");
            }
          }
        });
      }
      Array.from((node as Element).childNodes).forEach(traverse);
    }
    Array.from(doc.body.firstElementChild?.childNodes || []).forEach(traverse);
    return (doc.body.firstElementChild as HTMLElement)?.innerHTML || "";
  }

  const updateEditorHtmlRef = useCallback(() => {
    const html = editorRef.current?.innerHTML || "";
    editorHtmlRef.current = sanitizeHtml(html);
  }, []);

  function applyCommand(cmd: string) {
    focusEditor();
    if (cmd === "insertUnorderedList") {
      const sel = window.getSelection();
      if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
        insertHtmlAtCursor(`<ul><li></li></ul>`);
        const lastLi = editorRef.current?.querySelector("li:last-child");
        if (lastLi) {
          const r = document.createRange();
          r.selectNodeContents(lastLi);
          r.collapse(false);
          sel?.removeAllRanges();
          sel?.addRange(r);
        }
        updateEditorHtmlRef();
        return;
      }
    }
    document.execCommand(cmd, false);
    updateEditorHtmlRef();
  }

  function wrapSelectionWithHtml(before: string, after: string) {
    focusEditor();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const range = sel.getRangeAt(0);
    const selectedText = range.toString();
    const el = document.createElement("span");
    el.innerHTML = `${before}${selectedText || ""}${after}`;
    const frag = document.createDocumentFragment();
    while (el.firstChild) frag.appendChild(el.firstChild);
    range.deleteContents();
    range.insertNode(frag);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    updateEditorHtmlRef();
  }

  function insertHtmlAtCursor(html: string) {
    focusEditor();
    const root = editorRef.current;
    const sel = window.getSelection();
    let useAppend = true;
    let range: Range | null = null;
    // 우선 저장된 선택 영역을 복원 시도
    if (restoreSavedSelection()) {
      const s2 = window.getSelection();
      if (s2 && s2.rangeCount > 0) {
        const r2 = s2.getRangeAt(0);
        if (root && r2 && root.contains(r2.commonAncestorContainer)) {
          useAppend = false;
          range = r2;
        }
      }
    } else if (sel && sel.rangeCount > 0) {
      const r = sel.getRangeAt(0);
      if (root && r && root.contains(r.commonAncestorContainer)) {
        useAppend = false;
        range = r;
      }
    }
    if (!root) {
      updateEditorHtmlRef();
      return;
    }
    if (useAppend) {
      root.innerHTML += html;
      // 커서를 본문 끝으로 이동
      const r = document.createRange();
      r.selectNodeContents(root);
      r.collapse(false);
      const s = window.getSelection();
      if (s) {
        s.removeAllRanges();
        s.addRange(r);
      }
      updateEditorHtmlRef();
      return;
    }
    // 에디터 내부 선택 영역에 삽입
    if (!range) {
      updateEditorHtmlRef();
      return;
    }
    range.deleteContents();
    const el = document.createElement("div");
    el.innerHTML = html;
    const frag = document.createDocumentFragment();
    let node: ChildNode | null;
    let lastNode: ChildNode | null = null;
    while ((node = el.firstChild)) {
      lastNode = frag.appendChild(node);
    }
    range.insertNode(frag);
    if (lastNode) {
      range.setStartAfter(lastNode);
      range.collapse(true);
      const s = window.getSelection();
      if (s) {
        s.removeAllRanges();
        s.addRange(range);
      }
    }
    updateEditorHtmlRef();
  }

  function getClosestElement(
    node: Node | null,
    tagName: string
  ): HTMLElement | null {
    const target = tagName.toUpperCase();
    let cur: Node | null = node;
    while (cur) {
      if (cur.nodeType === 1) {
        const el = cur as HTMLElement;
        if (el.tagName.toUpperCase() === target) return el;
      }
      cur = (cur as HTMLElement).parentNode as Node | null;
    }
    return null;
  }

  function isListItemEmpty(li: HTMLElement): boolean {
    // 이미지/비디오는 비어있지 않다고 간주
    if (li.querySelector("img,video,figure")) return false;
    const text = (li.textContent || "").replace(/\u200B/g, "").trim();
    // 빈 텍스트이거나 <br>만 있는 경우 비어있다고 판단
    const onlyBr =
      li.children.length === 1 && li.children[0].tagName.toUpperCase() === "BR";
    return text.length === 0 || onlyBr;
  }

  function exitListFromListItem(li: HTMLElement) {
    const list = li.closest("ul,ol") as HTMLElement | null;
    if (!list) return;
    const p = document.createElement("p");
    p.appendChild(document.createElement("br"));
    list.insertAdjacentElement("afterend", p);
    // 마지막 빈 li 자동 제거 및 빈 리스트 정리
    if (isListItemEmpty(li)) {
      li.remove();
      const remaining = list.querySelectorAll("li").length;
      if (remaining === 0) {
        list.remove();
      }
    }
    const r = document.createRange();
    r.setStart(p, 0);
    r.collapse(true);
    const s = window.getSelection();
    s?.removeAllRanges();
    s?.addRange(r);
    updateEditorHtmlRef();
  }

  // 이미지 압축 (간단 버전)
  async function compressImage(
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

  async function handleSelectImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("로그인이 필요합니다");
    if (!/^image\//.test(file.type))
      return toast.error("이미지 파일만 업로드할 수 있습니다");
    if (file.size > 10 * 1024 * 1024)
      return toast.error("이미지는 최대 10MB까지 지원합니다");
    setIsUploadingImage(true);
    try {
      const blob = await compressImage(file);
      const ext = (file.name.split(".").pop() || "jpg").toLowerCase();
      const path = `posts/images/${user.id}/${Date.now()}.${ext}`;
      const { error: upErr } = await supabase.storage
        .from(POSTS_BUCKET)
        .upload(path, blob, {
          upsert: true,
          contentType: blob.type,
          cacheControl: "3600",
        });
      if (upErr) throw upErr;
      const { data: urlData } = supabase.storage
        .from(POSTS_BUCKET)
        .getPublicUrl(path);
      const url = urlData.publicUrl;
      insertHtmlAtCursor(
        `<figure class=\"my-2\"><img loading=\"lazy\" class=\"max-w-full h-auto rounded border border-border\" src=\"${url}\" alt=\"\" /><figcaption class=\"text-xs text-muted-foreground\">이미지 설명</figcaption></figure>`
      );
      toast.success("이미지가 본문에 삽입되었습니다");
    } catch (err: unknown) {
      console.error(err);
      toast.error((err as Error)?.message ?? "이미지 업로드 실패");
    } finally {
      setIsUploadingImage(false);
      if (imageInputRef.current) imageInputRef.current.value = "";
    }
  }

  async function handleSelectVideo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!user) return toast.error("로그인이 필요합니다");
    if (!/^video\//.test(file.type))
      return toast.error("동영상 파일만 업로드할 수 있습니다");
    if (file.size > 200 * 1024 * 1024)
      return toast.error("동영상은 최대 200MB까지 지원합니다");
    setIsUploadingVideo(true);
    setVideoUploadProgress(0);
    toast("동영상 압축이 백그라운드에서 진행 중입니다…");
    try {
      if (!SUPABASE_URL) throw new Error("SUPABASE_URL 미설정");
      const ext = (file.name.split(".").pop() || "mp4").toLowerCase();
      const path = `posts/videos/${user.id}/${Date.now()}.${ext}`;
      const endpoint = `${SUPABASE_URL.replace(/\/$/, "")}/storage/v1/object/${encodeURIComponent(POSTS_BUCKET)}/${path}`;
      const { data: sess } = await supabase.auth.getSession();
      const accessToken = sess.session?.access_token;
      if (!accessToken) throw new Error("인증 토큰 없음");

      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        videoXhrRef.current = xhr;
        xhr.open("POST", endpoint, true);
        xhr.setRequestHeader("Authorization", `Bearer ${accessToken}`);
        xhr.setRequestHeader("x-upsert", "true");
        xhr.setRequestHeader("cache-control", "3600");
        xhr.setRequestHeader("content-type", file.type);
        xhr.upload.onprogress = (ev) => {
          if (ev.lengthComputable) {
            const percent = Math.min(
              100,
              Math.round((ev.loaded / ev.total) * 100)
            );
            setVideoUploadProgress(percent);
          }
        };
        xhr.onerror = () => reject(new Error("업로드 네트워크 오류"));
        xhr.onabort = () => reject(new Error("업로드가 취소되었습니다"));
        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) resolve();
          else reject(new Error(`업로드 실패(${xhr.status})`));
        };
        xhr.send(file);
      });

      const { data: urlData } = supabase.storage
        .from(POSTS_BUCKET)
        .getPublicUrl(path);
      const url = urlData.publicUrl;
      insertHtmlAtCursor(
        `<figure class="my-2"><video class="max-w-full h-auto rounded" controls src="${url}"></video><figcaption class="text-xs text-muted-foreground">동영상 설명</figcaption></figure>`
      );
      toast.success("동영상이 본문에 삽입되었습니다");
    } catch (err: unknown) {
      console.error(err);
      const msg = (err as Error)?.message ?? "동영상 업로드 실패";
      toast.error(msg);
    } finally {
      setIsUploadingVideo(false);
      setVideoUploadProgress(0);
      videoXhrRef.current = null;
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  }

  function cancelVideoUpload() {
    if (videoXhrRef.current) {
      videoXhrRef.current.abort();
    }
    setIsUploadingVideo(false);
    setVideoUploadProgress(0);
    if (videoInputRef.current) videoInputRef.current.value = "";
  }

  function onInsertLink() {
    const url = window.prompt("링크 URL을 입력하세요");
    if (!url) return;
    try {
      const u = new URL(url);
      if (!/^https?:$/.test(u.protocol)) throw new Error();
    } catch {
      toast.error("유효한 http/https URL을 입력해주세요");
      return;
    }
    // 선택 영역이 있으면 감싸고, 없으면 URL 텍스트로 삽입
    const sel = window.getSelection();
    if (sel && sel.rangeCount && !sel.isCollapsed) {
      wrapSelectionWithHtml(
        `<a href="${url}" target="_blank" rel="noopener noreferrer">`,
        "</a>"
      );
    } else {
      insertHtmlAtCursor(
        `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`
      );
    }
  }

  function onInsertCodeBlock() {
    const sel = window.getSelection();
    const hasSelection = sel && sel.rangeCount && !sel!.isCollapsed;
    if (hasSelection) {
      wrapSelectionWithHtml(`<pre><code>`, `</code></pre>`);
    } else {
      insertHtmlAtCursor(`<pre><code>// 코드 입력</code></pre>`);
    }
  }


  return (
    <div className="mx-auto max-w-4xl px-3 sm:px-4 py-4 sm:py-6 space-y-3 sm:space-y-4">
      {/* Breadcrumb */}
      <div className="pt-1 pb-0 -mt-2 sm:mt-0">
        <nav className="flex items-center space-x-1 text-[11px] sm:text-sm text-muted-foreground">
          <Link
            href="/"
            className="flex items-center hover:text-foreground transition-colors"
          >
            <Home className="h-3 w-3 mr-1" />홈
          </Link>
          <ChevronRight className="h-3 w-3" />
          {editIdParam ? (
            <span className="text-foreground font-medium">글 수정</span>
          ) : categorySlugParam ? (
            <>
              <Link
                href={`/categories/${categorySlugParam}`}
                className="text-foreground font-medium hover:text-primary transition-colors"
              >
                {(() => {
                  const found = categories.find(
                    (c) => c.slug === categorySlugParam
                  );
                  return found ? found.name : "카테고리";
                })()}
              </Link>
              <ChevronRight className="h-3 w-3" />
              <span className="text-foreground font-medium">글쓰기</span>
            </>
          ) : (
            <span className="text-foreground font-medium">글쓰기</span>
          )}
        </nav>
      </div>

      <div className="flex flex-col gap-3">
        {/* 카테고리 선택 (공지 모드에서는 숨김) */}
        {uiReady && !activeNoticeMode && (
          <div>
            <label className="text-xs block mb-1">카테고리</label>
            <select
              className="w-full rounded border h-7 sm:h-8 px-2 bg-background text-[11px] sm:text-xs"
              value={selectedCategoryId}
              onChange={(e) => {
                setSelectedCategoryId(e.target.value);
                setSelectedTopicIds([]);
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
        )}

        {/* 태그 입력 (공지 모드나 익명 모드에서는 숨김) */}
        {uiReady && !activeNoticeMode && !isAnonymous && (
          <div>
            <label className="text-[11px] sm:text-xs block mb-1">
              태그(엔터로 추가)
            </label>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Hash className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  className="pl-8 h-7 sm:h-8 text-[11px] sm:text-xs"
                  placeholder="태그 입력..."
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addTag();
                    }
                  }}
                />
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTag}
                className="h-7 sm:h-8 px-2 text-[11px] sm:text-xs"
              >
                <Plus className="h-3.5 w-3.5 sm:h-4 sm:w-4" /> 추가
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-2">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="gap-1">
                    {t}
                    <button
                      type="button"
                      aria-label="태그 제거"
                      onClick={() => removeTag(t)}
                      className="ml-1 inline-flex items-center justify-center"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 익명 체크박스 (공지 모드가 아닐 때만 표시) */}
        {uiReady && !activeNoticeMode && (
          <div>
            <label className="text-xs inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isAnonymous}
                onChange={(e) => {
                  setIsAnonymous(e.target.checked);
                  // 익명 선택 시 태그 초기화
                  if (e.target.checked) {
                    setTags([]);
                    setTagInput("");
                  }
                }}
              />
              익명으로 작성
            </label>
            {isAnonymous && (
              <p className="text-[10px] sm:text-xs text-muted-foreground mt-1">
                익명으로 작성하면 작성자가 공개되지 않으며, 태그를 사용할 수 없습니다.
              </p>
            )}
          </div>
        )}

        {/* 제목 */}
        <div>
          <label className="text-[11px] sm:text-xs block mb-1">제목</label>
          <Input
            placeholder="제목을 입력하세요"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-7 sm:h-8 text-[11px] sm:text-xs"
          />
        </div>

        {/* 공지 옵션: 댓글 허용 (공지 모드에서만 표시) */}
        {uiReady && activeNoticeMode && (
          <div className="mt-1 space-y-2">
            <label className="text-xs inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={allowComments}
                onChange={(e) => setAllowComments(e.target.checked)}
              />
              댓글 허용
            </label>
            <label className="text-xs inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={showInRecent}
                onChange={(e) => setShowInRecent(e.target.checked)}
              />
              최근 게시물에 표시
            </label>
          </div>
        )}

        {/* 관리자 전용: 고정(핀) 설정 (표시만 제어; 서버에서 재검증) */}
        {uiReady && isAdmin && (
          <div className="mt-2 space-y-2">
            <div className="text-[11px] text-muted-foreground">관리자 설정</div>
            <label className="text-xs inline-flex items-center gap-2">
              <input
                type="checkbox"
                className="h-4 w-4"
                checked={isPinned}
                onChange={(e) => setIsPinned(e.target.checked)}
              />
              상단 고정
            </label>
            {isPinned && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="text-xs block mb-1">고정 범위</label>
                  <select
                    className="w-full rounded border p-2 bg-background text-[13px] sm:text-sm"
                    value={pinScope}
                    onChange={(e) =>
                      setPinScope(
                        (e.target.value as "global" | "category") || "global"
                      )
                    }
                  >
                    <option value="global">전역</option>
                    <option value="category">카테고리</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs block mb-1">만료 시각(선택)</label>
                  <Popover open={expiryOpen} onOpenChange={setExpiryOpen}>
                    <PopoverTrigger asChild>
                      <button
                        type="button"
                        className="w-full rounded border p-2 bg-background text-left flex items-center justify-between hover:bg-muted/50"
                      >
                        <span className="truncate">
                          {formatDisplayDate(expirySelectedDate)}
                        </span>
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </PopoverTrigger>
                    <PopoverContent className="w-80" align="end">
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const d = new Date(expiryView);
                              d.setMonth(d.getMonth() - 1);
                              setExpiryView(d);
                            }}
                          >
                            <ChevronLeft className="h-4 w-4" />
                          </Button>
                          <div className="text-sm font-medium">
                            {expiryView.getFullYear()}.
                            {String(expiryView.getMonth() + 1).padStart(2, "0")}
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const d = new Date(expiryView);
                              d.setMonth(d.getMonth() + 1);
                              setExpiryView(d);
                            }}
                          >
                            <ChevronRight className="h-4 w-4" />
                          </Button>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-[11px] select-none">
                          {["일", "월", "화", "수", "목", "금", "토"].map(
                            (w, i) => (
                              <div
                                key={w}
                                className={
                                  "py-1 " +
                                  (i === 6
                                    ? "text-blue-500"
                                    : i === 0
                                      ? "text-red-500"
                                      : "text-muted-foreground")
                                }
                              >
                                {w}
                              </div>
                            )
                          )}
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs select-none">
                          {(() => {
                            const base = new Date(
                              expiryView.getFullYear(),
                              expiryView.getMonth(),
                              1
                            );
                            const startDay = new Date(base);
                            // Sunday start: move start to the previous Sunday
                            startDay.setDate(1 - base.getDay());
                            const days: Date[] = [];
                            for (let i = 0; i < 42; i++) {
                              const d = new Date(startDay);
                              d.setDate(startDay.getDate() + i);
                              days.push(d);
                            }
                            const sel = expirySelectedDate;
                            const yearSet =
                              holidayDatesByYear[expiryView.getFullYear()];
                            const today = new Date();
                            today.setHours(0, 0, 0, 0);
                            return days.map((d, idx) => {
                              const isCurMonth =
                                d.getMonth() === expiryView.getMonth();
                              const isSel =
                                sel &&
                                d.getFullYear() === sel.getFullYear() &&
                                d.getMonth() === sel.getMonth() &&
                                d.getDate() === sel.getDate();
                              const isToday =
                                d.getFullYear() === today.getFullYear() &&
                                d.getMonth() === today.getMonth() &&
                                d.getDate() === today.getDate();
                              const dow = d.getDay();
                              const isHoliday = (() => {
                                const setByYear =
                                  holidayDatesByYear[d.getFullYear()] ||
                                  yearSet;
                                return setByYear
                                  ? setByYear.has(toLocalDateKey(d))
                                  : false;
                              })();
                              return (
                                <button
                                  key={idx}
                                  type="button"
                                  className={(() => {
                                    const base = [
                                      "py-1",
                                      "rounded",
                                    ] as string[];
                                    if (isSel) {
                                      base.push(
                                        "bg-primary",
                                        "text-primary-foreground"
                                      );
                                    } else if (!isCurMonth) {
                                      base.push(
                                        "text-muted-foreground/70",
                                        "hover:bg-muted"
                                      );
                                    } else {
                                      base.push("hover:bg-muted");
                                      if (isHoliday || dow === 0)
                                        base.push("text-red-500");
                                      else if (dow === 6)
                                        base.push("text-blue-500");
                                      else base.push("text-foreground");
                                      if (isToday)
                                        base.push("border", "border-primary");
                                    }
                                    return base.join(" ");
                                  })()}
                                  onClick={() => {
                                    const current = sel || new Date();
                                    const nd = new Date(d);
                                    nd.setHours(
                                      current.getHours(),
                                      current.getMinutes(),
                                      0,
                                      0
                                    );
                                    setPinnedUntil(toLocalDateTimeString(nd));
                                  }}
                                >
                                  {d.getDate()}
                                </button>
                              );
                            });
                          })()}
                        </div>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-2 text-sm">
                            <label className="text-xs text-muted-foreground">
                              시간
                            </label>
                            <input
                              type="number"
                              min={0}
                              max={23}
                              className="w-14 rounded border p-1 bg-background"
                              value={(() => {
                                const d = expirySelectedDate || new Date();
                                return d.getHours();
                              })()}
                              onChange={(e) => {
                                const h = Math.max(
                                  0,
                                  Math.min(
                                    23,
                                    parseInt(e.target.value || "0", 10)
                                  )
                                );
                                const base = expirySelectedDate || new Date();
                                const nd = new Date(base);
                                nd.setHours(h);
                                setPinnedUntil(toLocalDateTimeString(nd));
                              }}
                            />
                            <span>:</span>
                            <input
                              type="number"
                              min={0}
                              max={59}
                              className="w-14 rounded border p-1 bg-background"
                              value={(() => {
                                const d = expirySelectedDate || new Date();
                                return d.getMinutes();
                              })()}
                              onChange={(e) => {
                                const m = Math.max(
                                  0,
                                  Math.min(
                                    59,
                                    parseInt(e.target.value || "0", 10)
                                  )
                                );
                                const base = expirySelectedDate || new Date();
                                const nd = new Date(base);
                                nd.setMinutes(m);
                                setPinnedUntil(toLocalDateTimeString(nd));
                              }}
                            />
                          </div>
                          <div className="flex items-center gap-2">
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const now = new Date();
                                setExpiryView(
                                  new Date(now.getFullYear(), now.getMonth(), 1)
                                );
                              }}
                            >
                              오늘로 이동
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              onClick={() => {
                                const now = new Date();
                                setPinnedUntil(toLocalDateTimeString(now));
                              }}
                            >
                              오늘 선택
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              onClick={() => {
                                setPinnedUntil("");
                              }}
                            >
                              초기화
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setExpiryOpen(false)}
                            >
                              확인
                            </Button>
                          </div>
                        </div>
                      </div>
                    </PopoverContent>
                  </Popover>
                </div>
                <div>
                  <label className="text-xs block mb-1">
                    우선순위(작을수록 상단)
                  </label>
                  <input
                    type="number"
                    className="w-full rounded border p-2 bg-background text-[13px] sm:text-sm"
                    value={pinPriority}
                    onChange={(e) =>
                      setPinPriority(parseInt(e.target.value || "0", 10))
                    }
                  />
                </div>
                {pinScope === "category" && (
                  <div>
                    <label className="text-xs block mb-1">고정 카테고리</label>
                    <select
                      className="w-full rounded border p-2 bg-background text-[13px] sm:text-sm"
                      value={selectedCategoryId}
                      onChange={(e) => setSelectedCategoryId(e.target.value)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        <div>
          <label className="text-xs block mb-1">내용</label>
          {/* 툴바 */}
          <TooltipProvider>
            <div className="flex flex-wrap items-center gap-1 sm:gap-2 rounded border bg-muted/40 p-1.5">
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="굵게"
                    onClick={() => applyCommand("bold")}
                  >
                    <Bold className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>굵게</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="기울임"
                    onClick={() => applyCommand("italic")}
                  >
                    <Italic className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>기울임</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="취소선"
                    onClick={() => applyCommand("strikeThrough")}
                  >
                    <Strikethrough className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>취소선</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="목록"
                    onClick={() => applyCommand("insertUnorderedList")}
                  >
                    <List className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>목록</TooltipContent>
              </Tooltip>

              <div className="w-px h-6 bg-border mx-1" />

              {/* 이미지 */}
              <input
                ref={imageInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleSelectImage}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="이미지"
                    onClick={() => imageInputRef.current?.click()}
                    disabled={isUploadingImage}
                  >
                    {isUploadingImage ? (
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <ImageIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>이미지</TooltipContent>
              </Tooltip>

              {/* 동영상 */}
              <input
                ref={videoInputRef}
                type="file"
                accept="video/*"
                className="hidden"
                onChange={handleSelectVideo}
              />
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="동영상"
                    onClick={() => videoInputRef.current?.click()}
                    disabled={isUploadingVideo}
                  >
                    {isUploadingVideo ? (
                      <Loader2 className="h-3.5 w-3.5 sm:h-4 sm:w-4 animate-spin" />
                    ) : (
                      <VideoIcon className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                    )}
                  </Button>
                </TooltipTrigger>
                <TooltipContent>동영상</TooltipContent>
              </Tooltip>
              {isUploadingVideo && (
                <div className="ml-1 flex items-center gap-1 text-xs text-muted-foreground">
                  <span>{videoUploadProgress}%</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="업로드 취소"
                    onClick={cancelVideoUpload}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}


              {/* 링크 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="링크"
                    onClick={onInsertLink}
                  >
                    <Link2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>링크</TooltipContent>
              </Tooltip>
              {/* 코드 블록 */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="코드"
                    onClick={onInsertCodeBlock}
                  >
                    <Code2 className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>코드 블록</TooltipContent>
              </Tooltip>
            </div>
          </TooltipProvider>

          {/* 편진 영역 */}
          <div
            ref={editorRef}
            className="w-full min-h-[300px] rounded border p-2.5 sm:p-3 bg-background text-[13px] sm:text-sm mt-1.5 sm:mt-2 focus:outline-none [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded [&_img]:border [&_img]:border-border [&_video]:max-w-full [&_video]:h-auto [&_ul]:list-disc [&_ul]:pl-6 [&_pre]:bg-muted [&_pre]:p-2 [&_pre]:rounded"
            contentEditable
            role="textbox"
            aria-multiline
            aria-label="게시글 내용"
            data-placeholder="내용을 입력하세요..."
            onInput={updateEditorHtmlRef}
            onBlur={updateEditorHtmlRef}
            onKeyDown={(e) => {
              // 빈 목록 항목에서 Enter → 목록 종료 후 일반 문단으로 이동
              if (e.key === "Enter" && !e.shiftKey) {
                const sel = window.getSelection();
                const anchor = sel?.anchorNode || null;
                const li = getClosestElement(anchor, "LI");
                if (li && isListItemEmpty(li)) {
                  e.preventDefault();
                  exitListFromListItem(li);
                  return;
                }
              }
              // Ctrl+Enter → 즉시 목록 종료
              if (e.ctrlKey && e.key === "Enter") {
                const sel = window.getSelection();
                const anchor = sel?.anchorNode || null;
                const li = getClosestElement(anchor, "LI");
                if (li) {
                  e.preventDefault();
                  exitListFromListItem(li);
                  return;
                }
              }
              if (e.ctrlKey && e.key.toLowerCase() === "b") {
                e.preventDefault();
                applyCommand("bold");
              }
              if (e.ctrlKey && e.key.toLowerCase() === "i") {
                e.preventDefault();
                applyCommand("italic");
              }
              if (e.ctrlKey && e.key.toLowerCase() === "s") {
                e.preventDefault();
                applyCommand("strikeThrough");
              }
            }}
            suppressContentEditableWarning
          />
          <p className="text-[11px] text-muted-foreground mt-1">
            이미지/동영상은 공개 URL로 삽입됩니다. 민감한 정보는 포함하지
            마세요.
          </p>
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
