'use client';

import { observer } from 'mobx-react-lite';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import clsx from 'clsx';
import { Role } from '@ai-werewolf/types';
import { gameMaster } from '@/stores/gameStore';

export const ChatDisplay = observer(function ChatDisplay() {
  const gameState = gameMaster.getGameState();
  const speechesData = gameMaster.getSpeeches();
  
  // 将 AllSpeeches 对象转换为数组格式，保持时间顺序（最新的在前）
  const speeches = Object.keys(speechesData)
    .sort((a, b) => Number(b) - Number(a)) // 按回合数倒序排序，最新的回合在前
    .flatMap(round => {
      const roundSpeeches = speechesData[Number(round)] || [];
      return roundSpeeches.slice().reverse(); // 每个回合内的消息也倒序，最新的在前
    })
    .filter(speech => speech != null);
  
  // 详细调试信息
  console.log('=== ChatDisplay 调试信息 ===');
  console.log('📋 ChatDisplay - 原始speeches数据:', speechesData);
  console.log('📋 ChatDisplay - 处理后speeches数组:', speeches);
  console.log('📋 ChatDisplay - speeches长度:', speeches.length);
  console.log('📋 ChatDisplay - gameState:', gameState);
  console.log('📋 ChatDisplay - 游戏状态:', {
    hasGameState: !!gameState,
    playersCount: gameState?.players?.length || 0,
    currentPhase: gameState?.currentPhase,
    currentRound: gameState?.round // 使用正确的属性名
  });
  
  // 检查每个speech的有效性
  speeches.forEach((speech, index) => {
    if (!speech.content || !speech.playerId) {
      console.warn(`⚠️ ChatDisplay - 发现无效speech[${index}]:`, speech);
    }
  });

  const getPlayerRole = (playerId: number): Role | null => {
    if (!gameState) return null;
    const player = gameState.players.find(p => p.id === playerId);
    return player?.role || null;
  };

  const getMessageStyle = () => {
    return 'border border-border bg-card';
  };

  const getRoleText = (role: Role | null) => {
    const roleMap = {
      [Role.WEREWOLF]: '狼人',
      [Role.VILLAGER]: '村民',
      [Role.SEER]: '预言家',
      [Role.WITCH]: '女巫'
    };
    return role ? roleMap[role] : '';
  };

  if (!gameState && speeches.length === 0) {
    return (
      <Card className="max-h-[800px] flex flex-col">
        <CardHeader className="flex-shrink-0">
          <CardTitle className='text-sm'>玩家对话记录</CardTitle>
        </CardHeader>
        <CardContent className="flex-1 flex items-center justify-center">
          <div className="text-muted-foreground text-sm">
            等待游戏开始...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="max-h-[800px] flex flex-col">
      <CardHeader className="flex-shrink-0">
        <CardTitle className='text-sm'>玩家对话记录</CardTitle>
      </CardHeader>
        
      <CardContent className="flex-1 overflow-y-auto p-4 space-y-2 min-h-0">
        {speeches.length === 0 ? (
          <div className="text-muted-foreground text-center py-8 text-sm">
            暂无发言记录
          </div>
        ) : (
          speeches
            .map((speech, index) => {
              const role = getPlayerRole(speech.playerId);
              const messageStyle = getMessageStyle();
              
              // 为每个发言添加详细调试
              console.log(`💬 ChatDisplay - 渲染speech[${index}]:`, {
                speech,
                role,
                isSystem: speech.type === 'system',
                isPlayer: speech.type === 'player' || !speech.type,
                hasContent: !!speech.content,
                contentLength: speech.content?.length || 0
              });
              
              return (
                <div
                  key={`${speech.playerId}-${index}-${speech.content?.slice(0, 10) || 'empty'}`}
                  className={clsx(
                    'rounded-lg p-3 transition-all duration-200',
                    'hover:shadow-sm border-l-4',
                    messageStyle,
                    {
                      'border-l-blue-500': speech.type === 'system',
                      'border-l-green-500': speech.type === 'player' || !speech.type,
                      'bg-blue-50': speech.type === 'system',
                      'bg-green-50': speech.type === 'player' || !speech.type
                    }
                  )}
                >
                  <div className="flex justify-between items-start mb-1">
                    <div className="flex items-center space-x-2">
                      <span className={clsx(
                        'font-medium text-sm',
                        {
                          'text-primary': speech.type === 'system',
                          'text-foreground': speech.type === 'player' || !speech.type
                        }
                      )}>
                        {speech.type === 'system' ? '系统' : `玩家${speech.playerId}`}
                      </span>
                      
                      {speech.type === 'system' && (
                        <Badge variant="secondary" className="text-xs h-5">
                          系统通知
                        </Badge>
                      )}
                      
                      
                      {(!speech.type || speech.type === 'player') && role && (
                        <Badge 
                          variant={role === Role.WEREWOLF ? 'destructive' : 'outline'}
                          className="text-xs h-5"
                        >
                          {getRoleText(role)}
                        </Badge>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground shrink-0 ml-2">
                      {format(new Date(), 'HH:mm:ss')}
                    </span>
                  </div>
                  <div className="text-sm text-foreground leading-relaxed mt-1">
                    {speech.content || '无内容'}
                  </div>
                  
                  {/* 调试信息（仅在开发环境显示） */}
                  {process.env.NODE_ENV === 'development' && (
                    <div className="text-xs text-gray-400 mt-1 border-t pt-1">
                      Debug: Player#{speech.playerId}, Type: {speech.type || 'player'}, Role: {role || 'unknown'}
                    </div>
                  )}
                </div>
              );
            })
        )}
      </CardContent>
    </Card>
  );
});