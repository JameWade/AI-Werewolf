import { 
  Role, 
  type PlayerInfo, 
  type Speech, 
  type Vote, 
  GamePhase,
  type AllSpeeches,
  type AllVotes,
  type PlayerId,
  type  Round
} from '@ai-werewolf/types';

/**
 * AI记忆数据结构
 */
export interface AIMemoryEntry {
  id: string;
  timestamp: number;
  round: Round;
  type: 'speech_analysis' | 'vote_pattern' | 'role_deduction' | 'strategy' | 'contradiction';
  playerId?: PlayerId;
  content: string;
  confidence: number; // 0-1之间的置信度
  relevance: number;   // 0-1之间的相关度
  source: 'observation' | 'deduction' | 'interaction';
}

/**
 * 玩家分析档案
 */
export interface PlayerProfile {
  playerId: PlayerId;
  suspectedRole?: Role;
  confidence: number;
  behaviors: string[];
  contradictions: string[];
  alliances: PlayerId[];
  threats: PlayerId[];
  lastUpdated: Round;
}

/**
 * 策略记忆
 */
export interface StrategyMemory {
  situation: string;
  action: string;
  outcome: 'success' | 'failure' | 'neutral';
  context: Record<string, any>;
  lessons: string[];
}

/**
 * AI记忆系统 - 让AI能够记住重要信息并进行深度分析
 */
export class AIMemorySystem {
  private memories: AIMemoryEntry[] = [];
  private playerProfiles: Map<PlayerId, PlayerProfile> = new Map();
  private strategyMemories: StrategyMemory[] = [];
  private gameContext: {
    myRole: Role;
    myPlayerId: PlayerId;
    teammates?: PlayerId[];
    currentRound: Round;
    currentPhase: GamePhase;
  };

  constructor(myRole: Role, myPlayerId: PlayerId, teammates?: PlayerId[]) {
    this.gameContext = {
      myRole,
      myPlayerId,
      teammates: teammates || [],
      currentRound: 1,
      currentPhase: GamePhase.DAY
    };
  }

  /**
   * 更新游戏上下文
   */
  updateGameContext(round: Round, phase: GamePhase): void {
    this.gameContext.currentRound = round;
    this.gameContext.currentPhase = phase;
  }

  /**
   * 分析发言并存储记忆
   */
  analyzeSpeech(speech: Speech, allSpeeches: AllSpeeches, alivePlayers: PlayerInfo[]): void {
    const playerId = speech.playerId;
    
    // 分析发言内容
    const analysis = this.extractSpeechInsights(speech, allSpeeches);
    
    // 存储发言分析记忆
    this.addMemory({
      type: 'speech_analysis',
      playerId,
      content: analysis.summary,
      confidence: analysis.confidence,
      relevance: this.calculateRelevance(playerId, analysis.keywords),
      source: 'observation'
    });

    // 更新玩家档案
    this.updatePlayerProfile(playerId, analysis, alivePlayers);

    // 检测矛盾
    const contradictions = this.detectContradictions(playerId, speech, allSpeeches);
    if (contradictions.length > 0) {
      this.addMemory({
        type: 'contradiction',
        playerId,
        content: `检测到矛盾: ${contradictions.join('; ')}`,
        confidence: 0.8,
        relevance: 0.9,
        source: 'deduction'
      });
    }
  }

  /**
   * 分析投票模式
   */
  analyzeVotingPattern(votes: Vote[], allVotes: AllVotes, alivePlayers: PlayerInfo[]): void {
    const patterns = this.extractVotingPatterns(votes, allVotes);
    
    for (const pattern of patterns) {
      this.addMemory({
        type: 'vote_pattern',
        playerId: pattern.playerId,
        content: pattern.description,
        confidence: pattern.confidence,
        relevance: 0.8,
        source: 'observation'
      });
    }
  }

  /**
   * 进行角色推断
   */
  deduceRoles(alivePlayers: PlayerInfo[], allSpeeches: AllSpeeches, allVotes: AllVotes): Map<PlayerId, { role: Role; confidence: number }> {
    const roleDeductions = new Map<PlayerId, { role: Role; confidence: number }>();
    
    for (const player of alivePlayers) {
      if (player.id === this.gameContext.myPlayerId) continue;
      
      const deduction = this.analyzePlayerRole(player.id, allSpeeches, allVotes);
      if (deduction.confidence > 0.3) {
        roleDeductions.set(player.id, deduction);
        
        this.addMemory({
          type: 'role_deduction',
          playerId: player.id,
          content: `推断角色: ${deduction.role} (置信度: ${deduction.confidence})`,
          confidence: deduction.confidence,
          relevance: 0.9,
          source: 'deduction'
        });
      }
    }
    
    return roleDeductions;
  }

