"use client"

import { toast } from "sonner"
import { Button } from "@/components/ui/button"

export function ToastDemo() {
  return (
    <div className="flex items-center gap-3">
      <Button onClick={() => toast.success("샤드cn + sonner 토스트 동작 확인!")}>토스트 테스트</Button>
    </div>
  )
}
