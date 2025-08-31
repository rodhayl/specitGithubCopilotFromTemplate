# Implementation Plan: 15 Tasks to Fix Conversation Flow

## Overview

This document provides detailed implementation instructions for the 15 critical tasks identified to fix the broken conversation flow in the Docu VS Code extension. Each task includes specific code changes, file modifications, and testing requirements.

***

## Phase 1: Core Infrastructure Fixes

### Task 1: Fix Agent Manager Integration

**Files to Modify:**

* `src/commands/CommandRouter.ts`

* `src/agents/AgentManager.ts`

**Current Problem:**
Lines 454-530 in CommandRouter.ts contain hardcoded placeholder responses instead of real AgentManager integration.

**Implementation Steps:**

1. **Modify CommandRouter.ts constructor:**

```typescript
export class CommandRouter {
    private agentManager: AgentManager;
    
    constructor(
        private templateService: TemplateService,
        private toolManager: ToolManager,
        agentManager: AgentManager // Add this parameter
    ) {
        this.agentManager = agentManager;
        this.registerCommands();
    }
}
```

1. **Replace placeholder agent command handler:**

```typescript
private async handleAgentCommand(args: string[], flags: Record<string, any>): Promise<CommandResult> {
    try {
        const subcommand = args[0];
        
        switch (subcommand) {
            case 'set':
                const agentId = args[1];
                if (!agentId) {
                    return {
                        success: false,
                        message: '❌ Agent ID required. Usage: /agent set <agent-id>',
                        data: { error: 'Missing agent ID' }
                    };
                }
                
                const setResult = await this.agentManager.setCurrentAgent(agentId);
                if (setResult.success) {
                    return {
                        success: true,
                        message: `✅ Agent Set: ${agentId}\n\n🤖 Ready for conversation! You can now chat directly without using /chat.\n\n💡 What would you like to work on?\n\n• Tell me about your project requirements\n• Help me develop the document content\n• Review and improve existing content\n\n💬 Just type your message below to get started!`,
                        data: { agentId, agent: setResult.agent }
                    };
                } else {
                    return {
                        success: false,
                        message: `❌ Failed to set agent: ${setResult.error}`,
                        data: { error: setResult.error }
                    };
                }
                
            case 'list':
                const agents = this.agentManager.getAvailableAgents();
                const agentList = agents.map(agent => `• ${agent.id}: ${agent.description}`).join('\n');
                return {
                    success: true,
                    message: `📋 Available Agents:\n\n${agentList}`,
                    data: { agents }
                };
                
            case 'current':
                const currentAgent = this.agentManager.getCurrentAgent();
                if (currentAgent) {
                    return {
                        success: true,
                        message: `🤖 Current Agent: ${currentAgent.id}\n${currentAgent.description}`,
                        data: { agent: currentAgent }
                    };
                } else {
                    return {
                        success: true,
                        message: '❌ No agent currently set. Use /agent set <agent-id> to set one.',
                        data: { agent: null }
                    };
                }
                
            default:
                return {
                    success: false,
                    message: '❌ Invalid subcommand. Use: list, set <agent-id>, or current',
                    data: { error: 'Invalid subcommand' }
                };
        }
    } catch (error) {
        return {
            success: false,
            message: `❌ Agent command failed: ${error.message}`,
            data: { error: error.message }
        };
    }
}
```

1. **Update AgentManager.setCurrentAgent method:**

```typescript
public async setCurrentAgent(agentId: string): Promise<{success: boolean, agent?: BaseAgent, error?: string}> {
    try {
        const agent = this.getAgent(agentId);
        if (!agent) {
            return {
                success: false,
                error: `Agent '${agentId}' not found. Available agents: ${this.getAvailableAgents().map(a => a.id).join(', ')}`
            };
        }
        
        this.currentAgent = agent;
        
        // Notify other components about agent change
        await this.notifyAgentChange(agent);
        
        return { success: true, agent };
    } catch (error) {
        return {
            success: false,
            error: `Failed to set agent: ${error.message}`
        };
    }
}

private async notifyAgentChange(agent: BaseAgent): Promise<void> {
    // Notify conversation manager about agent change
    // This will be implemented in Task 3
}
```

**Testing Requirements:**

* Test `/agent list` returns all registered agents

* Test `/agent set prd-creator` successfully sets the agent

* Test `/agent set invalid-agent` returns appropriate error

* Test `/agent current` shows the currently set agent

***

### Task 2: Implement Command-to-Conversation Bridge

**Files to Modify:**

* `src/commands/NewCommandHandler.ts`

* `src/conversation/ConversationFlowHandler.ts`

* `src/extension.ts`

**Current Problem:**
NewCommandHandler has conversation integration code but it's not properly connected to the main flow.

**Implementation Steps:**

1. **Fix NewCommandHandler conversation integration:**

```typescript
export class NewCommandHandler {
    constructor(
        private templateService: TemplateService,
        private conversationFlowHandler: ConversationFlowHandler,
        private agentManager: AgentManager,
        private stateManager: StateManager // Will be created in Task 3
    ) {}
    
    public async execute(args: string[], flags: Record<string, any>): Promise<CommandResult> {
        try {
            // ... existing document creation code ...
            
            // After successful document creation
            if (result.success) {
                // Set up conversation context
                const conversationContext = {
                    documentPath: result.data.filePath,
                    documentName: result.data.fileName,
                    template: result.data.template,
                    agentId: this.determineAgentForTemplate(result.data.template)
                };
                
                // Initialize conversation flow
                await this.initializeConversationFlow(conversationContext);
                
                return {
                    success: true,
                    message: `✅ Document created: ${result.data.fileName}\n\n🤖 Starting conversation with ${conversationContext.agentId}...\n\n💬 I'm ready to help you develop this document. What would you like to focus on first?`,
                    data: {
                        ...result.data,
                        conversationStarted: true,
                        agentId: conversationContext.agentId
                    }
                };
            }
            
            return result;
        } catch (error) {
            return {
                success: false,
                message: `❌ Failed to create document: ${error.message}`,
                data: { error: error.message }
            };
        }
    }
    
    private determineAgentForTemplate(template: string): string {
        const templateAgentMap = {
            'basic': 'prd-creator',
            'prd': 'prd-creator',
            'architecture': 'solution-architect',
            'requirements': 'requirements-gatherer'
        };
        
        return templateAgentMap[template] || 'prd-creator';
    }
    
    private async initializeConversationFlow(context: any): Promise<void> {
        // Set the appropriate agent
        await this.agentManager.setCurrentAgent(context.agentId);
        
        // Initialize conversation flow
        await this.conversationFlowHandler.initializeFlow(context);
        
        // Update state manager
        await this.stateManager.setConversationContext(context);
    }
}
```

1. **Update ConversationFlowHandler:**

```typescript
export class ConversationFlowHandler {
    private currentContext: any = null;
    
    constructor(
        private agentManager: AgentManager,
        private conversationManager: ConversationManager
    ) {}
    
    public async initializeFlow(context: any): Promise<void> {
        this.currentContext = context;
        
        // Create conversation session
        await this.conversationManager.createSession({
            documentPath: context.documentPath,
            agentId: context.agentId,
            template: context.template
        });
        
        // Enable auto-chat mode
        await this.conversationManager.enableAutoChat(true);
    }
    
    public async handleUserInput(input: string): Promise<string> {
        if (!this.currentContext) {
            throw new Error('No conversation context available');
        }
        
        const agent = this.agentManager.getCurrentAgent();
        if (!agent) {
            throw new Error('No agent set for conversation');
        }
        
        return await agent.handleConversationalRequest(input, this.currentContext);
    }
}
```

**Testing Requirements:**

* Test document creation triggers conversation initialization

* Test appropriate agent is selected based on template

* Test conversation context is properly set up

* Test auto-chat mode is enabled after document creation

***

### Task 3: Centralize State Management

**Files to Create:**

* `src/state/StateManager.ts`

**Files to Modify:**

* `src/extension.ts`

**Implementation Steps:**

1. **Create StateManager class:**

```typescript
export interface ConversationContext {
    documentPath: string;
    documentName: string;
    template: string;
    agentId: string;
    sessionId?: string;
    isActive: boolean;
}

export interface ApplicationState {
    currentAgent: string | null;
    conversationContext: ConversationContext | null;
    isConversationActive: boolean;
    lastCommand: string | null;
    commandHistory: string[];
}

export class StateManager {
    private state: ApplicationState = {
        currentAgent: null,
        conversationContext: null,
        isConversationActive: false,
        lastCommand: null,
        commandHistory: []
    };
    
