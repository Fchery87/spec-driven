/**
 * Systematic Debugging Skill Adapter
 * 
 * Provides structured debugging approaches for identifying and resolving issues.
 */

import { SkillAdapter } from '../skill_adapter';
import { SkillContext, SkillResult, SuperpowersSkill } from '../types';

export class SystematicDebuggingAdapter extends SkillAdapter {
  skill: SuperpowersSkill = 'systematic_debugging';
  
  canHandle(phase: string, context: Record<string, unknown>): boolean {
    return ['VALIDATE', 'AUTO_REMEDY', 'SOLUTIONING'].includes(phase);
  }
  
  async execute(
    input: Record<string, unknown>,
    context: SkillContext
  ): Promise<SkillResult> {
    const startTime = Date.now();
    
    const { valid, errors } = this.validateInput(input, ['issue', 'errorLogs']);
    if (!valid) {
      return this.createErrorResult(errors, Date.now() - startTime);
    }
    
    const analysis = this.performDebuggingAnalysis(input, context);
    
    return this.createSuccessResult(
      {
        rootCause: analysis.rootCause,
        contributingFactors: analysis.contributingFactors,
        recommendations: analysis.recommendations,
        resolutionSteps: analysis.resolutionSteps,
        preventionMeasures: analysis.preventionMeasures,
        severity: analysis.severity,
      },
      Date.now() - startTime
    );
  }
  
  private performDebuggingAnalysis(
    input: Record<string, unknown>,
    context: SkillContext
  ): {
    rootCause: string;
    contributingFactors: string[];
    recommendations: string[];
    resolutionSteps: Array<{ step: string; action: string; expectedOutcome: string }>;
    preventionMeasures: string[];
    severity: 'low' | 'medium' | 'high' | 'critical';
  } {
    const issue = String(input.issue || '');
    const errorLogs = input.errorLogs as string || '';
    
    // Analyze error patterns
    const patterns = this.analyzeErrorPatterns(errorLogs);
    
    return {
      rootCause: patterns.rootCause || 'Unknown - requires manual investigation',
      contributingFactors: patterns.factors || [
        'Insufficient error handling',
        'Missing validation',
        'Configuration issue',
      ],
      recommendations: [
        'Implement comprehensive error handling',
        'Add detailed logging',
        'Create automated tests for edge cases',
        'Review and update documentation',
      ],
      resolutionSteps: [
        {
          step: '1',
          action: 'Reproduce the issue in a controlled environment',
          expectedOutcome: 'Consistent reproduction of the bug',
        },
        {
          step: '2',
          action: 'Isolate the failing component',
          expectedOutcome: 'Identify the exact source of the issue',
        },
        {
          step: '3',
          action: 'Implement fix based on root cause analysis',
          expectedOutcome: 'Resolved issue without introducing regressions',
        },
        {
          step: '4',
          action: 'Add or update tests to cover the edge case',
          expectedOutcome: 'Prevent future occurrences',
        },
      ],
      preventionMeasures: [
        'Implement comprehensive test coverage',
        'Add monitoring and alerting',
        'Establish code review guidelines',
        'Create runbooks for common issues',
      ],
      severity: this.determineSeverity(issue, errorLogs),
    };
  }
  
  private analyzeErrorPatterns(logs: string): {
    rootCause?: string;
    factors?: string[];
  } {
    const lowerLogs = logs.toLowerCase();
    
    // Common error patterns
    if (lowerLogs.includes('null') || lowerLogs.includes('undefined')) {
      return {
        rootCause: 'Null or undefined reference',
        factors: ['Missing null checks', 'Race conditions', 'Initialization issues'],
      };
    }
    
    if (lowerLogs.includes('timeout') || lowerLogs.includes('deadlock')) {
      return {
        rootCause: 'Timeout or deadlock condition',
        factors: ['Resource contention', 'Long-running operations', 'Missing timeouts'],
      };
    }
    
    if (lowerLogs.includes('memory') || lowerLogs.includes('heap')) {
      return {
        rootCause: 'Memory-related issue',
        factors: ['Memory leaks', 'Large data structures', 'Insufficient resources'],
      };
    }
    
    if (lowerLogs.includes('permission') || lowerLogs.includes('access')) {
      return {
        rootCause: 'Access or permission issue',
        factors: ['Missing permissions', 'Authentication failures', 'Configuration errors'],
      };
    }
    
    if (lowerLogs.includes('syntax') || lowerLogs.includes('parse')) {
      return {
        rootCause: 'Syntax or parsing error',
        factors: ['Invalid input format', 'Code errors', 'Schema mismatches'],
      };
    }
    
    return {
      rootCause: 'General error - detailed analysis required',
      factors: ['Multiple contributing factors', 'Requires deeper investigation'],
    };
  }
  
  private determineSeverity(
    issue: string,
    logs: string
  ): 'low' | 'medium' | 'high' | 'critical' {
    const lowerIssue = issue.toLowerCase();
    const lowerLogs = logs.toLowerCase();
    
    // Critical indicators
    if (
      lowerLogs.includes('fatal') ||
      lowerLogs.includes('crash') ||
      lowerIssue.includes('data loss') ||
      lowerIssue.includes('security breach')
    ) {
      return 'critical';
    }
    
    // High indicators
    if (
      lowerLogs.includes('error') ||
      lowerIssue.includes('blocking') ||
      lowerIssue.includes('major feature')
    ) {
      return 'high';
    }
    
    // Medium indicators
    if (
      lowerLogs.includes('warn') ||
      lowerIssue.includes('performance') ||
      lowerIssue.includes('minor feature')
    ) {
      return 'medium';
    }
    
    return 'low';
  }
}
