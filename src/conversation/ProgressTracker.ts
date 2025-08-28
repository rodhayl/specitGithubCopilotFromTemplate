// ProgressTracker implementation for workflow monitoring
import {
    ProgressTracker as IProgressTracker,
    ProgressStatus,
    CompletionMetrics
} from './types';

export class ProgressTracker implements IProgressTracker {
    private progressData: Map<string, ProgressStatus> = new Map();
    private sessionMetrics: Map<string, CompletionMetrics> = new Map();
    private sessionStartTimes: Map<string, Date> = new Map();

    calculateProgress(sessionId: string): ProgressStatus {
        const existingProgress = this.progressData.get(sessionId);
        if (existingProgress) {
            return existingProgress;
        }

        // Return default progress for new sessions
        return {
            currentPhase: 'prd',
            completionPercentage: 0,
            completedSections: [],
            pendingSections: ['Executive Summary', 'Product Objectives', 'User Personas'],
            nextSteps: ['Define your product vision', 'Identify target users'],
            estimatedTimeRemaining: '30-45 minutes'
        };
    }

    updateProgress(sessionId: string, updates: Partial<ProgressStatus>): void {
        const currentProgress = this.progressData.get(sessionId) || this.calculateProgress(sessionId);
        
        const updatedProgress: ProgressStatus = {
            ...currentProgress,
            ...updates
        };

        // Recalculate completion percentage if sections changed
        if (updates.completedSections || updates.pendingSections) {
            const totalSections = updatedProgress.completedSections.length + updatedProgress.pendingSections.length;
            updatedProgress.completionPercentage = totalSections > 0 
                ? (updatedProgress.completedSections.length / totalSections) * 100 
                : 0;
        }

        // Update estimated time remaining
        updatedProgress.estimatedTimeRemaining = this.calculateEstimatedTime(updatedProgress);

        this.progressData.set(sessionId, updatedProgress);
    }

    getCompletionMetrics(sessionId: string): CompletionMetrics {
        const existingMetrics = this.sessionMetrics.get(sessionId);
        if (existingMetrics) {
            return this.updateMetricsWithCurrentTime(existingMetrics, sessionId);
        }

        // Initialize metrics for new session
        const startTime = this.sessionStartTimes.get(sessionId) || new Date();
        this.sessionStartTimes.set(sessionId, startTime);

        const initialMetrics: CompletionMetrics = {
            questionsAnswered: 0,
            totalQuestions: this.getExpectedQuestionCount('prd'),
            sectionsCompleted: 0,
            totalSections: this.getExpectedSectionCount('prd'),
            qualityScore: 0,
            timeSpent: 0,
            estimatedTimeRemaining: 30 * 60 // 30 minutes in seconds
        };

        this.sessionMetrics.set(sessionId, initialMetrics);
        return initialMetrics;
    }

    identifyMissingSections(documentPath: string, phase: string): string[] {
        const requiredSections = this.getRequiredSectionsForPhase(phase);
        // This would integrate with ContentCapture to check existing sections
        // For now, return mock missing sections
        return requiredSections.slice(Math.floor(requiredSections.length * 0.4));
    }

    estimateRemainingWork(sessionId: string): string {
        const progress = this.calculateProgress(sessionId);
        const metrics = this.getCompletionMetrics(sessionId);

        if (progress.completionPercentage >= 90) {
            return '5-10 minutes';
        } else if (progress.completionPercentage >= 70) {
            return '10-20 minutes';
        } else if (progress.completionPercentage >= 50) {
            return '20-30 minutes';
        } else if (progress.completionPercentage >= 25) {
            return '30-45 minutes';
        } else {
            return '45-60 minutes';
        }
    }