    private listeners: Map<string, Function[]> = new Map();
    
    // Agent state management
    public async setCurrentAgent(agentId: string): Promise<void> {
        this.state.currentAgent = agentId;
        await this.notifyListeners('agentChanged', agentId);
    }
    
    public getCurrentAgent(): string | null {
        return this.state.currentAgent;
    }
    
    // Conversation state management
    public async setConversationContext(context: ConversationContext): Promise<void> {
        this.state.conversationContext = context;
        this.state.isConversationActive = true;
        await this.notifyListeners('conversationStarted', context);
    }
    
    public getConversationContext(): ConversationContext | null {
        return this.state.conversationContext;
    }
    
    public async endConversation(): Promise<void> {
        this.state.conversationContext = null;
        this.state.isConversationActive = false;
        await this.notifyListeners('conversationEnded', null);
    }
    
    // Command history
    public addCommandToHistory(command: string): void {
        this.state.commandHistory.push(command);
        this.state.lastCommand = command;
        
        // Keep only last 50 commands
        if (this.state.commandHistory.length > 50) {
            this.state.commandHistory = this.state.commandHistory.slice(-50);
        }
    }
    
    // Event system
    public addEventListener(event: string, callback: Function): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(callback);
    }
    
    private async notifyListeners(event: string, data: any): Promise<void> {
        const callbacks = this.listeners.get(event) || [];
        for (const callback of callbacks) {
            try {
                await callback(data);
            } catch (error) {
                console.error(`Error in state listener for ${event}:`, error);
            }
        }
    }
    
    // State persistence
    public getState(): ApplicationState {
        return { ...this.state };
    }
    
    public async restoreState(state: Partial<ApplicationState>): Promise<void> {
        this.state = { ...this.state, ...state };
        await this.notifyListeners('stateRestored', this.state);
    }
}
```

1. **Update extension.ts to use StateManager:**

```typescript
// Add to extension.ts activation function
export async function activate(context: vscode.ExtensionContext) {
    try {
        // Initialize state manager first
        const stateManager = new StateManager();
        
        // Initialize other components with state manager
        const agentManager = new AgentManager(stateManager);
        const conversationFlowHandler = new ConversationFlowHandler(agentManager, conversationManager, stateManager);
        const commandRouter = new CommandRouter(templateService, toolManager, agentManager, stateManager);
        
        // Set up state synchronization
        stateManager.addEventListener('agentChanged', async (agentId: string) => {
            // Notify all components about agent change
            await conversationManager.setCurrentAgent(agentId);
        });
        
        // ... rest of initialization
    } catch (error) {
        console.error('Extension activation failed:', error);
        throw error;
    }
}
```

**Testing Requirements:**

* Test state synchronization between components

* Test event listeners are properly notified

* Test state persistence and recovery

* Test command history tracking

***

### Task 4: Fix Extension Component Wiring

**Files to Modify:**

* `src/extension.ts`

**Current Problem:**
Components are initialized but dependency injection is incomplete and initialization order is wrong.

**Implementation Steps:**

1. **Fix component initialization order:**

```typescript
export async function activate(context: vscode.ExtensionContext) {
    try {
        console.log('🚀 Activating Docu extension...');
        
        // Phase 1: Initialize core services (no dependencies)
        const templateService = new TemplateService();
        const toolManager = new ToolManager();
        const configurationManager = new ConfigurationManager();
        const stateManager = new StateManager();
        
        // Phase 2: Initialize managers with basic dependencies
        const agentManager = new AgentManager(stateManager);
        const llmService = new LLMService(configurationManager);
        
        // Phase 3: Initialize conversation components
        const conversationManager = new ConversationManager(agentManager, llmService, stateManager);
        const conversationFlowHandler = new ConversationFlowHandler(agentManager, conversationManager, stateManager);
        const conversationSessionRouter = new ConversationSessionRouter(conversationManager, agentManager, stateManager);
        
        // Phase 4: Initialize command system
        const commandRouter = new CommandRouter(templateService, toolManager, agentManager, stateManager);
        
        // Phase 5: Wire components together
        await wireComponents({
            stateManager,
            agentManager,
            conversationManager,
            conversationFlowHandler,
            conversationSessionRouter,
            commandRouter,
            templateService,
            toolManager,
            configurationManager,
            llmService
        });
        
        // Phase 6: Register VS Code commands
        await registerVSCodeCommands(context, commandRouter, conversationSessionRouter);
        
        // Phase 7: Perform health checks
        await performHealthChecks({
            agentManager,
            conversationManager,
            commandRouter,
            llmService
        });
        
        console.log('✅ Docu extension activated successfully');
        
    } catch (error) {
        console.error('❌ Extension activation failed:', error);
        vscode.window.showErrorMessage(`Docu extension failed to activate: ${error.message}`);
        throw error;
    }
}

async function wireComponents(components: any): Promise<void> {
    // Set up cross-component communication
    components.stateManager.addEventListener('agentChanged', async (agentId: string) => {
        await components.conversationManager.setCurrentAgent(agentId);
    });
    
    components.stateManager.addEventListener('conversationStarted', async (context: any) => {
        await components.conversationSessionRouter.createSession(context);
    });
    
    // Initialize agents with required dependencies
    await components.agentManager.initializeAgents({
        llmService: components.llmService,
        conversationManager: components.conversationManager,
        stateManager: components.stateManager
    });
}

async function registerVSCodeCommands(context: vscode.ExtensionContext, commandRouter: CommandRouter, conversationSessionRouter: ConversationSessionRouter): Promise<void> {
    // Register chat request handler
    const chatRequestHandler = vscode.chat.createChatParticipant('docu', async (request, context, stream, token) => {
        try {
            await handleChatRequest(request, context, stream, token, commandRouter, conversationSessionRouter);
        } catch (error) {
            console.error('Chat request failed:', error);
            stream.markdown(`❌ Error: ${error.message}`);
        }
    });
    
    context.subscriptions.push(chatRequestHandler);
}

async function performHealthChecks(components: any): Promise<void> {
    const checks = [
        { name: 'AgentManager', check: () => components.agentManager.getAvailableAgents().length > 0 },
        { name: 'ConversationManager', check: () => components.conversationManager.isInitialized() },
        { name: 'CommandRouter', check: () => components.commandRouter.getRegisteredCommands().length > 0 },
        { name: 'LLMService', check: () => components.llmService.isConfigured() }
    ];
    
    for (const { name, check } of checks) {
        try {
            const result = await check();
            if (!result) {
                throw new Error(`${name} health check failed`);
            }
            console.log(`✅ ${name} health check passed`);
        } catch (error) {
            console.error(`❌ ${name} health check failed:`, error);
            throw new Error(`Component ${name} is not healthy: ${error.message}`);
        }
    }
}
```

**Testing Requirements:**

* Test all components initialize in correct order

* Test dependency injection works properly

* Test health checks pass for all components

* Test error handling during initialization

***

### Task 5: Implement Proper Error Handling

**Files to Modify:**

* `src/commands/CommandRouter.ts`

* `src/agents/AgentManager.ts`

* `src/conversation/ConversationFlowHandler.ts`

* `src/utils/ErrorHandler.ts` (new)

**Implementation Steps:**

1. **Create centralized error handler:**

```typescript
export enum ErrorType {
    COMMAND_ERROR = 'COMMAND_ERROR',
    AGENT_ERROR = 'AGENT_ERROR',
    CONVERSATION_ERROR = 'CONVERSATION_ERROR',
    SYSTEM_ERROR = 'SYSTEM_ERROR',
    USER_ERROR = 'USER_ERROR'
}

export interface DocuError {
    type: ErrorType;
    message: string;
    details?: any;
    recoverable: boolean;
    userMessage: string;
    suggestedActions?: string[];
}

export class ErrorHandler {
    public static createError(type: ErrorType, message: string, details?: any): DocuError {
        const error: DocuError = {
            type,
            message,
            details,
            recoverable: this.isRecoverable(type),
            userMessage: this.getUserMessage(type, message),
            suggestedActions: this.getSuggestedActions(type)
        };
        
        // Log error for debugging
        console.error(`[${type}] ${message}`, details);
        
        return error;
    }
    
    private static isRecoverable(type: ErrorType): boolean {
        switch (type) {
            case ErrorType.USER_ERROR:
            case ErrorType.COMMAND_ERROR:
                return true;
            case ErrorType.SYSTEM_ERROR:
                return false;
            default:
                return true;
        }
    }
    
