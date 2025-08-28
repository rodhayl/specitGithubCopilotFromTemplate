# Agent Interaction Improvements Design

## Overview

This design addresses the current gaps in agent interaction within the VSCode Docu extension. The system currently creates documents but lacks proactive agent behavior, clear user guidance, and structured conversation flows. This design introduces a conversational agent framework with proactive questioning, workflow progression, and automatic content capture.

## Architecture

### Core Components

1. **ConversationManager**: Orchestrates multi-turn conversations between users and agents
2. **QuestionEngine**: Generates contextual questions based on agent type and conversation state
3. **ResponseProcessor**: Analyzes user responses and extracts structured information
4. **ContentCapture**: Automatically updates documents based on conversation content
5. **WorkflowOrchestrator**: Manages phase transitions and agent switching
6. **ProgressTracker**: Monitors completion status and provides progress feedback

### Agent Enhancement Framework

Each agent will be enhanced with:
- **Question Templates**: Pre-defined question sets for different scenarios
- **Response Handlers**: Logic to process and validate user responses
- **Content Extractors**: Methods to pull structured data from conversational responses
- **Transition Logic**: Rules for when to suggest moving to next phases

## Components and Interfaces

### ConversationManager

```typescript
interface ConversationManager {
  startConversation(agentName: string, context: ConversationContext): Promise<ConversationSession>
  continueConversation(sessionId: string, userResponse: string): Promise<ConversationResponse>
  endConversation(sessionId: string): Promise<ConversationSummary>
  getConversationHistory(sessionId: string): ConversationTurn[]
}

interface ConversationContext {
  documentType: string
  documentPath: string
  existingContent?: string
  workflowPhase: string
  previousConversations?: ConversationSummary[]
}

interface ConversationSession {
  sessionId: string
  agentName: string
  currentQuestionSet: Question[]
  state: ConversationState
}

interface ConversationResponse {
  agentMessage: string
  followupQuestions?: Question[]
  documentUpdates?: DocumentUpdate[]
  workflowSuggestions?: WorkflowSuggestion[]
  progressUpdate?: ProgressStatus
}
```

### QuestionEngine

```typescript
interface QuestionEngine {
  generateInitialQuestions(agentType: string, context: ConversationContext): Question[]
  generateFollowupQuestions(agentType: string, userResponse: string, conversationHistory: ConversationTurn[]): Question[]
  validateQuestionRelevance(questions: Question[], context: ConversationContext): Question[]
}

interface Question {
  id: string
  text: string
  type: 'open-ended' | 'multiple-choice' | 'structured'
  examples?: string[]
  required: boolean
  followupTriggers?: string[]
  category: string
}
```

### ResponseProcessor

```typescript
interface ResponseProcessor {
  analyzeResponse(response: string, question: Question): ResponseAnalysis
  extractStructuredData(response: string, expectedFormat: string): StructuredData
  validateCompleteness(response: string, requirements: ValidationRule[]): ValidationResult
  suggestImprovements(response: string, context: ConversationContext): string[]
}

interface ResponseAnalysis {
  completeness: number // 0-1 scale
  clarity: number // 0-1 scale
  extractedEntities: Entity[]
  suggestedFollowups: string[]
  needsClarification: boolean
}
```

### ContentCapture

```typescript
interface ContentCapture {
  updateDocument(documentPath: string, updates: DocumentUpdate[]): Promise<UpdateResult>
  generateDocumentSection(sectionType: string, conversationData: ConversationData): string
  validateDocumentStructure(documentPath: string): ValidationResult
  trackChanges(documentPath: string, changes: DocumentChange[]): void
}

interface DocumentUpdate {
  section: string
  content: string
  updateType: 'replace' | 'append' | 'prepend' | 'insert'
  position?: number
}
```

### WorkflowOrchestrator

```typescript
interface WorkflowOrchestrator {
  evaluatePhaseCompletion(currentPhase: string, documentPath: string): PhaseCompletionStatus
  suggestNextPhase(currentPhase: string, completionStatus: PhaseCompletionStatus): WorkflowSuggestion
  validatePhaseTransition(fromPhase: string, toPhase: string): TransitionValidation
  executePhaseTransition(suggestion: WorkflowSuggestion): Promise<TransitionResult>
}

interface WorkflowSuggestion {
  nextPhase: string
  recommendedAgent: string
  reason: string
  prerequisites: string[]
  estimatedDuration: string
}
```

## Data Models

### Agent Question Templates

Each agent will have structured question templates:

```typescript
interface AgentQuestionTemplate {
  agentName: string
  phase: string
  initialQuestions: QuestionSet
  followupStrategies: FollowupStrategy[]
  completionCriteria: CompletionCriteria
}

interface QuestionSet {
  primary: Question[] // Must-ask questions
  secondary: Question[] // Context-dependent questions
  validation: Question[] // Clarification questions
}

interface FollowupStrategy {
  trigger: string // Regex or keyword pattern
  questions: Question[]
  contentExtraction: ExtractionRule[]
}
```

### Conversation State Management

```typescript
interface ConversationState {
  sessionId: string
  agentName: string
  phase: string
  currentQuestionIndex: number
  answeredQuestions: Map<string, string>
  extractedData: Map<string, any>
  pendingValidations: ValidationItem[]
  completionScore: number
}
```

## Error Handling

### Conversation Error Recovery

1. **Unclear Responses**: When user responses are ambiguous, agents will:
   - Ask clarifying questions with examples
   - Offer multiple-choice alternatives
   - Provide templates for structured responses

2. **Incomplete Information**: When responses lack necessary detail:
   - Identify specific missing elements
   - Ask targeted follow-up questions
   - Provide guidance on expected level of detail

3. **Context Loss**: When conversations become unfocused:
   - Summarize current progress
   - Refocus on current objectives
   - Offer to restart with clearer structure

### Document Update Failures

1. **File Access Issues**: Implement retry logic with user notification
2. **Content Conflicts**: Detect conflicts and ask user to resolve
3. **Format Validation**: Validate content before writing and fix common issues

## Testing Strategy

### Unit Testing

1. **Question Generation**: Test question templates for different scenarios
2. **Response Processing**: Validate extraction of structured data from various response formats
3. **Content Capture**: Test document updates with different content types
4. **Workflow Logic**: Verify phase transition rules and validation

### Integration Testing

1. **Agent Conversations**: Test complete conversation flows for each agent type
2. **Multi-Agent Workflows**: Test transitions between different agents
3. **Document Generation**: Verify end-to-end document creation from conversations
4. **Error Recovery**: Test error handling and recovery scenarios

### User Experience Testing

1. **Conversation Flow**: Test natural conversation patterns with real users
2. **Question Clarity**: Validate that questions are clear and actionable
3. **Progress Feedback**: Test progress tracking and completion indicators
4. **Workflow Guidance**: Verify that users understand next steps and transitions

## Implementation Phases

### Phase 1: Core Conversation Framework
- Implement ConversationManager and basic question/response handling
- Create question templates for PRD Creator agent
- Add basic content capture for PRD documents

### Phase 2: Enhanced Agent Interactions
- Extend question templates to all agent types
- Implement ResponseProcessor with entity extraction
- Add workflow progression suggestions

### Phase 3: Advanced Features
- Implement ProgressTracker with completion metrics
- Add conversation history and context awareness
- Create advanced error recovery mechanisms

### Phase 4: Polish and Optimization
- Optimize question generation based on user feedback
- Implement conversation analytics and improvement suggestions
- Add customizable conversation flows