    // Additional helper methods
    startSession(sessionId: string, phase: string): void {
        this.sessionStartTimes.set(sessionId, new Date());
        
        const initialProgress: ProgressStatus = {
            currentPhase: phase,
            completionPercentage: 0,
            completedSections: [],
            pendingSections: this.getRequiredSectionsForPhase(phase),
            nextSteps: this.getInitialNextSteps(phase),
            estimatedTimeRemaining: this.getPhaseEstimatedDuration(phase)
        };

        this.progressData.set(sessionId, initialProgress);

        const initialMetrics: CompletionMetrics = {
            questionsAnswered: 0,
            totalQuestions: this.getExpectedQuestionCount(phase),
            sectionsCompleted: 0,
            totalSections: this.getExpectedSectionCount(phase),
            qualityScore: 0,
            timeSpent: 0,
            estimatedTimeRemaining: this.getPhaseEstimatedDurationSeconds(phase)
        };

        this.sessionMetrics.set(sessionId, initialMetrics);
    }

    updateQuestionProgress(sessionId: string, questionsAnswered: number, totalQuestions?: number): void {
        const metrics = this.getCompletionMetrics(sessionId);
        
        const updatedMetrics: CompletionMetrics = {
            ...metrics,
            questionsAnswered,
            totalQuestions: totalQuestions || metrics.totalQuestions,
            timeSpent: this.calculateTimeSpent(sessionId),
            estimatedTimeRemaining: this.calculateRemainingTimeFromQuestions(questionsAnswered, totalQuestions || metrics.totalQuestions)
        };

        this.sessionMetrics.set(sessionId, updatedMetrics);

        // Update overall progress
        const questionProgress = (questionsAnswered / (totalQuestions || metrics.totalQuestions)) * 100;
        const currentProgress = this.progressData.get(sessionId);
        
        if (currentProgress) {
            this.updateProgress(sessionId, {
                completionPercentage: Math.max(currentProgress.completionPercentage, questionProgress * 0.7) // Questions are 70% of progress
            });
        }
    }

    updateSectionProgress(sessionId: string, completedSections: string[], pendingSections: string[]): void {
        const currentProgress = this.progressData.get(sessionId);
        if (!currentProgress) {
            return;
        }

        this.updateProgress(sessionId, {
            completedSections,
            pendingSections,
            nextSteps: this.generateNextStepsFromSections(pendingSections, currentProgress.currentPhase)
        });

        // Update metrics
        const metrics = this.getCompletionMetrics(sessionId);
        const updatedMetrics: CompletionMetrics = {
            ...metrics,
            sectionsCompleted: completedSections.length,
            totalSections: completedSections.length + pendingSections.length,
            timeSpent: this.calculateTimeSpent(sessionId)
        };

        this.sessionMetrics.set(sessionId, updatedMetrics);
    }

    updateQualityScore(sessionId: string, qualityScore: number): void {
        const metrics = this.getCompletionMetrics(sessionId);
        const updatedMetrics: CompletionMetrics = {
            ...metrics,
            qualityScore,
            timeSpent: this.calculateTimeSpent(sessionId)
        };

        this.sessionMetrics.set(sessionId, updatedMetrics);
    }

    getProgressSummary(sessionId: string): string {
        const progress = this.calculateProgress(sessionId);
        const metrics = this.getCompletionMetrics(sessionId);

        const completionText = `${Math.round(progress.completionPercentage)}% complete`;
        const sectionsText = `${metrics.sectionsCompleted}/${metrics.totalSections} sections`;
        const questionsText = `${metrics.questionsAnswered}/${metrics.totalQuestions} questions`;
        const timeText = `${Math.round(metrics.timeSpent / 60)} minutes spent`;

        return `${completionText} • ${sectionsText} • ${questionsText} • ${timeText}`;
    }

    private calculateEstimatedTime(progress: ProgressStatus): string {
        const remainingPercentage = 100 - progress.completionPercentage;
        
        if (remainingPercentage <= 10) {
            return '5-10 minutes';
        } else if (remainingPercentage <= 25) {
            return '10-20 minutes';
        } else if (remainingPercentage <= 50) {
            return '20-35 minutes';
        } else if (remainingPercentage <= 75) {
            return '35-50 minutes';
        } else {
            return '50-75 minutes';
        }
    }