    private static getUserMessage(type: ErrorType, message: string): string {
        switch (type) {
            case ErrorType.COMMAND_ERROR:
                return `❌ Command failed: ${message}`;
            case ErrorType.AGENT_ERROR:
                return `🤖 Agent error: ${message}`;
            case ErrorType.CONVERSATION_ERROR:
                return `💬 Conversation error: ${message}`;
            case ErrorType.USER_ERROR:
                return `⚠️ ${message}`;
            case ErrorType.SYSTEM_ERROR:
                return `🚨 System error: ${message}. Please restart the extension.`;
            default:
                return `❌ Error: ${message}`;
        }
    }
    
    private static getSuggestedActions(type: ErrorType): string[] {
        switch (type) {
            case ErrorType.COMMAND_ERROR:
                return [
                    'Check command syntax with /help',
                    'Verify required parameters are provided',
                    'Try the command again'
                ];
            case ErrorType.AGENT_ERROR:
                return [
                    'Check available agents with /agent list',
                    'Verify agent is properly configured',
                    'Try setting a different agent'
                ];
            case ErrorType.CONVERSATION_ERROR:
                return [
                    'Try rephrasing your request',
                    'Check if an agent is set with /agent current',
                    'Restart the conversation'
                ];
            case ErrorType.SYSTEM_ERROR:
                return [
                    'Restart VS Code',
                    'Check extension logs',
                    'Report the issue if it persists'
                ];
            default:
                return ['Try the operation again'];
        }
    }
    
    public static formatErrorForUser(error: DocuError): string {
        let message = error.userMessage;
        
        if (error.suggestedActions && error.suggestedActions.length > 0) {
            message += '\n\n💡 Suggested actions:\n';
            message += error.suggestedActions.map(action => `• ${action}`).join('\n');
        }
        
        return message;
    }
}
```

1. **Update CommandRouter with proper error handling:**

```typescript
public async routeCommand(prompt: string): Promise<CommandResult> {
    try {
        const parsed = this.parseCommand(prompt);
        if (!parsed) {
            const error = ErrorHandler.createError(
                ErrorType.COMMAND_ERROR,
                'Invalid command format',
                { prompt }
            );
            return {
                success: false,
                message: ErrorHandler.formatErrorForUser(error),
                data: { error }
            };
        }
        
        const handler = this.commandHandlers.get(parsed.command);
        if (!handler) {
            const error = ErrorHandler.createError(
                ErrorType.COMMAND_ERROR,
                `Unknown command: ${parsed.command}`,
                { command: parsed.command, availableCommands: Array.from(this.commandHandlers.keys()) }
            );
            return {
                success: false,
                message: ErrorHandler.formatErrorForUser(error),
                data: { error }
            };
        }
        
        return await handler.execute(parsed.args, parsed.flags);
        
    } catch (error) {
        const docuError = ErrorHandler.createError(
            ErrorType.SYSTEM_ERROR,
            'Command execution failed',
            { originalError: error.message, stack: error.stack }
        );
        
        return {
            success: false,
            message: ErrorHandler.formatErrorForUser(docuError),
            data: { error: docuError }
        };
    }
}
```

**Testing Requirements:**

* Test error handling for invalid commands

* Test error recovery mechanisms

* Test user-friendly error messages

* Test error logging and debugging support

***

## Phase 2: Conversation Flow Implementation

### Task 6: Fix Conversation Session Routing

**Files to Modify:**

* `src/conversation/ConversationSessionRouter.ts`

* `src/extension.ts`

**Implementation Steps:**

1. **Fix ConversationSessionRouter:**

```typescript
export class ConversationSessionRouter {
    private activeSessions: Map<string, ConversationSession> = new Map();
    
    constructor(
        private conversationManager: ConversationManager,
        private agentManager: AgentManager,
        private stateManager: StateManager
    ) {
        // Listen for conversation context changes
        this.stateManager.addEventListener('conversationStarted', (context) => {
            this.createSession(context);
        });
    }
    
    public async routeUserInput(input: string, context: any): Promise<string> {
        try {
            // Check if we have an active conversation
            const conversationContext = this.stateManager.getConversationContext();
            if (conversationContext && conversationContext.isActive) {
                return await this.handleConversationInput(input, conversationContext);
            }
            
            // Check if we have an active agent
            const currentAgent = this.agentManager.getCurrentAgent();
            if (currentAgent) {
                return await this.handleAgentInput(input, currentAgent);
            }
            
            // No active conversation or agent
            return this.getNoAgentMessage();
            
        } catch (error) {
            const docuError = ErrorHandler.createError(
                ErrorType.CONVERSATION_ERROR,
                'Failed to process user input',
                { input, error: error.message }
            );
            return ErrorHandler.formatErrorForUser(docuError);
        }
    }
    
    private async handleConversationInput(input: string, context: ConversationContext): Promise<string> {
        const session = this.activeSessions.get(context.sessionId || 'default');
        if (!session) {
            throw new Error('No active conversation session found');
        }
        
        return await session.processInput(input);
    }
    
    private async handleAgentInput(input: string, agent: BaseAgent): Promise<string> {
        return await agent.handleConversationalRequest(input, {
            mode: 'standalone',
            timestamp: new Date().toISOString()
        });
    }
    
    public async createSession(context: ConversationContext): Promise<string> {
        const sessionId = context.sessionId || `session-${Date.now()}`;
        
        const session = new ConversationSession({
            id: sessionId,
            agentId: context.agentId,
            documentPath: context.documentPath,
            template: context.template
        }, this.agentManager, this.conversationManager);
        
        this.activeSessions.set(sessionId, session);
        
        // Update context with session ID
        context.sessionId = sessionId;
        await this.stateManager.setConversationContext(context);
        
        return sessionId;
    }
    
    private getNoAgentMessage(): string {
        return `🤖 No agent is currently set. Use one of these commands to get started:\n\n• \`/agent list\` - See available agents\n• \`/agent set <agent-id>\` - Set an agent\n• \`/new <document-name>\` - Create a document with guided assistance\n\n💡 Try: \`/agent set prd-creator\` to start with the PRD Creator agent.`;
    }
}

class ConversationSession {
    constructor(
        private config: any,
        private agentManager: AgentManager,
        private conversationManager: ConversationManager
    ) {}
    
    public async processInput(input: string): Promise<string> {
        const agent = this.agentManager.getAgent(this.config.agentId);
        if (!agent) {
            throw new Error(`Agent ${this.config.agentId} not found`);
        }
        
        return await agent.handleConversationalRequest(input, {
            sessionId: this.config.id,
            documentPath: this.config.documentPath,
            template: this.config.template,
            timestamp: new Date().toISOString()
        });
    }
}
```

**Testing Requirements:**

* Test session creation after document creation

* Test input routing to correct session

* Test agent fallback when no session exists

* Test error handling for invalid sessions

***

### Task 7: Implement Auto-Chat Integration

**Files to Modify:**

* `src/conversation/AutoChatStateManager.ts`

* `src/commands/NewCommandHandler.ts`

**Implementation Steps:**

1. **Fix AutoChatStateManager:**

```typescript
export class AutoChatStateManager {
    private isAutoChatEnabled: boolean = false;
    private autoChatContext: any = null;
    
    constructor(private stateManager: StateManager) {
        // Listen for conversation events
        this.stateManager.addEventListener('conversationStarted', (context) => {
            this.enableAutoChat(context);
        });
        
        this.stateManager.addEventListener('conversationEnded', () => {
            this.disableAutoChat();
        });
    }
    
    public enableAutoChat(context: any): void {
        this.isAutoChatEnabled = true;
        this.autoChatContext = context;
        console.log('Auto-chat enabled for:', context.documentName);
    }
    
    public disableAutoChat(): void {
        this.isAutoChatEnabled = false;
        this.autoChatContext = null;
        console.log('Auto-chat disabled');
    }
    
    public isEnabled(): boolean {
        return this.isAutoChatEnabled;
    }
    
    public getContext(): any {
        return this.autoChatContext;
    }
    
