# Design Document

## Overview

This design addresses the offline mode detection issues and agent functionality problems in the Docu extension. The solution involves improving the model availability detection logic, enhancing agent offline capabilities, and ensuring proper conversation flows work in both online and offline modes.

## Architecture

### Offline Mode Detection Improvements

The current `OfflineManager.checkModelAvailability()` method needs to be more robust in detecting GitHub Copilot availability. The issue appears to be in the model selection logic and timing of checks. Additionally, there are reports of the extension causing GitHub Copilot to prompt for re-authentication, suggesting potential interference with Copilot's authentication state.

**Key Changes:**
- Improve model availability detection with better error handling
- Add retry logic for transient failures
- Distinguish between temporary unavailability and true offline state
- Add configuration option to force online/offline mode for testing
- Investigate and fix potential authentication interference issues
- Ensure extension doesn't invalidate existing Copilot sessions

### Agent Conversation Flow Enhancement

Agents currently have conversation capabilities but they're not being properly triggered by the `/new` command. The conversation flow needs to be integrated with document creation.

**Key Changes:**
- Modify `handleNewCommand` to trigger agent conversations for appropriate templates
- Ensure agents provide structured offline fallbacks
- Improve conversation state management
- Add proper error recovery for conversation failures

### Fallback Functionality Design

When truly offline, agents should provide structured, helpful responses rather than generic error messages.

**Key Changes:**
- Create template-specific offline responses
- Provide guided manual workflows
- Offer structured placeholders and examples
- Maintain conversation-like interaction even without AI

## Components and Interfaces

### OfflineManager Enhancements

```typescript
interface ModelAvailabilityResult {
    available: boolean;
    models: vscode.LanguageModel[];
    error?: string;
    retryAfter?: number;
}

class OfflineManager {
    async checkModelAvailability(force?: boolean): Promise<ModelAvailabilityResult>
    async validateCopilotAuthentication(): Promise<boolean>
    setOfflineMode(offline: boolean, reason?: string): void
    getDetailedStatus(): OfflineStatus
}
```

### Agent Conversation Integration

```typescript
interface ConversationTrigger {
    templateId: string;
    shouldTrigger: boolean;
    agentName: string;
    questionSet: string;
}

class BaseAgent {
    async handleOfflineRequest(request: ChatRequest, context: AgentContext): Promise<AgentResponse>
    generateOfflineFallback(operation: string, context: any): Promise<string>
    createStructuredOfflineResponse(templateType: string): AgentResponse
}
```

### Command Integration

```typescript
interface DocumentCreationContext {
    templateId: string;
    title: string;
    outputPath: string;
    shouldStartConversation: boolean;
    agentName?: string;
}

async function handleNewCommand(
    parsedCommand: ParsedCommand, 
    context: CommandContext
): Promise<CommandResult>
```

## Data Models

### Offline Status Model

```typescript
interface OfflineStatus {
    isOffline: boolean;
    reason: string;
    lastCheck: Date;
    capabilities: OfflineCapabilities;
    modelStatus: {
        copilotAvailable: boolean;
        modelsFound: number;
        lastError?: string;
    };
}
```

### Conversation State Model

```typescript
interface ConversationState {
    sessionId: string;
    agentName: string;
    templateType: string;
    documentPath: string;
    currentQuestion: number;
    responses: Record<string, string>;
    isOffline: boolean;
}
```

## Error Handling

### Model Detection Errors

- **Transient Failures:** Retry with exponential backoff
- **Authentication Issues:** Provide clear guidance to user without triggering re-auth
- **Network Issues:** Distinguish from Copilot unavailability
- **Permission Issues:** Guide user through resolution steps
- **Authentication Interference:** Ensure extension doesn't invalidate Copilot sessions

### Conversation Errors

- **Agent Unavailable:** Fall back to structured templates
- **Conversation Interrupted:** Allow resumption or restart
- **Invalid Responses:** Provide validation and retry options
- **Timeout Issues:** Graceful degradation to manual mode

### Fallback Strategies

1. **Graceful Degradation:** Provide structured alternatives
2. **User Guidance:** Clear instructions for manual completion
3. **Template Enhancement:** Rich placeholders and examples
4. **Progressive Enhancement:** Restore features as they become available

## Testing Strategy

### Unit Tests

- `OfflineManager.checkModelAvailability()` with various scenarios
- Agent offline response generation
- Command handling with offline/online modes
- Conversation state management

### Integration Tests

- End-to-end `/new` command flow
- Agent conversation triggering
- Mode transitions (online ↔ offline)
- Document creation with conversations

### Manual Testing Scenarios

1. **Normal Operation:** Copilot available, all features working
2. **Copilot Unavailable:** No models found, proper offline mode
3. **Authentication Issues:** Copilot installed but not authenticated
4. **Network Issues:** Intermittent connectivity problems
5. **Mode Transitions:** Going offline and coming back online
6. **Authentication Interference:** Extension causing Copilot re-login prompts

### Test Data

- Mock GitHub Copilot model responses
- Sample conversation flows for each agent
- Template configurations for testing
- Various error conditions and responses

## Implementation Phases

### Phase 1: Offline Detection Fixes
- Improve `OfflineManager.checkModelAvailability()`
- Add better error handling and retry logic
- Implement detailed status reporting

### Phase 2: Agent Conversation Integration
- Modify `/new` command to trigger conversations
- Enhance agent offline capabilities
- Implement structured fallback responses

### Phase 3: Enhanced Fallback Functionality
- Create template-specific offline workflows
- Improve user guidance and error messages
- Add configuration options for testing

### Phase 4: Testing and Documentation
- Comprehensive test coverage
- Update tutorial and documentation
- Validate all user scenarios