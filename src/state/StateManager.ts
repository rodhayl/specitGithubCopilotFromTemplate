import * as vscode from 'vscode';
import { AgentManager } from '../agents/AgentManager';
import { ConversationManager } from '../conversation/ConversationManager';
import { ConversationFlowHandler } from '../conversation/ConversationFlowHandler';
import { ConversationSessionRouter } from '../conversation/ConversationSessionRouter';
import { CommandRouter } from '../commands/CommandRouter';
import { ConfigurationManager } from '../config/ConfigurationManager';
import { ErrorHandler } from '../error/ErrorHandler';
import { OfflineManager } from '../offline/OfflineManager';
import { SecurityManager } from '../security/SecurityManager';
import { Logger } from '../logging/Logger';
import { TelemetryManager } from '../telemetry/TelemetryManager';
import { DebugManager } from '../debugging/DebugManager';
import { TemplateService } from '../templates/TemplateService';
import { ToolManager } from '../tools';
import { LLMService } from '../llm/LLMService';
// import { SettingsWebviewProvider } from '../webview/SettingsWebviewProvider'; // TODO: Implement when webview is created
import { OutputCoordinator } from '../commands/OutputCoordinator';
import { ConversationBridge } from '../conversation/ConversationBridge';

/**
 * State change event types
 */
export type StateChangeEvent = 
    | 'agent-changed'
    | 'conversation-started'
    | 'conversation-ended'
    | 'offline-mode-changed'
    | 'configuration-changed'
    | 'extension-activated'
    | 'extension-deactivated'
    | 'error-occurred'
    | 'component-initialized'
    | 'component-destroyed';

/**
 * State change listener callback
 */
export type StateChangeListener = (event: StateChangeEvent, data?: any) => void;

/**
 * Component initialization status
 */
export interface ComponentStatus {
    name: string;
    initialized: boolean;
    error?: string;
    dependencies: string[];
    dependents: string[];
}

/**
 * Global application state interface
 */
export interface ApplicationState {
    isActivated: boolean;
    isOffline: boolean;
    currentAgent?: string;
    activeConversationId?: string;
    workspaceRoot?: string;
    extensionVersion?: string;
    lastError?: Error;
    componentStatuses: Map<string, ComponentStatus>;
}

/**
 * Centralized state management for the Docu extension
 * Coordinates between all components and provides a single source of truth
 */
export class StateManager {
    private static instance: StateManager;
    private state: ApplicationState;
    private listeners: Map<StateChangeEvent, StateChangeListener[]> = new Map();
    private components: Map<string, any> = new Map();
    private logger?: Logger;
    private initializationOrder: string[] = [
        'logger',
        'telemetryManager',
        'debugManager',
        'errorHandler',
        'offlineManager',
        'configManager',
        'securityManager',
        'templateService',
        'toolManager',
        'agentManager',
        'conversationManager',
        'conversationFlowHandler',
        'conversationSessionRouter',
        'llmService',
        'outputCoordinator',
        'commandRouter',
        'conversationBridge',
        'settingsProvider'
    ];

    private constructor(private context: vscode.ExtensionContext) {
        this.state = {
            isActivated: false,
            isOffline: false,
            componentStatuses: new Map()
        };
        
        // Initialize component statuses
        this.initializationOrder.forEach(name => {
            this.state.componentStatuses.set(name, {
                name,
                initialized: false,
                dependencies: this.getComponentDependencies(name),
                dependents: this.getComponentDependents(name)
            });
        });
    }

    /**
     * Get singleton instance
     */
    public static getInstance(context?: vscode.ExtensionContext): StateManager {
        if (!StateManager.instance) {
            if (!context) {
                throw new Error('StateManager requires extension context for initialization');
            }
            StateManager.instance = new StateManager(context);
        }
        return StateManager.instance;
    }

    /**
     * Initialize the state manager
     */
    public async initialize(): Promise<void> {
        this.state.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        this.state.extensionVersion = this.context.extension.packageJSON.version;
        
        this.emit('component-initialized', { component: 'stateManager' });
    }

