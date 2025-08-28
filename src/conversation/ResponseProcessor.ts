// ResponseProcessor implementation for analyzing user responses
import {
    ResponseProcessor as IResponseProcessor,
    ResponseAnalysis,
    StructuredData,
    ValidationResult,
    ValidationRule,
    Entity,
    Question,
    ConversationContext
} from './types';

export class ResponseProcessor implements IResponseProcessor {
    private entityPatterns: Map<string, RegExp> = new Map();
    private commonPhrases: Map<string, string[]> = new Map();

    constructor() {
        this.initializeEntityPatterns();
        this.initializeCommonPhrases();
    }

    analyzeResponse(response: string, question: Question): ResponseAnalysis {
        const cleanResponse = response.trim();
        
        // Calculate completeness based on response length and content
        const completeness = this.calculateCompleteness(cleanResponse, question);
        
        // Calculate clarity based on structure and coherence
        const clarity = this.calculateClarity(cleanResponse);
        
        // Extract entities from the response
        const extractedEntities = this.processEntities(cleanResponse);
        
        // Generate suggested follow-ups
        const suggestedFollowups = this.generateFollowupSuggestions(cleanResponse, question);
        
        // Determine if clarification is needed
        const needsClarification = this.needsClarification(cleanResponse, question);
        
        // Calculate overall confidence
        const confidence = this.calculateConfidence(completeness, clarity, extractedEntities.length);

        return {
            completeness,
            clarity,
            extractedEntities,
            suggestedFollowups,
            needsClarification,
            confidence
        };
    }

    extractStructuredData(response: string, expectedFormat: string): StructuredData {
        const cleanResponse = response.trim();
        let extractedData: Record<string, any> = {};
        let confidence = 0.5;

        switch (expectedFormat.toLowerCase()) {
            case 'user-story':
                extractedData = this.extractUserStory(cleanResponse);
                confidence = this.calculateUserStoryConfidence(extractedData);
                break;
                
            case 'acceptance-criteria':
                extractedData = this.extractAcceptanceCriteria(cleanResponse);
                confidence = this.calculateAcceptanceCriteriaConfidence(extractedData);
                break;
                
            case 'requirements':
                extractedData = this.extractRequirements(cleanResponse);
                confidence = this.calculateRequirementsConfidence(extractedData);
                break;
                
            case 'metrics':
                extractedData = this.extractMetrics(cleanResponse);
                confidence = this.calculateMetricsConfidence(extractedData);
                break;
                
            default:
                extractedData = this.extractGenericStructure(cleanResponse);
                confidence = 0.6;
        }

        return {
            type: expectedFormat,
            data: extractedData,
            confidence,
            source: 'user-response'
        };
    }

