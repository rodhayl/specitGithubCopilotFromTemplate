// ResponseProcessor unit tests
import { ResponseProcessor } from '../ResponseProcessor';
import { Question, ConversationContext, ValidationRule } from '../types';
import * as vscode from 'vscode';

describe('ResponseProcessor', () => {
    let responseProcessor: ResponseProcessor;
    let mockContext: ConversationContext;

    beforeEach(() => {
        responseProcessor = new ResponseProcessor();
        mockContext = {
            documentType: 'prd',
            documentPath: '/test/document.md',
            workflowPhase: 'prd',
            workspaceRoot: '/test',
            extensionContext: {} as vscode.ExtensionContext
        };
    });

    describe('analyzeResponse', () => {
        const mockQuestion: Question = {
            id: 'test-q1',
            text: 'What problem are you solving?',
            type: 'open-ended',
            examples: ['Authentication issues', 'Performance problems'],
            required: true,
            followupTriggers: ['performance', 'authentication'],
            category: 'problem-definition',
            priority: 1
        };

        it('should analyze a comprehensive response positively', () => {
            const response = 'We are facing significant authentication issues with our current system. Users are experiencing slow login times and frequent timeouts, which impacts their productivity and creates frustration.';
            
            const analysis = responseProcessor.analyzeResponse(response, mockQuestion);

            expect(analysis.completeness).toBeGreaterThan(0.7);
            expect(analysis.clarity).toBeGreaterThan(0.6);
            expect(analysis.extractedEntities.length).toBeGreaterThan(0);
            expect(analysis.needsClarification).toBe(false);
            expect(analysis.confidence).toBeGreaterThan(0.6);
        });

        it('should identify short responses as needing clarification', () => {
            const response = 'Yes';
            
            const analysis = responseProcessor.analyzeResponse(response, mockQuestion);

            expect(analysis.completeness).toBeLessThan(0.5);
            expect(analysis.needsClarification).toBe(true);
            expect(analysis.suggestedFollowups.length).toBeGreaterThan(0);
        });

        it('should extract entities from technical responses', () => {
            const response = 'Our API response times are over 500ms and our database queries are slow. We need to improve performance for 1000 concurrent users.';
            
            const analysis = responseProcessor.analyzeResponse(response, mockQuestion);

            expect(analysis.extractedEntities.length).toBeGreaterThan(0);
            
            const entityTypes = analysis.extractedEntities.map(e => e.type);
            expect(entityTypes).toContain('technology');
            expect(entityTypes).toContain('metric');
        });

        it('should generate relevant follow-up suggestions', () => {
            const response = 'We have user authentication problems';
            
            const analysis = responseProcessor.analyzeResponse(response, mockQuestion);

            expect(analysis.suggestedFollowups.length).toBeGreaterThan(0);
            expect(analysis.suggestedFollowups.some(s => s.includes('users'))).toBe(true);
        });

        it('should handle structured question types appropriately', () => {
            const structuredQuestion: Question = {
                ...mockQuestion,
                type: 'structured'
            };
            const response = 'Just some basic issues';
            
            const analysis = responseProcessor.analyzeResponse(response, structuredQuestion);

            expect(analysis.completeness).toBeLessThan(0.8); // Penalized for lack of structure
        });
    });

    describe('extractStructuredData', () => {
        it('should extract user story format', () => {
            const response = 'As a developer, I want to authenticate users quickly, so that they can access the system without delays';
            
            const structured = responseProcessor.extractStructuredData(response, 'user-story');

            expect(structured.type).toBe('user-story');
            expect(structured.data.role).toBe('developer');
            expect(structured.data.want).toContain('authenticate');
            expect(structured.data.benefit).toContain('access');
            expect(structured.confidence).toBeGreaterThan(0.8);
        });

        it('should extract acceptance criteria in EARS format', () => {
            const response = 'WHEN a user enters valid credentials THEN the system SHALL authenticate within 2 seconds. IF authentication fails THEN the system SHALL display an error message.';
            
            const structured = responseProcessor.extractStructuredData(response, 'acceptance-criteria');

            expect(structured.type).toBe('acceptance-criteria');
            expect(structured.data.criteria.length).toBeGreaterThan(0);
            expect(structured.data.hasEarsFormat).toBe(true);
            expect(structured.confidence).toBeGreaterThan(0.8);
        });

        it('should extract requirements with priorities', () => {
            const response = 'The system must authenticate users within 2 seconds. The system should support 1000 concurrent users. The system will provide detailed error messages.';
            
            const structured = responseProcessor.extractStructuredData(response, 'requirements');

            expect(structured.type).toBe('requirements');
            expect(structured.data.requirements.length).toBe(3);
            expect(structured.data.hasPriorities).toBe(true);
            
            const priorities = structured.data.requirements.map((r: any) => r.priority);
            expect(priorities).toContain('high'); // 'must' should be high priority
        });

        it('should extract metrics and performance data', () => {
            const response = 'Response time should be under 100ms for 95% of requests. We need to support 10000 users and process 5GB of data.';
            
            const structured = responseProcessor.extractStructuredData(response, 'metrics');

            expect(structured.type).toBe('metrics');
            expect(structured.data.metrics.length).toBeGreaterThan(0);
            expect(structured.data.hasPerformanceMetrics).toBe(true);
            
            const values = structured.data.metrics.map((m: any) => m.value);
            expect(values).toContain(100);
            expect(values).toContain(10000);
        });

        it('should handle unknown formats gracefully', () => {
            const response = 'This is a general response with some content.';
            
            const structured = responseProcessor.extractStructuredData(response, 'unknown-format');

            expect(structured.type).toBe('unknown-format');
            expect(structured.data).toBeDefined();
            expect(structured.confidence).toBeGreaterThan(0);
        });
    });

    describe('validateCompleteness', () => {
        it('should validate required fields', () => {
            const rules: ValidationRule[] = [
                {
                    type: 'required',
                    message: 'Response is required'
                }
            ];

            const validResult = responseProcessor.validateCompleteness('Valid response', rules);
            expect(validResult.valid).toBe(true);
            expect(validResult.errors).toHaveLength(0);

            const invalidResult = responseProcessor.validateCompleteness('', rules);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors).toHaveLength(1);
        });

        it('should validate minimum length', () => {
            const rules: ValidationRule[] = [
                {
                    type: 'minLength',
                    value: 10,
                    message: 'Response too short'
                }
            ];

            const validResult = responseProcessor.validateCompleteness('This is a long enough response', rules);
            expect(validResult.valid).toBe(true);

            const invalidResult = responseProcessor.validateCompleteness('Short', rules);
            expect(invalidResult.valid).toBe(false);
            expect(invalidResult.errors[0]).toContain('short');
        });

        it('should validate maximum length', () => {
            const rules: ValidationRule[] = [
                {
                    type: 'maxLength',
                    value: 20,
                    message: 'Response too long'
                }
            ];

            const validResult = responseProcessor.validateCompleteness('Short response', rules);
            expect(validResult.valid).toBe(true);

            const invalidResult = responseProcessor.validateCompleteness('This is a very long response that exceeds the maximum length', rules);
            expect(invalidResult.valid).toBe(false);
        });

        it('should validate patterns', () => {
            const rules: ValidationRule[] = [
                {
                    type: 'pattern',
                    value: '\\b(must|shall|should)\\b',
                    message: 'Must contain requirement keywords'
                }
            ];

            const validResult = responseProcessor.validateCompleteness('The system must authenticate users', rules);
            expect(validResult.valid).toBe(true);

            const invalidResult = responseProcessor.validateCompleteness('The system authenticates users', rules);
            expect(invalidResult.valid).toBe(false);
        });

        it('should handle custom validation', () => {
            const rules: ValidationRule[] = [
                {
                    type: 'custom',
                    message: 'Must contain user perspective',
                    validator: (input: string) => input.toLowerCase().includes('user')
                }
            ];

            const validResult = responseProcessor.validateCompleteness('This helps users work better', rules);
            expect(validResult.valid).toBe(true);

            const invalidResult = responseProcessor.validateCompleteness('This is a system feature', rules);
            expect(invalidResult.valid).toBe(false);
        });
    });

    describe('suggestImprovements', () => {
        it('should suggest more detail for short responses', () => {
            const response = 'Yes';
            
            const suggestions = responseProcessor.suggestImprovements(response, mockContext);

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions.some(s => s.includes('detail'))).toBe(true);
        });

        it('should suggest breaking up very long responses', () => {
            const response = 'A'.repeat(1500);
            
            const suggestions = responseProcessor.suggestImprovements(response, mockContext);

            expect(suggestions.some(s => s.includes('smaller') || s.includes('break'))).toBe(true);
        });

        it('should suggest avoiding vague language', () => {
            const response = 'We have some stuff that needs something done somehow';
            
            const suggestions = responseProcessor.suggestImprovements(response, mockContext);

            expect(suggestions.some(s => s.includes('specific') || s.includes('vague'))).toBe(true);
        });

        it('should suggest examples for PRD context', () => {
            const response = 'We need better performance';
            
            const suggestions = responseProcessor.suggestImprovements(response, mockContext);

            expect(suggestions.some(s => s.includes('example'))).toBe(true);
        });

        it('should suggest measurable criteria for requirements context', () => {
            const requirementsContext = {
                ...mockContext,
                workflowPhase: 'requirements'
            };
            const response = 'The system should be fast';
            
            const suggestions = responseProcessor.suggestImprovements(response, requirementsContext);

            expect(suggestions.some(s => s.includes('measurable') || s.includes('criteria'))).toBe(true);
        });

        it('should suggest user perspective for PRD', () => {
            const response = 'The system will process data efficiently';
            
            const suggestions = responseProcessor.suggestImprovements(response, mockContext);

            expect(suggestions.some(s => s.includes('user') || s.includes('benefit'))).toBe(true);
        });
    });

    describe('processEntities', () => {
        it('should extract technology entities', () => {
            const response = 'We use React and Node.js with a PostgreSQL database deployed on AWS';
            
            const entities = responseProcessor.processEntities(response);

            expect(entities.length).toBeGreaterThan(0);
            
            const techEntities = entities.filter(e => e.type === 'technology');
            expect(techEntities.length).toBeGreaterThan(0);
            
            const values = techEntities.map(e => e.value.toLowerCase());
            expect(values).toContain('react');
            expect(values).toContain('node');
            expect(values).toContain('aws');
        });

        it('should extract metric entities', () => {
            const response = 'Response time is 150ms for 1000 users processing 5GB of data';
            
            const entities = responseProcessor.processEntities(response);

            const metricEntities = entities.filter(e => e.type === 'metric');
            expect(metricEntities.length).toBeGreaterThan(0);
        });

        it('should extract role entities', () => {
            const response = 'The admin can manage users while customers can view their data';
            
            const entities = responseProcessor.processEntities(response);

            const roleEntities = entities.filter(e => e.type === 'role');
            expect(roleEntities.length).toBeGreaterThan(0);
            
            const values = roleEntities.map(e => e.value.toLowerCase());
            expect(values).toContain('admin');
            expect(values).toContain('customer');
        });

        it('should remove overlapping entities', () => {
            const response = 'user users';
            
            const entities = responseProcessor.processEntities(response);

            // Should not have overlapping entities
            for (let i = 0; i < entities.length; i++) {
                for (let j = i + 1; j < entities.length; j++) {
                    const entity1 = entities[i];
                    const entity2 = entities[j];
                    
                    const overlap = (entity1.startIndex < entity2.endIndex && entity1.endIndex > entity2.startIndex);
                    expect(overlap).toBe(false);
                }
            }
        });

        it('should assign confidence scores to entities', () => {
            const response = 'We use React for the frontend';
            
            const entities = responseProcessor.processEntities(response);

            expect(entities.length).toBeGreaterThan(0);
            entities.forEach(entity => {
                expect(entity.confidence).toBeGreaterThan(0);
                expect(entity.confidence).toBeLessThanOrEqual(1);
            });
        });
    });
});