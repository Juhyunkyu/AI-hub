"use client";

import React, { forwardRef, useImperativeHandle, useRef } from "react";

export type FilePickerHandle = {
  open: () => void;
};

export default forwardRef(function ImagePicker(
  { accept, onPick }: { accept: string; onPick: (file: File) => void },
  ref: React.Ref<FilePickerHandle>
) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  useImperativeHandle(ref, () => ({
    open: () => inputRef.current?.click(),
  }));

  return (
    <input
      ref={inputRef}
      type="file"
      accept={accept}
      className="hidden"
      onChange={(e) => {
        const f = e.target.files?.[0];
        if (f) onPick(f);
        if (inputRef.current) inputRef.current.value = "";
      }}
    />
  );
});