    public async handleAutoChat(input: string): Promise<string> {
        if (!this.isAutoChatEnabled || !this.autoChatContext) {
            throw new Error('Auto-chat is not enabled');
        }
        
        // Process input in auto-chat context
        return `Auto-chat response for: ${input}`;
    }
}
```

1. **Update NewCommandHandler to enable auto-chat:**

```typescript
private async initializeConversationFlow(context: any): Promise<void> {
    // Set the appropriate agent
    await this.agentManager.setCurrentAgent(context.agentId);
    
    // Initialize conversation flow
    await this.conversationFlowHandler.initializeFlow(context);
    
    // Update state manager
    await this.stateManager.setConversationContext(context);
    
    // Enable auto-chat
    this.autoChatStateManager.enableAutoChat(context);
}
```

**Testing Requirements:**

* Test auto-chat enablement after document creation

* Test auto-chat context preservation

* Test auto-chat disabling when conversation ends

***

### Task 8: Create Conversation Context Management

**Files to Create:**

* `src/conversation/ConversationContext.ts`

**Files to Modify:**

* `src/conversation/ConversationManager.ts`

**Implementation Steps:**

1. **Create ConversationContext class:**

```typescript
export interface DocumentContext {
    path: string;
    name: string;
    template: string;
    content?: string;
    lastModified?: Date;
}

export interface AgentContext {
    id: string;
    name: string;
    capabilities: string[];
    currentTask?: string;
}

export interface SessionContext {
    id: string;
    startTime: Date;
    lastActivity: Date;
    messageCount: number;
    phase: string;
}

export class ConversationContext {
    public readonly id: string;
    public document: DocumentContext;
    public agent: AgentContext;
    public session: SessionContext;
    public metadata: Record<string, any> = {};
    
    constructor(
        document: DocumentContext,
        agent: AgentContext,
        sessionId?: string
    ) {
        this.id = `ctx-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        this.document = document;
        this.agent = agent;
        this.session = {
            id: sessionId || `session-${Date.now()}`,
            startTime: new Date(),
            lastActivity: new Date(),
            messageCount: 0,
            phase: 'initialization'
        };
    }
    
    public updateActivity(): void {
        this.session.lastActivity = new Date();
        this.session.messageCount++;
    }
    
    public setPhase(phase: string): void {
        this.session.phase = phase;
        this.updateActivity();
    }
    
    public addMetadata(key: string, value: any): void {
        this.metadata[key] = value;
    }
    
    public getMetadata(key: string): any {
        return this.metadata[key];
    }
    
    public serialize(): any {
        return {
            id: this.id,
            document: this.document,
            agent: this.agent,
            session: this.session,
            metadata: this.metadata
        };
    }
    
    public static deserialize(data: any): ConversationContext {
        const context = new ConversationContext(data.document, data.agent, data.session.id);
        context.session = data.session;
        context.metadata = data.metadata || {};
        return context;
    }
}
```

1. **Update ConversationManager to use ConversationContext:**

```typescript
export class ConversationManager {
    private activeContexts: Map<string, ConversationContext> = new Map();
    
    public async createContext(
        documentPath: string,
        agentId: string,
        template: string
    ): Promise<ConversationContext> {
        const documentContext: DocumentContext = {
            path: documentPath,
            name: path.basename(documentPath),
            template: template
        };
        
        const agent = this.agentManager.getAgent(agentId);
        if (!agent) {
            throw new Error(`Agent ${agentId} not found`);
        }
        
        const agentContext: AgentContext = {
            id: agentId,
            name: agent.name,
            capabilities: agent.capabilities || [],
            currentTask: 'document_development'
        };
        
        const context = new ConversationContext(documentContext, agentContext);
        this.activeContexts.set(context.id, context);
        
        return context;
    }
    
    public getContext(contextId: string): ConversationContext | undefined {
        return this.activeContexts.get(contextId);
    }
    
    public async persistContext(context: ConversationContext): Promise<void> {
        // Save context to workspace state or file
        const serialized = context.serialize();
        // Implementation depends on persistence strategy
    }
    
    public async restoreContext(contextId: string): Promise<ConversationContext | null> {
        // Load context from workspace state or file
        // Implementation depends on persistence strategy
        return null;
    }
}
```

**Testing Requirements:**

* Test context creation with document and agent info

* Test context persistence and restoration

* Test metadata management

* Test session tracking

***

### Task 9: Fix Agent Conversation Integration

**Files to Modify:**

* `src/agents/BaseAgent.ts`

* `src/agents/PRDCreatorAgent.ts`

* `src/agents/AgentManager.ts`

**Implementation Steps:**

1. **Fix BaseAgent conversation handling:**

```typescript
export abstract class BaseAgent {
    public abstract id: string;
    public abstract name: string;
    public abstract description: string;
    public capabilities: string[] = [];
    
    constructor(
        protected llmService: LLMService,
        protected conversationManager?: ConversationManager
    ) {}
    
    public async handleConversationalRequest(
        input: string,
        context: any
    ): Promise<string> {
        try {
            // Update context activity
            if (context.sessionId) {
                const conversationContext = this.conversationManager?.getContext(context.sessionId);
                if (conversationContext) {
                    conversationContext.updateActivity();
                }
            }
            
            // Process the request
            const response = await this.processConversationalRequest(input, context);
            
            // Handle document updates if needed
            if (context.documentPath && this.shouldUpdateDocument(input, response)) {
                await this.updateDocument(context.documentPath, response, context);
            }
            
            return response;
            
        } catch (error) {
            const docuError = ErrorHandler.createError(
                ErrorType.AGENT_ERROR,
                `${this.name} failed to process request`,
                { input, context, error: error.message }
            );
            return ErrorHandler.formatErrorForUser(docuError);
        }
    }
    
    protected abstract processConversationalRequest(
        input: string,
        context: any
    ): Promise<string>;
    
    protected shouldUpdateDocument(input: string, response: string): boolean {
        // Override in subclasses to determine when to update documents
        return false;
    }
    
    protected async updateDocument(
        documentPath: string,
        content: string,
        context: any
    ): Promise<void> {
        // Override in subclasses to handle document updates
    }
    
    public getCapabilities(): string[] {
        return this.capabilities;
    }
    
    public async initialize(dependencies: any): Promise<void> {
        // Override in subclasses for initialization
    }
}
```

1. **Update PRDCreatorAgent:**

```typescript
export class PRDCreatorAgent extends BaseAgent {
    public id = 'prd-creator';
    public name = 'PRD Creator';
    public description = 'Helps create and develop Product Requirements Documents';
    public capabilities = ['prd_creation', 'requirements_analysis', 'feature_specification'];
    
    protected async processConversationalRequest(
        input: string,
        context: any
    ): Promise<string> {
        // Determine the type of request
        const requestType = this.analyzeRequest(input);
        
        switch (requestType) {
            case 'feature_request':
                return await this.handleFeatureRequest(input, context);
            case 'requirements_clarification':
                return await this.handleRequirementsClarification(input, context);
            case 'document_review':
                return await this.handleDocumentReview(input, context);
            default:
                return await this.handleGeneralRequest(input, context);
        }
    }
    
    private analyzeRequest(input: string): string {
        const lowerInput = input.toLowerCase();
        
        if (lowerInput.includes('feature') || lowerInput.includes('functionality')) {
            return 'feature_request';
        }
        if (lowerInput.includes('requirement') || lowerInput.includes('spec')) {
            return 'requirements_clarification';
        }
        if (lowerInput.includes('review') || lowerInput.includes('check')) {
            return 'document_review';
        }
        
        return 'general';
    }
    
    private async handleFeatureRequest(input: string, context: any): Promise<string> {
        const prompt = `As a PRD Creator agent, help the user with their feature request: "${input}"
        
Context:
        - Document: ${context.documentPath || 'New PRD'}
        - Template: ${context.template || 'basic'}
        
Provide specific guidance on:
        1. Feature specification
        2. Requirements definition
        3. Acceptance criteria
        
Keep the response conversational and actionable.`;
        
        return await this.llmService.generateResponse(prompt);
    }
    
    private async handleRequirementsClarification(input: string, context: any): Promise<string> {
        const prompt = `As a PRD Creator agent, help clarify requirements: "${input}"
        
Context:
        - Document: ${context.documentPath || 'New PRD'}
        - Current phase: ${context.phase || 'requirements_gathering'}
        
Provide:
        1. Clarifying questions if needed
        2. Structured requirements format
        3. Next steps
        
Be specific and helpful.`;
        
        return await this.llmService.generateResponse(prompt);
    }
    
    private async handleDocumentReview(input: string, context: any): Promise<string> {
        // Read current document content if available
        let documentContent = '';
        if (context.documentPath) {
            try {
                documentContent = await this.readDocumentContent(context.documentPath);
            } catch (error) {
                console.warn('Could not read document content:', error);
            }
        }
        
        const prompt = `As a PRD Creator agent, review the document based on: "${input}"
        
Current document content:
        ${documentContent || 'No content available'}
        
Provide:
        1. Review feedback
        2. Improvement suggestions
        3. Missing elements
        
Be constructive and specific.`;
        
        return await this.llmService.generateResponse(prompt);
    }
    
    private async handleGeneralRequest(input: string, context: any): Promise<string> {
        const prompt = `As a PRD Creator agent, respond to: "${input}"
        
I specialize in:
        - Product Requirements Documents
        - Feature specifications
        - Requirements analysis
        - User story creation
        
How can I help you with your PRD development?`;
        
        return await this.llmService.generateResponse(prompt);
    }
    
    protected shouldUpdateDocument(input: string, response: string): boolean {
        // Update document if response contains structured content
        return response.includes('##') || response.includes('###') || response.includes('| ');
    }
    
    protected async updateDocument(
        documentPath: string,
        content: string,
        context: any
    ): Promise<void> {
        // Extract structured content and update document
        // This would integrate with DocumentUpdateEngine
        console.log('Would update document:', documentPath, 'with content from response');
    }
    
    private async readDocumentContent(documentPath: string): Promise<string> {
        // Read document content from file system
        // Implementation depends on file system access
        return '';
    }
}
```

**Testing Requirements:**

* Test agent conversation handling with different request types

* Test context passing to agents

* Test document update integration

* Test error handling in agent conversations

***

### Task 10: Implement Document Update Integration

**Files to Modify:**

* `src/conversation/DocumentUpdateEngine.ts`

* `src/conversation/ConversationManager.ts`

**Implementation Steps:**

1. **Fix DocumentUpdateEngine:**

```typescript
export interface DocumentUpdate {
    type: 'insert' | 'replace' | 'append' | 'prepend';
    content: string;
    position?: number;
    section?: string;
    metadata?: any;
}

export class DocumentUpdateEngine {
    constructor(
        private fileSystemService: any // Would need to be implemented
    ) {}
    
    public async updateDocument(
        documentPath: string,
        updates: DocumentUpdate[],
        context: ConversationContext
    ): Promise<boolean> {
        try {
            // Read current document
            const currentContent = await this.readDocument(documentPath);
            
            // Apply updates
            let updatedContent = currentContent;
            for (const update of updates) {
                updatedContent = await this.applyUpdate(updatedContent, update);
            }
            
            // Write updated document
            await this.writeDocument(documentPath, updatedContent);
            
            // Update context
            context.document.lastModified = new Date();
            context.addMetadata('lastUpdate', {
                timestamp: new Date(),
                updatesCount: updates.length
            });
            
            return true;
            
        } catch (error) {
            console.error('Document update failed:', error);
            return false;
        }
    }
    
    private async applyUpdate(content: string, update: DocumentUpdate): Promise<string> {
        switch (update.type) {
            case 'append':
                return content + '\n\n' + update.content;
                
            case 'prepend':
                return update.content + '\n\n' + content;
                
            case 'insert':
                if (update.position !== undefined) {
                    const lines = content.split('\n');
                    lines.splice(update.position, 0, update.content);
                    return lines.join('\n');
                }
                return content + '\n' + update.content;
                
            case 'replace':
                if (update.section) {
                    return this.replaceSection(content, update.section, update.content);
                }
                return update.content;
                
            default:
                return content;
        }
    }
    
    private replaceSection(content: string, sectionName: string, newContent: string): string {
        // Find and replace specific sections (e.g., ## Section Name)
        const sectionRegex = new RegExp(`(## ${sectionName}[\s\S]*?)(?=## |$)`, 'i');
        const match = content.match(sectionRegex);
        
        if (match) {
            return content.replace(match[0], `## ${sectionName}\n\n${newContent}\n`);
        }
        
        // If section not found, append it
        return content + `\n\n## ${sectionName}\n\n${newContent}\n`;
    }
    
    private async readDocument(path: string): Promise<string> {
        // Implementation would depend on VS Code API or file system access
        return '';
    }
    
    private async writeDocument(path: string, content: string): Promise<void> {
        // Implementation would depend on VS Code API or file system access
    }
    
    public extractUpdatesFromResponse(response: string): DocumentUpdate[] {
        const updates: DocumentUpdate[] = [];
        
        // Extract markdown sections
        const sectionRegex = /## ([^\n]+)\n([\s\S]*?)(?=## |$)/g;
        let match;
        
        while ((match = sectionRegex.exec(response)) !== null) {
            updates.push({
                type: 'replace',
                section: match[1].trim(),
                content: match[2].trim()
            });
        }
        
        // If no sections found, treat as append
        if (updates.length === 0 && response.trim()) {
            updates.push({
                type: 'append',
                content: response.trim()
            });
        }
        
        return updates;
    }
}
```

**Testing Requirements:**

* Test document reading and writing

* Test different update types (insert, replace, append)

* Test section replacement

* Test update extraction from responses

***

## Phase 3: User Experience and Testing

### Task 11: Implement Proper User Feedback

**Files to Modify:**

* `src/commands/OutputCoordinator.ts`

* `src/conversation/ConversationFeedbackManager.ts` (new)

**Implementation Steps:**

1. **Create ConversationFeedbackManager:**

```typescript
export interface FeedbackMessage {
    type: 'info' | 'success' | 'warning' | 'error' | 'progress';
    message: string;
    details?: string;
    actions?: Array<{ label: string; action: string }>;
    timestamp: Date;
}

export class ConversationFeedbackManager {
    private feedbackHistory: FeedbackMessage[] = [];
    