    validateCompleteness(response: string, requirements: ValidationRule[]): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];
        let score = 1.0;

        for (const rule of requirements) {
            const result = this.validateRule(response, rule);
            if (!result.valid) {
                if (rule.type === 'required') {
                    errors.push(result.message);
                    score -= 0.3;
                } else {
                    warnings.push(result.message);
                    score -= 0.1;
                }
            }
        }

        score = Math.max(0, score);

        return {
            valid: errors.length === 0,
            errors,
            warnings,
            score
        };
    }

    suggestImprovements(response: string, context: ConversationContext): string[] {
        const suggestions: string[] = [];
        const cleanResponse = response.trim();

        // Check response length
        if (cleanResponse.length < 10) {
            suggestions.push('Please provide more detail in your response');
        } else if (cleanResponse.length > 1000) {
            suggestions.push('Consider breaking your response into smaller, focused points');
        }

        // Check for vague language
        const vagueWords = ['thing', 'stuff', 'something', 'somehow', 'maybe', 'probably'];
        const hasVagueLanguage = vagueWords.some(word => 
            cleanResponse.toLowerCase().includes(word)
        );
        if (hasVagueLanguage) {
            suggestions.push('Try to be more specific and avoid vague terms');
        }

        // Check for examples based on document type
        if (context.documentType === 'prd' && !this.hasExamples(cleanResponse)) {
            suggestions.push('Consider providing specific examples to illustrate your points');
        }

        // Check for measurable criteria
        if (context.workflowPhase === 'requirements' && !this.hasMeasurableCriteria(cleanResponse)) {
            suggestions.push('Include measurable criteria or specific conditions where possible');
        }

        // Check for user perspective
        if (!this.hasUserPerspective(cleanResponse) && context.documentType === 'prd') {
            suggestions.push('Consider explaining how this affects or benefits users');
        }

        return suggestions;
    }

    processEntities(response: string): Entity[] {
        const entities: Entity[] = [];
        const cleanResponse = response.toLowerCase();

        // Process each entity pattern
        for (const [entityType, pattern] of this.entityPatterns) {
            const matches = Array.from(cleanResponse.matchAll(pattern));
            
            for (const match of matches) {
                if (match.index !== undefined) {
                    entities.push({
                        type: entityType,
                        value: match[0],
                        confidence: this.calculateEntityConfidence(entityType, match[0]),
                        startIndex: match.index,
                        endIndex: match.index + match[0].length
                    });
                }
            }
        }

        // Remove overlapping entities (keep highest confidence)
        return this.removeOverlappingEntities(entities);
    }

    private calculateCompleteness(response: string, question: Question): number {
        let score = 0;

        // Base score from response length
        if (response.length < 10) {
            score = 0.2;
        } else if (response.length < 50) {
            score = 0.5;
        } else if (response.length < 200) {
            score = 0.8;
        } else {
            score = 1.0;
        }

        // Adjust based on question type
        if (question.type === 'structured' && !this.hasStructuredElements(response)) {
            score *= 0.7;
        }

        // Bonus for examples if question has examples
        if (question.examples && question.examples.length > 0 && this.hasExamples(response)) {
            score = Math.min(1.0, score + 0.1);
        }

        return score;
    }

    private calculateClarity(response: string): number {
        let score = 0.8; // Start with good baseline

        // Check for coherent sentences
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        if (sentences.length === 0) {
            return 0.2;
        }

        // Penalize very short or very long sentences
        const avgSentenceLength = response.length / sentences.length;
        if (avgSentenceLength < 5 || avgSentenceLength > 100) {
            score -= 0.2;
        }

        // Check for proper punctuation
        const hasPunctuation = /[.!?]/.test(response);
        if (!hasPunctuation && response.length > 20) {
            score -= 0.1;
        }

        // Check for excessive repetition
        const words = response.toLowerCase().split(/\s+/);
        const uniqueWords = new Set(words);
        const repetitionRatio = uniqueWords.size / words.length;
        if (repetitionRatio < 0.5) {
            score -= 0.2;
        }

        return Math.max(0.1, score);
    }

    private generateFollowupSuggestions(response: string, question: Question): string[] {
        const suggestions: string[] = [];
        const cleanResponse = response.toLowerCase();

        // Generic follow-ups based on response characteristics
        if (response.length < 20) {
            suggestions.push('Could you provide more detail about that?');
        }

        // Category-specific follow-ups
        if (question.category.includes('problem') && cleanResponse.includes('user')) {
            suggestions.push('How does this problem specifically impact those users?');
        }

        if (question.category.includes('solution') && !cleanResponse.includes('how')) {
            suggestions.push('How would you implement this solution?');
        }

        if (question.category.includes('success') && !this.hasMetrics(cleanResponse)) {
            suggestions.push('What specific metrics would you use to measure success?');
        }

        // Trigger-based follow-ups
        for (const trigger of question.followupTriggers || []) {
            if (cleanResponse.includes(trigger.toLowerCase())) {
                suggestions.push(`Tell me more about the ${trigger} aspect.`);
            }
        }

        return suggestions.slice(0, 3); // Limit to 3 suggestions
    }

    private needsClarification(response: string, question: Question): boolean {
        // Very short responses likely need clarification
        if (response.trim().length < 10) {
            return true;
        }

        // Yes/no responses to open-ended questions need clarification
        if (question.type === 'open-ended' && /^(yes|no|maybe|sure|ok)$/i.test(response.trim())) {
            return true;
        }

        // Responses with only vague terms need clarification
        const vagueWords = ['thing', 'stuff', 'something', 'somehow'];
        const words = response.toLowerCase().split(/\s+/);
        const vagueWordCount = words.filter(word => vagueWords.includes(word)).length;
        if (vagueWordCount > words.length * 0.3) {
            return true;
        }

        return false;
    }

    private calculateConfidence(completeness: number, clarity: number, entityCount: number): number {
        const baseConfidence = (completeness + clarity) / 2;
        const entityBonus = Math.min(0.2, entityCount * 0.05);
        return Math.min(1.0, baseConfidence + entityBonus);
    }

    private extractUserStory(response: string): Record<string, any> {
        const userStoryPattern = /as\s+(?:a|an)\s+([^,]+),?\s*i\s+want\s+([^,]+),?\s*so\s+that\s+(.+)/i;
        const match = response.match(userStoryPattern);

        if (match) {
            return {
                role: match[1].trim(),
                want: match[2].trim(),
                benefit: match[3].trim(),
                format: 'standard'
            };
        }

        // Try to extract components even if not in standard format
        const rolePattern = /(user|admin|customer|developer|manager|analyst)/i;
        const roleMatch = response.match(rolePattern);

        return {
            role: roleMatch ? roleMatch[1] : 'user',
            want: this.extractWantStatement(response),
            benefit: this.extractBenefitStatement(response),
            format: 'extracted'
        };
    }

    private extractAcceptanceCriteria(response: string): Record<string, any> {
        const criteria: string[] = [];
        const earsPattern = /(when|if|while|where)\s+([^,]+),?\s*(then|the system shall|system shall)\s+(.+)/gi;
        
        let match;
        while ((match = earsPattern.exec(response)) !== null) {
            criteria.push({
                condition: `${match[1]} ${match[2]}`,
                action: `${match[3]} ${match[4]}`,
                format: 'EARS'
            });
        }

        // Also look for bullet points or numbered lists
        const listItems = response.split(/\n|\*|-|\d+\./).filter(item => item.trim().length > 0);
        for (const item of listItems) {
            if (item.trim().length > 10 && !criteria.some(c => c.action && item.includes(c.action))) {
                criteria.push({
                    condition: 'general',
                    action: item.trim(),
                    format: 'list'
                });
            }
        }

        return {
            criteria,
            count: criteria.length,
            hasEarsFormat: criteria.some(c => c.format === 'EARS')
        };
    }

    private extractRequirements(response: string): Record<string, any> {
        const requirements: any[] = [];
        const mustPattern = /(must|shall|should|will)\s+([^.!?]+)/gi;
        
        let match;
        while ((match = mustPattern.exec(response)) !== null) {
            requirements.push({
                type: 'functional',
                priority: match[1].toLowerCase() === 'must' ? 'high' : 'medium',
                description: match[2].trim()
            });
        }

        return {
            requirements,
            count: requirements.length,
            hasPriorities: requirements.some(r => r.priority === 'high')
        };
    }

    private extractMetrics(response: string): Record<string, any> {
        const metrics: any[] = [];
        const numberPattern = /(\d+(?:\.\d+)?)\s*(%|percent|ms|seconds?|minutes?|hours?|users?|requests?|mb|gb|tb)/gi;
        
        let match;
        while ((match = numberPattern.exec(response)) !== null) {
            metrics.push({
                value: parseFloat(match[1]),
                unit: match[2],
                context: this.extractMetricContext(response, match.index || 0)
            });
        }

        return {
            metrics,
            count: metrics.length,
            hasPerformanceMetrics: metrics.some(m => ['ms', 'seconds', 'minutes'].includes(m.unit))
        };
    }

    private extractGenericStructure(response: string): Record<string, any> {
        const sentences = response.split(/[.!?]+/).filter(s => s.trim().length > 0);
        const words = response.split(/\s+/).filter(w => w.length > 0);
        
        return {
            sentences: sentences.length,
            words: words.length,
            avgWordsPerSentence: sentences.length > 0 ? words.length / sentences.length : 0,
            hasQuestions: /\?/.test(response),
            hasExclamations: /!/.test(response)
        };
    }

    private validateRule(response: string, rule: ValidationRule): { valid: boolean; message: string } {
        switch (rule.type) {
            case 'required':
                return {
                    valid: response.trim().length > 0,
                    message: rule.message || 'Response is required'
                };
                
            case 'minLength':
                return {
                    valid: response.length >= (rule.value || 0),
                    message: rule.message || `Response must be at least ${rule.value} characters`
                };
                
            case 'maxLength':
                return {
                    valid: response.length <= (rule.value || Infinity),
                    message: rule.message || `Response must be no more than ${rule.value} characters`
                };
                
            case 'pattern':
                const regex = new RegExp(rule.value);
                return {
                    valid: regex.test(response),
                    message: rule.message || 'Response does not match required pattern'
                };
                
            case 'custom':
                return {
                    valid: rule.validator ? rule.validator(response) : true,
                    message: rule.message || 'Response does not meet custom validation criteria'
                };
                
            default:
                return { valid: true, message: '' };
        }
    }

    private initializeEntityPatterns(): void {
        this.entityPatterns.set('technology', /\b(api|database|server|cloud|aws|azure|docker|kubernetes|react|angular|vue|node|python|java|javascript|typescript)\b/gi);
        this.entityPatterns.set('metric', /\b(\d+(?:\.\d+)?)\s*(ms|seconds?|minutes?|hours?|%|percent|users?|requests?|mb|gb|tb)\b/gi);
        this.entityPatterns.set('role', /\b(user|admin|customer|developer|manager|analyst|stakeholder)\b/gi);
        this.entityPatterns.set('action', /\b(create|read|update|delete|login|logout|authenticate|authorize|process|generate|validate)\b/gi);
        this.entityPatterns.set('business_term', /\b(revenue|profit|cost|roi|conversion|engagement|retention|acquisition)\b/gi);
    }

    private initializeCommonPhrases(): void {
        this.commonPhrases.set('positive', ['good', 'great', 'excellent', 'perfect', 'amazing', 'wonderful']);
        this.commonPhrases.set('negative', ['bad', 'terrible', 'awful', 'horrible', 'poor', 'disappointing']);
        this.commonPhrases.set('uncertainty', ['maybe', 'perhaps', 'possibly', 'might', 'could', 'probably']);
    }

    private hasStructuredElements(response: string): boolean {
        return /(\*|-|\d+\.|\n)/.test(response) || response.includes(':');
    }

    private hasExamples(response: string): boolean {
        const exampleIndicators = ['example', 'for instance', 'such as', 'like', 'including'];
        return exampleIndicators.some(indicator => 
            response.toLowerCase().includes(indicator)
        );
    }

    private hasMeasurableCriteria(response: string): boolean {
        return /\b(\d+(?:\.\d+)?)\s*(ms|seconds?|minutes?|hours?|%|percent|users?|requests?)\b/i.test(response);
    }

    private hasUserPerspective(response: string): boolean {
        const userIndicators = ['user', 'customer', 'people', 'they', 'their', 'benefit', 'help', 'improve'];
        return userIndicators.some(indicator => 
            response.toLowerCase().includes(indicator)
        );
    }

    private hasMetrics(response: string): boolean {
        return /\b(\d+(?:\.\d+)?)\s*(%|percent|ms|seconds?|minutes?|hours?|users?|requests?)\b/i.test(response);
    }

    private calculateEntityConfidence(entityType: string, value: string): number {
        // Base confidence varies by entity type
        const baseConfidence: Record<string, number> = {
            'technology': 0.9,
            'metric': 0.95,
            'role': 0.8,
            'action': 0.7,
            'business_term': 0.8
        };

        return baseConfidence[entityType] || 0.6;
    }

    private removeOverlappingEntities(entities: Entity[]): Entity[] {
        entities.sort((a, b) => a.startIndex - b.startIndex);
        
        const result: Entity[] = [];
        for (const entity of entities) {
            const hasOverlap = result.some(existing => 
                (entity.startIndex >= existing.startIndex && entity.startIndex < existing.endIndex) ||
                (entity.endIndex > existing.startIndex && entity.endIndex <= existing.endIndex)
            );
            
            if (!hasOverlap) {
                result.push(entity);
            } else {
                // Keep the entity with higher confidence
                const overlapping = result.find(existing => 
                    (entity.startIndex >= existing.startIndex && entity.startIndex < existing.endIndex) ||
                    (entity.endIndex > existing.startIndex && entity.endIndex <= existing.endIndex)
                );
                
                if (overlapping && entity.confidence > overlapping.confidence) {
                    const index = result.indexOf(overlapping);
                    result[index] = entity;
                }
            }
        }
        
        return result;
    }

    private extractWantStatement(response: string): string {
        const wantPatterns = [
            /i\s+want\s+([^,]+)/i,
            /need\s+to\s+([^,]+)/i,
            /would\s+like\s+to\s+([^,]+)/i
        ];

        for (const pattern of wantPatterns) {
            const match = response.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return 'perform an action';
    }

    private extractBenefitStatement(response: string): string {
        const benefitPatterns = [
            /so\s+that\s+([^.!?]+)/i,
            /because\s+([^.!?]+)/i,
            /to\s+([^.!?]+)/i
        ];

        for (const pattern of benefitPatterns) {
            const match = response.match(pattern);
            if (match) {
                return match[1].trim();
            }
        }

        return 'achieve a goal';
    }

    private extractMetricContext(response: string, position: number): string {
        const contextStart = Math.max(0, position - 50);
        const contextEnd = Math.min(response.length, position + 50);
        return response.substring(contextStart, contextEnd).trim();
    }

    private calculateUserStoryConfidence(data: Record<string, any>): number {
        if (data.format === 'standard') {
            return 0.9;
        } else if (data.format === 'extracted') {
            return 0.6;
        }
        return 0.4;
    }

    private calculateAcceptanceCriteriaConfidence(data: Record<string, any>): number {
        if (data.hasEarsFormat) {
            return 0.9;
        } else if (data.count > 0) {
            return 0.7;
        }
        return 0.3;
    }

    private calculateRequirementsConfidence(data: Record<string, any>): number {
        if (data.hasPriorities && data.count > 0) {
            return 0.8;
        } else if (data.count > 0) {
            return 0.6;
        }
        return 0.3;
    }

    private calculateMetricsConfidence(data: Record<string, any>): number {
        if (data.hasPerformanceMetrics) {
            return 0.9;
        } else if (data.count > 0) {
            return 0.7;
        }
        return 0.2;
    }
}