  /**
   * 生成策略建议
   */
  generateStrategy(
    context: {
      currentPhase: GamePhase;
      alivePlayers: PlayerInfo[];
      allSpeeches: AllSpeeches;
      allVotes: AllVotes;
    }
  ): {
    primaryStrategy: string;
    reasoning: string;
    targetPlayers: PlayerId[];
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const relevantMemories = this.getRelevantMemories(context.currentPhase);
    const playerAnalysis = this.getPlayerAnalysis();
    
    let strategy: any = {
      primaryStrategy: '',
      reasoning: '',
      targetPlayers: [],
      riskLevel: 'medium' as const
    };

    if (this.gameContext.myRole === Role.WEREWOLF) {
      strategy = this.generateWerewolfStrategy(context, relevantMemories, playerAnalysis);
    } else if (this.gameContext.myRole === Role.SEER) {
      strategy = this.generateSeerStrategy(context, relevantMemories, playerAnalysis);
    } else if (this.gameContext.myRole === Role.WITCH) {
      strategy = this.generateWitchStrategy(context, relevantMemories, playerAnalysis);
    } else {
      strategy = this.generateVillagerStrategy(context, relevantMemories, playerAnalysis);
    }

    // 存储策略记忆
    this.addMemory({
      type: 'strategy',
      content: `策略: ${strategy.primaryStrategy} | 理由: ${strategy.reasoning}`,
      confidence: 0.7,
      relevance: 1.0,
      source: 'deduction'
    });

    return strategy;
  }

  /**
   * 获取重要记忆摘要
   */
  getMemorySummary(maxEntries: number = 10): string {
    const importantMemories = this.memories
      .filter(m => m.relevance > 0.6 && m.confidence > 0.5)
      .sort((a, b) => (b.relevance * b.confidence) - (a.relevance * a.confidence))
      .slice(0, maxEntries);

    if (importantMemories.length === 0) {
      return '暂无重要记忆信息。';
    }

    const summary = importantMemories.map(memory => 
      `第${memory.round}轮: ${memory.content} (置信度: ${Math.round(memory.confidence * 100)}%)`
    ).join('\n');

    return `重要记忆信息:\n${summary}`;
  }

  /**
   * 获取玩家威胁评估
   */
  getThreatAssessment(): Array<{ playerId: PlayerId; threatLevel: number; reason: string }> {
    const threats: Array<{ playerId: PlayerId; threatLevel: number; reason: string }> = [];
    
    for (const [playerId, profile] of this.playerProfiles) {
      if (playerId === this.gameContext.myPlayerId) continue;
      
      let threatLevel = 0;
      const reasons: string[] = [];
      
      // 基于怀疑角色的威胁评估
      if (profile.suspectedRole === Role.WEREWOLF && this.gameContext.myRole !== Role.WEREWOLF) {
        threatLevel += 0.8;
        reasons.push('疑似狼人');
      }
      
      // 基于行为模式的威胁评估
      if (profile.contradictions.length > 2) {
        threatLevel += 0.3;
        reasons.push('发言矛盾');
      }
      
      // 基于投票模式的威胁评估
      const votingMemories = this.memories.filter(m => 
        m.type === 'vote_pattern' && m.playerId === playerId
      );
      
      if (votingMemories.some(m => m.content.includes('可疑'))) {
        threatLevel += 0.2;
        reasons.push('投票行为可疑');
      }
      
      if (threatLevel > 0.3) {
        threats.push({
          playerId,
          threatLevel: Math.min(threatLevel, 1.0),
          reason: reasons.join(', ')
        });
      }
    }
    
    return threats.sort((a, b) => b.threatLevel - a.threatLevel);
  }

  // ===== 私有方法 =====

