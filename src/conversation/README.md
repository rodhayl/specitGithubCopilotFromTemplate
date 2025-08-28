# Conversation System

This directory contains the implementation of the conversational agent system for the VSCode Docu extension. The system enables proactive, intelligent conversations between users and AI agents to create comprehensive documentation.

## Overview

The conversation system transforms the extension from a simple document creator into an intelligent assistant that:

- **Proactively asks relevant questions** based on agent specialization
- **Analyzes user responses** to extract structured information
- **Automatically updates documents** based on conversation content
- **Tracks progress** and suggests workflow transitions
- **Handles errors gracefully** with recovery mechanisms

## Architecture

### Core Components

1. **ConversationManager** - Orchestrates multi-turn conversations
2. **QuestionEngine** - Generates contextual questions using agent-specific templates
3. **ResponseProcessor** - Analyzes and validates user responses
4. **ContentCapture** - Automatically updates documents from conversation data
5. **WorkflowOrchestrator** - Manages phase transitions between agents
6. **ProgressTracker** - Monitors completion and provides progress feedback

### Agent Integration

The system enhances existing agents with conversation capabilities:

- **PRDCreatorAgent** - Asks strategic questions about product vision, users, and goals
- **BrainstormerAgent** - Facilitates creative exploration with open-ended questions
- **RequirementsGathererAgent** - Structures requirements using EARS format

## Usage

### Starting a Conversation

When a user interacts with an agent without using commands, the conversation system automatically:

1. Starts a new conversation session
2. Generates initial questions based on the agent type
3. Presents the first question with examples
4. Tracks the user's progress

### Example Flow

```
User: @docu /new "Card Game Shop"
Agent: Document created! Now let's develop it together.

🚀 Welcome to PRD Creation!

I'm here to help you transform your product idea into a comprehensive 
Product Requirements Document. Let's start with the most important question:

**What specific problem or pain point are you trying to solve with this product?**

💡 Here are some examples to inspire you:
• Users struggle with managing multiple authentication systems
• Our current data processing is too slow for real-time needs
• Customers can't easily find the information they need

User: I want to create an online platform where people can buy and sell 
trading cards, but current marketplaces are too complex and have high fees.

Agent: That's a great problem to solve! The trading card market definitely 
needs better platforms. Let me dig a bit deeper.

**Who are your primary target users, and what are their key characteristics?**

💡 Here are some examples:
• Software developers who need to integrate authentication
• Business analysts who create reports from large datasets
• End customers who shop on our e-commerce platform
```

### Conversation Features

- **Contextual Questions**: Questions adapt based on previous responses
- **Progress Tracking**: Users see completion percentage and next steps
- **Document Updates**: Responses automatically update relevant document sections
- **Error Recovery**: System handles unclear responses with clarification requests
- **Workflow Transitions**: Suggests moving to next phase when ready

## Implementation Details

### Question Templates

Each agent has structured question templates with:

```typescript
{
  agentName: 'prd-creator',
  phase: 'prd',
  initialQuestions: {
    primary: [...], // Must-ask questions
    secondary: [...], // Context-dependent questions
    validation: [...] // Clarification questions
  },
  followupStrategies: [...], // Trigger-based follow-ups
  completionCriteria: {...} // When to suggest phase transition
}
```

### Response Analysis

The ResponseProcessor analyzes responses for:

- **Completeness**: Length, detail level, structure
- **Clarity**: Coherence, specificity, readability
- **Entity Extraction**: Technologies, metrics, roles, actions
- **Validation**: Against question requirements and format rules

### Document Integration

ContentCapture automatically:

- Updates document sections based on conversation responses
- Uses templates to format content appropriately
- Tracks changes and provides summaries
- Validates document structure

### Error Handling

The system gracefully handles:

- **Unclear Responses**: Asks for clarification with examples
- **Context Loss**: Summarizes progress and refocuses conversation
- **Validation Errors**: Provides specific guidance and suggestions
- **Session Issues**: Offers recovery options and restart capabilities

## Testing

The system includes comprehensive tests:

- **Unit Tests**: Individual component functionality
- **Integration Tests**: End-to-end conversation flows
- **Error Handling Tests**: Recovery mechanism validation
- **Performance Tests**: Response time and memory usage

Run tests with:
```bash
npm test src/conversation
```

## Configuration

Agents can be customized through:

- **Question Templates**: Modify agent-specific questions
- **Validation Rules**: Adjust response requirements
- **Completion Criteria**: Change phase transition thresholds
- **Error Messages**: Customize user-facing messages

## Future Enhancements

Planned improvements include:

- **Conversation Analytics**: Track effectiveness and optimize questions
- **Custom Templates**: User-defined question sets for specific domains
- **Multi-language Support**: Conversations in different languages
- **Voice Integration**: Audio-based conversations
- **Collaboration**: Multi-user conversation sessions

## Contributing

When adding new features:

1. Follow the existing architecture patterns
2. Add comprehensive tests for new functionality
3. Update question templates for new agent types
4. Document any new configuration options
5. Consider error handling and recovery scenarios

## API Reference

See the TypeScript interfaces in `types.ts` for detailed API documentation.