// Error handling and recovery mechanisms for conversations
import { ConversationError, ValidationError, Question, ConversationContext } from './types';

export class ConversationErrorRecovery {
    /**
     * Handle unclear or incomplete responses
     */
    static handleUnclearResponse(userResponse: string, question: Question): {
        clarificationMessage: string;
        clarificationQuestions: Question[];
        recoveryOptions: string[];
    } {
        const clarificationMessage = this.generateClarificationMessage(userResponse, question);
        const clarificationQuestions = this.generateClarificationQuestions(question);
        const recoveryOptions = this.generateRecoveryOptions(userResponse, question);

        return {
            clarificationMessage,
            clarificationQuestions,
            recoveryOptions
        };
    }

    /**
     * Handle conversation context loss
     */
    static handleContextLoss(sessionId: string, conversationHistory: any[]): {
        contextSummary: string;
        refocusMessage: string;
        restartOptions: string[];
    } {
        const contextSummary = this.generateContextSummary(conversationHistory);
        const refocusMessage = this.generateRefocusMessage(contextSummary);
        const restartOptions = [
            'Continue from where we left off',
            'Start over with a fresh conversation',
            'Skip to a specific topic',
            'Get help understanding the process'
        ];

        return {
            contextSummary,
            refocusMessage,
            restartOptions
        };
    }

    /**
     * Handle validation errors
     */
    static handleValidationError(error: ValidationError, userResponse: string): {
        errorMessage: string;
        suggestions: string[];
        examples: string[];
    } {
        const errorMessage = this.generateValidationErrorMessage(error);
        const suggestions = this.generateValidationSuggestions(error, userResponse);
        const examples = this.generateValidationExamples(error);

        return {
            errorMessage,
            suggestions,
            examples
        };
    }

    /**
     * Handle conversation errors
     */
    static handleConversationError(error: ConversationError): {
        userMessage: string;
        recoveryActions: string[];
        canRecover: boolean;
    } {
        let userMessage = '';
        let recoveryActions: string[] = [];
        let canRecover = error.recoverable;

        switch (error.code) {
            case 'SESSION_NOT_FOUND':
                userMessage = 'Your conversation session has expired. Let\'s start a new one!';
                recoveryActions = [
                    'Start a new conversation',
                    'Switch to a different agent',
                    'Check your conversation history'
                ];
                canRecover = true;
                break;

            case 'SESSION_INACTIVE':
                userMessage = 'Your conversation was paused. Would you like to resume?';
                recoveryActions = [
                    'Resume the conversation',
                    'Start a new conversation',
                    'Review what we\'ve covered so far'
                ];
                canRecover = true;
                break;

            case 'NO_CURRENT_QUESTION':
                userMessage = 'We seem to have lost track of where we are in the conversation.';
                recoveryActions = [
                    'Show me the current progress',
                    'Continue with the next question',
                    'Start over from the beginning'
                ];
                canRecover = true;
                break;

            default:
                userMessage = `Something went wrong: ${error.message}`;
                recoveryActions = [
                    'Try again',
                    'Start a new conversation',
                    'Get help'
                ];
                canRecover = error.recoverable;
        }

        return {
            userMessage,
            recoveryActions,
            canRecover
        };
    }

    /**
     * Generate user guidance for better responses
     */
    static generateResponseGuidance(question: Question, context: ConversationContext): {
        guidanceMessage: string;
        tips: string[];
        examples: string[];
    } {
        const guidanceMessage = this.generateGuidanceMessage(question, context);
        const tips = this.generateResponseTips(question, context);
        const examples = question.examples || this.generateGenericExamples(question);

        return {
            guidanceMessage,
            tips,
            examples
        };
    }

    private static generateClarificationMessage(userResponse: string, question: Question): string {
        if (userResponse.length < 10) {
            return `I need a bit more detail to understand your response. Could you elaborate on "${userResponse}"?`;
        }

        if (this.containsVagueLanguage(userResponse)) {
            return 'I notice your response contains some general terms. Could you be more specific?';
        }

        if (question.type === 'structured' && !this.hasStructure(userResponse)) {
            return 'For this question, it would help to provide a more structured response. Could you organize your thoughts into clear points?';
        }

        return 'I want to make sure I understand you correctly. Could you provide a bit more detail?';
    }

    private static generateClarificationQuestions(originalQuestion: Question): Question[] {
        return [
            {
                id: `clarify_${originalQuestion.id}_${Date.now()}`,
                text: `Could you provide more specific details about ${originalQuestion.category.replace('-', ' ')}?`,
                type: 'open-ended',
                examples: originalQuestion.examples?.slice(0, 2) || [],
                required: false,
                followupTriggers: [],
                category: `${originalQuestion.category}-clarification`,
                priority: 1
            }
        ];
    }

