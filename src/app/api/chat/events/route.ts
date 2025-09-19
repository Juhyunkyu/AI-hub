import { createSupabaseServerClient } from "@/lib/supabase/server";
import { NextRequest } from "next/server";

// Server-Sent Events for 실시간 채팅 (WebSocket 대체)
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const roomId = searchParams.get('roomId');
  
  if (!roomId) {
    return new Response('Room ID required', { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  
  if (!user) {
    return new Response('Unauthorized', { status: 401 });
  }

  // SSE 헤더 설정
  const headers = new Headers({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control',
  });

  const encoder = new TextEncoder();
  
  const stream = new ReadableStream({
    start(controller) {
      // 연결 확인 메시지
      const data = encoder.encode(`data: ${JSON.stringify({ 
        type: 'connected', 
        roomId,
        timestamp: new Date().toISOString()
      })}\n\n`);
      controller.enqueue(data);

      // Supabase 실시간 구독
      const channel = supabase
        .channel(`sse_room_${roomId}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'chat_messages',
            filter: `room_id=eq.${roomId}`,
          },
          async (payload) => {
            try {
              const newMessage = payload.new;
              
              // 발신자 정보 조회
              const { data: sender } = await supabase
                .from('profiles')
                .select('id, username, avatar_url')
                .eq('id', newMessage.sender_id)
                .single();

              const messageData = {
                type: 'new_message',
                message: {
                  ...newMessage,
                  sender,
                  read_by: [newMessage.sender_id]
                },
                timestamp: new Date().toISOString()
              };

              const data = encoder.encode(`data: ${JSON.stringify(messageData)}\n\n`);
              controller.enqueue(data);
              
            } catch (error) {
              console.error('SSE message processing error:', error);
            }
          }
        )
        .on(
          'postgres_changes',
          {
            event: 'UPDATE',
            schema: 'public',
            table: 'chat_room_participants',
            filter: `room_id=eq.${roomId}`,
          },
          (payload) => {
            // 읽음 상태 업데이트 등
            const data = encoder.encode(`data: ${JSON.stringify({
              type: 'participant_update',
              data: payload.new,
              timestamp: new Date().toISOString()
            })}\n\n`);
            controller.enqueue(data);
          }
        )
        .subscribe();

      // Keep-alive ping (30초마다)
      const pingInterval = setInterval(() => {
        try {
          const pingData = encoder.encode(`data: ${JSON.stringify({ 
            type: 'ping', 
            timestamp: new Date().toISOString() 
          })}\n\n`);
          controller.enqueue(pingData);
        } catch {
          clearInterval(pingInterval);
          supabase.removeChannel(channel);
        }
      }, 30000);

      // 정리 함수
      return () => {
        clearInterval(pingInterval);
        supabase.removeChannel(channel);
      };
    },
    
    cancel() {
      // 클라이언트가 연결을 끊을 때
      console.log('SSE connection cancelled for room:', roomId);
    }
  });

  return new Response(stream, { headers });
}

// OPTIONS 요청 처리 (CORS)
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}