    public showProgress(message: string, details?: string): void {
        const feedback: FeedbackMessage = {
            type: 'progress',
            message: `⏳ ${message}`,
            details,
            timestamp: new Date()
        };
        
        this.addToHistory(feedback);
        this.displayFeedback(feedback);
    }
    
    public showSuccess(message: string, actions?: Array<{ label: string; action: string }>): void {
        const feedback: FeedbackMessage = {
            type: 'success',
            message: `✅ ${message}`,
            actions,
            timestamp: new Date()
        };
        
        this.addToHistory(feedback);
        this.displayFeedback(feedback);
    }
    
    public showError(message: string, details?: string, actions?: Array<{ label: string; action: string }>): void {
        const feedback: FeedbackMessage = {
            type: 'error',
            message: `❌ ${message}`,
            details,
            actions,
            timestamp: new Date()
        };
        
        this.addToHistory(feedback);
        this.displayFeedback(feedback);
    }
    
    public showInfo(message: string, details?: string): void {
        const feedback: FeedbackMessage = {
            type: 'info',
            message: `ℹ️ ${message}`,
            details,
            timestamp: new Date()
        };
        
        this.addToHistory(feedback);
        this.displayFeedback(feedback);
    }
    
    private addToHistory(feedback: FeedbackMessage): void {
        this.feedbackHistory.push(feedback);
        
        // Keep only last 100 messages
        if (this.feedbackHistory.length > 100) {
            this.feedbackHistory = this.feedbackHistory.slice(-100);
        }
    }
    
    private displayFeedback(feedback: FeedbackMessage): void {
        let output = feedback.message;
        
        if (feedback.details) {
            output += `\n\n${feedback.details}`;
        }
        
        if (feedback.actions && feedback.actions.length > 0) {
            output += '\n\n💡 Available actions:\n';
            output += feedback.actions.map(action => `• ${action.label}`).join('\n');
        }
        
        console.log(`[${feedback.type.toUpperCase()}] ${output}`);
        
        // In a real implementation, this would send to VS Code chat interface
    }
    
    public getFeedbackHistory(): FeedbackMessage[] {
        return [...this.feedbackHistory];
    }
}
```

1. **Update OutputCoordinator:**

```typescript
export class OutputCoordinator {
    constructor(
        private feedbackManager: ConversationFeedbackManager
    ) {}
    
    public async handleCommandResult(result: CommandResult): Promise<void> {
        if (result.success) {
            this.feedbackManager.showSuccess(result.message, this.getActionsForResult(result));
        } else {
            this.feedbackManager.showError(
                result.message,
                result.data?.error?.details,
                this.getRecoveryActions(result)
            );
        }
    }
    
    public showCommandProgress(command: string, step: string): void {
        this.feedbackManager.showProgress(`Executing ${command}`, step);
    }
    
    private getActionsForResult(result: CommandResult): Array<{ label: string; action: string }> {
        const actions = [];
        
        if (result.data?.conversationStarted) {
            actions.push({ label: 'Continue conversation', action: 'continue_chat' });
        }
        
        if (result.data?.filePath) {
            actions.push({ label: 'Open document', action: `open:${result.data.filePath}` });
        }
        
        return actions;
    }
    
