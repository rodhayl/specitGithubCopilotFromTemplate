// WorkflowOrchestrator implementation for phase management
import {
    WorkflowOrchestrator as IWorkflowOrchestrator,
    PhaseCompletionStatus,
    WorkflowSuggestion,
    TransitionValidation,
    TransitionResult
} from './types';

export class WorkflowOrchestrator implements IWorkflowOrchestrator {
    private readonly workflowPhases = ['prd', 'requirements', 'design', 'implementation'];
    private readonly phaseRequirements: Map<string, string[]> = new Map();

    constructor() {
        this.initializePhaseRequirements();
    }

    async evaluatePhaseCompletion(currentPhase: string, documentPath: string): Promise<PhaseCompletionStatus> {
        const requiredSections = this.getPhaseRequirements(currentPhase);
        const completedSections = await this.getCompletedSections(documentPath, currentPhase);
        const missingSections = requiredSections.filter(section => !completedSections.includes(section));
        
        const completionPercentage = requiredSections.length > 0 
            ? (completedSections.length / requiredSections.length) * 100 
            : 100;

        const qualityScore = await this.calculateQualityScore(documentPath, currentPhase);
        const readyForTransition = completionPercentage >= 80 && qualityScore >= 0.7;

        return {
            phase: currentPhase,
            completionPercentage,
            requiredSections,
            completedSections,
            missingSections,
            qualityScore,
            readyForTransition
        };
    }

    suggestNextPhase(currentPhase: string, completionStatus: PhaseCompletionStatus): WorkflowSuggestion {
        const currentIndex = this.workflowPhases.indexOf(currentPhase);
        
        if (currentIndex === -1 || currentIndex >= this.workflowPhases.length - 1) {
            return {
                nextPhase: currentPhase,
                recommendedAgent: this.getAgentForPhase(currentPhase),
                reason: 'You are in the final phase of the workflow',
                prerequisites: [],
                estimatedDuration: '0 minutes',
                confidence: 1.0
            };
        }

        const nextPhase = this.workflowPhases[currentIndex + 1];
        const recommendedAgent = this.getAgentForPhase(nextPhase);
        
        let reason = '';
        let prerequisites: string[] = [];
        let estimatedDuration = '';
        let confidence = 0.9;

        if (!completionStatus.readyForTransition) {
            reason = `Complete the missing sections in ${currentPhase} phase before proceeding`;
            prerequisites = completionStatus.missingSections;
            confidence = 0.3;
        } else {
            reason = this.getTransitionReason(currentPhase, nextPhase);
            estimatedDuration = this.estimatePhaseDuration(nextPhase);
        }

        return {
            nextPhase,
            recommendedAgent,
            reason,
            prerequisites,
            estimatedDuration,
            confidence
        };
    }