    private updateMetricsWithCurrentTime(metrics: CompletionMetrics, sessionId: string): CompletionMetrics {
        return {
            ...metrics,
            timeSpent: this.calculateTimeSpent(sessionId),
            estimatedTimeRemaining: Math.max(0, metrics.estimatedTimeRemaining - this.calculateTimeSpent(sessionId))
        };
    }

    private calculateTimeSpent(sessionId: string): number {
        const startTime = this.sessionStartTimes.get(sessionId);
        if (!startTime) {
            return 0;
        }

        return (Date.now() - startTime.getTime()) / 1000; // Return seconds
    }

    private calculateRemainingTimeFromQuestions(answered: number, total: number): number {
        if (total === 0) {
            return 0;
        }

        const remainingQuestions = total - answered;
        const averageTimePerQuestion = 120; // 2 minutes per question
        return remainingQuestions * averageTimePerQuestion;
    }

    private getRequiredSectionsForPhase(phase: string): string[] {
        const sectionMap: Record<string, string[]> = {
            'prd': ['Executive Summary', 'Product Objectives', 'User Personas', 'Functional Requirements', 'Success Criteria'],
            'requirements': ['Introduction', 'Functional Requirements', 'Non-Functional Requirements', 'User Stories', 'Acceptance Criteria'],
            'design': ['Overview', 'Architecture', 'Components and Interfaces', 'Data Models', 'Error Handling'],
            'implementation': ['Implementation Plan', 'Task Breakdown', 'Testing Strategy', 'Deployment Plan']
        };

        return sectionMap[phase] || [];
    }

    private getExpectedQuestionCount(phase: string): number {
        const questionCounts: Record<string, number> = {
            'prd': 6,
            'requirements': 8,
            'design': 10,
            'implementation': 6
        };

        return questionCounts[phase] || 5;
    }

    private getExpectedSectionCount(phase: string): number {
        return this.getRequiredSectionsForPhase(phase).length;
    }

    private getInitialNextSteps(phase: string): string[] {
        const nextStepsMap: Record<string, string[]> = {
            'prd': [
                'Define your product vision and goals',
                'Identify target users and their needs',
                'Outline core features and functionality'
            ],
            'requirements': [
                'Create detailed user stories',
                'Write acceptance criteria in EARS format',
                'Define non-functional requirements'
            ],
            'design': [
                'Design system architecture',
                'Define component interfaces',
                'Create data models'
            ],
            'implementation': [
                'Break down work into tasks',
                'Create implementation timeline',
                'Define testing approach'
            ]
        };

        return nextStepsMap[phase] || ['Continue with the current phase'];
    }

    private getPhaseEstimatedDuration(phase: string): string {
        const durations: Record<string, string> = {
            'prd': '30-45 minutes',
            'requirements': '45-60 minutes',
            'design': '60-90 minutes',
            'implementation': '30-45 minutes'
        };

        return durations[phase] || '30-60 minutes';
    }

    private getPhaseEstimatedDurationSeconds(phase: string): number {
        const durations: Record<string, number> = {
            'prd': 37.5 * 60, // 37.5 minutes average
            'requirements': 52.5 * 60, // 52.5 minutes average
            'design': 75 * 60, // 75 minutes average
            'implementation': 37.5 * 60 // 37.5 minutes average
        };

        return durations[phase] || 45 * 60; // 45 minutes default
    }

    private generateNextStepsFromSections(pendingSections: string[], phase: string): string[] {
        if (pendingSections.length === 0) {
            return [`Complete ${phase} phase review`, 'Prepare for next phase'];
        }

        const nextSteps = pendingSections.slice(0, 3).map(section => `Complete ${section}`);
        
        if (pendingSections.length > 3) {
            nextSteps.push(`...and ${pendingSections.length - 3} more sections`);
        }

        return nextSteps;
    }
}