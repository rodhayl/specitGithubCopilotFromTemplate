/**
 * Utility functions for agent management
 */
export class AgentUtils {
    /**
     * Get user-friendly display name for agent
     */
    static getAgentDisplayName(agentName: string): string {
        const displayNames: Record<string, string> = {
            'prd-creator': 'PRD Creator',
            'brainstormer': 'Brainstormer',
            'requirements-gatherer': 'Requirements Gatherer',
            'solution-architect': 'Solution Architect',
            'specification-writer': 'Specification Writer',
            'quality-reviewer': 'Quality Reviewer'
        };

        return displayNames[agentName] || agentName;
    }
}