    private getRecoveryActions(result: CommandResult): Array<{ label: string; action: string }> {
        const actions = [];
        
        if (result.data?.error?.type === 'COMMAND_ERROR') {
            actions.push({ label: 'Show help', action: 'help' });
        }
        
        if (result.data?.error?.type === 'AGENT_ERROR') {
            actions.push({ label: 'List agents', action: 'agent_list' });
        }
        
        actions.push({ label: 'Try again', action: 'retry' });
        
        return actions;
    }
}
```

**Testing Requirements:**

* Test progress indicators during command execution

* Test success feedback with appropriate actions

* Test error feedback with recovery options

* Test feedback history management

***

### Task 12: Fix Template Integration

**Files to Modify:**

* `src/templates/TemplateService.ts`

* `src/commands/NewCommandHandler.ts`

**Implementation Steps:**

1. **Update TemplateService with agent mapping:**

```typescript
export interface TemplateConfig {
    id: string;
    name: string;
    description: string;
    defaultAgent: string;
    conversationStarters: string[];
    requiredSections: string[];
    metadata: Record<string, any>;
}

export class TemplateService {
    private templates: Map<string, TemplateConfig> = new Map();
    
    constructor() {
        this.initializeTemplates();
    }
    
    private initializeTemplates(): void {
        // PRD Templates
        this.templates.set('basic', {
            id: 'basic',
            name: 'Basic PRD',
            description: 'A simple Product Requirements Document template',
            defaultAgent: 'prd-creator',
            conversationStarters: [
                'Tell me about your product idea',
                'What problem does your product solve?',
                'Who is your target audience?',
                'What are the key features you want to include?'
            ],
            requiredSections: [
                'Product Overview',
                'Core Features',
                'User Stories',
                'Technical Requirements'
            ],
            metadata: {
                category: 'prd',
                difficulty: 'beginner',
                estimatedTime: '30-60 minutes'
            }
        });
        
        this.templates.set('prd', {
            id: 'prd',
            name: 'Comprehensive PRD',
            description: 'A detailed Product Requirements Document with all sections',
            defaultAgent: 'prd-creator',
            conversationStarters: [
                'Let\'s start with your product vision',
                'What market research have you done?',
                'What are your success metrics?',
                'Tell me about your competitive landscape'
            ],
            requiredSections: [
                'Executive Summary',
                'Product Overview',
                'Market Analysis',
                'Core Features',
                'User Stories',
                'Technical Requirements',
                'Success Metrics',
                'Timeline'
            ],
            metadata: {
                category: 'prd',
                difficulty: 'advanced',
                estimatedTime: '2-4 hours'
            }
        });
        
        // Architecture Templates
        this.templates.set('architecture', {
            id: 'architecture',
            name: 'Solution Architecture',
            description: 'Technical architecture and system design document',
            defaultAgent: 'solution-architect',
            conversationStarters: [
                'What type of system are you building?',
                'What are your scalability requirements?',
                'What technologies are you considering?',
                'What are your performance requirements?'
            ],
            requiredSections: [
                'Architecture Overview',
                'System Components',
                'Data Flow',
                'Technology Stack',
                'Deployment Strategy'
            ],
            metadata: {
                category: 'architecture',
                difficulty: 'advanced',
                estimatedTime: '1-3 hours'
            }
        });
        
        // Requirements Templates
        this.templates.set('requirements', {
            id: 'requirements',
            name: 'Requirements Document',
            description: 'Detailed requirements gathering and specification',
            defaultAgent: 'requirements-gatherer',
            conversationStarters: [
                'What are your functional requirements?',
                'What are your non-functional requirements?',
                'Who are your stakeholders?',
                'What constraints do you have?'
            ],
            requiredSections: [
                'Functional Requirements',
                'Non-Functional Requirements',
                'User Stories',
                'Acceptance Criteria',
                'Constraints'
            ],
            metadata: {
                category: 'requirements',
                difficulty: 'intermediate',
                estimatedTime: '1-2 hours'
            }
        });
    }
    
    public getTemplate(templateId: string): TemplateConfig | undefined {
        return this.templates.get(templateId);
    }
    
    public getAllTemplates(): TemplateConfig[] {
        return Array.from(this.templates.values());
    }
    
    public getTemplatesByCategory(category: string): TemplateConfig[] {
        return Array.from(this.templates.values())
            .filter(template => template.metadata.category === category);
    }
    
    public getDefaultAgentForTemplate(templateId: string): string | undefined {
        const template = this.templates.get(templateId);
        return template?.defaultAgent;
    }
    
    public getConversationStarters(templateId: string): string[] {
        const template = this.templates.get(templateId);
        return template?.conversationStarters || [];
    }
}
```

**Testing Requirements:**

* Test template retrieval and filtering
* Test agent mapping for templates
* Test conversation starter generation
* Test template metadata handling

***

### Task 13: Implement Conversation Recovery

**Files to Create:**

* `src/conversation/ConversationRecoveryManager.ts`

**Implementation Steps:**

1. **Create ConversationRecoveryManager:**

```typescript
export interface ConversationState {
    sessionId: string;
    agentId: string;
    documentPath?: string;
    template?: string;
    phase: string;
    context: Record<string, any>;
    lastActivity: Date;
    messageHistory: Array<{
        role: 'user' | 'assistant';
        content: string;
        timestamp: Date;
    }>;
}

export class ConversationRecoveryManager {
    private conversationStates: Map<string, ConversationState> = new Map();
    private readonly MAX_RECOVERY_TIME = 24 * 60 * 60 * 1000; // 24 hours
    
    constructor(
        private agentManager: AgentManager,
        private conversationManager: ConversationManager
    ) {}
    
    public saveConversationState(state: ConversationState): void {
        this.conversationStates.set(state.sessionId, {
            ...state,
            lastActivity: new Date()
        });
        
        // Persist to storage (would use VS Code workspace state)
        this.persistState(state);
    }
    
    public async recoverConversation(sessionId: string): Promise<boolean> {
        const state = this.conversationStates.get(sessionId);
        
        if (!state) {
            return false;
        }
        
        // Check if recovery is still valid
        const timeSinceLastActivity = Date.now() - state.lastActivity.getTime();
        if (timeSinceLastActivity > this.MAX_RECOVERY_TIME) {
            this.conversationStates.delete(sessionId);
            return false;
        }
        
        try {
            // Restore agent
            await this.agentManager.setCurrentAgent(state.agentId);
            
            // Restore conversation context
            const context = new ConversationContext(
                state.sessionId,
                state.agentId,
                state.documentPath,
                state.template
            );
            
            // Restore context data
            Object.entries(state.context).forEach(([key, value]) => {
                context.addMetadata(key, value);
            });
            
            // Restore conversation manager state
            this.conversationManager.restoreContext(context);
            
            return true;
            
        } catch (error) {
            console.error('Conversation recovery failed:', error);
            return false;
        }
    }
    
    public getRecoverableConversations(): ConversationState[] {
        const now = Date.now();
        return Array.from(this.conversationStates.values())
            .filter(state => {
                const timeSinceLastActivity = now - state.lastActivity.getTime();
                return timeSinceLastActivity <= this.MAX_RECOVERY_TIME;
            })
            .sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    }
    
    public async suggestRecovery(): Promise<string | null> {
        const recoverable = this.getRecoverableConversations();
        
        if (recoverable.length === 0) {
            return null;
        }
        
        const latest = recoverable[0];
        const agent = this.agentManager.getAgent(latest.agentId);
        
        return `💡 I found a recent conversation with ${agent?.name || latest.agentId} ` +
               `${latest.documentPath ? `working on "${latest.documentPath}"` : ''} ` +
               `from ${this.formatTimeAgo(latest.lastActivity)}. ` +
               `Would you like to continue where we left off?`;
    }
    
    private formatTimeAgo(date: Date): string {
        const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
        
        if (minutes < 60) {
            return `${minutes} minutes ago`;
        }
        
        const hours = Math.floor(minutes / 60);
        if (hours < 24) {
            return `${hours} hours ago`;
        }
        
        const days = Math.floor(hours / 24);
        return `${days} days ago`;
    }
    
    private persistState(state: ConversationState): void {
        // In a real implementation, this would save to VS Code workspace state
        // or a persistent storage mechanism
        console.log('Persisting conversation state:', state.sessionId);
    }
    
