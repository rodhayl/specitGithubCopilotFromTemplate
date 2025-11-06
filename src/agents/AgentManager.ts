// Agent management system
import * as vscode from 'vscode';
import * as path from 'path';
import { Agent, AgentConfiguration, ChatRequest, AgentContext, WorkflowState, UserPreferences } from './types';
import { PRDCreatorAgent } from './PRDCreatorAgent';
import { BrainstormerAgent } from './BrainstormerAgent';
import { RequirementsGathererAgent } from './RequirementsGathererAgent';
import { SolutionArchitectAgent } from './SolutionArchitectAgent';
import { SpecificationWriterAgent } from './SpecificationWriterAgent';
import { QualityReviewerAgent } from './QualityReviewerAgent';
import { Logger } from '../logging/Logger';
import { AGENTS, WORKFLOW_PHASES, PATHS } from '../constants';

export class AgentManager {
    private agents: Map<string, Agent> = new Map();
    private configurations: Map<string, AgentConfiguration> = new Map();
    private currentAgent: string = AGENTS.PRD_CREATOR;
    private workflowState: WorkflowState;
    private logger: Logger;

    constructor(private extensionContext: vscode.ExtensionContext) {
        this.logger = Logger.getInstance();
        this.workflowState = this.initializeWorkflowState();
        this.registerBuiltinAgents();
    }

    /**
     * Register built-in agents
     */
    private registerBuiltinAgents(): void {
        this.registerAgent(new PRDCreatorAgent());
        this.registerAgent(new BrainstormerAgent());
        this.registerAgent(new RequirementsGathererAgent(
            'requirements-gatherer',
            'You are a requirements gathering specialist focused on collecting and structuring business requirements using EARS format.',
            ['readFile', 'writeFile', 'listFiles', 'applyTemplate', 'insertSection'],
            'requirements'
        ));
        this.registerAgent(new SolutionArchitectAgent(
            'solution-architect',
            'You are a solution architect focused on technical decisions, architecture patterns, and system design.',
            ['readFile', 'writeFile', 'listFiles', 'applyTemplate', 'insertSection'],
            'design'
        ));
        this.registerAgent(new SpecificationWriterAgent(
            'specification-writer',
            'You are a specification writer focused on implementation planning and task breakdown.',
            ['readFile', 'writeFile', 'listFiles', 'applyTemplate', 'insertSection'],
            'implementation'
        ));
        this.registerAgent(new QualityReviewerAgent(
            'quality-reviewer',
            'You are a quality reviewer focused on document validation and improvement suggestions.',
            ['readFile', 'writeFile', 'listFiles', 'applyTemplate', 'insertSection'],
            'implementation'
        ));
    }

    /**
     * Register an agent with the manager
     */
    registerAgent(agent: Agent): void {
        this.agents.set(agent.name, agent);
        this.logger.extension.debug(`Registered agent: ${agent.name}`);
    }

    /**
     * Get an agent by name
     */
    getAgent(name: string): Agent | undefined {
        return this.agents.get(name);
    }

    /**
     * Get the currently active agent
     */
    getCurrentAgent(): Agent | undefined {
        return this.agents.get(this.currentAgent);
    }

    /**
     * Set the active agent
     */
    setCurrentAgent(name: string): boolean {
        if (this.agents.has(name)) {
            this.currentAgent = name;
            this.workflowState.activeAgent = name;
            return true;
        }
        return false;
    }

    /**
     * List all available agents
     */
    listAgents(): Array<{ name: string; description: string; phase: string; active: boolean }> {
        return Array.from(this.agents.values()).map(agent => ({
            name: agent.name,
            description: this.configurations.get(agent.name)?.description || 'No description available',
            phase: agent.workflowPhase,
            active: agent.name === this.currentAgent
        }));
    }

    /**
     * Load agent configurations from JSON/YAML files
     */
    async loadConfigurations(): Promise<void> {
        try {
            // Load built-in configurations
            await this.loadBuiltinConfigurations();

            // Load user-defined configurations if they exist
            await this.loadUserConfigurations();
        } catch (error) {
            this.logger.extension.error('Error loading agent configurations', error as Error);
        }
    }

    /**
     * Build agent context for request processing
     */
    buildAgentContext(request: vscode.ChatRequest): AgentContext {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
        const userPreferences = this.getUserPreferences();

        return {
            workspaceRoot,
            previousOutputs: [],
            userPreferences,
            workflowState: this.workflowState,
            extensionContext: this.extensionContext
        };
    }

    /**
     * Update workflow state
     */
    updateWorkflowState(updates: Partial<WorkflowState>): void {
        this.workflowState = { ...this.workflowState, ...updates };
    }

    /**
     * Get current workflow state
     */
    getWorkflowState(): WorkflowState {
        return this.workflowState;
    }

    /**
     * Suggest next workflow phase based on current state
     */
    suggestNextPhase(): { phase: string; agent: string; description: string } | null {
        const currentPhase = this.workflowState.currentPhase;
        
        switch (currentPhase) {
            case 'prd':
                return {
                    phase: 'requirements',
                    agent: 'requirements-gatherer',
                    description: 'Move to requirements gathering to structure your ideas into formal requirements'
                };
            case 'requirements':
                return {
                    phase: 'design',
                    agent: 'solution-architect',
                    description: 'Progress to solution design to create technical architecture'
                };
            case 'design':
                return {
                    phase: 'implementation',
                    agent: 'specification-writer',
                    description: 'Create implementation specifications and detailed plans'
                };
            case 'implementation':
                return {
                    phase: 'implementation',
                    agent: 'quality-reviewer',
                    description: 'Review and validate all documentation for quality and consistency'
                };
            default:
                return null;
        }
    }