    /**
     * Register a component with the state manager
     */
    public registerComponent<T>(name: string, component: T): void {
        this.components.set(name, component);
        
        const status = this.state.componentStatuses.get(name);
        if (status) {
            status.initialized = true;
            this.state.componentStatuses.set(name, status);
        }
        
        // Set logger reference if this is the logger component
        if (name === 'logger' && !this.logger) {
            this.logger = component as any;
        }
        
        this.logger?.extension.info(`Component registered: ${name}`);
        this.emit('component-initialized', { component: name });
    }

    /**
     * Get a registered component
     */
    public getComponent<T>(name: string): T | undefined {
        return this.components.get(name) as T;
    }

    /**
     * Get all registered components
     */
    public getAllComponents(): Map<string, any> {
        return new Map(this.components);
    }

    /**
     * Check if a component is initialized
     */
    public isComponentInitialized(name: string): boolean {
        return this.state.componentStatuses.get(name)?.initialized || false;
    }

    /**
     * Get component initialization status
     */
    public getComponentStatus(name: string): ComponentStatus | undefined {
        return this.state.componentStatuses.get(name);
    }

    /**
     * Get all component statuses
     */
    public getAllComponentStatuses(): ComponentStatus[] {
        return Array.from(this.state.componentStatuses.values());
    }

    /**
     * Check if all required components are initialized
     */
    public areAllComponentsInitialized(): boolean {
        return Array.from(this.state.componentStatuses.values())
            .every(status => status.initialized);
    }

    /**
     * Get current application state
     */
    public getState(): Readonly<ApplicationState> {
        return { ...this.state };
    }

    /**
     * Update application state
     */
    public updateState(updates: Partial<ApplicationState>): void {
        const oldState = { ...this.state };
        this.state = { ...this.state, ...updates };
        
        // Emit specific events based on what changed
        if (oldState.currentAgent !== this.state.currentAgent) {
            this.emit('agent-changed', { 
                oldAgent: oldState.currentAgent, 
                newAgent: this.state.currentAgent 
            });
        }
        
        if (oldState.isOffline !== this.state.isOffline) {
            this.emit('offline-mode-changed', { isOffline: this.state.isOffline });
        }
        
        if (oldState.activeConversationId !== this.state.activeConversationId) {
            if (this.state.activeConversationId) {
                this.emit('conversation-started', { conversationId: this.state.activeConversationId });
            } else if (oldState.activeConversationId) {
                this.emit('conversation-ended', { conversationId: oldState.activeConversationId });
            }
        }
    }

    /**
     * Set current agent
     */
    public setCurrentAgent(agentName: string): void {
        this.updateState({ currentAgent: agentName });
    }

    /**
     * Set offline mode
     */
    public setOfflineMode(isOffline: boolean): void {
        this.updateState({ isOffline });
    }

    /**
     * Set active conversation
     */
    public setActiveConversation(conversationId: string | undefined): void {
        this.updateState({ activeConversationId: conversationId });
    }

    /**
     * Set last error
     */
    public setLastError(error: Error): void {
        this.updateState({ lastError: error });
        this.emit('error-occurred', { error });
    }

    /**
     * Mark extension as activated
     */
    public setActivated(activated: boolean): void {
        this.updateState({ isActivated: activated });
        this.emit(activated ? 'extension-activated' : 'extension-deactivated');
    }

    /**
     * Add state change listener
     */
    public addEventListener(event: StateChangeEvent, listener: StateChangeListener): void {
        if (!this.listeners.has(event)) {
            this.listeners.set(event, []);
        }
        this.listeners.get(event)!.push(listener);
    }

