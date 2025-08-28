import { 
  Role, 
  GamePhase,
  type StartGameParams, 
  type PlayerContext, 
  type WitchContext, 
  type SeerContext,
  type PlayerId,
  PersonalityType,
  VotingResponseType,
  SpeechResponseType,
  VotingResponseSchema,
  NightActionResponseType,
  WerewolfNightActionSchema,
  SeerNightActionSchema,
  WitchNightActionSchema,
  SpeechResponseSchema,
  LastWordsResponseSchema,
  type LastWordsResponseType,
  type LastWordsParams
} from '@ai-werewolf/types';
import { WerewolfPrompts } from './prompts';
import { generateObject } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { 
  getAITelemetryConfig,
  createGameSession,
  createPhaseTrace,
  endPhaseTrace,
  logEvent,
  type AITelemetryContext
} from './services/langfuse';
import { PlayerConfig } from './config/PlayerConfig';
import { AIMemorySystem, WerewolfCommunicationSystem } from '@ai-werewolf/lib';

// 角色到夜间行动 Schema 的映射
const ROLE_SCHEMA_MAP = {
  [Role.WEREWOLF]: WerewolfNightActionSchema,
  [Role.SEER]: SeerNightActionSchema,
  [Role.WITCH]: WitchNightActionSchema,
} as const;

export class PlayerServer {
  private gameId?: string;
  private playerId?: number;
  private role?: Role;
  private teammates?: PlayerId[];
  private config: PlayerConfig;
  private aiMemory?: AIMemorySystem;
  private werewolfComm?: WerewolfCommunicationSystem;

  constructor(config: PlayerConfig) {
    this.config = config;
  }

  async startGame(params: StartGameParams): Promise<void> {
    this.gameId = params.gameId;
    this.role = params.role as Role;
    this.teammates = params.teammates;
    this.playerId = params.playerId;
    
    // 初始化AI记忆系统
    this.aiMemory = new AIMemorySystem(
      this.role,
      this.playerId,
      this.teammates
    );
    
    // 如果是狼人，初始化狼人交流系统
    if (this.role === Role.WEREWOLF) {
      this.werewolfComm = new WerewolfCommunicationSystem();
    }
    
    // 创建 Langfuse session
    createGameSession(this.gameId, {
      playerId: this.playerId,
      role: this.role,
      teammates: this.teammates
    });
    
    if (this.config.logging.enabled) {
      console.log(`🎮 Player started game ${this.gameId} as ${this.role}`);
      console.log(`👤 Player ID: ${this.playerId}`);
      if (this.teammates && this.teammates.length > 0) {
        console.log(`🤝 Teammates: ${this.teammates.join(', ')}`);
      }
      console.log(`📊 Game ID (session): ${this.gameId}`);
    }
  }

  async speak(context: PlayerContext): Promise<string> {
    console.log(`🗣️ [Player ${this.playerId}] speak() 被调用`);
    
    if (!this.role) {
      console.error(`❌ [Player ${this.playerId}] speak() 失败: 角色未设置`);
      return "我需要仔细思考一下当前的情况。";
    }
    
    if (!this.config.ai.apiKey) {
      console.error(`❌ [Player ${this.playerId}] speak() 失败: API密钥未配置`);
      console.error(`🔍 [Player ${this.playerId}] 配置信息:`, {
        provider: this.config.ai.provider,
        model: this.config.ai.model,
        hasApiKey: !!this.config.ai.apiKey,
        envApiKey: !!process.env.OPENROUTER_API_KEY
      });
      return "我需要仔细思考一下当前的情况。";
    }

    console.log(`📝 [Player ${this.playerId}] speak() 参数:`, {
      round: context.round,
      phase: context.currentPhase,
      alivePlayers: context.alivePlayers?.length || 0,
      allSpeeches: Object.keys(context.allSpeeches || {}).length,
      allVotes: Object.keys(context.allVotes || {}).length
    });

    // 使用AI记忆系统分析当前局势
    if (this.aiMemory) {
      this.aiMemory.updateGameContext(context.round, context.currentPhase);
      
      // 分析最新发言
      const currentRoundSpeeches = context.allSpeeches[context.round] || [];
      for (const speech of currentRoundSpeeches) {
        if (speech.playerId !== this.playerId) {
          this.aiMemory.analyzeSpeech(speech, context.allSpeeches, context.alivePlayers);
        }
      }
      
      // 分析投票模式
      const currentRoundVotes = context.allVotes[context.round] || [];
      if (currentRoundVotes.length > 0) {
        this.aiMemory.analyzeVotingPattern(currentRoundVotes, context.allVotes, context.alivePlayers);
      }
    }

    try {
      const speechResponse = await this.generateSpeech(context);
      console.log(`✅ [Player ${this.playerId}] speak() 成功生成发言:`, speechResponse.speech);
      return speechResponse.speech;
    } catch (error) {
      console.error(`❌ [Player ${this.playerId}] speak() 内部错误:`, error);
      return "我需要仔细思考一下当前的情况。";
    }
  }

