"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeleteRoomsModalProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  roomCount: number;
}

export function DeleteRoomsModal({
  open,
  onClose,
  onConfirm,
  roomCount
}: DeleteRoomsModalProps) {
  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>채팅방 삭제</DialogTitle>
          <DialogDescription>
            선택한 {roomCount}개의 채팅방을 삭제하시겠습니까?
            <br />
            <span className="text-red-600 font-medium">
              삭제된 채팅방과 모든 메시지는 복구할 수 없습니다.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={onClose}>
            취소
          </Button>
          <Button
            variant="destructive"
            onClick={onConfirm}
          >
            삭제
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}