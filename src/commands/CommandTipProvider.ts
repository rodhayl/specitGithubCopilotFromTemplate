import { OutputCoordinator } from './OutputCoordinator';
import { AgentUtils } from '../utils/AgentUtils';

/**
 * Command tip types and interfaces
 */
export interface CommandTip {
    type: 'example' | 'suggestion' | 'warning' | 'info';
    title: string;
    content: string;
    examples?: string[];
    category?: string; // For backward compatibility
    message?: string; // For backward compatibility
    priority?: number; // For backward compatibility
}

export interface ConversationTip {
    type: 'conversation-start' | 'conversation-continue' | 'conversation-help';
    title: string;
    content: string;
    examples?: string[];
}

/**
 * Provides contextual tips and guidance for commands
 */
export class CommandTipProvider {
    private static instance: CommandTipProvider;
    private outputCoordinator: OutputCoordinator;

    private constructor() {
        this.outputCoordinator = OutputCoordinator.getInstance();
    }

    static getInstance(): CommandTipProvider {
        if (!CommandTipProvider.instance) {
            CommandTipProvider.instance = new CommandTipProvider();
        }
        return CommandTipProvider.instance;
    }

    /**
     * Get tips for a specific command
     */
    getTipsForCommand(
        commandName: string,
        templateId?: string,
        flags?: Record<string, any>
    ): CommandTip[] {
        const tips: CommandTip[] = [];

        switch (commandName) {
            case 'new':
                tips.push(...this.getNewCommandTips(templateId, flags));
                break;
            case 'update':
                tips.push(...this.getUpdateCommandTips(flags));
                break;
            case 'review':
                tips.push(...this.getReviewCommandTips(flags));
                break;
            case 'chat':
                tips.push(...this.getChatCommandTips());
                break;
            default:
                tips.push(...this.getGeneralCommandTips());
        }

        return tips;
    }

    /**
     * Get conversation-related tips
     */
    getConversationTips(
        agentName?: string
    ): ConversationTip[] {
        const tips: ConversationTip[] = [];

        if (agentName) {
            tips.push({
                type: 'conversation-continue',
                title: 'Continue Conversation',
                content: `You can continue your conversation with the ${AgentUtils.getAgentDisplayName(agentName)} agent by simply typing your response.`,
                examples: [
                    'Tell me about your target users',
                    'What are the main features you need?',
                    'Help me define the success criteria'
                ]
            });
        }

        tips.push({
            type: 'conversation-help',
            title: 'Conversation Commands',
            content: 'Use these commands to manage your conversations:',
            examples: [
                '/agent current - See which agent is active',
                '/agent set <name> - Switch to a different agent',
                '/chat <message> - Start a conversation with the active agent'
            ]
        });

        return tips;
    }

    /**
     * Get tips for /new command
     */
    private getNewCommandTips(templateId?: string, flags?: Record<string, any>): CommandTip[] {
        const tips: CommandTip[] = [];

        // Check if conversation flags are used
        const hasConversationFlag = flags?.['with-conversation'] || flags?.['wc'];
        const hasNoConversationFlag = flags?.['no-conversation'] || flags?.['nc'];

        // Only show conversation tips if user hasn't made an explicit choice
        if (!hasConversationFlag && !hasNoConversationFlag) {
            tips.push({
                type: 'suggestion',
                title: 'Start a Conversation',
                content: 'Get AI assistance while creating your document by starting a conversation:',
                examples: [
                    `/new "My Product PRD" --with-conversation`,
                    `/new "API Design" --template basic --with-conversation`,
                    'After creating: `/chat Help me develop this document`'
                ]
            });
        }

        // Template-specific tips (only if not starting conversation)
        if (!hasConversationFlag) {
            if (templateId === 'prd') {
                tips.push({
                    type: 'info',
                    title: 'PRD Template Tips',
                    content: 'The PRD template works best with the PRD Creator agent for guided development:',
                    examples: [
                        `/agent set prd-creator`,
                        `/new "Product Requirements" --template prd --with-conversation`,
                        'Follow the guided questions to build a comprehensive PRD'
                    ]
                });
            } else if (templateId === 'basic') {
                tips.push({
                    type: 'info',
                    title: 'Basic Template Tips',
                    content: 'The basic template is flexible and works with any agent:',
                    examples: [
                        `/new "My Document" --template basic --with-conversation`,
                        `/agent set brainstormer` + ` then /chat Help me brainstorm ideas`,
                        'Use `/update` commands to modify sections later'
                    ]
                });
            }
        }

        // Path tips (always show if custom path is used)
        if (flags?.path || flags?.p) {
            tips.push({
                type: 'info',
                title: 'Custom Path',
                content: 'Your document will be created at the specified path. Make sure the directory exists or will be created.',
                examples: [
                    'docs/requirements.md',
                    'project/design/architecture.md'
                ]
            });
        }

        return tips;
    }

