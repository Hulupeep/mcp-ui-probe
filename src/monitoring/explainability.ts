import { StorageService } from './storage.js';

export interface Decision {
  id: string;
  testId: string;
  stepName: string;
  timestamp: Date;
  reasoning: string;
  context: any;
  outcome: string;
  confidence?: number;
  alternatives?: string[];
  factors: DecisionFactor[];
}

export interface DecisionFactor {
  name: string;
  value: any;
  weight: number;
  description: string;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface TestAnalysis {
  testId: string;
  totalDecisions: number;
  decisionTypes: { [key: string]: number };
  averageConfidence: number;
  criticalDecisions: Decision[];
  timeline: DecisionTimeline[];
  summary: string;
  recommendations: string[];
}

export interface DecisionTimeline {
  timestamp: Date;
  stepName: string;
  reasoning: string;
  outcome: string;
  duration?: number;
}

export class ExplainabilityService {
  private storageService: StorageService;
  private decisions: Map<string, Decision[]> = new Map();

  constructor(storageService: StorageService) {
    this.storageService = storageService;
  }

  public recordDecision(
    testId: string,
    stepName: string,
    reasoning: string,
    context?: any,
    outcome?: string,
    confidence?: number,
    alternatives?: string[]
  ): void {
    const decision: Decision = {
      id: this.generateDecisionId(),
      testId,
      stepName,
      timestamp: new Date(),
      reasoning,
      context: context || {},
      outcome: outcome || 'pending',
      confidence,
      alternatives,
      factors: this.extractFactors(reasoning, context)
    };

    // Store in memory
    if (!this.decisions.has(testId)) {
      this.decisions.set(testId, []);
    }
    this.decisions.get(testId)!.push(decision);

    // Store in persistent storage
    this.storageService.logEvent({
      type: 'ai_decision',
      timestamp: new Date(),
      data: decision
    });
  }

