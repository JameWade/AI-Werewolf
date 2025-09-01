import type { 
  PlayerId, 
  PlayerInfo, 
  Round,
  AllSpeeches,
  AllVotes 
} from '@ai-werewolf/types';

/**
 * 狼人交流消息
 */
export interface WerewolfMessage {
  id: string;
  senderId: PlayerId;
  content: string;
  timestamp: number;
  round: Round;
  type: 'strategy' | 'target_suggestion' | 'information' | 'coordination';
}

/**
 * 狼人团队决策
 */
export interface WerewolfTeamDecision {
  targetPlayerId: PlayerId;
  reason: string;
  consensus: boolean;
  participatingMembers: PlayerId[];
  finalDecisionMaker: PlayerId;
}

/**
 * 狼人交流上下文
 */
export interface WerewolfCommunicationContext {
  round: Round;
  alivePlayers: PlayerInfo[];
  werewolfTeam: PlayerId[];
  aliveWerewolves: PlayerId[];
  targetCandidates: PlayerId[];
  gameAnalysis: string;
  urgencyLevel: 'low' | 'medium' | 'high';
}

/**
 * 狼人夜间交流系统
 * 
 * 让狼人团队能够：
 * 1. 夜间私密交流
 * 2. 协商击杀目标
 * 3. 制定白天伪装策略
 * 4. 分享情报和分析
 */
export class WerewolfCommunicationSystem {
  private messages: WerewolfMessage[] = [];
  private teamDecisions: WerewolfTeamDecision[] = [];
  private communicationHistory: Map<Round, WerewolfMessage[]> = new Map();

  constructor() {}

  /**
   * 生成狼人夜间交流内容
   */
  generateWerewolfCommunication(
    senderId: PlayerId,
    context: WerewolfCommunicationContext,
    allSpeeches: AllSpeeches,
    allVotes: AllVotes
  ): {
    messageType: 'strategy' | 'target_suggestion' | 'information' | 'coordination';
    content: string;
    priority: 'low' | 'medium' | 'high';
    suggestedTarget?: PlayerId;
    reasoning: string;
  } {
    // 分析当前游戏局势
    const gameAnalysis = this.analyzeGameSituation(context, allSpeeches, allVotes);
    
    // 根据分析生成交流内容
    const communication = this.generateCommunicationContent(
      gameAnalysis
    );

    // 存储消息
    this.addMessage({
      senderId,
      content: communication.content,
      round: context.round,
      type: communication.messageType
    });

    return communication;
  }

  /**
   * 协商击杀目标
   */
  negotiateKillTarget(
    context: WerewolfCommunicationContext,
    memberSuggestions: Array<{
      memberId: PlayerId;
      suggestedTarget: PlayerId;
      reason: string;
      priority: number;
    }>
  ): WerewolfTeamDecision {
    // 分析所有建议
    const targetAnalysis = this.analyzeTargetSuggestions(
      memberSuggestions,
    );

    // 生成团队决策
    const decision = this.makeTeamDecision(targetAnalysis, context);

    // 存储决策
    this.teamDecisions.push(decision);

    return decision;
  }

  /**
   * 生成白天伪装策略
   */
  generateDayStrategy(
    context: WerewolfCommunicationContext,
    teamDecision: WerewolfTeamDecision
  ): {
    overallStrategy: string;
    individualStrategies: Map<PlayerId, {
      speechStrategy: string;
      votingStrategy: string;
      riskLevel: 'low' | 'medium' | 'high';
    }>;
    coordinationPoints: string[];
  } {
    const strategies = new Map<PlayerId, any>();
    const coordinationPoints: string[] = [];

    // 为每个狼人成员制定策略
    for (const werewolfId of context.aliveWerewolves) {
      const strategy = this.generateIndividualStrategy(
        werewolfId,
        context,
      );
      strategies.set(werewolfId, strategy);
    }

    // 制定协调要点
    coordinationPoints.push(
      '避免同时投票给同一目标',
      '分散发言时间避免过于一致',
      '适当质疑队友制造假象'
    );

    if (context.urgencyLevel === 'high') {
      coordinationPoints.push('优先保护核心成员');
    }

    return {
      overallStrategy: `团队目标: 消除${teamDecision.targetPlayerId}号玩家，白天需要伪装成村民`,
      individualStrategies: strategies,
      coordinationPoints
    };
  }

  /**
   * 获取交流历史
   */
  getCommunicationHistory(round?: Round): WerewolfMessage[] {
    if (round) {
      return this.communicationHistory.get(round) || [];
    }
    return this.messages;
  }