    private static generateRecoveryOptions(userResponse: string, question: Question): string[] {
        const options = ['Let me try answering again'];

        if (userResponse.length < 10) {
            options.push('I need help understanding what you\'re asking');
        }

        if (question.examples && question.examples.length > 0) {
            options.push('Show me more examples');
        }

        options.push('Skip this question for now');
        options.push('I need help with this topic');

        return options;
    }

    private static generateContextSummary(conversationHistory: any[]): string {
        if (conversationHistory.length === 0) {
            return 'We haven\'t started our conversation yet.';
        }

        const questions = conversationHistory.filter(turn => turn.type === 'question').length;
        const responses = conversationHistory.filter(turn => turn.type === 'response').length;

        return `So far, I've asked ${questions} questions and you've provided ${responses} responses. We were discussing your project requirements.`;
    }

    private static generateRefocusMessage(contextSummary: string): string {
        return `Let me help you get back on track. ${contextSummary} 

What would you like to do next?`;
    }

    private static generateValidationErrorMessage(error: ValidationError): string {
        switch (error.rule.type) {
            case 'required':
                return 'This field is required. Please provide a response.';
            case 'minLength':
                return `Your response needs to be at least ${error.rule.value} characters long.`;
            case 'maxLength':
                return `Your response is too long. Please keep it under ${error.rule.value} characters.`;
            case 'pattern':
                return 'Your response doesn\'t match the expected format.';
            default:
                return error.message || 'Your response doesn\'t meet the requirements.';
        }
    }

    private static generateValidationSuggestions(error: ValidationError, userResponse: string): string[] {
        const suggestions: string[] = [];

        switch (error.rule.type) {
            case 'required':
                suggestions.push('Please provide any response to continue');
                break;
            case 'minLength':
                suggestions.push('Try adding more detail to your response');
                suggestions.push('Explain your reasoning or provide examples');
                break;
            case 'maxLength':
                suggestions.push('Try to be more concise');
                suggestions.push('Focus on the most important points');
                break;
            case 'pattern':
                suggestions.push('Check the expected format');
                suggestions.push('Look at the examples provided');
                break;
        }

        return suggestions;
    }

    private static generateValidationExamples(error: ValidationError): string[] {
        switch (error.rule.type) {
            case 'pattern':
                if (error.rule.value === '\\b(must|shall|should)\\b') {
                    return [
                        'The system must authenticate users within 2 seconds',
                        'The application shall support 1000 concurrent users',
                        'The interface should be intuitive for new users'
                    ];
                }
                break;
        }

        return [];
    }

    private static generateGuidanceMessage(question: Question, context: ConversationContext): string {
        let message = 'Here are some tips for providing a great response:\n\n';

        if (question.type === 'structured') {
            message += '• Organize your thoughts into clear points or sections\n';
        }

        if (context.workflowPhase === 'requirements') {
            message += '• Be specific and measurable when possible\n';
            message += '• Think about what the system must do, not how it will do it\n';
        }

        if (context.workflowPhase === 'prd') {
            message += '• Focus on the problem and user needs\n';
            message += '• Think about the business value and impact\n';
        }

        return message;
    }

    private static generateResponseTips(question: Question, context: ConversationContext): string[] {
        const tips: string[] = [];

        // General tips
        tips.push('Be specific and detailed in your response');
        tips.push('Use concrete examples when possible');

        // Question-type specific tips
        if (question.type === 'structured') {
            tips.push('Organize your response with bullet points or numbered lists');
        }

        // Context-specific tips
        if (context.workflowPhase === 'requirements') {
            tips.push('Focus on what the system needs to do');
            tips.push('Include measurable criteria when relevant');
        }

        if (context.workflowPhase === 'prd') {
            tips.push('Think from the user\'s perspective');
            tips.push('Consider the business impact');
        }

        return tips.slice(0, 4); // Limit to 4 tips
    }

    private static generateGenericExamples(question: Question): string[] {
        const examples: string[] = [];

        if (question.category.includes('problem')) {
            examples.push('Users are experiencing slow response times');
            examples.push('The current process is manual and error-prone');
        }

        if (question.category.includes('user')) {
            examples.push('Software developers who need to integrate APIs');
            examples.push('Business analysts who create reports');
        }

        if (question.category.includes('solution')) {
            examples.push('An automated system that processes requests');
            examples.push('A user-friendly dashboard for monitoring');
        }

        return examples;
    }

    private static containsVagueLanguage(response: string): boolean {
        const vagueWords = ['thing', 'stuff', 'something', 'somehow', 'maybe', 'probably'];
        const words = response.toLowerCase().split(/\s+/);
        const vagueCount = words.filter(word => vagueWords.includes(word)).length;
        return vagueCount > words.length * 0.2; // More than 20% vague words
    }

    private static hasStructure(response: string): boolean {
        return /(\*|-|\d+\.|\n)/.test(response) || response.includes(':');
    }
}