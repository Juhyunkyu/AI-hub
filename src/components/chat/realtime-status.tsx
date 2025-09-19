import { useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertCircle } from 'lucide-react';

interface RealtimeStatusProps {
  currentRoom: any;
  realtimeConnectionState: string;
  realtimeError?: string;
  reconnectRealtime: () => void;
}

export function RealtimeStatus({
  currentRoom,
  realtimeConnectionState,
  realtimeError,
  reconnectRealtime
}: RealtimeStatusProps) {
  const statusInfo = useMemo(() => {
    const getStatusColor = () => {
      switch (realtimeConnectionState) {
        case 'connected': return 'text-green-500';
        case 'connecting': return 'text-yellow-500';
        case 'error': return 'text-red-500';
        default: return 'text-gray-400';
      }
    };

    const getStatusIcon = () => {
      switch (realtimeConnectionState) {
        case 'connected': return <Wifi className="h-3 w-3" />;
        case 'connecting': return (
          <div className="h-3 w-3 animate-spin border border-yellow-500 border-t-transparent rounded-full" />
        );
        case 'error': return <WifiOff className="h-3 w-3" />;
        default: return <WifiOff className="h-3 w-3" />;
      }
    };

    const getStatusText = () => {
      switch (realtimeConnectionState) {
        case 'connected': return '실시간';
        case 'connecting': return '연결 중...';
        case 'error': return '연결 오류';
        default: return '오프라인';
      }
    };

    return {
      color: getStatusColor(),
      icon: getStatusIcon(),
      text: getStatusText()
    };
  }, [realtimeConnectionState]);

  if (!currentRoom) return null;

  return (
    <div className={`flex items-center space-x-1 text-xs ${statusInfo.color}`}>
      {statusInfo.icon}
      <span>{statusInfo.text}</span>
      {realtimeError && (
        <Button
          variant="ghost"
          size="sm"
          className="h-4 w-4 p-0 text-red-500 hover:text-red-600"
          onClick={reconnectRealtime}
          title={`재연결 시도 (에러: ${realtimeError})`}
        >
          <AlertCircle className="h-3 w-3" />
        </Button>
      )}
    </div>
  );
}