    /**
     * Progress to next workflow phase
     */
    progressToNextPhase(): boolean {
        const nextPhase = this.suggestNextPhase();
        if (nextPhase) {
            this.workflowState.currentPhase = nextPhase.phase as any;
            this.setCurrentAgent(nextPhase.agent);
            this.workflowState.history.push({
                timestamp: new Date(),
                event: 'phase_transition',
                data: {
                    from: this.workflowState.currentPhase,
                    to: nextPhase.phase,
                    agent: nextPhase.agent
                }
            });
            return true;
        }
        return false;
    }

    /**
     * Track document creation/update
     */
    trackDocument(documentType: string, filePath: string): void {
        (this.workflowState.documents as any)[documentType] = filePath;
        this.workflowState.history.push({
            timestamp: new Date(),
            event: 'document_updated',
            data: {
                type: documentType,
                path: filePath,
                agent: this.currentAgent
            }
        });
    }

    /**
     * Get workflow progress summary
     */
    getWorkflowProgress(): {
        currentPhase: string;
        completedPhases: string[];
        nextSuggestion: string[];
        documentsCreated: number;
    } {
        const phases = ['prd', 'requirements', 'design', 'implementation'];
        const currentIndex = phases.indexOf(this.workflowState.currentPhase);
        const completedPhases = phases.slice(0, currentIndex);
        
        return {
            currentPhase: this.workflowState.currentPhase,
            completedPhases,
            nextSuggestion: this.suggestNextPhase()?.phase ? [this.suggestNextPhase()!.phase] : [],
            documentsCreated: Object.keys(this.workflowState.documents).length
        };
    }

    private initializeWorkflowState(): WorkflowState {
        return {
            projectId: this.generateProjectId(),
            currentPhase: 'prd',
            activeAgent: 'prd-creator',
            documents: {},
            context: {},
            history: []
        };
    }

    private generateProjectId(): string {
        const workspaceName = vscode.workspace.name || 'untitled';
        const timestamp = Date.now().toString(36);
        return `${workspaceName}-${timestamp}`;
    }

    private getUserPreferences(): UserPreferences {
        const config = vscode.workspace.getConfiguration('docu');
        return {
            defaultDirectory: config.get('defaultDirectory', 'docs'),
            defaultAgent: config.get('defaultAgent', 'prd-creator'),
            templateDirectory: config.get('templateDirectory', '.vscode/docu/templates')
        };
    }

    private async loadBuiltinConfigurations(): Promise<void> {
        // Built-in agent configurations
        const builtinConfigs: AgentConfiguration[] = [
            {
                name: 'prd-creator',
                systemPrompt: 'You are a PRD Creator agent that helps develop initial product ideas into comprehensive Product Requirements Documents.',
                allowedTools: ['writeFile', 'applyTemplate', 'openInEditor'],
                workflowPhase: 'prd',
                description: 'Creates Product Requirements Documents from initial ideas',
                enabled: true
            },
            {
                name: 'brainstormer',
                systemPrompt: 'You are a Brainstormer agent that facilitates ideation and concept exploration based on PRD context.',
                allowedTools: ['readFile', 'writeFile', 'insertSection'],
                workflowPhase: 'prd',
                description: 'Facilitates ideation and concept exploration',
                enabled: true
            },
            {
                name: 'requirements-gatherer',
                systemPrompt: 'You are a Requirements Gatherer agent that systematically collects and structures business requirements using EARS format.',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'applyTemplate'],
                workflowPhase: 'requirements',
                description: 'Collects and structures business requirements',
                enabled: true
            },
            {
                name: 'solution-architect',
                systemPrompt: 'You are a Solution Architect agent that designs technical solutions and system architecture.',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'applyTemplate'],
                workflowPhase: 'design',
                description: 'Designs technical solutions and architecture',
                enabled: true
            },
            {
                name: 'specification-writer',
                systemPrompt: 'You are a Specification Writer agent that creates detailed technical specifications and implementation plans.',
                allowedTools: ['readFile', 'writeFile', 'insertSection', 'listFiles'],
                workflowPhase: 'implementation',
                description: 'Creates technical specifications and implementation plans',
                enabled: true
            },
            {
                name: 'quality-reviewer',
                systemPrompt: 'You are a Quality Reviewer agent that validates and improves all document types with strict review criteria.',
                allowedTools: ['readFile', 'writeFile', 'insertSection'],
                workflowPhase: 'implementation',
                description: 'Reviews and improves document quality',
                enabled: true
            }
        ];

        builtinConfigs.forEach(config => {
            this.configurations.set(config.name, config);
        });
    }

    private async loadUserConfigurations(): Promise<void> {
        try {
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (!workspaceRoot) {return;}

            const configPath = path.join(workspaceRoot, '.vscode', 'docu', 'agents.json');
            const configUri = vscode.Uri.file(configPath);

            try {
                const configData = await vscode.workspace.fs.readFile(configUri);
                const userConfigs: AgentConfiguration[] = JSON.parse(configData.toString());
                
                userConfigs.forEach(config => {
                    if (config.enabled !== false) {
                        this.configurations.set(config.name, config);
                    }
                });
            } catch (error) {
                // User configuration file doesn't exist or is invalid - this is okay
                this.logger.extension.debug('No user agent configurations found or invalid format');
            }
        } catch (error) {
            this.logger.extension.error('Error loading user configurations', error as Error);
        }
    }
}