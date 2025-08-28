'use client';

import { observer } from 'mobx-react-lite';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import clsx from 'clsx';
import { useState, useEffect } from 'react';

interface APILogEntry {
  id: string;
  timestamp: number;
  type: 'request' | 'response' | 'error';
  playerId?: number;
  endpoint?: string;
  data?: any;
  message: string;
  level: 'info' | 'warn' | 'error';
}

export const APILogDisplay = observer(function APILogDisplay() {
  const [logs, setLogs] = useState<APILogEntry[]>([]);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    // 拦截console.log来捕获API日志
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;

    const addLog = (level: 'info' | 'warn' | 'error', args: any[]) => {
      const message = args.join(' ');
      
      // 只捕获包含特定标识的日志
      if (message.includes('[GameMaster ->') || 
          message.includes('🤖 [Player') || 
          message.includes('🚀 [Player') ||
          message.includes('AI请求') ||
          message.includes('HTTP响应')) {
        
        const logEntry: APILogEntry = {
          id: `${Date.now()}-${Math.random()}`,
          timestamp: Date.now(),
          type: message.includes('请求') ? 'request' : 
                message.includes('响应') ? 'response' : 'error',
          message,
          level,
          data: args.length > 1 ? args.slice(1) : undefined
        };

        setLogs(prev => [logEntry, ...prev.slice(0, 99)]); // 保留最新100条
      }
    };

    console.log = (...args) => {
      originalLog.apply(console, args);
      addLog('info', args);
    };

    console.warn = (...args) => {
      originalWarn.apply(console, args);
      addLog('warn', args);
    };

    console.error = (...args) => {
      originalError.apply(console, args);
      addLog('error', args);
    };

    return () => {
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
    };
  }, []);

  if (!isVisible) {
    return (
      <div className="fixed bottom-4 right-4 z-50">
        <button 
          onClick={() => setIsVisible(true)}
          className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-lg shadow-lg"
        >
          📊 API日志 ({logs.length})
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-4 right-4 w-96 max-h-96 z-50">
      <Card className="flex flex-col h-full">
        <CardHeader className="flex-shrink-0 pb-2">
          <div className="flex justify-between items-center">
            <CardTitle className="text-sm">API请求日志</CardTitle>
            <div className="flex gap-2">
              <button 
                onClick={() => setLogs([])}
                className="text-xs bg-gray-100 hover:bg-gray-200 px-2 py-1 rounded"
              >
                清空
              </button>
              <button 
                onClick={() => setIsVisible(false)}
                className="text-xs bg-red-100 hover:bg-red-200 px-2 py-1 rounded"
              >
                关闭
              </button>
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="flex-1 overflow-y-auto p-2 space-y-1 text-xs">
          {logs.length === 0 ? (
            <div className="text-muted-foreground text-center py-4">
              暂无API日志
            </div>
          ) : (
            logs.map((log) => (
              <div
                key={log.id}
                className={clsx(
                  'p-2 rounded border-l-2 text-xs',
                  {
                    'border-l-blue-500 bg-blue-50': log.type === 'request',
                    'border-l-green-500 bg-green-50': log.type === 'response',
                    'border-l-red-500 bg-red-50': log.type === 'error',
                  }
                )}
              >
                <div className="flex justify-between items-start mb-1">
                  <Badge 
                    variant={log.level === 'error' ? 'destructive' : 'outline'}
                    className="text-xs h-4"
                  >
                    {log.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">
                    {format(new Date(log.timestamp), 'HH:mm:ss')}
                  </span>
                </div>
                <div className="text-xs break-words">
                  {log.message}
                </div>
                {log.data && (
                  <details className="mt-1">
                    <summary className="cursor-pointer text-xs text-gray-500">
                      详细数据
                    </summary>
                    <pre className="text-xs bg-gray-100 p-1 rounded mt-1 overflow-x-auto">
                      {JSON.stringify(log.data, null, 2)}
                    </pre>
                  </details>
                )}
              </div>
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
});