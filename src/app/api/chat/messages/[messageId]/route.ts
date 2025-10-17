import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ messageId: string }> }
) {
  try {
    const { messageId } = await params;
    console.log("🔍 DELETE request for messageId:", messageId);
    const supabase = await createSupabaseServerClient();
    const supabaseAdmin = await createSupabaseAdminClient();

    // 인증 확인
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 메시지 조회 (소유권 확인 및 읽음 상태 확인)
    const { data: message, error: fetchError } = await supabase
      .from("chat_messages")
      .select(`
        id,
        sender_id,
        room_id,
        file_url,
        message_type,
        deleted_for,
        created_at
      `)
      .eq("id", messageId)
      .single();

    console.log("📦 Fetched message:", message);
    console.log("❌ Fetch error:", fetchError);

    if (fetchError || !message) {
      return NextResponse.json(
        { error: "Message not found" },
        { status: 404 }
      );
    }

    // 📌 상대방이 보낸 메시지인 경우 → Soft Delete만 가능
    if (message.sender_id !== user.id) {
      console.log("💡 Deleting other's message - Soft Delete");
      console.log("Current deleted_for:", message.deleted_for);
      console.log("User ID to add:", user.id);

      // 이미 삭제되어 있는지 확인
      if (message.deleted_for?.includes(user.id)) {
        return NextResponse.json(
          { error: "Message already deleted" },
          { status: 400 }
        );
      }

      // Soft Delete: 본인만 안 보이게
      // ⚠️ Admin Client 사용 이유:
      //    사용자가 deleted_for에 추가되면 SELECT RLS에 의해 메시지가 안 보이게 됨
      //    이 경우 일반 Client UPDATE의 WITH CHECK가 실패함 (업데이트된 row를 볼 수 없음)
      const currentDeletedFor = message.deleted_for || [];
      const updatedDeletedFor = [...currentDeletedFor, user.id];

      const { error: softDeleteError } = await supabaseAdmin
        .from("chat_messages")
        .update({ deleted_for: updatedDeletedFor })
        .eq("id", messageId);

      if (softDeleteError) {
        console.error("❌ Soft delete error details:", JSON.stringify(softDeleteError, null, 2));
        return NextResponse.json(
          { error: "Failed to delete message", details: softDeleteError.message },
          { status: 500 }
        );
      }

      console.log("✅ Soft delete successful");

      // 업데이트된 메시지 조회 (커스텀 이벤트용)
      const { data: updatedMessage } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("id", messageId)
        .single();

      return NextResponse.json({
        success: true,
        delete_type: "soft",
        message: "Message hidden for you",
        updated_message: updatedMessage, // ✅ 커스텀 이벤트용
      });
    }

    // 📌 본인이 보낸 메시지인 경우 → 읽음 상태 확인 후 Hard/Soft Delete

    // 채팅방 참여자 목록 조회
    const { data: participants, error: participantsError } = await supabase
      .from("chat_room_participants")
      .select("user_id")
      .eq("room_id", message.room_id);

    if (participantsError || !participants) {
      return NextResponse.json(
        { error: "Failed to fetch room participants" },
        { status: 500 }
      );
    }

    // 다른 참여자가 있는지 확인
    const otherParticipants = participants.filter((p) => p.user_id !== user.id);
    console.log("💡 Other participants:", otherParticipants.length, otherParticipants.map(p => p.user_id));

    // 읽음 상태 확인 (message_reads 테이블)
    const otherParticipantIds = otherParticipants.map((p) => p.user_id);

    // 빈 배열인 경우 처리
    if (otherParticipantIds.length === 0) {
      console.log("💡 No other participants - Hard Delete");
      // 참여자가 본인뿐이면 바로 Hard Delete
      // ... (하드 삭제 로직으로 이동)
    }

    const { data: reads, error: readsError } = await supabase
      .from("message_reads")
      .select("user_id, last_read_at")
      .eq("room_id", message.room_id)
      .in("user_id", otherParticipantIds);

    console.log("💡 Reads data:", reads);
    console.log("💡 Reads error:", readsError);

    if (readsError) {
      console.error("Error checking read status:", readsError);
      // 읽음 상태 확인 실패 시 안전하게 소프트 삭제
      // ⚠️ 송신자가 자신의 메시지를 숨기는 경우, Admin Client 사용
      const currentDeletedFor = message.deleted_for || [];
      const updatedDeletedFor = [...currentDeletedFor, user.id];

      const { error: softDeleteError } = await supabaseAdmin
        .from("chat_messages")
        .update({ deleted_for: updatedDeletedFor })
        .eq("id", messageId);

      if (softDeleteError) {
        console.error("❌ Soft delete error (reads check failed):", JSON.stringify(softDeleteError, null, 2));
        return NextResponse.json(
          { error: "Failed to delete message", details: softDeleteError.message },
          { status: 500 }
        );
      }

      console.log("✅ Soft delete successful (reads check failed)");

      // 업데이트된 메시지 조회 (커스텀 이벤트용)
      const { data: updatedMessage } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("id", messageId)
        .single();

      return NextResponse.json({
        success: true,
        delete_type: "soft",
        message: "Message hidden for you",
        updated_message: updatedMessage, // ✅ 커스텀 이벤트용
      });
    }

    // 다른 참여자 중 메시지를 읽은 사람이 있는지 확인
    const hasBeenReadByOthers = reads?.some((read) => {
      return (
        read.last_read_at &&
        new Date(read.last_read_at) >= new Date(message.created_at)
      );
    });

    if (hasBeenReadByOthers) {
      // 🔹 Soft Delete: 다른 참여자가 읽었으면 본인만 안 보이게
      // ⚠️ 송신자가 자신의 메시지를 숨기는 경우, Admin Client 사용
      // 이유: 송신자가 deleted_for에 자신을 추가하면 RLS SELECT 정책에 의해 메시지가 보이지 않게 됨
      //       이 경우 일반 Client UPDATE는 RLS 위반으로 차단됨 (WITH CHECK 실패)
      console.log("💡 Own message read by others - Soft Delete (Admin Client)");
      const currentDeletedFor = message.deleted_for || [];
      const updatedDeletedFor = [...currentDeletedFor, user.id];

      const { error: softDeleteError } = await supabaseAdmin
        .from("chat_messages")
        .update({ deleted_for: updatedDeletedFor })
        .eq("id", messageId);

      if (softDeleteError) {
        console.error("❌ Soft delete error (read by others):", JSON.stringify(softDeleteError, null, 2));
        return NextResponse.json(
          { error: "Failed to delete message", details: softDeleteError.message },
          { status: 500 }
        );
      }

      console.log("✅ Soft delete successful (own message read by others)");

      // 업데이트된 메시지 조회 (커스텀 이벤트용)
      const { data: updatedMessage } = await supabaseAdmin
        .from("chat_messages")
        .select("*")
        .eq("id", messageId)
        .single();

      return NextResponse.json({
        success: true,
        delete_type: "soft",
        message: "Message hidden for you (others have read it)",
        updated_message: updatedMessage, // ✅ 커스텀 이벤트용
      });
    } else {
      // 🔹 Hard Delete: 아무도 안 읽었으면 완전 삭제
      console.log("💡 No one read - Hard Delete path");
      console.log("💡 Message file_url:", message.file_url);
      console.log("💡 Message type:", message.message_type);

      // 1. Storage에서 파일 삭제 (있는 경우)
      if (message.file_url && ["image", "file"].includes(message.message_type)) {
        console.log("💡 Attempting to delete storage file");
        try {
          // Supabase Storage URL 파싱
          const url = new URL(message.file_url);
          const pathParts = url.pathname.split("/");
          const bucketIndex = pathParts.findIndex(
            (part) => part === "storage"
          );

          if (bucketIndex !== -1 && pathParts[bucketIndex + 2]) {
            const bucket = pathParts[bucketIndex + 2];
            const filePath = pathParts.slice(bucketIndex + 3).join("/");

            console.log("💡 Storage bucket:", bucket);
            console.log("💡 Storage file path:", filePath);

            const { error: storageError } = await supabase.storage
              .from(bucket)
              .remove([filePath]);

            if (storageError) {
              console.error("❌ Storage file deletion error:", storageError);
            } else {
              console.log("✅ Storage file deleted successfully");
            }
          }
        } catch (error) {
          console.error("Failed to parse storage URL:", error);
        }
      }

      // 2. message_reads에서 참조 제거 (FK constraint 위반 방지)
      console.log("💡 Clearing message_reads references");
      const { error: readsUpdateError } = await supabaseAdmin
        .from("message_reads")
        .update({ last_read_message_id: null })
        .eq("last_read_message_id", messageId);

      if (readsUpdateError) {
        console.error("❌ Failed to clear message_reads references:", readsUpdateError);
      } else {
        console.log("✅ Message_reads references cleared");
      }

      // 3. DB에서 메시지 완전 삭제
      console.log("💡 Attempting to delete message from DB");
      const { error: hardDeleteError } = await supabaseAdmin
        .from("chat_messages")
        .delete()
        .eq("id", messageId);

      if (hardDeleteError) {
        console.error("❌ DB deletion error:", hardDeleteError);
        return NextResponse.json(
          { error: "Failed to delete message" },
          { status: 500 }
        );
      }

      console.log("✅ Message deleted from DB successfully");

      // ✅ Hard Delete도 messageId 반환 (Realtime 이벤트 대체)
      return NextResponse.json({
        success: true,
        delete_type: "hard",
        message: "Message deleted for everyone",
        deleted_message_id: messageId, // 클라이언트가 직접 삭제 처리
      });
    }
  } catch (error) {
    console.error("Error deleting message:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