    /**
     * Remove state change listener
     */
    public removeEventListener(event: StateChangeEvent, listener: StateChangeListener): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            const index = eventListeners.indexOf(listener);
            if (index > -1) {
                eventListeners.splice(index, 1);
            }
        }
    }

    /**
     * Emit state change event
     */
    private emit(event: StateChangeEvent, data?: any): void {
        const eventListeners = this.listeners.get(event);
        if (eventListeners) {
            eventListeners.forEach(listener => {
                try {
                    listener(event, data);
                } catch (error) {
                    this.logger?.extension.error(`Error in state change listener for ${event}`, error instanceof Error ? error : new Error(String(error)));
                }
            });
        }
    }

    /**
     * Get component dependencies
     */
    private getComponentDependencies(componentName: string): string[] {
        const dependencies: Record<string, string[]> = {
            'logger': [],
            'telemetryManager': ['logger'],
            'debugManager': ['logger'],
            'errorHandler': ['logger'],
            'offlineManager': ['logger'],
            'configManager': ['logger'],
            'securityManager': ['logger', 'configManager'],
            'templateService': ['logger'],
            'toolManager': ['templateService'],
            'agentManager': ['logger', 'configManager'],
            'conversationManager': ['logger', 'agentManager', 'offlineManager'],
            'conversationFlowHandler': ['conversationManager', 'agentManager', 'offlineManager'],
            'conversationSessionRouter': ['conversationManager', 'agentManager', 'offlineManager'],
            'llmService': ['logger', 'configManager'],
            'outputCoordinator': ['logger'],
            'commandRouter': ['agentManager'],
            'conversationBridge': ['conversationFlowHandler', 'conversationManager', 'agentManager', 'outputCoordinator'],
            'settingsProvider': ['agentManager', 'llmService']
        };
        
        return dependencies[componentName] || [];
    }

    /**
     * Get component dependents
     */
    private getComponentDependents(componentName: string): string[] {
        const dependents: string[] = [];
        
        for (const [name, deps] of Object.entries(this.getComponentDependencies(''))) {
            if (deps.includes(componentName)) {
                dependents.push(name);
            }
        }
        
        return dependents;
    }

    /**
     * Validate component initialization order
     */
    public validateInitializationOrder(): { valid: boolean; errors: string[] } {
        const errors: string[] = [];
        
        for (const componentName of this.initializationOrder) {
            const status = this.state.componentStatuses.get(componentName);
            if (!status) {continue;}
            
            // Check if all dependencies are initialized before this component
            for (const dependency of status.dependencies) {
                const depStatus = this.state.componentStatuses.get(dependency);
                if (!depStatus?.initialized && status.initialized) {
                    errors.push(`Component '${componentName}' is initialized but its dependency '${dependency}' is not`);
                }
            }
        }
        
        return { valid: errors.length === 0, errors };
    }

    /**
     * Get initialization progress
     */
    public getInitializationProgress(): { completed: number; total: number; percentage: number } {
        const total = this.state.componentStatuses.size;
        const completed = Array.from(this.state.componentStatuses.values())
            .filter(status => status.initialized).length;
        
        return {
            completed,
            total,
            percentage: total > 0 ? Math.round((completed / total) * 100) : 0
        };
    }

    /**
     * Reset state manager (for testing)
     */
    public reset(): void {
        this.components.clear();
        this.listeners.clear();
        this.state = {
            isActivated: false,
            isOffline: false,
            componentStatuses: new Map()
        };
        
        // Reinitialize component statuses
        this.initializationOrder.forEach(name => {
            this.state.componentStatuses.set(name, {
                name,
                initialized: false,
                dependencies: this.getComponentDependencies(name),
                dependents: this.getComponentDependents(name)
            });
        });
    }

    /**
     * Check if all registered components are initialized
     */
    isAllInitialized(): boolean {
        return Array.from(this.components.keys()).every(name => this.isComponentInitialized(name));
    }

    /**
     * Dispose all components and clean up resources
     */
    public dispose(): void {
        this.emit('extension-deactivated');
        this.components.clear();
        this.listeners.clear();
        StateManager.instance = undefined as any;
    }
}