import type {
  PlayerContext,
  StartGameParams,
  SpeechResponseType,
  VotingResponseType,
  NightActionResponseType
} from '@ai-werewolf/types';
import pRetry, { AbortError } from 'p-retry';

export class PlayerAPIClient {
  private url: string;
  private playerId: number;
  
  // 不该重试的状态码
  private static readonly NON_RETRYABLE_STATUS = [400, 401, 403, 404, 422];

  constructor(playerId: number, url: string) {
    this.playerId = playerId;
    this.url = url;
  }

  // 函数重载 - 精确的类型映射
  private async call(endpoint: 'start-game', params: StartGameParams): Promise<void>;
  private async call(endpoint: 'speak', params: PlayerContext): Promise<SpeechResponseType>;
  private async call(endpoint: 'vote', params: PlayerContext): Promise<VotingResponseType>;
  private async call(endpoint: 'use-ability', params: PlayerContext): Promise<NightActionResponseType | null>;
  private async call(endpoint: 'status'): Promise<any>;
  private async call(
    endpoint: 'use-ability' | 'speak' | 'vote' | 'start-game' | 'status', 
    params?: PlayerContext | StartGameParams
  ): Promise<unknown> {
    console.log(`🚀 [GameMaster -> Player ${this.playerId}] 调用 ${endpoint}`);
    if (params) {
      console.log(`📝 [GameMaster -> Player ${this.playerId}] 请求参数:`, JSON.stringify(params, null, 2));
    }
    
    return pRetry(
      async () => {
        const startTime = Date.now();
        console.log(`📡 [GameMaster -> Player ${this.playerId}] 发送HTTP请求到: ${this.url}/api/player/${endpoint}`);
        
        const isStatusRequest = endpoint === 'status';
        const response = await fetch(`${this.url}/api/player/${endpoint}`, {
          method: isStatusRequest ? 'GET' : 'POST',
          headers: isStatusRequest ? {} : { 'Content-Type': 'application/json' },
          body: isStatusRequest ? undefined : JSON.stringify(params),
          signal: AbortSignal.timeout(45000) // AI需要更长时间
        });
        
        const duration = Date.now() - startTime;
        console.log(`📊 [GameMaster -> Player ${this.playerId}] HTTP响应: ${response.status} ${response.statusText} (耗时: ${duration}ms)`);
        
        if (response.ok) {
          // start-game 没有响应体
          if (endpoint === 'start-game') {
            console.log(`✅ [GameMaster -> Player ${this.playerId}] ${endpoint} 成功，无响应体`);
            return;
          }
          
          const result = await response.json();
          console.log(`✅ [GameMaster -> Player ${this.playerId}] ${endpoint} 成功`);
          console.log(`📝 [GameMaster -> Player ${this.playerId}] 响应数据:`, JSON.stringify(result, null, 2));
          return result;
        }
        
        const errorText = await response.text();
        console.error(`❌ [GameMaster -> Player ${this.playerId}] ${endpoint} 失败`);
        console.error(`🔍 [GameMaster -> Player ${this.playerId}] 错误响应:`, errorText);
        
        const error = new Error(`HTTP ${response.status}: ${errorText}`);
        
        // 精确的错误分类
        if (PlayerAPIClient.NON_RETRYABLE_STATUS.includes(response.status)) {
          throw new AbortError(error.message);
        }
        
        // 5xx、429、408等值得重试
        throw error;
      },
      {
        retries: endpoint === 'start-game' ? 1 : 3, // 初始化快速失败
        minTimeout: 1000,
        maxTimeout: 10000,
        factor: 2,
        onFailedAttempt: error => {
          console.warn(`⚠️ [GameMaster -> Player ${this.playerId}] [${endpoint}] 重试 ${error.attemptNumber}/${error.retriesLeft + error.attemptNumber}: ${error.message}`);
        }
      }
    );
  }

  async useAbility(params: PlayerContext): Promise<NightActionResponseType | null> {
    return this.call('use-ability', params);
  }

  async speak(params: PlayerContext): Promise<SpeechResponseType> {
    return this.call('speak', params);
  }

  async vote(params: PlayerContext): Promise<VotingResponseType> {
    return this.call('vote', params);
  }

  async startGame(params: StartGameParams): Promise<void> {
    return this.call('start-game', params);
  }

  async getStatus(): Promise<any> {
    return this.call('status');
  }
}