  async vote(context: PlayerContext): Promise<VotingResponseType> {
    if (!this.role || !this.config.ai.apiKey) {
      return { target: 1, reason: "默认投票给玩家1" };
    }

    // 使用AI记忆系统进行角色推断和威胁评估
    if (this.aiMemory) {
      this.aiMemory.deduceRoles(context.alivePlayers, context.allSpeeches, context.allVotes);
    }

    return await this.generateVote(context);
  }

  async useAbility(context: PlayerContext | WitchContext | SeerContext): Promise<any> {
    console.log(`🌙 [Player ${this.playerId}] useAbility() 被调用`);
    console.log(`📝 [Player ${this.playerId}] useAbility() 角色: ${this.role}`);
    console.log(`📝 [Player ${this.playerId}] useAbility() API密钥: ${!!this.config.ai.apiKey}`);
    
    if (!this.role) {
      console.error(`❌ [Player ${this.playerId}] useAbility() 失败: 角色未设置`);
      throw new Error("角色未设置，无法使用特殊能力。");
    }
    
    if (!this.config.ai.apiKey) {
      console.error(`❌ [Player ${this.playerId}] useAbility() 失败: API密钥未配置`);
      throw new Error("API密钥未配置，无法使用特殊能力。");
    }

    try {
      const result = await this.generateAbilityUse(context);
      console.log(`✅ [Player ${this.playerId}] useAbility() 成功:`, JSON.stringify(result, null, 2));
      return result;
    } catch (error) {
      console.error(`❌ [Player ${this.playerId}] useAbility() 内部错误:`, error);
      throw error;
    }
  }

  async lastWords(lastWordsParams?: LastWordsParams): Promise<string> {
    if (!this.role || !this.config.ai.apiKey || !lastWordsParams) {
      return "很遗憾要离开游戏了，希望好人阵营能够获胜！";
    }

    return await this.generateLastWords(lastWordsParams);
  }

  getStatus() {
    return {
      gameId: this.gameId,
      playerId: this.playerId,
      role: this.role,
      teammates: this.teammates,
      isAlive: true,
      config: {
        personality: this.config.game.personality
      }
    };
  }

  // Getter methods for prompt factories
  getRole(): Role | undefined {
    return this.role;
  }

  getPlayerId(): number | undefined {
    return this.playerId;
  }

  getTeammates(): PlayerId[] | undefined {
    return this.teammates;
  }

  getPersonalityPrompt(): string {
    return this.buildPersonalityPrompt();
  }

  getGameId(): string | undefined {
    return this.gameId;
  }

