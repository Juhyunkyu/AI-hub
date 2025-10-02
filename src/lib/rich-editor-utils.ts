/**
 * 리치 텍스트 에디터 유틸리티 함수들
 * posts/new 페이지에서 추출한 재사용 가능한 에디터 기능들
 */

/**
 * HTML 컨텐츠 sanitize (보안 강화)
 */
export function sanitizeHtml(html: string): string {
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
      "data-lat",
      "data-lng",
      "data-name",
      "data-zoom",
      "data-provider",
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

/**
 * 에디터에서 현재 선택 영역이 에디터 내부인지 확인
 */
export function isRangeInsideEditor(
  range: Range | null,
  editorRef: HTMLElement | null
): boolean {
  if (!editorRef || !range) return false;
  return editorRef.contains(range.commonAncestorContainer);
}

/**
 * 선택 영역을 HTML로 감싸기
 */
export function wrapSelectionWithHtml(
  before: string,
  after: string,
  editorRef: HTMLElement | null
): void {
  if (!editorRef) return;

  editorRef.focus();
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
}

/**
 * 커서 위치에 HTML 삽입
 */
export function insertHtmlAtCursor(
  html: string,
  editorRef: HTMLElement | null,
  savedRange?: Range | null
): void {
  if (!editorRef) return;

  editorRef.focus();
  const sel = window.getSelection();
  let useAppend = true;
  let range: Range | null = null;

  // 저장된 선택 영역이 있으면 복원
  if (savedRange && isRangeInsideEditor(savedRange, editorRef)) {
    sel?.removeAllRanges();
    sel?.addRange(savedRange);
    useAppend = false;
    range = savedRange;
  } else if (sel && sel.rangeCount > 0) {
    const r = sel.getRangeAt(0);
    if (isRangeInsideEditor(r, editorRef)) {
      useAppend = false;
      range = r;
    }
  }

  if (useAppend) {
    // 에디터 끝에 추가
    editorRef.innerHTML += html;
    // 커서를 본문 끝으로 이동
    const r = document.createRange();
    r.selectNodeContents(editorRef);
    r.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(r);
    return;
  }

  // 에디터 내부 선택 영역에 삽입
  if (!range) return;

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
    sel?.removeAllRanges();
    sel?.addRange(range);
  }
}

/**
 * 가장 가까운 특정 태그 요소 찾기
 */
export function getClosestElement(
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

/**
 * 리스트 아이템이 비어있는지 확인
 */
export function isListItemEmpty(li: HTMLElement): boolean {
  // 이미지/비디오는 비어있지 않다고 간주
  if (li.querySelector("img,video,figure")) return false;
  const text = (li.textContent || "").replace(/\u200B/g, "").trim();
  // 빈 텍스트이거나 <br>만 있는 경우 비어있다고 판단
  const onlyBr =
    li.children.length === 1 && li.children[0].tagName.toUpperCase() === "BR";
  return text.length === 0 || onlyBr;
}

/**
 * 리스트에서 벗어나기
 */
export function exitListFromListItem(li: HTMLElement): void {
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
}

/**
 * 에디터 명령 실행
 */
export function applyEditorCommand(
  cmd: string,
  editorRef: HTMLElement | null
): void {
  if (!editorRef) return;

  editorRef.focus();

  if (cmd === "insertUnorderedList") {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || sel.isCollapsed) {
      insertHtmlAtCursor(`<ul><li></li></ul>`, editorRef);
      const lastLi = editorRef.querySelector("li:last-child");
      if (lastLi) {
        const r = document.createRange();
        r.selectNodeContents(lastLi);
        r.collapse(false);
        sel?.removeAllRanges();
        sel?.addRange(r);
      }
      return;
    }
  }

  document.execCommand(cmd, false);
}

/**
 * 링크 삽입
 */
export function insertLink(editorRef: HTMLElement | null): void {
  const url = window.prompt("링크 URL을 입력하세요");
  if (!url) return;

  try {
    const u = new URL(url);
    if (!/^https?:$/.test(u.protocol)) throw new Error();
  } catch {
    alert("유효한 http/https URL을 입력해주세요");
    return;
  }

  // 선택 영역이 있으면 감싸고, 없으면 URL 텍스트로 삽입
  const sel = window.getSelection();
  if (sel && sel.rangeCount && !sel.isCollapsed) {
    wrapSelectionWithHtml(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">`,
      "</a>",
      editorRef
    );
  } else {
    insertHtmlAtCursor(
      `<a href="${url}" target="_blank" rel="noopener noreferrer">${url}</a>`,
      editorRef
    );
  }
}

/**
 * 코드 블록 삽입
 */
export function insertCodeBlock(editorRef: HTMLElement | null): void {
  const sel = window.getSelection();
  const hasSelection = sel && sel.rangeCount && !sel.isCollapsed;

  if (hasSelection) {
    wrapSelectionWithHtml(`<pre><code>`, `</code></pre>`, editorRef);
  } else {
    insertHtmlAtCursor(`<pre><code>// 코드 입력</code></pre>`, editorRef);
  }
}

/**
 * 선택 영역 저장/복원을 위한 유틸리티
 */
export class SelectionManager {
  private savedRange: Range | null = null;
  private editorRef: HTMLElement | null = null;

  constructor(editorRef: HTMLElement | null) {
    this.editorRef = editorRef;
  }

  saveSelection(): void {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const r = sel.getRangeAt(0);
    if (!isRangeInsideEditor(r, this.editorRef)) return;
    // clone to avoid live range issues
    this.savedRange = r.cloneRange();
  }

  restoreSelection(): boolean {
    const r = this.savedRange;
    if (!isRangeInsideEditor(r, this.editorRef)) return false;
    const s = window.getSelection();
    s?.removeAllRanges();
    if (r) s?.addRange(r);
    return true;
  }

  getSavedRange(): Range | null {
    return this.savedRange;
  }
}