  private addMemory(params: Omit<AIMemoryEntry, 'id' | 'timestamp' | 'round'>): void {
    const memory: AIMemoryEntry = {
      id: `memory_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      round: this.gameContext.currentRound,
      ...params
    };
    
    this.memories.push(memory);
    
    // 限制记忆数量，保留最重要的记忆
    if (this.memories.length > 100) {
      this.memories = this.memories
        .sort((a, b) => (b.relevance * b.confidence) - (a.relevance * a.confidence))
        .slice(0, 80);
    }
  }

  private extractSpeechInsights(speech: Speech, allSpeeches: AllSpeeches): {
    summary: string;
    confidence: number;
    keywords: string[];
  } {
    const content = speech.content.toLowerCase();
    const keywords: string[] = [];
    let confidence = 0.5;
    
    // 提取关键词和分析
    if (content.includes('狼人') || content.includes('杀')) {
      keywords.push('狼人相关');
      confidence += 0.1;
    }
    
    if (content.includes('预言家') || content.includes('查验')) {
      keywords.push('预言家相关');
      confidence += 0.1;
    }
    
    if (content.includes('女巫') || content.includes('药')) {
      keywords.push('女巫相关');
      confidence += 0.1;
    }
    
    if (content.includes('投票') || content.includes('出局')) {
      keywords.push('投票相关');
      confidence += 0.1;
    }
    
    if (content.includes('昨晚') || content.includes('夜里')) {
      keywords.push('夜间信息');
      confidence += 0.1;
    }
    
    const summary = `${speech.playerId}号: ${keywords.length > 0 ? keywords.join(', ') : '一般发言'}`;
    
    return { summary, confidence: Math.min(confidence, 1.0), keywords };
  }

  private updatePlayerProfile(playerId: PlayerId, analysis: any, alivePlayers: PlayerInfo[]): void {
    let profile = this.playerProfiles.get(playerId);
    
    if (!profile) {
      profile = {
        playerId,
        confidence: 0,
        behaviors: [],
        contradictions: [],
        alliances: [],
        threats: [],
        lastUpdated: this.gameContext.currentRound
      };
    }
    
    // 更新行为记录
    if (analysis.keywords.length > 0) {
      profile.behaviors.push(`第${this.gameContext.currentRound}轮: ${analysis.keywords.join(', ')}`);
    }
    
    profile.lastUpdated = this.gameContext.currentRound;
    this.playerProfiles.set(playerId, profile);
  }

  private detectContradictions(playerId: PlayerId, speech: Speech, allSpeeches: AllSpeeches): string[] {
    const contradictions: string[] = [];
    const currentContent = speech.content.toLowerCase();
    
    // 获取该玩家的历史发言
    const playerSpeeches: Speech[] = [];
    for (const roundSpeeches of Object.values(allSpeeches)) {
      playerSpeeches.push(...roundSpeeches.filter(s => s.playerId === playerId));
    }
    
    // 简单的矛盾检测
    for (const pastSpeech of playerSpeeches) {
      if (pastSpeech.content === speech.content) continue;
      
      const pastContent = pastSpeech.content.toLowerCase();
      
      // 检测角色声明矛盾
      if (currentContent.includes('我是预言家') && pastContent.includes('我不是预言家')) {
        contradictions.push('角色声明前后矛盾');
      }
      
      if (currentContent.includes('我是女巫') && pastContent.includes('我不是女巫')) {
        contradictions.push('角色声明前后矛盾');
      }
      
      // 检测查验结果矛盾
      if (currentContent.includes('查验') && pastContent.includes('查验')) {
        contradictions.push('查验结果可能矛盾');
      }
    }
    
    return contradictions;
  }

  private extractVotingPatterns(votes: Vote[], allVotes: AllVotes): Array<{
    playerId: PlayerId;
    description: string;
    confidence: number;
  }> {
    const patterns: Array<{ playerId: PlayerId; description: string; confidence: number }> = [];
    
    // 分析每个玩家的投票模式
    const playerVotes = new Map<PlayerId, Vote[]>();
    
    for (const roundVotes of Object.values(allVotes)) {
      for (const vote of roundVotes) {
        if (!playerVotes.has(vote.voterId)) {
          playerVotes.set(vote.voterId, []);
        }
        playerVotes.get(vote.voterId)!.push(vote);
      }
    }
    
    for (const [playerId, votes] of playerVotes) {
      if (votes.length < 2) continue;
      
      // 检测跟票行为
      const isFollower = this.detectFollowerBehavior(votes, allVotes);
      if (isFollower) {
        patterns.push({
          playerId,
          description: '经常跟票，可能是狼人或保守村民',
          confidence: 0.6
        });
      }
      
      // 检测分散投票
      const targets = new Set(votes.map(v => v.targetId));
      if (targets.size === votes.length) {
        patterns.push({
          playerId,
          description: '投票分散，可能在搅局',
          confidence: 0.5
        });
      }
    }
    
    return patterns;
  }

  private detectFollowerBehavior(playerVotes: Vote[], allVotes: AllVotes): boolean {
    let followCount = 0;
    
    for (const vote of playerVotes) {
      const roundVotes = Object.values(allVotes).find(roundVotes => 
        roundVotes.some(v => v.voterId === vote.voterId && v.targetId === vote.targetId)
      );
      
      if (!roundVotes) continue;
      
      // 检查是否在该轮投票的后半段
      const voteIndex = roundVotes.findIndex(v => v.voterId === vote.voterId);
      if (voteIndex > roundVotes.length / 2) {
        followCount++;
      }
    }
    
    return followCount > playerVotes.length * 0.6;
  }

  private analyzePlayerRole(playerId: PlayerId, allSpeeches: AllSpeeches, allVotes: AllVotes): {
    role: Role;
    confidence: number;
  } {
    let werewolfScore = 0;
    let seerScore = 0;
    let witchScore = 0;
    let villagerScore = 0;
    
    // 分析发言内容
    const playerSpeeches: Speech[] = [];
    for (const roundSpeeches of Object.values(allSpeeches)) {
      playerSpeeches.push(...roundSpeeches.filter(s => s.playerId === playerId));
    }
    
    for (const speech of playerSpeeches) {
      const content = speech.content.toLowerCase();
      
      if (content.includes('预言家') || content.includes('查验')) {
        seerScore += 0.2;
      }
      
      if (content.includes('女巫') || content.includes('药')) {
        witchScore += 0.2;
      }
      
      if (content.includes('我是村民') || content.includes('好人')) {
        villagerScore += 0.1;
      }
      
      // 狼人往往会误导或保持低调
      if (content.includes('不确定') || content.includes('可能')) {
        werewolfScore += 0.1;
      }
    }
    
    // 基于矛盾检测调整狼人分数
    const profile = this.playerProfiles.get(playerId);
    if (profile && profile.contradictions.length > 1) {
      werewolfScore += 0.3;
    }
    
    // 确定最可能的角色
    const scores = [
      { role: Role.WEREWOLF, score: werewolfScore },
      { role: Role.SEER, score: seerScore },
      { role: Role.WITCH, score: witchScore },
      { role: Role.VILLAGER, score: villagerScore }
    ];
    
    const bestGuess = scores.sort((a, b) => b.score - a.score)[0];
    
    return {
      role: bestGuess.role,
      confidence: Math.min(bestGuess.score, 0.8)
    };
  }

  private getRelevantMemories(phase: GamePhase): AIMemoryEntry[] {
    return this.memories
      .filter(m => {
        // 获取最近几轮的记忆
        if (this.gameContext.currentRound - m.round > 3) return false;
        
        // 高相关度和置信度的记忆
        return m.relevance > 0.5 && m.confidence > 0.4;
      })
      .sort((a, b) => (b.relevance * b.confidence) - (a.relevance * a.confidence));
  }

  private getPlayerAnalysis(): Map<PlayerId, PlayerProfile> {
    return this.playerProfiles;
  }

  private generateWerewolfStrategy(context: any, memories: AIMemoryEntry[], players: Map<PlayerId, PlayerProfile>) {
    return {
      primaryStrategy: '伪装村民，寻找神职目标',
      reasoning: '作为狼人需要隐藏身份并消除威胁',
      targetPlayers: Array.from(players.keys()).filter(id => 
        players.get(id)?.suspectedRole === Role.SEER || players.get(id)?.suspectedRole === Role.WITCH
      ).slice(0, 2),
      riskLevel: 'medium' as const
    };
  }

  private generateSeerStrategy(context: any, memories: AIMemoryEntry[], players: Map<PlayerId, PlayerProfile>) {
    return {
      primaryStrategy: '适时公布查验结果，引导投票',
      reasoning: '作为预言家需要在保护自己的同时传达信息',
      targetPlayers: Array.from(players.keys()).filter(id => 
        players.get(id)?.suspectedRole === Role.WEREWOLF
      ).slice(0, 2),
      riskLevel: 'high' as const
    };
  }

  private generateWitchStrategy(context: any, memories: AIMemoryEntry[], players: Map<PlayerId, PlayerProfile>) {
    return {
      primaryStrategy: '隐藏身份，关键时刻使用药水',
      reasoning: '作为女巫需要在合适时机使用能力',
      targetPlayers: [],
      riskLevel: 'low' as const
    };
  }

  private generateVillagerStrategy(context: any, memories: AIMemoryEntry[], players: Map<PlayerId, PlayerProfile>) {
    return {
      primaryStrategy: '分析发言，寻找逻辑漏洞',
      reasoning: '作为村民需要通过逻辑分析找出狼人',
      targetPlayers: Array.from(players.keys()).filter(id => {
        const player = players.get(id);
        return player && player.contradictions.length > 1;
      }).slice(0, 2),
      riskLevel: 'low' as const
    };
  }

  private calculateRelevance(playerId: PlayerId, keywords: string[]): number {
    let relevance = 0.5;
    
    // 如果是队友相关信息，降低相关度
    if (this.gameContext.teammates?.includes(playerId)) {
      relevance *= 0.7;
    }
    
    // 如果包含重要关键词，提高相关度
    if (keywords.some(k => k.includes('狼人') || k.includes('预言家') || k.includes('女巫'))) {
      relevance += 0.3;
    }
    
    return Math.min(relevance, 1.0);
  }
}