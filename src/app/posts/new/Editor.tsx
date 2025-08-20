"use client";

import React, { forwardRef, useImperativeHandle } from "react";
import { Editor, EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Placeholder from "@tiptap/extension-placeholder";
import TextAlign from "@tiptap/extension-text-align";
import Link from "@tiptap/extension-link";
import Image from "@tiptap/extension-image";
import TaskList from "@tiptap/extension-task-list";
import TaskItem from "@tiptap/extension-task-item";
import { toast } from "sonner";

export type EditorApi = {
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
};

export default forwardRef(function TiptapEditor(
  {
    onUpdate,
    placeholder = "내용을 입력하세요...",
    onUploadImage,
    onUploadVideo,
  }: {
    onUpdate?: (html: string) => void;
    placeholder?: string;
    onUploadImage?: (file: File) => Promise<string | null>;
    onUploadVideo?: (file: File) => Promise<string | null>;
  },
  ref: React.Ref<EditorApi>
) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: [
      StarterKit,
      Placeholder.configure({ placeholder }),
      TextAlign.configure({ types: ["heading", "paragraph"] }),
      Link.configure({ openOnClick: false }),
      Image,
      TaskList,
      TaskItem.configure({ nested: true }),
    ],
    content: "",
    onUpdate: ({ editor }) => onUpdate?.(editor.getHTML()),
    editorProps: {
      attributes: {
        class:
          "prose prose-sm sm:prose-base dark:prose-invert min-h-72 focus:outline-none",
      },
      handlePaste: async (view, event) => {
        const items = Array.from(event.clipboardData?.items ?? []);
        let any = false;
        for (const it of items) {
          if (it.kind === "file") {
            const file = it.getAsFile();
            if (!file) continue;
            any = true;
            toast.info("업로드 시작", { id: "paste-upload" });
            try {
              const isImage = file.type.startsWith("image/");
              const isVideo = file.type.startsWith("video/");
              let url: string | null = null;
              if (isImage && onUploadImage) url = await onUploadImage(file);
              else if (isVideo && onUploadVideo)
                url = await onUploadVideo(file);
              if (url) {
                const html = isImage
                  ? `<p><img src="${url}" alt="image" /></p>`
                  : `<p><video controls src="${url}"></video></p>`;
                editor?.commands.insertContent(html);
              }
            } finally {
              toast.success("업로드 완료", { id: "paste-upload" });
            }
          }
        }
        return any; // 우리가 처리했으면 기본 처리 막기
      },
    },
  });

  useImperativeHandle(
    ref,
    (): EditorApi => ({
      toggleBold: () => editor?.chain().focus().toggleBold().run(),
      toggleItalic: () => editor?.chain().focus().toggleItalic().run(),
      toggleStrike: () => editor?.chain().focus().toggleStrike().run(),
      alignLeft: () => editor?.chain().focus().setTextAlign("left").run(),
      alignCenter: () => editor?.chain().focus().setTextAlign("center").run(),
      alignRight: () => editor?.chain().focus().setTextAlign("right").run(),
      insertCodeBlock: () => editor?.chain().focus().toggleCodeBlock().run(),
      toggleBlockquote: () => editor?.chain().focus().toggleBlockquote().run(),
      toggleTaskList: () => editor?.chain().focus().toggleTaskList().run(),
      insertHtml: (html: string) => editor?.commands.insertContent(html),
    }),
    [editor]
  );

  return <EditorContent editor={editor} />;
});