  private generateDecisionId(): string {
    return `decision_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  private extractFactors(reasoning: string, context: any): DecisionFactor[] {
    const factors: DecisionFactor[] = [];

    try {
      // Extract factors from reasoning text using pattern matching
      const patterns = [
        { pattern: /because\s+(.+?)(?:\s+and|\s+but|\s*$)/gi, weight: 0.8 },
        { pattern: /due to\s+(.+?)(?:\s+and|\s+but|\s*$)/gi, weight: 0.7 },
        { pattern: /given that\s+(.+?)(?:\s+and|\s+but|\s*$)/gi, weight: 0.6 },
        { pattern: /since\s+(.+?)(?:\s+and|\s+but|\s*$)/gi, weight: 0.5 },
        { pattern: /considering\s+(.+?)(?:\s+and|\s+but|\s*$)/gi, weight: 0.4 }
      ];

      patterns.forEach(({ pattern, weight }) => {
        const matches = reasoning.matchAll(pattern);
        for (const match of matches) {
          if (match[1] && match[1].trim()) {
            factors.push({
              name: this.categorizeReason(match[1]),
              value: match[1].trim(),
              weight,
              description: match[1].trim(),
              impact: this.determineImpact(match[1])
            });
          }
        }
      });

      // Extract factors from context
      if (context) {
        Object.entries(context).forEach(([key, value]) => {
          factors.push({
            name: key,
            value,
            weight: 0.3,
            description: `Context parameter: ${key}`,
            impact: 'neutral'
          });
        });
      }

      return factors;
    } catch (error: unknown) {
      console.error('Error extracting factors:', error);
      return [];
    }
  }

  private categorizeReason(reason: string): string {
    const categories = {
      'performance': /performance|speed|fast|slow|optimize|efficiency/i,
      'reliability': /reliable|stable|robust|error|fail|success/i,
      'security': /security|safe|risk|vulnerability|protect/i,
      'usability': /user|interface|experience|intuitive|accessible/i,
      'compatibility': /compatible|support|version|platform|browser/i,
      'maintainability': /maintain|clean|readable|simple|complex/i,
      'testing': /test|verify|validate|check|assert|expect/i,
      'data': /data|input|output|validation|format|structure/i,
      'logic': /logic|algorithm|condition|flow|branch|decision/i,
      'integration': /integrate|connect|api|service|external|dependency/i
    };

    for (const [category, pattern] of Object.entries(categories)) {
      if (pattern.test(reason)) {
        return category;
      }
    }

    return 'general';
  }

  private determineImpact(reason: string): 'positive' | 'negative' | 'neutral' {
    const positiveWords = /improve|better|optimize|enhance|increase|good|successful|efficient|fast/i;
    const negativeWords = /problem|issue|error|fail|slow|bad|risk|vulnerability|decrease|poor/i;

    if (positiveWords.test(reason)) {
      return 'positive';
    } else if (negativeWords.test(reason)) {
      return 'negative';
    }

    return 'neutral';
  }

  public async getDecisions(testId: string): Promise<Decision[]> {
    const memoryDecisions = this.decisions.get(testId) || [];

    // Also fetch from storage in case of restart
    const storedLogs = await this.storageService.getLogs({
      type: 'ai_decision',
      testId
    });
    const storedDecisions = storedLogs.map(log => log.data);

    // Merge and deduplicate
    const allDecisions = [...memoryDecisions, ...storedDecisions];
    const uniqueDecisions = allDecisions.filter((decision, index, self) =>
      index === self.findIndex(d => d.id === decision.id)
    );

    return uniqueDecisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  public async analyzeTest(testId: string): Promise<TestAnalysis> {
    const decisions = await this.getDecisions(testId);

    if (decisions.length === 0) {
      return {
        testId,
        totalDecisions: 0,
        decisionTypes: {},
        averageConfidence: 0,
        criticalDecisions: [],
        timeline: [],
        summary: 'No AI decisions recorded for this test.',
        recommendations: ['Consider adding more explainability to test steps.']
      };
    }

    // Analyze decision types
    const decisionTypes: { [key: string]: number } = {};
    decisions.forEach(decision => {
      decision.factors.forEach(factor => {
        decisionTypes[factor.name] = (decisionTypes[factor.name] || 0) + 1;
      });
    });

    // Calculate average confidence
    const decisionsWithConfidence = decisions.filter(d => d.confidence !== undefined);
    const averageConfidence = decisionsWithConfidence.length > 0 ?
      decisionsWithConfidence.reduce((sum, d) => sum + d.confidence!, 0) / decisionsWithConfidence.length :
      0;

    // Find critical decisions (low confidence, negative factors, or failed outcomes)
    const criticalDecisions = decisions.filter(decision =>
      (decision.confidence !== undefined && decision.confidence < 0.5) ||
      decision.factors.some(f => f.impact === 'negative') ||
      decision.outcome.includes('error') ||
      decision.outcome.includes('fail')
    );

    // Create timeline
    const timeline: DecisionTimeline[] = decisions.map((decision, index) => {
      const duration = index < decisions.length - 1 ?
        decisions[index + 1].timestamp.getTime() - decision.timestamp.getTime() :
        undefined;

      return {
        timestamp: decision.timestamp,
        stepName: decision.stepName,
        reasoning: decision.reasoning,
        outcome: decision.outcome,
        duration
      };
    });

    // Generate summary
    const summary = this.generateTestSummary(decisions, decisionTypes, averageConfidence);

    // Generate recommendations
    const recommendations = this.generateRecommendations(decisions, criticalDecisions, decisionTypes);

    return {
      testId,
      totalDecisions: decisions.length,
      decisionTypes,
      averageConfidence,
      criticalDecisions,
      timeline,
      summary,
      recommendations
    };
  }

  private generateTestSummary(
    decisions: Decision[],
    decisionTypes: { [key: string]: number },
    averageConfidence: number
  ): string {
    const totalDecisions = decisions.length;
    const mostCommonType = Object.entries(decisionTypes)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || 'unknown';

    const successfulDecisions = decisions.filter(d =>
      d.outcome.includes('success') || d.outcome.includes('pass')
    ).length;

    const successRate = totalDecisions > 0 ? (successfulDecisions / totalDecisions * 100).toFixed(1) : '0';

    return `Test executed ${totalDecisions} AI-driven decisions with ${successRate}% success rate. ` +
           `Most decisions were ${mostCommonType}-related. Average confidence: ${(averageConfidence * 100).toFixed(1)}%.`;
  }

  private generateRecommendations(
    decisions: Decision[],
    criticalDecisions: Decision[],
    decisionTypes: { [key: string]: number }
  ): string[] {
    const recommendations: string[] = [];

    // Low confidence recommendations
    const lowConfidenceDecisions = decisions.filter(d => d.confidence !== undefined && d.confidence < 0.7);
    if (lowConfidenceDecisions.length > decisions.length * 0.3) {
      recommendations.push('Consider improving training data or model parameters - many decisions had low confidence.');
    }

    // Critical decisions recommendations
    if (criticalDecisions.length > 0) {
      recommendations.push(`Review ${criticalDecisions.length} critical decisions that may indicate issues with the test logic.`);
    }

    // Decision type recommendations
    const sortedTypes = Object.entries(decisionTypes).sort(([,a], [,b]) => b - a);
    if (sortedTypes.length > 0) {
      const dominantType = sortedTypes[0][0];
      const dominantCount = sortedTypes[0][1];

      if (dominantCount > decisions.length * 0.5) {
        recommendations.push(`Test heavily relies on ${dominantType} decisions. Consider diversifying test approach.`);
      }
    }

    // Performance recommendations
    const timeline = decisions.map((d, i) => ({
      decision: d,
      duration: i < decisions.length - 1 ?
        decisions[i + 1].timestamp.getTime() - d.timestamp.getTime() : 0
    }));

    const slowDecisions = timeline.filter(t => t.duration > 5000); // > 5 seconds
    if (slowDecisions.length > 0) {
      recommendations.push(`${slowDecisions.length} decisions took longer than 5 seconds. Consider optimizing AI decision speed.`);
    }

    // Alternatives recommendations
    const decisionsWithAlternatives = decisions.filter(d => d.alternatives && d.alternatives.length > 0);
    if (decisionsWithAlternatives.length < decisions.length * 0.5) {
      recommendations.push('Consider generating alternative approaches for more decisions to improve explainability.');
    }

    // Default recommendation
    if (recommendations.length === 0) {
      recommendations.push('Test AI decisions appear to be performing well. Continue monitoring for patterns.');
    }

    return recommendations;
  }

  public async getDecisionsByType(type: string): Promise<Decision[]> {
    const allDecisions: Decision[] = [];

    this.decisions.forEach(decisions => {
      allDecisions.push(...decisions.filter(d =>
        d.factors.some(f => f.name === type)
      ));
    });

    return allDecisions.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  public getDecisionStatistics(): any {
    const allDecisions: Decision[] = [];
    this.decisions.forEach(decisions => allDecisions.push(...decisions));

    if (allDecisions.length === 0) {
      return {
        totalDecisions: 0,
        averageConfidence: 0,
        decisionTypes: {},
        factorDistribution: {},
        impactDistribution: { positive: 0, negative: 0, neutral: 0 }
      };
    }

    const decisionTypes: { [key: string]: number } = {};
    const factorDistribution: { [key: string]: number } = {};
    const impactDistribution = { positive: 0, negative: 0, neutral: 0 };

    let confidenceSum = 0;
    let confidenceCount = 0;

    allDecisions.forEach(decision => {
      if (decision.confidence !== undefined) {
        confidenceSum += decision.confidence;
        confidenceCount++;
      }

      decision.factors.forEach(factor => {
        decisionTypes[factor.name] = (decisionTypes[factor.name] || 0) + 1;
        factorDistribution[factor.name] = (factorDistribution[factor.name] || 0) + factor.weight;
        impactDistribution[factor.impact]++;
      });
    });

    return {
      totalDecisions: allDecisions.length,
      averageConfidence: confidenceCount > 0 ? confidenceSum / confidenceCount : 0,
      decisionTypes,
      factorDistribution,
      impactDistribution
    };
  }

  public async exportDecisions(testId?: string): Promise<any> {
    if (testId) {
      return {
        testId,
        decisions: await this.getDecisions(testId),
        analysis: await this.analyzeTest(testId),
        exportedAt: new Date()
      };
    }

    const allTestIds = Array.from(this.decisions.keys());
    const tests = await Promise.all(allTestIds.map(async id => ({
      testId: id,
      decisions: await this.getDecisions(id),
      analysis: await this.analyzeTest(id)
    })));

    return {
      tests,
      statistics: this.getDecisionStatistics(),
      exportedAt: new Date()
    };
  }

  public clearDecisions(testId?: string): void {
    if (testId) {
      this.decisions.delete(testId);
    } else {
      this.decisions.clear();
    }
  }
}