  // 通用AI生成方法
  private async generateWithLangfuse<T>(
    params: {
      functionId: string;
      schema: any;  // Zod schema
      prompt: string;
      maxOutputTokens?: number;
      temperature?: number;
      context?: PlayerContext;  // 使用 PlayerContext 替代 telemetryMetadata
    }
  ): Promise<T> {
    const { functionId, context, schema, prompt, maxOutputTokens, temperature } = params;
    
    console.log(`🤖 [Player ${this.playerId}] ${functionId} - AI请求开始`);
    console.log(`📝 [Player ${this.playerId}] ${functionId} prompt:`, prompt);
    console.log(`📋 [Player ${this.playerId}] ${functionId} schema:`, JSON.stringify(schema.shape, null, 2));
    console.log(`⚙️ [Player ${this.playerId}] ${functionId} 配置:`, {
      model: this.config.ai.model,
      maxTokens: maxOutputTokens || this.config.ai.maxTokens,
      temperature: temperature ?? this.config.ai.temperature,
      provider: this.config.ai.provider
    });
    
    // 获取遥测配置
    const telemetryConfig = this.getTelemetryConfig(functionId, context);
    
    const startTime = Date.now();
    
    // 为女巫等复杂Schema增加重试机制
    const maxRetries = functionId === 'ability-generation' ? 3 : 1;
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🚀 [Player ${this.playerId}] ${functionId} - 第${attempt}次尝试AI请求...`);
        
        const result = await generateObject({
          model: this.getModel(),
          schema: schema,
          prompt: prompt,
          maxOutputTokens: maxOutputTokens || this.config.ai.maxTokens,
          temperature: temperature ?? this.config.ai.temperature,
          // 使用 experimental_telemetry（只有在有配置时才传递）
          ...(telemetryConfig && { experimental_telemetry: telemetryConfig }),
        });

        const duration = Date.now() - startTime;
        console.log(`✅ [Player ${this.playerId}] ${functionId} - AI请求成功 (耗时: ${duration}ms, 尝试: ${attempt}/${maxRetries})`);
        console.log(`🎯 [Player ${this.playerId}] ${functionId} result:`, JSON.stringify(result.object, null, 2));
        
        return result.object as T;
      } catch (error) {
        const duration = Date.now() - startTime;
        lastError = error instanceof Error ? error : new Error(String(error));
        
        console.error(`❌ [Player ${this.playerId}] ${functionId} - 第${attempt}次尝试失败 (耗时: ${duration}ms):`, lastError.message);
        
        // 如果是解析错误且还有重试机会，继续重试
        if (attempt < maxRetries && (lastError.message.includes('parse') || lastError.message.includes('No object generated'))) {
          console.warn(`⚠️ [Player ${this.playerId}] ${functionId} - 检测到解析错误，将进行第${attempt + 1}次重试...`);
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt)); // 递增延迟
          continue;
        }
        
        // 如果是最后一次尝试失败，输出详细错误信息
        if (attempt === maxRetries) {
          console.error(`🔍 [Player ${this.playerId}] ${functionId} - 所有重试失败，错误详情:`, {
            message: lastError.message,
            stack: lastError.stack,
            attempts: maxRetries,
            config: {
              model: this.config.ai.model,
              provider: this.config.ai.provider,
              hasApiKey: !!this.config.ai.apiKey,
              maxTokens: maxOutputTokens || this.config.ai.maxTokens,
              temperature: temperature ?? this.config.ai.temperature
            },
            promptLength: prompt.length,
            promptPreview: prompt.slice(0, 200) + '...'
          });
        }
      }
    }
    
    // 根据错误类型提供不同的错误信息
    let errorMessage = `Failed to generate ${functionId}`;
    if (lastError) {
      if (lastError.message.includes('API key')) {
        errorMessage += ': API密钥错误或未配置';
      } else if (lastError.message.includes('rate limit') || lastError.message.includes('429')) {
        errorMessage += ': API请求频率限制';
      } else if (lastError.message.includes('timeout')) {
        errorMessage += ': 请求超时';
      } else if (lastError.message.includes('network') || lastError.message.includes('fetch')) {
        errorMessage += ': 网络连接错误';
      } else if (lastError.message.includes('parse') || lastError.message.includes('No object generated')) {
        errorMessage += ': AI响应格式错误，无法解析为有效JSON';
      } else {
        errorMessage += `: ${lastError.message}`;
      }
    }
    
    throw new Error(errorMessage);
  }

  // AI生成方法
  private async generateSpeech(context: PlayerContext): Promise<SpeechResponseType> {
    const prompt = this.buildSpeechPrompt(context);
    
    return this.generateWithLangfuse<SpeechResponseType>({
      functionId: 'speech-generation',
      schema: SpeechResponseSchema,
      prompt: prompt,
      context: context,
    });
  }

  private async generateVote(context: PlayerContext): Promise<VotingResponseType> {
    const prompt = this.buildVotePrompt(context);
    
    return this.generateWithLangfuse<VotingResponseType>({
      functionId: 'vote-generation',
      schema: VotingResponseSchema,
      prompt: prompt,
      context: context,
    });
  }

  private async generateAbilityUse(context: PlayerContext | WitchContext | SeerContext): Promise<NightActionResponseType> {
    console.log(`🌙 [Player ${this.playerId}] generateAbilityUse() 开始`);
    console.log(`📝 [Player ${this.playerId}] generateAbilityUse() 角色: ${this.role}`);
    
    if (this.role === Role.VILLAGER) {
      console.error(`❌ [Player ${this.playerId}] generateAbilityUse() 村民无夹间能力`);
      throw new Error('Village has no night action, should be skipped');
    }
    
    const schema = ROLE_SCHEMA_MAP[this.role!];
    if (!schema) {
      console.error(`❌ [Player ${this.playerId}] generateAbilityUse() 未知角色: ${this.role}`);
      throw new Error(`Unknown role: ${this.role}`);
    }

    console.log(`📄 [Player ${this.playerId}] generateAbilityUse() 正在构建提示词...`);
    try {
      const prompt = this.buildAbilityPrompt(context);
      console.log(`✅ [Player ${this.playerId}] generateAbilityUse() 提示词构建成功`);
    
      console.log(`🤖 [Player ${this.playerId}] generateAbilityUse() 调用AI生成...`);
      const result = await this.generateWithLangfuse<NightActionResponseType>({
        functionId: 'ability-generation',
        schema: schema,
        prompt: prompt,
        context: context,
      });
      
      console.log(`✅ [Player ${this.playerId}] generateAbilityUse() AI生成成功`);
      return result;
    } catch (error) {
      console.error(`❌ [Player ${this.playerId}] generateAbilityUse() 错误:`, error);
      throw error;
    }
  }

  private async generateLastWords(params: LastWordsParams): Promise<string> {
    const prompt = this.buildLastWordsPrompt(params);
    
    const result = await this.generateWithLangfuse<LastWordsResponseType>({
      functionId: 'last-words-generation',
      schema: LastWordsResponseSchema,
      prompt: prompt,
    });
    
    return result.content;
  }

  // 狼人交流方法
  async werewolfCommunicate(context: PlayerContext): Promise<{
    messageType: string;
    content: string;
    suggestedTarget?: number;
  }> {
    if (this.role !== Role.WEREWOLF || !this.werewolfComm || !this.aiMemory) {
      throw new Error('只有狼人才能使用对话功能');
    }

    const werewolfContext = {
      round: context.round,
      alivePlayers: context.alivePlayers,
      werewolfTeam: this.teammates || [],
      aliveWerewolves: (this.teammates || []).filter(id => 
        context.alivePlayers.some(p => p.id === id && p.isAlive)
      ),
      targetCandidates: context.alivePlayers
        .filter(p => p.isAlive && !this.teammates?.includes(p.id) && p.id !== this.playerId)
        .map(p => p.id),
      gameAnalysis: this.aiMemory.getMemorySummary(),
      urgencyLevel: 'medium' as const
    };

    const communication = this.werewolfComm.generateWerewolfCommunication(
      this.playerId!,
      werewolfContext,
      context.allSpeeches,
      context.allVotes
    );

    return {
      messageType: communication.messageType,
      content: communication.content,
      suggestedTarget: communication.suggestedTarget
    };
  }

  // Prompt构建方法
  private buildSpeechPrompt(context: PlayerContext): string {
    let speechPrompt = WerewolfPrompts.getSpeech(
      this,
      context
    );

    // 集成AI记忆系统的分析结果
    if (this.aiMemory) {
      const memorySummary = this.aiMemory.getMemorySummary(5);
      const threatAssessment = this.aiMemory.getThreatAssessment();
      const strategy = this.aiMemory.generateStrategy({
        currentPhase: context.currentPhase,
        alivePlayers: context.alivePlayers,
        allSpeeches: context.allSpeeches,
        allVotes: context.allVotes
      });

      speechPrompt += `\n\n重要记忆信息:\n${memorySummary}`;
      
      if (threatAssessment.length > 0) {
        const threats = threatAssessment.slice(0, 3).map((t: any) => 
          `${t.playerId}号(威胁级别: ${Math.round(t.threatLevel * 100)}%): ${t.reason}`
        ).join('; ');
        speechPrompt += `\n\n威胁评估: ${threats}`;
      }
      
      speechPrompt += `\n\n当前策略: ${strategy.primaryStrategy}\n理由: ${strategy.reasoning}`;
    }

    return speechPrompt + '\n\n注意：发言内容控制在30-80字，语言自然，像真人玩家。';
  }

  private buildVotePrompt(context: PlayerContext): string {
    const personalityPrompt = this.buildPersonalityPrompt();

    const additionalParams = {
      teammates: this.teammates
    };

    // 为预言家添加查验结果
    if (this.role === Role.SEER && 'investigatedPlayers' in context) {
      const seerContext = context as any;
      const checkResults: {[key: string]: 'good' | 'werewolf'} = {};
      
      for (const investigation of Object.values(seerContext.investigatedPlayers)) {
        const investigationData = investigation as { target: number; isGood: boolean };
        checkResults[investigationData.target.toString()] = investigationData.isGood ? 'good' : 'werewolf';
      }
      
      (additionalParams as any).checkResults = checkResults;
    }

    let votingPrompt = WerewolfPrompts.getVoting(
      this,
      context
    );

    // 集成AI记忆系统的分析结果
    if (this.aiMemory) {
      const threatAssessment = this.aiMemory.getThreatAssessment();
      if (threatAssessment.length > 0) {
        const topThreat = threatAssessment[0];
        votingPrompt += `\n\n最高威胁目标: ${topThreat.playerId}号 (威胁级别: ${Math.round(topThreat.threatLevel * 100)}%, 理由: ${topThreat.reason})`;
      }
    }

    return personalityPrompt + votingPrompt;
  }

  private buildAbilityPrompt(context: PlayerContext | WitchContext | SeerContext): string {
    const nightPrompt = WerewolfPrompts.getNightAction(this, context);
    
    return nightPrompt;
  }

  private buildLastWordsPrompt(params: LastWordsParams): string {
    const { getLastWords } = require('./prompts/special');
    let lastWordsPrompt = getLastWords(params);
    
    // 集成AI记忆系统的分析结果
    if (this.aiMemory) {
      const memorySummary = this.aiMemory.getMemorySummary(3);
      const threatAssessment = this.aiMemory.getThreatAssessment();
      
      lastWordsPrompt += `\n\n重要记忆信息:\n${memorySummary}`;
      
      if (threatAssessment.length > 0) {
        const suspects = threatAssessment.slice(0, 2).map((t: any) => 
          `${t.playerId}号(威胁级别${Math.round(t.threatLevel * 100)}%)`
        ).join(', ');
        lastWordsPrompt += `\n\n可疑玩家: ${suspects}`;
      }
    }

    lastWordsPrompt += `\n\n请返回JSON格式：
{
  "content": "你的遗言内容(30-100字)",
  "reveal_role": false,
  "accusation": "指认的玩家(可选)",
  "advice": "给好人阵营的建议(可选)"
}`;
    
    return lastWordsPrompt;
  }

  // 辅助方法
  private getModel() {
    console.log(`🤖 [Player ${this.playerId}] getModel() 初始化AI客户端`);
    
    const apiKey = this.config.ai.apiKey || process.env.OPENROUTER_API_KEY;
    
    if (!apiKey) {
      console.error(`❌ [Player ${this.playerId}] getModel() 失败: 未找到API密钥`);
      console.error(`🔍 [Player ${this.playerId}] 配置检查:`, {
        configApiKey: !!this.config.ai.apiKey,
        envApiKey: !!process.env.OPENROUTER_API_KEY,
        provider: this.config.ai.provider,
        model: this.config.ai.model
      });
      throw new Error('API密钥未配置');
    }
    
    console.log(`⚙️ [Player ${this.playerId}] getModel() 配置:`, {
      provider: this.config.ai.provider,
      model: this.config.ai.model,
      hasApiKey: !!apiKey,
      apiKeyPrefix: apiKey.substring(0, 10) + '...'
    });
    
    try {
      const openrouter = createOpenAICompatible({
        name: 'openrouter',
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey: apiKey,
        headers: {
          'HTTP-Referer': 'https://mojo.monad.xyz',
          'X-Title': 'AI Werewolf Game',
        },
      });
      
      const model = openrouter.chatModel(this.config.ai.model);
      console.log(`✅ [Player ${this.playerId}] getModel() 初始化成功`);
      return model;
    } catch (error) {
      console.error(`❌ [Player ${this.playerId}] getModel() 初始化失败:`, error);
      throw new Error(`AI客户端初始化失败: ${error}`);
    }
  }

  private getTelemetryConfig(
    functionId: string,
    context?: PlayerContext
  ) {
    if (!this.gameId || !this.playerId) {
      return false;
    }
    
    const telemetryContext: AITelemetryContext = {
      gameId: this.gameId,
      playerId: this.playerId,
      functionId,
      context,
    };
    
    return getAITelemetryConfig(telemetryContext);
  }

  private buildPersonalityPrompt(): string {
    if (!this.config.game.strategy) {
      return '';
    }

    const personalityType = this.config.game.strategy === 'balanced' ? 'cunning' : this.config.game.strategy as PersonalityType;
    
    return WerewolfPrompts.getPersonality(personalityType) + '\n\n';
  }
}