    /**
     * Get tips for /update command
     */
    private getUpdateCommandTips(flags?: Record<string, any>): CommandTip[] {
        const tips: CommandTip[] = [];

        tips.push({
            type: 'suggestion',
            title: 'Get Help with Updates',
            content: 'Use AI assistance to improve your document updates:',
            examples: [
                `/chat Review my document and suggest improvements`,
                `/agent set quality-reviewer` + ` then /chat Check this section`,
                `/review --file myfile.md --fix` + ` for automatic fixes`
            ]
        });

        if (flags?.mode === 'append') {
            tips.push({
                type: 'info',
                title: 'Append Mode',
                content: 'Content will be added to the end of the specified section.',
            });
        } else if (flags?.mode === 'prepend') {
            tips.push({
                type: 'info',
                title: 'Prepend Mode',
                content: 'Content will be added to the beginning of the specified section.',
            });
        }

        return tips;
    }

    /**
     * Get tips for /review command
     */
    private getReviewCommandTips(flags?: Record<string, any>): CommandTip[] {
        const tips: CommandTip[] = [];

        tips.push({
            type: 'suggestion',
            title: 'Quality Review Process',
            content: 'Get comprehensive feedback on your documents:',
            examples: [
                `/agent set quality-reviewer`,
                `/review --file README.md --level strict`,
                `/chat What are the main issues with this document?`
            ]
        });

        if (flags?.fix) {
            tips.push({
                type: 'warning',
                title: 'Automatic Fixes',
                content: 'The --fix flag will automatically apply suggested changes. Review them carefully.',
            });
        }

        return tips;
    }

    /**
     * Get tips for /chat command
     */
    private getChatCommandTips(): CommandTip[] {
        return [
            {
                type: 'info',
                title: 'Chat with AI Agents',
                content: 'Start conversations with specialized agents for different types of assistance:',
                examples: [
                    `/agent set prd-creator` + ` then /chat Help me create a PRD`,
                    `/agent set brainstormer` + ` then /chat I need ideas for my project`,
                    `/agent set quality-reviewer` + ` then /chat Review my document`
                ]
            },
            {
                type: 'suggestion',
                title: 'Natural Conversation',
                content: 'Once an agent is active, you can chat naturally without using /chat:',
                examples: [
                    'What are the key requirements for my project?',
                    'Help me improve this section',
                    'Can you suggest better wording for this?'
                ]
            }
        ];
    }

    /**
     * Get general command tips
     */
    private getGeneralCommandTips(): CommandTip[] {
        return [
            {
                type: 'info',
                title: 'Available Commands',
                content: 'Use these commands to work with documents and AI agents:',
                examples: [
                    '/new "Title" - Create a new document',
                    '/agent set <name> - Set an active AI agent',
                    '/chat <message> - Start a conversation',
                    '/help - Get detailed help'
                ]
            }
        ];
    }

    /**
     * Register tips with the output coordinator
     */
    registerTips(source: string, tips: CommandTip[]): void {
        if (tips.length > 0) {
            this.outputCoordinator.addTips(source, tips);
        }
    }

    /**
     * Get icon for tip type
     */
    private getTipIcon(type: CommandTip['type']): string {
        switch (type) {
            case 'example': return '📝';
            case 'suggestion': return '💡';
            case 'warning': return '⚠️';
            case 'info': return 'ℹ️';
            default: return '💡';
        }
    }

    /**
     * Get icon for conversation tip type
     */
    private getConversationTipIcon(type: ConversationTip['type']): string {
        switch (type) {
            case 'conversation-start': return '🚀';
            case 'conversation-continue': return '💬';
            case 'conversation-help': return '🤖';
            default: return '💡';
        }
    }


}