  /**
   * 获取团队决策历史
   */
  getTeamDecisions(): WerewolfTeamDecision[] {
    return this.teamDecisions;
  }

  /**
   * 清理旧数据
   */
  cleanup(currentRound: Round): void {
    // 只保留最近3轮的交流记录
    this.messages = this.messages.filter(msg => currentRound - msg.round <= 3);
    
    // 更新历史记录
    for (const [round, _] of this.communicationHistory) {
      if (currentRound - round > 3) {
        this.communicationHistory.delete(round);
      }
    }
  }

  // ===== 私有方法 =====

  private addMessage(params: Omit<WerewolfMessage, 'id' | 'timestamp'>): void {
    const message: WerewolfMessage = {
      id: `werewolf_msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      ...params
    };

    this.messages.push(message);

    // 更新历史记录
    if (!this.communicationHistory.has(params.round)) {
      this.communicationHistory.set(params.round, []);
    }
    this.communicationHistory.get(params.round)!.push(message);
  }

  private analyzeGameSituation(
    context: WerewolfCommunicationContext,
    allSpeeches: AllSpeeches,
    allVotes: AllVotes
  ): {
    threatLevel: 'low' | 'medium' | 'high';
    suspiciousPlayers: PlayerId[];
    godRoleCandidates: PlayerId[];
    safePlayers: PlayerId[];
    urgentActions: string[];
  } {
    const analysis = {
      threatLevel: 'medium' as 'low' | 'medium' | 'high',
      suspiciousPlayers: [] as PlayerId[],
      godRoleCandidates: [] as PlayerId[],
      safePlayers: [] as PlayerId[],
      urgentActions: [] as string[]
    };

    // 分析发言寻找神职角色
    for (const [_, speeches] of Object.entries(allSpeeches)) {
      for (const speech of speeches) {
        if (context.werewolfTeam.includes(speech.playerId)) continue;

        const content = speech.content.toLowerCase();
        
        // 检测预言家迹象
        if (content.includes('预言家') || content.includes('查验') || content.includes('昨晚我查了')) {
          if (!analysis.godRoleCandidates.includes(speech.playerId)) {
            analysis.godRoleCandidates.push(speech.playerId);
          }
        }

        // 检测女巫迹象
        if (content.includes('女巫') || content.includes('药水') || content.includes('救人') || content.includes('毒死')) {
          if (!analysis.godRoleCandidates.includes(speech.playerId)) {
            analysis.godRoleCandidates.push(speech.playerId);
          }
        }

        // 检测对狼人的怀疑
        if (content.includes('狼人') && (content.includes('认为') || content.includes('怀疑'))) {
          for (const werewolfId of context.werewolfTeam) {
            if (content.includes(werewolfId.toString())) {
              analysis.threatLevel = 'high';
              analysis.urgentActions.push(`${speech.playerId}号怀疑${werewolfId}号是狼人`);
            }
          }
        }
      }
    }

    // 分析投票模式
    for (const [_, votes] of Object.entries(allVotes)) {
      for (const vote of votes) {
        if (context.werewolfTeam.includes(vote.targetId)) {
          if (!analysis.suspiciousPlayers.includes(vote.voterId)) {
            analysis.suspiciousPlayers.push(vote.voterId);
          }
        }
      }
    }

    // 确定安全目标
    for (const player of context.alivePlayers) {
      if (context.werewolfTeam.includes(player.id)) continue;
      
      if (!analysis.godRoleCandidates.includes(player.id) && 
          !analysis.suspiciousPlayers.includes(player.id)) {
        analysis.safePlayers.push(player.id);
      }
    }

    return analysis;
  }

  private generateCommunicationContent(
    gameAnalysis: any
  ): {
    messageType: 'strategy' | 'target_suggestion' | 'information' | 'coordination';
    content: string;
    priority: 'low' | 'medium' | 'high';
    suggestedTarget?: PlayerId;
    reasoning: string;
  } {
    // 根据游戏分析决定交流类型和内容
    if (gameAnalysis.godRoleCandidates.length > 0) {
      // 优先处理神职角色
      const target = gameAnalysis.godRoleCandidates[0];
      return {
        messageType: 'target_suggestion',
        content: `建议优先击杀${target}号，疑似神职角色`,
        priority: 'high',
        suggestedTarget: target,
        reasoning: '消除神职角色威胁'
      };
    }

    if (gameAnalysis.threatLevel === 'high') {
      // 紧急情况下的协调
      return {
        messageType: 'coordination',
        content: '我们被怀疑了，需要更好地伪装和配合',
        priority: 'high',
        reasoning: '应对高威胁局势'
      };
    }

    if (gameAnalysis.safePlayers.length > 0) {
      // 建议击杀安全目标
      const target = gameAnalysis.safePlayers[0];
      return {
        messageType: 'target_suggestion',
        content: `${target}号相对安全，建议作为击杀目标`,
        priority: 'medium',
        suggestedTarget: target,
        reasoning: '选择风险较低的目标'
      };
    }

    // 默认策略讨论
    return {
      messageType: 'strategy',
      content: '需要仔细分析局势，寻找最佳击杀时机',
      priority: 'low',
      reasoning: '常规策略讨论'
    };
  }

  private analyzeTargetSuggestions(
    suggestions: Array<{
      memberId: PlayerId;
      suggestedTarget: PlayerId;
      reason: string;
      priority: number;
    }>,
  ): Map<PlayerId, {
    votes: number;
    totalPriority: number;
    reasons: string[];
    riskLevel: number;
  }> {
    const analysis = new Map<PlayerId, any>();

    // 统计每个目标的支持度
    for (const suggestion of suggestions) {
      const target = suggestion.suggestedTarget;
      
      if (!analysis.has(target)) {
        analysis.set(target, {
          votes: 0,
          totalPriority: 0,
          reasons: [],
          riskLevel: 0
        });
      }

      const targetData = analysis.get(target)!;
      targetData.votes += 1;
      targetData.totalPriority += suggestion.priority;
      targetData.reasons.push(suggestion.reason);
    }

    // 评估风险级别
    for (const [_, data] of analysis) {
      // 简单的风险评估：神职角色风险低，怀疑者风险高
      if (data.reasons.some((r: string) => r.includes('神职') || r.includes('预言家') || r.includes('女巫'))) {
        data.riskLevel = 0.3; // 低风险
      } else if (data.reasons.some((r: string) => r.includes('怀疑') || r.includes('威胁'))) {
        data.riskLevel = 0.8; // 高风险
      } else {
        data.riskLevel = 0.5; // 中等风险
      }
    }

    return analysis;
  }

  private makeTeamDecision(
    targetAnalysis: Map<PlayerId, any>,
    context: WerewolfCommunicationContext
  ): WerewolfTeamDecision {
    let bestTarget: PlayerId | null = null;
    let bestScore = -1;

    // 计算每个目标的综合得分
    for (const [target, data] of targetAnalysis) {
      const score = (data.votes * 0.4) + (data.totalPriority * 0.4) + ((1 - data.riskLevel) * 0.2);
      
      if (score > bestScore) {
        bestScore = score;
        bestTarget = target;
      }
    }

    // 如果没有明确目标，选择第一个可用目标
    if (!bestTarget && context.targetCandidates.length > 0) {
      bestTarget = context.targetCandidates[0];
    }

    // 检查是否达成共识
    const targetData = bestTarget ? targetAnalysis.get(bestTarget) : null;
    const consensus = targetData ? targetData.votes > context.aliveWerewolves.length / 2 : false;

    return {
      targetPlayerId: bestTarget || context.targetCandidates[0] || context.alivePlayers[0].id,
      reason: targetData ? targetData.reasons.join('; ') : '默认选择',
      consensus,
      participatingMembers: context.aliveWerewolves,
      finalDecisionMaker: context.aliveWerewolves[0]
    };
  }

  private generateIndividualStrategy(
    werewolfId: PlayerId,
    context: WerewolfCommunicationContext,
  ): {
    speechStrategy: string;
    votingStrategy: string;
    riskLevel: 'low' | 'medium' | 'high';
  } {
    const isLeader = werewolfId === context.aliveWerewolves[0];
    const riskLevel = context.urgencyLevel;

    let speechStrategy: string;
    let votingStrategy: string;

    if (isLeader) {
      speechStrategy = '适度引导讨论方向，不要过于主动';
      votingStrategy = '在投票中期参与，避免第一个投票';
    } else {
      speechStrategy = '支持队友观点但不要过于明显';
      votingStrategy = '跟随大多数意见，偶尔表达不同看法';
    }

    if (riskLevel === 'high') {
      speechStrategy += '，需要更加谨慎';
      votingStrategy += '，避免暴露关联';
    }

    return {
      speechStrategy,
      votingStrategy,
      riskLevel: riskLevel as 'low' | 'medium' | 'high'
    };
  }
}