    validatePhaseTransition(fromPhase: string, toPhase: string): TransitionValidation {
        const errors: string[] = [];
        const warnings: string[] = [];
        const prerequisites: string[] = [];
        const recommendations: string[] = [];

        // Check if phases are valid
        if (!this.workflowPhases.includes(fromPhase)) {
            errors.push(`Invalid source phase: ${fromPhase}`);
        }

        if (!this.workflowPhases.includes(toPhase)) {
            errors.push(`Invalid target phase: ${toPhase}`);
        }

        // Check if transition is logical
        const fromIndex = this.workflowPhases.indexOf(fromPhase);
        const toIndex = this.workflowPhases.indexOf(toPhase);

        if (toIndex < fromIndex) {
            warnings.push('Moving backwards in the workflow - ensure this is intentional');
        }

        if (toIndex > fromIndex + 1) {
            warnings.push('Skipping workflow phases - consider completing intermediate phases');
            const skippedPhases = this.workflowPhases.slice(fromIndex + 1, toIndex);
            recommendations.push(`Consider completing these phases first: ${skippedPhases.join(', ')}`);
        }

        // Add phase-specific prerequisites
        const phasePrerequisites = this.getTransitionPrerequisites(fromPhase, toPhase);
        prerequisites.push(...phasePrerequisites);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            prerequisites,
            recommendations
        };
    }

    async executePhaseTransition(suggestion: WorkflowSuggestion): Promise<TransitionResult> {
        try {
            // Validate the transition
            const validation = this.validatePhaseTransition(
                this.getCurrentPhaseFromSuggestion(suggestion),
                suggestion.nextPhase
            );

            if (!validation.valid) {
                return {
                    success: false,
                    fromPhase: this.getCurrentPhaseFromSuggestion(suggestion),
                    toPhase: suggestion.nextPhase,
                    newAgent: suggestion.recommendedAgent,
                    message: `Transition failed: ${validation.errors.join(', ')}`,
                    nextSteps: []
                };
            }

            // Execute the transition
            const nextSteps = this.generateNextSteps(suggestion.nextPhase);

            return {
                success: true,
                fromPhase: this.getCurrentPhaseFromSuggestion(suggestion),
                toPhase: suggestion.nextPhase,
                newAgent: suggestion.recommendedAgent,
                message: `Successfully transitioned to ${suggestion.nextPhase} phase with ${suggestion.recommendedAgent} agent`,
                nextSteps
            };

        } catch (error) {
            return {
                success: false,
                fromPhase: this.getCurrentPhaseFromSuggestion(suggestion),
                toPhase: suggestion.nextPhase,
                newAgent: suggestion.recommendedAgent,
                message: `Transition failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
                nextSteps: []
            };
        }
    }

    getWorkflowPhases(): string[] {
        return [...this.workflowPhases];
    }

    getPhaseRequirements(phase: string): string[] {
        return this.phaseRequirements.get(phase) || [];
    }

    private initializePhaseRequirements(): void {
        this.phaseRequirements.set('prd', [
            'Executive Summary',
            'Product Objectives',
            'User Personas',
            'Functional Requirements',
            'Success Criteria'
        ]);

        this.phaseRequirements.set('requirements', [
            'Introduction',
            'Functional Requirements',
            'Non-Functional Requirements',
            'User Stories',
            'Acceptance Criteria'
        ]);

        this.phaseRequirements.set('design', [
            'Overview',
            'Architecture',
            'Components and Interfaces',
            'Data Models',
            'Error Handling'
        ]);

        this.phaseRequirements.set('implementation', [
            'Implementation Plan',
            'Task Breakdown',
            'Testing Strategy',
            'Deployment Plan'
        ]);
    }

    private async getCompletedSections(documentPath: string, phase: string): Promise<string[]> {
        // This would integrate with ContentCapture to check which sections exist
        // For now, return a mock implementation
        const requiredSections = this.getPhaseRequirements(phase);
        
        // Simulate some completed sections
        return requiredSections.slice(0, Math.floor(requiredSections.length * 0.6));
    }

    private async calculateQualityScore(documentPath: string, phase: string): Promise<number> {
        // This would implement actual quality assessment
        // For now, return a mock score
        return 0.75;
    }

    private getAgentForPhase(phase: string): string {
        const agentMap: Record<string, string> = {
            'prd': 'prd-creator',
            'requirements': 'requirements-gatherer',
            'design': 'solution-architect',
            'implementation': 'specification-writer'
        };

        return agentMap[phase] || 'prd-creator';
    }

    private getTransitionReason(fromPhase: string, toPhase: string): string {
        const reasons: Record<string, Record<string, string>> = {
            'prd': {
                'requirements': 'Your PRD is complete! Now let\'s gather detailed requirements using EARS format.',
                'design': 'Ready to move to technical design based on your PRD.',
                'implementation': 'Ready to create implementation specifications.'
            },
            'requirements': {
                'design': 'Requirements are well-defined! Time to design the technical solution.',
                'implementation': 'Ready to create detailed implementation plans.'
            },
            'design': {
                'implementation': 'Design is complete! Let\'s create the implementation roadmap.'
            }
        };

        return reasons[fromPhase]?.[toPhase] || `Ready to transition from ${fromPhase} to ${toPhase}`;
    }

    private estimatePhaseDuration(phase: string): string {
        const durations: Record<string, string> = {
            'prd': '30-45 minutes',
            'requirements': '45-60 minutes',
            'design': '60-90 minutes',
            'implementation': '30-45 minutes'
        };

        return durations[phase] || '30-60 minutes';
    }

    private getTransitionPrerequisites(fromPhase: string, toPhase: string): string[] {
        const prerequisites: Record<string, Record<string, string[]>> = {
            'prd': {
                'requirements': ['Complete product vision', 'Define target users', 'Identify core features'],
                'design': ['Complete PRD', 'Validate with stakeholders'],
                'implementation': ['Complete PRD', 'Get design approval']
            },
            'requirements': {
                'design': ['All user stories defined', 'Acceptance criteria written', 'Requirements reviewed'],
                'implementation': ['Requirements approved', 'Technical constraints identified']
            },
            'design': {
                'implementation': ['Architecture approved', 'Technical design complete', 'Dependencies identified']
            }
        };

        return prerequisites[fromPhase]?.[toPhase] || [];
    }

    private getCurrentPhaseFromSuggestion(suggestion: WorkflowSuggestion): string {
        const nextIndex = this.workflowPhases.indexOf(suggestion.nextPhase);
        return nextIndex > 0 ? this.workflowPhases[nextIndex - 1] : 'unknown';
    }

    private generateNextSteps(phase: string): string[] {
        const nextSteps: Record<string, string[]> = {
            'prd': [
                'Define your product vision and goals',
                'Identify target users and their needs',
                'Outline core features and functionality',
                'Establish success metrics'
            ],
            'requirements': [
                'Create detailed user stories',
                'Write acceptance criteria in EARS format',
                'Define non-functional requirements',
                'Identify edge cases and constraints'
            ],
            'design': [
                'Design system architecture',
                'Define component interfaces',
                'Create data models',
                'Plan error handling strategy'
            ],
            'implementation': [
                'Break down work into tasks',
                'Create implementation timeline',
                'Define testing approach',
                'Plan deployment strategy'
            ]
        };

        return nextSteps[phase] || ['Begin working on the next phase'];
    }
}