    public cleanupExpiredStates(): void {
        const now = Date.now();
        const expired = [];
        
        for (const [sessionId, state] of this.conversationStates.entries()) {
            const timeSinceLastActivity = now - state.lastActivity.getTime();
            if (timeSinceLastActivity > this.MAX_RECOVERY_TIME) {
                expired.push(sessionId);
            }
        }
        
        expired.forEach(sessionId => {
            this.conversationStates.delete(sessionId);
        });
    }
}
```

**Testing Requirements:**

* Test conversation state saving and recovery
* Test expiration handling
* Test recovery suggestions
* Test cleanup of expired states

***

### Task 14: Comprehensive Testing

**Files to Create:**

* `src/test/ConversationFlow.test.ts`
* `src/test/CommandIntegration.test.ts`

**Implementation Steps:**

1. **Create ConversationFlow.test.ts:**

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { ConversationManager } from '../conversation/ConversationManager';
import { AgentManager } from '../agents/AgentManager';
import { CommandRouter } from '../commands/CommandRouter';
import { ConversationContext } from '../conversation/ConversationContext';

describe('Conversation Flow Integration', () => {
    let conversationManager: ConversationManager;
    let agentManager: AgentManager;
    let commandRouter: CommandRouter;
    
    beforeEach(() => {
        // Setup test dependencies
        agentManager = new AgentManager();
        conversationManager = new ConversationManager(agentManager);
        commandRouter = new CommandRouter(agentManager, conversationManager);
    });
    
    describe('Agent Set Command Flow', () => {
        it('should set agent and start conversation', async () => {
            // Test the full flow: /agent set prd-creator
            const result = await commandRouter.routeCommand('/agent set prd-creator');
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('Agent Set: prd-creator');
            expect(agentManager.getCurrentAgent()?.id).toBe('prd-creator');
            expect(conversationManager.hasActiveSession()).toBe(true);
        });
        
        it('should provide conversation guidance after agent set', async () => {
            await commandRouter.routeCommand('/agent set prd-creator');
            
            const guidance = conversationManager.getConversationGuidance();
            expect(guidance).toContain('Ready for conversation!');
            expect(guidance).toContain('What would you like to work on?');
        });
        
        it('should handle invalid agent gracefully', async () => {
            const result = await commandRouter.routeCommand('/agent set invalid-agent');
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('Agent not found');
            expect(agentManager.getCurrentAgent()).toBeNull();
        });
    });
    
    describe('New Command Flow', () => {
        it('should create document and maintain conversation', async () => {
            // Setup: Set agent first
            await commandRouter.routeCommand('/agent set prd-creator');
            
            // Test: Create new document
            const result = await commandRouter.routeCommand(
                '/new "Test PRD" --template basic --path docs/test-prd/'
            );
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('Document created');
            expect(conversationManager.hasActiveSession()).toBe(true);
            
            const context = conversationManager.getCurrentContext();
            expect(context?.document.path).toBe('docs/test-prd/');
            expect(context?.document.template).toBe('basic');
        });
        
        it('should suggest agent if none set', async () => {
            const result = await commandRouter.routeCommand(
                '/new "Test PRD" --template basic --path docs/test-prd/'
            );
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('Suggested agent: prd-creator');
        });
        
        it('should handle template-agent mismatch', async () => {
            await commandRouter.routeCommand('/agent set solution-architect');
            
            const result = await commandRouter.routeCommand(
                '/new "Test PRD" --template basic --path docs/test-prd/'
            );
            
            expect(result.success).toBe(true);
            expect(result.message).toContain('template suggests prd-creator');
        });
    });
    
    describe('Conversation Continuity', () => {
        it('should maintain context across interactions', async () => {
            // Setup conversation
            await commandRouter.routeCommand('/agent set prd-creator');
            await commandRouter.routeCommand('/new "Test PRD" --template basic --path docs/test/');
            
            // Test conversation input
            const response1 = await conversationManager.handleUserInput(
                'I want to build a mobile app for task management'
            );
            
            expect(response1).toContain('task management');
            
            // Test context preservation
            const response2 = await conversationManager.handleUserInput(
                'What features should I include?'
            );
            
            expect(response2).toContain('feature');
            
            const context = conversationManager.getCurrentContext();
            expect(context?.getMessageHistory().length).toBeGreaterThan(0);
        });
        
        it('should handle conversation recovery', async () => {
            // Setup and save state
            await commandRouter.routeCommand('/agent set prd-creator');
            const sessionId = conversationManager.getCurrentSessionId();
            
            // Simulate session loss and recovery
            conversationManager.clearSession();
            expect(conversationManager.hasActiveSession()).toBe(false);
            
            // Recover
            const recovered = await conversationManager.recoverSession(sessionId);
            expect(recovered).toBe(true);
            expect(conversationManager.hasActiveSession()).toBe(true);
        });
    });
});
```

2. **Create CommandIntegration.test.ts:**

```typescript
import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CommandRouter } from '../commands/CommandRouter';
import { AgentCommandHandler } from '../commands/AgentCommandHandler';
import { NewCommandHandler } from '../commands/NewCommandHandler';

describe('Command Integration Tests', () => {
    let commandRouter: CommandRouter;
    
    beforeEach(() => {
        commandRouter = new CommandRouter();
    });
    
    describe('Command Recognition', () => {
        it('should recognize agent commands', () => {
            expect(commandRouter.isCommand('/agent list')).toBe(true);
            expect(commandRouter.isCommand('/agent set prd-creator')).toBe(true);
            expect(commandRouter.isCommand('/agent current')).toBe(true);
        });
        
        it('should recognize new commands', () => {
            expect(commandRouter.isCommand('/new "Test Doc"')).toBe(true);
            expect(commandRouter.isCommand('/new "Test" --template basic')).toBe(true);
        });
        
        it('should reject non-commands', () => {
            expect(commandRouter.isCommand('Hello world')).toBe(false);
            expect(commandRouter.isCommand('What is a PRD?')).toBe(false);
        });
    });
    
    describe('Command Parsing', () => {
        it('should parse agent set command correctly', () => {
            const parsed = commandRouter.parseCommand('/agent set prd-creator');
            
            expect(parsed.command).toBe('agent');
            expect(parsed.subcommand).toBe('set');
            expect(parsed.args).toContain('prd-creator');
        });
        
        it('should parse new command with flags', () => {
            const parsed = commandRouter.parseCommand(
                '/new "My Document" --template basic --path docs/'
            );
            
            expect(parsed.command).toBe('new');
            expect(parsed.args[0]).toBe('My Document');
            expect(parsed.flags.template).toBe('basic');
            expect(parsed.flags.path).toBe('docs/');
        });
    });
    
    describe('Error Handling', () => {
        it('should handle malformed commands', async () => {
            const result = await commandRouter.routeCommand('/agent');
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('Missing subcommand');
        });
        
        it('should handle missing required arguments', async () => {
            const result = await commandRouter.routeCommand('/agent set');
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('Agent ID required');
        });
        
        it('should provide helpful error messages', async () => {
            const result = await commandRouter.routeCommand('/unknown-command');
            
            expect(result.success).toBe(false);
            expect(result.message).toContain('Unknown command');
            expect(result.message).toContain('Available commands');
        });
    });
});
```

**Testing Requirements:**

* Test complete command flows end-to-end
* Test error scenarios and recovery
* Test conversation state management
* Test integration between components

***

### Task 15: Documentation and User Guide Updates

**Files to Update:**

* `TUTORIAL_EXAMPLE.md`
* `docs/troubleshooting.md`
* `README.md`

**Implementation Steps:**

1. **Update TUTORIAL_EXAMPLE.md:**

```markdown
# Docu Extension Tutorial: Complete Workflow

This tutorial demonstrates the complete workflow for using the Docu extension to create and manage product documents through conversational AI.

## Prerequisites

- VS Code with Docu extension installed
- Basic understanding of product documentation

## Step 1: Set Your Agent

Start by setting the appropriate agent for your document type:

```
@docu /agent set prd-creator
```

**Expected Response:**
```
✅ Agent Set: prd-creator

🤖 Ready for conversation! You can now chat directly without using /chat.

💡 What would you like to work on?
• Tell me about your project requirements
• Help me develop the document content  
• Review and improve existing content

💬 Just type your message below to get started!
```

## Step 2: Create a New Document

Create a new document with the appropriate template:

```
@docu /new "CardCraft Online Store PRD" --template basic --path docs/01-prd/
```

**Expected Response:**
```
✅ Document Created: CardCraft Online Store PRD

📄 Document Details:
• Path: docs/01-prd/CardCraft-Online-Store-PRD.md
• Template: Basic PRD
• Agent: prd-creator (active)

🚀 Ready to start! Here are some conversation starters:
• "Tell me about your product idea"
• "What problem does your product solve?"
• "Who is your target audience?"

💬 What would you like to discuss about your CardCraft Online Store?
```

## Step 3: Start the Conversation

Begin describing your product requirements:

```
I want to build an online store for trading card games. The main focus is on CardCraft, a new TCG we're launching.
```

**Expected Response:**
```
🎯 Great! A trading card game online store is an exciting project. Let me help you develop the PRD for CardCraft.

Based on what you've shared, I have some questions to help structure your requirements:

1. **Target Audience**: Who are your primary users? (collectors, competitive players, casual gamers?)
2. **Core Features**: What key features do you envision? (card browsing, deck building, trading, tournaments?)
3. **Business Model**: How will you monetize? (direct sales, marketplace fees, subscriptions?)
4. **Platform**: Web-only or mobile app as well?

Let's start with your target audience - who do you see as your main users?

📝 *I'm updating your PRD with the initial product concept as we discuss.*
```

## Step 4: Continue the Conversation

Provide more details about your requirements:

```
Our target audience includes competitive players aged 16-35 and collectors. We want features like card marketplace, deck builder, tournament registration, and user profiles.
```

**Expected Response:**
```
✅ Perfect! I'm building out your PRD with these details.

**Updated Sections:**
• Product Overview ✓
• Target Audience ✓  
• Core Features (in progress)

**Next Steps:**
Let's dive deeper into the core features:

1. **Card Marketplace**: 
   - Will users be able to buy/sell individual cards?
   - Do you need auction functionality?
   - How will you handle card authentication/grading?

2. **Deck Builder**:
   - Should it validate deck legality for different formats?
   - Do you want deck sharing/importing features?

3. **Tournament System**:
   - Online tournaments or just registration for physical events?
   - What tournament formats will you support?

Which area would you like to explore first?

📄 *Your PRD is being updated in real-time at: docs/01-prd/CardCraft-Online-Store-PRD.md*
```

## Step 5: Review and Refine

Ask for document review:

```
Can you show me what we have so far and suggest any missing sections?
```

**Expected Response:**
```
📋 **Current PRD Status:**

✅ **Completed Sections:**
• Product Overview
• Target Audience  
• Core Features (partial)

⚠️ **Needs Attention:**
• User Stories (not started)
• Technical Requirements (not started)
• Success Metrics (not started)
• Timeline (not started)

📝 **Current Content Preview:**

## Product Overview
CardCraft Online Store is a comprehensive platform for trading card game enthusiasts, focusing on the new CardCraft TCG. The platform serves competitive players and collectors with marketplace, deck building, and tournament features.

## Target Audience
- Competitive players (ages 16-35)
- Card collectors and enthusiasts
- Tournament organizers

**Recommendations:**
1. Let's define specific user stories for each audience segment
2. We should outline technical requirements (platform, integrations, etc.)
3. Consider defining success metrics (user engagement, transaction volume, etc.)

Which section would you like to work on next?
```

## Available Commands

### Agent Management
- `/agent list` - Show all available agents
- `/agent set <agent-id>` - Set the current agent
- `/agent current` - Show current active agent

### Document Management  
- `/new "<title>" --template <template> --path <path>` - Create new document
- `/open <path>` - Open existing document
- `/templates` - List available templates

### Conversation Management
- `/chat <message>` - Send message to current agent (optional, direct input works too)
- `/context` - Show current conversation context
- `/reset` - Reset conversation state

## Tips for Success

1. **Start with the Right Agent**: Choose the agent that matches your document type
2. **Use Appropriate Templates**: Templates provide structure and guide the conversation
3. **Be Specific**: The more details you provide, the better the AI can help
4. **Iterate**: Don't expect perfection on the first pass - refine through conversation
5. **Review Regularly**: Ask to see the current document state and suggest improvements

## Troubleshooting

If commands aren't working:
1. Check that you're using the `@docu` prefix
2. Verify command syntax with `/help`
3. Try resetting with `/reset` if conversation state seems broken
4. Use `/agent current` to verify your agent is set correctly

For more help, see the [Troubleshooting Guide](docs/troubleshooting.md).
```

2. **Update troubleshooting.md:**

```markdown
# Troubleshooting Guide

## Common Issues and Solutions

### Commands Not Working

**Problem**: Commands like `/agent set` or `/new` don't respond

**Solutions**:
1. Ensure you're using the `@docu` prefix: `@docu /agent set prd-creator`
2. Check command syntax: `/agent set <agent-id>` (not `/agent <agent-id>`)
3. Verify the extension is active in VS Code
4. Try reloading VS Code window (Ctrl+Shift+P → "Developer: Reload Window")

### Agent Not Set Properly

**Problem**: "No active agent" error when trying to chat

**Solutions**:
1. Set an agent first: `@docu /agent set prd-creator`
2. Verify with: `@docu /agent current`
3. List available agents: `@docu /agent list`
4. If agent exists but won't set, try: `@docu /reset` then set again

### Document Creation Fails

**Problem**: `/new` command fails or creates empty documents

**Solutions**:
1. Check path permissions - ensure the target directory is writable
2. Verify template exists: `@docu /templates`
3. Use quotes for titles with spaces: `/new "My Document Title"`
4. Ensure path ends with `/` for directories

### Conversation State Issues

**Problem**: Conversation seems broken or responses don't make sense

**Solutions**:
1. Check current context: `@docu /context`
2. Reset conversation: `@docu /reset`
3. Restart with agent: `@docu /agent set <agent-id>`
4. If persistent, reload VS Code window

### Template and Agent Mismatch

**Problem**: Wrong agent suggestions or inappropriate responses

**Solutions**:
1. Use template-appropriate agents:
   - `basic` or `prd` templates → `prd-creator`
   - `architecture` template → `solution-architect`
   - `requirements` template → `requirements-gatherer`
2. Switch agents if needed: `@docu /agent set <correct-agent>`
3. The system will suggest appropriate agents for templates

## Debug Information

### Check Extension Status
1. Open VS Code Command Palette (Ctrl+Shift+P)
2. Run "Developer: Show Running Extensions"
3. Look for "Docu" in the list
4. Check for any error indicators

### View Extension Logs
1. Open Output panel (View → Output)
2. Select "Docu" from the dropdown
3. Look for error messages or warnings
4. Share relevant logs when reporting issues

### Reset Extension State
If all else fails:
1. `@docu /reset` - Reset conversation state
2. Reload VS Code window
3. Disable and re-enable the extension
4. Restart VS Code completely

## Getting Help

If you're still experiencing issues:
1. Check the [GitHub Issues](https://github.com/your-repo/docu-extension/issues)
2. Create a new issue with:
   - Steps to reproduce
   - Expected vs actual behavior
   - Extension logs (if available)
   - VS Code version and OS

## Performance Tips

1. **Large Documents**: For very large documents, consider breaking them into smaller sections
2. **Long Conversations**: Reset conversation periodically to maintain performance
3. **Multiple Documents**: Use separate conversation sessions for different documents
4. **Template Selection**: Choose the most specific template for better results
```

**Testing Requirements:**

* Test all documented workflows
* Verify troubleshooting steps work
* Test command examples in documentation
* Validate all links and references

---

## Implementation Timeline

### Phase 1: Core Infrastructure (Week 1-2)
- Tasks 1-5: Foundation fixes
- Focus on command routing and agent management
- Establish proper error handling

### Phase 2: Conversation Flow (Week 3-4)  
- Tasks 6-10: Conversation implementation
- Integration between commands and conversations
- Document update workflows

### Phase 3: Polish and Testing (Week 5)
- Tasks 11-15: User experience and testing
- Comprehensive testing and documentation
- Performance optimization

## Success Criteria

1. **Commands Work Reliably**: `/agent set` and `/new` commands execute successfully
2. **Conversation Continuity**: Smooth transition from commands to conversation
3. **State Management**: Proper context preservation across interactions
4. **Error Recovery**: Graceful handling of errors with helpful guidance
5. **User Experience**: Clear feedback and intuitive workflow
6. **Documentation**: Complete and accurate user guides
7. **Testing Coverage**: Comprehensive test suite covering all scenarios
8. **Performance**: Responsive interaction with minimal delays

This implementation plan addresses all identified issues in the conversation flow and provides a clear path to a fully functional, maintainable system.
```

