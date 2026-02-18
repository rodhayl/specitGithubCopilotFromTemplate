// extension.ts - Consolidated and deduplicated
import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateService } from './templates/TemplateService';
import { ToolManager } from './tools';
import { CommandRouter, CommandDefinition, ParsedCommand, CommandContext } from './commands';
import { CommandTipProvider } from './commands/CommandTipProvider';
import { OutputCoordinator } from './commands/OutputCoordinator';
import { AgentManager } from './agents';
import { ConfigurationManager } from './config';
import { ErrorHandler } from './error';
import { OfflineManager } from './offline';
import { SecurityManager } from './security';
import { Logger } from './logging';
import { TelemetryManager } from './telemetry';
import { DebugManager } from './debugging';
import { 
    ConversationManager, 
    QuestionEngine, 
    ResponseProcessor, 
    ContentCapture, 
    WorkflowOrchestrator, 
    ProgressTracker 
} from './conversation';
import { ConversationFlowHandler } from './conversation/ConversationFlowHandler';
import { ConversationSessionRouter } from './conversation/ConversationSessionRouter';
import { LLMService } from './llm/LLMService';
import { SettingsWebviewProvider } from './config/SettingsWebviewProvider';
import { SettingsCommand } from './commands/SettingsCommand';
import { StateManager } from './state/StateManager';
import { WorkflowStateManager } from './state/WorkflowStateManager';

// Centralized state management
let stateManager: StateManager;
let globalExtensionContext: vscode.ExtensionContext;

// Component accessors (using StateManager)
const getTemplateService = () => stateManager.getComponent<TemplateService>('templateService')!;
const getToolManager = () => stateManager.getComponent<ToolManager>('toolManager')!;
const getCommandRouter = () => stateManager.getComponent<CommandRouter>('commandRouter')!;
const getAgentManager = () => stateManager.getComponent<AgentManager>('agentManager')!;
const getConfigManager = () => stateManager.getComponent<ConfigurationManager>('configManager')!;
const getErrorHandler = () => stateManager.getComponent<ErrorHandler>('errorHandler')!;
const getOfflineManager = () => stateManager.getComponent<OfflineManager>('offlineManager')!;
const getSecurityManager = () => stateManager.getComponent<SecurityManager>('securityManager')!;
const getLogger = () => stateManager.getComponent<Logger>('logger')!;
const getTelemetryManager = () => stateManager.getComponent<TelemetryManager>('telemetryManager')!;
const getDebugManager = () => stateManager.getComponent<DebugManager>('debugManager')!;
const getConversationManager = () => stateManager.getComponent<ConversationManager>('conversationManager')!;
const getConversationFlowHandler = () => stateManager.getComponent<ConversationFlowHandler>('conversationFlowHandler')!;
const getConversationSessionRouter = () => stateManager.getComponent<ConversationSessionRouter>('conversationSessionRouter')!;
const getLLMService = () => stateManager.getComponent<LLMService>('llmService')!;
const getSettingsProvider = () => stateManager.getComponent<SettingsWebviewProvider>('settingsProvider')!;
const getOutputCoordinator = () => stateManager.getComponent<OutputCoordinator>('outputCoordinator')!;

export async function activate(context: vscode.ExtensionContext) {
	const startTime = Date.now();
	
	try {
		// Store global extension context
		globalExtensionContext = context;
		
		// Initialize StateManager first for centralized state coordination with context
		stateManager = StateManager.getInstance(context);
		await stateManager.initialize();
	
	// Initialize logging system first
	const logger = Logger.initialize(context);
	stateManager.registerComponent('logger', logger);
	logger.extension.info('Docu extension activation started');
	
	// Initialize telemetry and debugging
	const telemetryManager = TelemetryManager.initialize(context);
	const debugManager = DebugManager.initialize(context);
	stateManager.registerComponent('telemetryManager', telemetryManager);
	stateManager.registerComponent('debugManager', debugManager);

	// Initialize error handling and offline management
	const errorHandler = ErrorHandler.getInstance();
	const offlineManager = OfflineManager.getInstance();
	stateManager.registerComponent('errorHandler', errorHandler);
	stateManager.registerComponent('offlineManager', offlineManager);

	// Track activation start
	telemetryManager.startPerformanceMetric('extension.activation');
	debugManager.addDebugInfo('extension', 'info', 'Extension activation started');

	// Initialize configuration manager
	const configManager = new ConfigurationManager(context);
	stateManager.registerComponent('configManager', configManager);

	// Initialize security manager
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
	let securityManager: SecurityManager | undefined;
	if (workspaceRoot) {
		securityManager = new SecurityManager(workspaceRoot);
		stateManager.registerComponent('securityManager', securityManager);
		
		// Validate workspace security
		const securityValidation = await securityManager.validateWorkspaceState();
		if (!securityValidation.valid) {
			vscode.window.showErrorMessage(
				`Workspace security validation failed: ${securityValidation.error}`,
				'Open Settings'
			).then(selection => {
				if (selection === 'Open Settings') {
					vscode.commands.executeCommand('workbench.action.openSettings', 'docu');
				}
			}, () => { /* dialog dismissed */ });
		} else if (securityValidation.warnings && securityValidation.warnings.length > 0) {
			vscode.window.showWarningMessage(
				`Security recommendations: ${securityValidation.warnings.join(', ')}`
			);
		}
	}
	
	// Validate configuration
	const validation = configManager.validateConfiguration();
	if (!validation.valid) {
		vscode.window.showWarningMessage(
			`Docu configuration issues found: ${validation.errors.join(', ')}`,
			'Fix Settings'
		).then(selection => {
			if (selection === 'Fix Settings') {
				vscode.commands.executeCommand('workbench.action.openSettings', 'docu');
			}
		}, () => { /* dialog dismissed */ });
	}

	// Initialize consolidated template service
	const templateService = TemplateService.getInstance();
	templateService.initialize(context);
	await templateService.loadUserTemplates();
	stateManager.registerComponent('templateService', templateService);

	// Initialize tool system with template service
	const toolManager = new ToolManager(templateService);
	stateManager.registerComponent('toolManager', toolManager);

	// Initialize agent manager
	const agentManager = new AgentManager(context);
	await agentManager.loadConfigurations();
	stateManager.registerComponent('agentManager', agentManager);

	// Initialize consolidated conversation system
	const questionEngine = new QuestionEngine();
	const responseProcessor = new ResponseProcessor();
	const contentCapture = new ContentCapture();
	const workflowOrchestrator = new WorkflowOrchestrator();
	const progressTracker = new ProgressTracker();
	
	const conversationManager = new ConversationManager(
		questionEngine,
		responseProcessor,
		contentCapture,
		workflowOrchestrator,
		progressTracker,
		context,
		offlineManager,
		agentManager
	);
	stateManager.registerComponent('conversationManager', conversationManager);
	
	const conversationFlowHandler = new ConversationFlowHandler(
		conversationManager,
		agentManager,
		offlineManager
	);
	stateManager.registerComponent('conversationFlowHandler', conversationFlowHandler);

	// Initialize conversation session router
	const conversationSessionRouter = new ConversationSessionRouter(
		conversationManager,
		agentManager,
		context,
		offlineManager
	);
	stateManager.registerComponent('conversationSessionRouter', conversationSessionRouter);

	// Set session router on conversation flow handler
	conversationFlowHandler.setSessionRouter(conversationSessionRouter);

	// Get auto-chat components from the conversation session router
	const autoChatManager = conversationSessionRouter.getAutoChatManager();
	const documentUpdateEngine = conversationSessionRouter.getDocumentUpdateEngine();
	
	// Register auto-chat components with StateManager
	if (autoChatManager) {
		stateManager.registerComponent('autoChatManager', autoChatManager);
	}
	if (documentUpdateEngine) {
		stateManager.registerComponent('documentUpdateEngine', documentUpdateEngine);
	}

	// Initialize LLM service
	const preferredModel = configManager.get('preferredModel') as string;
	const llmService = new LLMService({ preferredModel: preferredModel || undefined });
	try {
		await llmService.initialize();
		logger.extension.info('LLM Service initialized successfully');
	} catch (error) {
		logger.extension.error('Failed to initialize LLM Service', error instanceof Error ? error : new Error(String(error)));
		vscode.window.showWarningMessage(
			'GitHub Copilot is not available. Some features may be limited.',
			'Learn More'
		).then(selection => {
			if (selection === 'Learn More') {
				vscode.env.openExternal(vscode.Uri.parse('https://github.com/features/copilot'));
			}
		}, (error) => {
			logger.extension.error('Failed to show Copilot warning dialog', error);
		});
	}
	stateManager.registerComponent('llmService', llmService);

	// Initialize settings webview provider
	const settingsProvider = new SettingsWebviewProvider(context.extensionUri, agentManager, llmService);
	stateManager.registerComponent('settingsProvider', settingsProvider);
	context.subscriptions.push(
		vscode.window.registerWebviewViewProvider(SettingsWebviewProvider.viewType, settingsProvider)
	);

	// Set conversation manager for all agents
	const agents = agentManager.listAgents();
	for (const agentInfo of agents) {
		const agent = agentManager.getAgent(agentInfo.name);
		if (agent && 'setConversationManager' in agent) {
			(agent as any).setConversationManager(conversationManager);
		}
	}

	// Set default agent from configuration
	const defaultAgent = configManager.get('defaultAgent');
	agentManager.setCurrentAgent(defaultAgent);

	// Check model availability and set offline mode if needed
	const skipStartupCheck = configManager.get('offline.skipStartupCheck') as boolean;
	if (skipStartupCheck) {
		logger.extension.info('Skipping model availability check during startup (skipStartupCheck=true)');
		logger.extension.info('Models will be checked on first use');
	} else {
		try {
			const modelStatus = await offlineManager.checkModelAvailability();
			logger.extension.info('Model availability check completed', { 
				available: modelStatus.available, 
				error: modelStatus.error,
				errorType: modelStatus.errorType 
			});
			
			// If models are available, show a success message
			if (modelStatus.available) {
				logger.extension.info('GitHub Copilot models are available - full functionality enabled');
			} else {
				logger.extension.warn('GitHub Copilot models not available - running in offline mode', {
					reason: modelStatus.error,
					errorType: modelStatus.errorType
				});
			}
		} catch (error) {
			logger.extension.error('Model availability check failed', error instanceof Error ? error : new Error(String(error)));
			// Continue activation even if model check fails
		}
	}

	// Initialize OutputCoordinator
	const outputCoordinator = OutputCoordinator.getInstance();
	stateManager.registerComponent('outputCoordinator', outputCoordinator);

	// Initialize command router with consolidated conversation manager
	const commandRouter = new CommandRouter(getAgentManager() as any);
	stateManager.registerComponent('commandRouter', commandRouter);
	
	// Set conversation handlers on command router (using consolidated manager)
	commandRouter.setConversationHandlers(
		getConversationFlowHandler(),
		getConversationManager()
	);

	// Check ConversationBridge availability (it's initialized automatically in CommandRouter.setConversationHandlers)
	if ((commandRouter as any).conversationBridge) {
		getLogger().extension.info('ConversationBridge initialized successfully');
	} else {
		getLogger().extension.warn('ConversationBridge not available - using fallback conversation handling');
	}

	// Set up auto-chat integration
	if (autoChatManager && documentUpdateEngine) {
		getCommandRouter().setAutoChatIntegration(autoChatManager, documentUpdateEngine);
		getLogger().extension.info('Auto-chat integration configured successfully');
	} else {
		getLogger().extension.warn('Auto-chat integration not available - some features may be limited');
	}
	
	registerCustomCommands();

	// Register context-aware workflow commands (/prd, /requirements, /design, /spec, /review, /status, /context, smart /help)
	const workflowStateManager = WorkflowStateManager.getInstance();
	getCommandRouter().registerWorkflowCommands(workflowStateManager);
	getLogger().extension.info('Workflow commands registered (BMAD-style guided workflow)');

	// First-run onboarding: if no project state exists yet, show a welcome notification
	void workflowStateManager.load().then(state => {
		if (!state.projectId || state.history.length === 0) {
			void vscode.window.showInformationMessage(
				'👋 Welcome to Docu! Type @docu /help in the Copilot Chat panel to get started, or /prd to begin a new project.',
				'Open Chat'
			).then(selection => {
				if (selection === 'Open Chat') {
					void vscode.commands.executeCommand('workbench.action.chat.open');
				}
			});
		}
	});

	// Setup configuration change handlers
	setupConfigurationHandlers(context);

	// Register the @docu chat participant with enhanced error handling
	try {
		getLogger().extension.info('Registering GitHub Copilot chat participant');
		
		// Enhanced check for GitHub Copilot Chat API availability
		if (!vscode.chat) {
			throw new Error('VS Code Chat API is not available - please ensure you have VS Code 1.97.0 or later and GitHub Copilot Chat extension is installed');
		}
		
		if (!vscode.chat.createChatParticipant) {
			throw new Error('createChatParticipant API is not available - this may be due to VS Code version incompatibility or missing GitHub Copilot Chat extension');
		}
		
		// Create the chat participant with enhanced configuration
		const participant = vscode.chat.createChatParticipant('docu', handleChatRequest);
		
		// Verify participant was created successfully
		if (!participant) {
			throw new Error('Failed to create chat participant - createChatParticipant returned null/undefined. This may indicate a conflict with VS Code agent mode.');
		}
		
		// Configure participant properties for GitHub Copilot integration
		participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');

		// Context-aware followup provider (BMAD-style: recommends next phase after each turn)
		participant.followupProvider = {
			async provideFollowups(result: vscode.ChatResult, _ctx: vscode.ChatContext, _token: vscode.CancellationToken) {
				const wsm = WorkflowStateManager.getInstance();
				const completedPhases = await wsm.getCompletedPhases();

				const phaseOrder = ['prd', 'requirements', 'design', 'implementation'];
				const nextPhase = phaseOrder.find(p => !completedPhases.includes(p));
				const phaseLabel: Record<string, string> = {
					prd: 'Start PRD',
					requirements: 'Gather Requirements',
					design: 'Design Architecture',
					implementation: 'Create Tasks'
				};
				const phaseCmd: Record<string, string> = {
					prd: '/prd',
					requirements: '/requirements',
					design: '/design',
					implementation: '/spec'
				};

				const followups: vscode.ChatFollowup[] = [
					{
						prompt: '/status',
						label: vscode.l10n.t('$(checklist) Workflow Status'),
						command: 'status'
					}
				];

				if (nextPhase) {
					followups.unshift({
						prompt: phaseCmd[nextPhase],
						label: vscode.l10n.t(`$(arrow-right) ${phaseLabel[nextPhase]}`),
						command: nextPhase
					});
				} else {
					// All phases done — offer review
					followups.unshift({
						prompt: '/review --file prd.md',
						label: vscode.l10n.t('$(check-all) Review PRD Quality'),
						command: 'review'
					});
				}

				followups.push({
					prompt: '/help',
					label: vscode.l10n.t('$(question) Help'),
					command: 'help'
				});

				return followups;
			}
		};

		// Add participant to subscriptions
		context.subscriptions.push(participant);
		
		// Log successful registration
		getLogger().extension.info('GitHub Copilot chat participant registered successfully', { 
			participantId: 'docu',
			fullName: 'Docu Assistant',
			vsCodeVersion: vscode.version
		});

		
	} catch (participantError) {
		const error = participantError instanceof Error ? participantError : new Error(String(participantError));
		getLogger().extension.error('Failed to register GitHub Copilot chat participant', error);
		console.error('DOCU EXTENSION: Failed to register GitHub Copilot chat participant:', error);
		
		// Enhanced error handling with specific guidance
		let errorMessage = `Failed to register Docu chat participant: ${error.message}`;
		let actions: string[] = ['Reload Window'];
		
		if (error.message.includes('agent mode') || error.message.includes('No activated agent')) {
			errorMessage += '\n\nThis appears to be related to VS Code\'s new agent mode. Try disabling agent mode in VS Code settings.';
			actions.push('Open Settings');
		} else if (error.message.includes('GitHub Copilot')) {
			errorMessage += '\n\nPlease ensure GitHub Copilot Chat extension is installed and enabled.';
			actions.push('Install Copilot');
		}
		
		vscode.window.showErrorMessage(errorMessage, ...actions).then(selection => {
			switch (selection) {
				case 'Reload Window':
					vscode.commands.executeCommand('workbench.action.reloadWindow');
					break;
				case 'Open Settings':
					vscode.commands.executeCommand('workbench.action.openSettings', 'chat.agent.enabled');
					break;
				case 'Install Copilot':
					vscode.commands.executeCommand('workbench.extensions.search', 'GitHub.copilot-chat');
					break;
			}
		}, () => { /* dialog dismissed */ });
		
		// Track error for telemetry
		getTelemetryManager().trackError(error, { 
			operation: 'github-copilot-chat-participant-registration',
			vsCodeVersion: vscode.version,
			errorType: error.message.includes('agent') ? 'agent-conflict' : 'api-unavailable'
		});
	}

	// Complete activation
	const activationDuration = getTelemetryManager().endPerformanceMetric('extension.activation');
	getLogger().extension.info('Docu extension activation completed', { duration: activationDuration });
	getDebugManager().addDebugInfo('extension', 'info', 'Extension activation completed', { duration: activationDuration });
	getTelemetryManager().trackEvent('extension.activated', { success: true }, { duration: activationDuration || 0 });

	// Register debug commands
	registerDebugCommands(context);

	// Register settings command
	// const settingsProvider = stateManager.getComponent('settingsProvider'); // Already declared above
	context.subscriptions.push(
		SettingsCommand.register(context, settingsProvider as SettingsWebviewProvider)
	);

		// Register a test command to verify extension is working
		context.subscriptions.push(
			vscode.commands.registerCommand('docu.test', () => {
				vscode.window.showInformationMessage('Docu extension is active and working!');
				getLogger().extension.info('Test command executed successfully');
			})
		);
		
		// Log successful activation
		const duration = Date.now() - startTime;
		logger.extension.info(`Extension activated successfully in ${duration}ms`);
		
	} catch (error) {
		const duration = Date.now() - startTime;
		const errorMessage = `Extension activation failed: ${error instanceof Error ? error.message : String(error)}`;
		
		// Try to show error to user if possible
		try {
			vscode.window.showErrorMessage(errorMessage, 'Show Details').then(selection => {
				if (selection === 'Show Details') {
					vscode.window.showErrorMessage(`Detailed Error: ${error instanceof Error ? error.stack : String(error)}`);
				}
			}, () => { /* dialog dismissed */ });
		} catch (displayError) {
			console.error('DOCU EXTENSION: Failed to display error message:', displayError);
		}
		
		// Re-throw to ensure VS Code knows activation failed
		throw error;
	}
}

async function handleChatRequest(
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
	const startTime = performance.now();
	
	try {
		// Validate agent manager is available
		const agentManager = getAgentManager();
		if (!agentManager) {
			const errorMsg = 'Agent manager not initialized - extension may not be fully activated';
			stream.markdown(`❌ **Error**: ${errorMsg}`);
			console.error('DOCU EXTENSION: Chat request failed -', errorMsg);
			return { errorDetails: { message: errorMsg } };
		}
		
		getLogger().extension.info('GitHub Copilot chat request received', {
			prompt: request.prompt.substring(0, 100),
			command: request.command,
			participantId: 'docu'
		});
		getTelemetryManager().startPerformanceMetric('chat.request');
	
	// Add debug information about the request
	getDebugManager().addDebugInfo('chat', 'info', 'GitHub Copilot chat request received', {
		prompt: request.prompt.substring(0, 100),
		command: request.command,
		participantId: 'docu',
		timestamp: new Date().toISOString()
	});

	// Fallback mechanism for agent/participant confusion
	try {
		// Check if this request is being incorrectly routed as an agent invocation
		if (request.prompt.includes('No activated agent with id') || 
			request.prompt.includes('invokeAgent')) {
			stream.markdown('🔧 **Agent/Participant Conflict Detected**\n\n');
			stream.markdown('It appears VS Code is trying to invoke this as an agent instead of a chat participant. ');
			stream.markdown('This is likely due to VS Code\'s new agent mode conflicting with chat participants.\n\n');
			stream.markdown('**To fix this issue:**\n');
			stream.markdown('1. Open VS Code Settings (Ctrl+,)\n');
			stream.markdown('2. Search for "chat.agent.enabled"\n');
			stream.markdown('3. Disable agent mode\n');
			stream.markdown('4. Reload VS Code\n\n');
			stream.markdown('**Alternative:** Use the @docu prefix in GitHub Copilot Chat instead of trying to invoke as an agent.\n');
			return { metadata: { type: 'agent-conflict-detected', success: true } };
		}
	} catch (fallbackError) {
		// Continue with normal processing if fallback fails
		console.warn('DOCU EXTENSION: Fallback mechanism failed:', fallbackError);
	}

	try {
		const prompt = request.prompt.trim();
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

		// Ensure model availability (especially if startup check was skipped)
		await getOfflineManager().ensureModelAvailability();
		
		// Check offline mode status
		if (getOfflineManager().isOffline()) {
			getLogger().extension.warn('Chat request in offline mode');
			stream.markdown('⚠️ **Offline Mode Active** - Some AI features are unavailable.\n\n');
		}

		// Check if this is a command
		if (getCommandRouter().isCommand(prompt)) {
			getLogger().extension.info('Processing command', { prompt });
			
			const commandContext: CommandContext = {
				request,
				stream,
				token,
				workspaceRoot,
				extensionContext: context as any,
				model: request.model
			};

			try {
				const result = await getCommandRouter().routeCommand(prompt, commandContext);
				
				getLogger().extension.info('Command execution result', { success: result.success, error: result.error });
				if (!result.success && result.error) {
					stream.markdown(`❌ **Error:** ${result.error}`);
					
					// Provide recovery suggestions if available
					if (result.metadata?.recoveryOptions) {
						stream.markdown('\n**Recovery Options:**\n');
						for (const option of result.metadata.recoveryOptions) {
							stream.markdown(`- ${option}\n`);
						}
					}
				}

				const duration = getTelemetryManager().endPerformanceMetric('chat.request');
				getLogger().extension.info('Chat command processed', { command: result.success, duration });
				return { metadata: { command: request.command, success: result.success } };
			} catch (commandError) {
				getLogger().extension.error('Command execution failed', commandError instanceof Error ? commandError : new Error(String(commandError)));
				stream.markdown(`❌ **Command execution failed:** ${commandError instanceof Error ? commandError.message : String(commandError)}`);
				
				const duration = getTelemetryManager().endPerformanceMetric('chat.request');
				return { metadata: { command: request.command, success: false, error: commandError } };
			}
		}

		// Handle non-command input - use conversation session routing
		getLogger().extension.info('Processing non-command input', { prompt: prompt.substring(0, 100) });
		
		try {
			// Check if we're in offline mode
			if (getOfflineManager().isOffline()) {
				const currentAgent = getAgentManager().getCurrentAgent();
				if (currentAgent) {
					stream.markdown(`🤖 **${currentAgent.name} (Offline Mode)**\n\n`);
					stream.markdown('**Your message:** ' + prompt + '\n\n');
					
					// Provide offline guidance based on agent type
					const offlineGuidance = getOfflineAgentGuidance(currentAgent.name, prompt);
					stream.markdown(offlineGuidance);

					const duration = getTelemetryManager().endPerformanceMetric('chat.request');
					return { metadata: { agent: currentAgent.name, mode: 'offline', duration } };
				}
			}

			// Route user input through conversation session router
			const commandContext: CommandContext = {
				request,
				stream,
				token,
				workspaceRoot,
				extensionContext: context as any,
				model: request.model
			};

			const routingResult = await getConversationSessionRouter().routeUserInput(prompt, commandContext);

			getLogger().extension.info('User input routed', {
				routedTo: routingResult.routedTo,
				sessionId: routingResult.sessionId,
				agentName: routingResult.agentName
			});

			// Handle routing result
			if (routingResult.routedTo === 'conversation') {
				// Input was routed to active conversation
				if (routingResult.response) {
					stream.markdown(routingResult.response);
				}
				
				// Show conversation status
				if (routingResult.shouldContinue) {
					stream.markdown('\n💬 **Conversation continues** - Please respond to continue the discussion.\n');
				} else {
					stream.markdown('\n✅ **Conversation completed** - You can start a new conversation or use commands.\n');
				}

				const duration = getTelemetryManager().endPerformanceMetric('chat.request');
				getTelemetryManager().trackEvent('chat.conversation.continued', { sessionId: routingResult.sessionId });
				return { metadata: { type: 'conversation', sessionId: routingResult.sessionId, duration } };

			} else if (routingResult.routedTo === 'agent') {
				// Input was routed to active agent
				if (routingResult.response) {
					stream.markdown(routingResult.response);
				}

				const duration = getTelemetryManager().endPerformanceMetric('chat.request');
				getTelemetryManager().trackEvent('chat.agent.conversation', { agent: routingResult.agentName });
				return { metadata: { type: 'agent', agent: routingResult.agentName, duration } };

			} else if (routingResult.routedTo === 'error') {
				// Routing failed
				stream.markdown(`❌ **Error:** ${routingResult.error}\n\n`);
				stream.markdown('**What you can try:**\n');
				stream.markdown('- `/agent list` - See available agents\n');
				stream.markdown('- `/agent set <agent-name>` - Set an active agent\n');
				stream.markdown('- `/help` - Get help with commands\n');

				const duration = getTelemetryManager().endPerformanceMetric('chat.request');
				return { metadata: { type: 'error', error: routingResult.error, duration } };
			}

		} catch (routingError) {
			getLogger().extension.error('Conversation routing failed', routingError instanceof Error ? routingError : new Error(String(routingError)));
			
			stream.markdown(`❌ **Routing Error:** ${routingError instanceof Error ? routingError.message : String(routingError)}\n\n`);
			stream.markdown('**What you can try:**\n');
			stream.markdown('- `/agent list` - See available agents\n');
			stream.markdown('- `/agent set <agent-name>` - Switch to a different agent\n');
			stream.markdown('- `/help` - Get help with commands\n');

			const duration = getTelemetryManager().endPerformanceMetric('chat.request');
			return { metadata: { type: 'routing-error', error: true, duration } };
		}
		
		// No active agent - show help and available commands
		getLogger().extension.debug('Non-command chat input received, no active agent, showing help');
		getTelemetryManager().trackEvent('chat.help.shown');
		
		// Show helpful guidance
		stream.markdown('👋 **Hello! I am the Docu AI assistant.**\n\n');
		stream.markdown('I help you create and manage documentation through specific commands. Here\'s how to get started:\n\n');
		
		stream.markdown('## 🚀 **Quick Start Commands**\n\n');
		stream.markdown('- `/new "Document Title"` - Create a new document\n');
		stream.markdown('- `/agent list` - Show available AI agents\n');
		stream.markdown('- `/agent set <agent-name>` - Set active agent for guided workflows\n');
		stream.markdown('- `/chat <message>` - Start a conversation with the active agent\n');
		stream.markdown('- `/templates list` - Show available templates\n');
		stream.markdown('- `/help` - Show detailed command help\n\n');
		
		stream.markdown('## 💡 **Working with Agents**\n\n');
		stream.markdown('After setting an agent with `/agent set <name>`, you can have conversations to develop your documents. Available agents:\n\n');
		
		// Show available agents
		const agents = getAgentManager().listAgents();
		for (const agentInfo of agents) {
			stream.markdown(`- **${agentInfo.name}** - ${agentInfo.description}\n`);
		}
		
		stream.markdown('\n## 📝 **Example Workflow**\n\n');
		stream.markdown('1. `/agent set prd-creator` - Set the PRD Creator agent\n');
		stream.markdown('2. `/new "My Product PRD"` - Create a new document\n');
		stream.markdown('3. `Help me develop a PRD for my card game shop` - Continue conversation (no /chat needed!)\n\n');
		
		stream.markdown('**💬 Tip:** Once an agent is active, you can chat directly without using `/chat`!\n');

		const duration = getTelemetryManager().endPerformanceMetric('chat.request');
		return { metadata: { command: request.command, type: 'help', duration } };
	} catch (error) {
		const duration = performance.now() - startTime;
		
		// Enhanced error handling with automatic recovery
		const err = error instanceof Error ? error : new Error(String(error));
		const { ErrorHandler } = await import('./error/ErrorHandler.js');
		const errorHandler = ErrorHandler.getInstance();
		
		const errorContext = ErrorHandler.createContext('chat-request', {
			userInput: request.prompt.substring(0, 100),
			agentName: request.command || 'unknown'
		});
		
		// Attempt recovery for chat requests (they're often recoverable)
		const errorReport = await errorHandler.handleErrorWithRecovery(err, errorContext, 2);
		
		// Log error with enhanced context
		getLogger().extension.error('Chat request failed', err, {
			prompt: request.prompt.substring(0, 100),
			errorCategory: errorReport.severity,
			recoveryAttempted: errorReport.userMessage.includes('recovered')
		});
		getTelemetryManager().trackError(err, {
			operation: 'chat-request',
			prompt: request.prompt.substring(0, 100),
			errorSeverity: errorReport.severity
		});
		
		const errorHandlerForReport = getErrorHandler();
		const legacyErrorReport = errorHandlerForReport ? await (errorHandlerForReport as any).handleError(err, {
			operation: 'chat-request',
			userInput: request.prompt,
			timestamp: new Date()
		}) : null;

		// Use the enhanced error report for better user experience
		const displayErrorReport = errorReport || {
			userMessage: err.message,
			severity: 'medium' as const,
			recoveryOptions: [],
			technicalDetails: err.message
		};

		// Show user-friendly error message with severity-based formatting
		const errorIcon = displayErrorReport.severity === 'critical' ? '🚨' : 
						 displayErrorReport.severity === 'high' ? '⚠️' : 
						 displayErrorReport.severity === 'medium' ? '❌' : 'ℹ️';

		stream.markdown(`${errorIcon} **Error:** ${displayErrorReport.userMessage}`);
		
		// Show technical details only for high/critical errors or if recovery was attempted
		if (displayErrorReport.severity === 'high' || displayErrorReport.severity === 'critical' || 
			displayErrorReport.userMessage.includes('recovered')) {
			stream.markdown(`\n\n**Technical Details:** ${displayErrorReport.technicalDetails}`);
		}
		
		// Show recovery options if available
		if (displayErrorReport.recoveryOptions && displayErrorReport.recoveryOptions.length > 0) {
			stream.markdown('\n\n**What you can try:**\n');
			for (const option of displayErrorReport.recoveryOptions) {
				stream.markdown(`- ${option.description || option.label}\n`);
			}
		}
		
		// Add contextual help for common error scenarios
		if (err.message.toLowerCase().includes('network') || err.message.toLowerCase().includes('timeout')) {
			stream.markdown('\n\n💡 **Tip:** This appears to be a network-related issue. The system may have automatically attempted recovery.');
		} else if (err.message.toLowerCase().includes('agent') || err.message.toLowerCase().includes('model')) {
			stream.markdown('\n\n💡 **Tip:** Try setting a different agent with `/agent set <agent-name>` or check your AI service configuration.');
		}

		getTelemetryManager().endPerformanceMetric('chat.request');
		return { 
			metadata: { 
				command: request.command, 
				error: true, 
				severity: displayErrorReport.severity, 
				duration,
				recoveryAttempted: displayErrorReport.userMessage.includes('recovered'),
				canRetry: displayErrorReport.recoveryOptions?.some((opt: any) => opt.label?.toLowerCase().includes('retry')) || false
			} 
		};
	}
	
	} catch (error) {
		// Comprehensive error handling for chat requests
		const errorMsg = `Chat request failed: ${error instanceof Error ? error.message : String(error)}`;
		stream.markdown(`❌ **Error**: ${errorMsg}`);
		
		// Log the error
		getLogger().extension.error('Chat request error', error instanceof Error ? error : new Error(String(error)));
		
		// End telemetry tracking
		getTelemetryManager().endPerformanceMetric('chat.request');
		
		// Provide helpful recovery suggestions
		stream.markdown('\n**What you can try:**\n');
		stream.markdown('- Reload the VS Code window\n');
		stream.markdown('- Check if GitHub Copilot Chat extension is enabled\n');
		stream.markdown('- Try using `/help` to see available commands\n');
		
		return { errorDetails: { message: errorMsg } };
	}
}

export function deactivate() {
	if (stateManager) {
		getLogger()?.extension.info('Docu extension deactivation started');
		getTelemetryManager()?.trackEvent('extension.deactivating');
	}

	// Clean up managers through StateManager
	if (stateManager) {
		getConfigManager().dispose();
		getErrorHandler().clearHistory();
		getTelemetryManager().dispose();
		getDebugManager().dispose();
		getLogger().extension.info('Docu extension deactivated');
		getLogger().dispose();
		
		// Dispose StateManager itself
		stateManager.dispose();
	}
}

/**
 * Register custom command implementations
 */
function registerCustomCommands(): void {
	// Override the /new command with actual implementation
	const newCommand: CommandDefinition = {
		name: 'new',
		description: 'Create a new document',
		usage: '/new <title> [--template <template-id>] [--path <output-path>] [--with-placeholders]',
		examples: [
			'/new "My Product Requirements"',
			'/new "API Design" --template basic',
			'/new "User Guide" --template basic --path docs/user-guide.md',
			'/new "PRD Document" --template prd --with-placeholders'
		],
		flags: [
			{
				name: 'template',
				shortName: 't',
				description: 'Template to use for the document',
				type: 'string',
				defaultValue: 'basic'
			},
			{
				name: 'path',
				shortName: 'p',
				description: 'Output path for the document',
				type: 'string'
			},
			{
				name: 'with-placeholders',
				shortName: 'wp',
				description: 'Create document with placeholder values for missing required variables',
				type: 'boolean',
				defaultValue: false
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleNewCommand(parsedCommand, context);
		}
	};

	// Override the /templates command with actual implementation
	const templatesCommand: CommandDefinition = {
		name: 'templates',
		description: 'Manage document templates',
		usage: '/templates <subcommand> [options]',
		examples: [
			'/templates list',
			'/templates list --agent prd-creator',
			'/templates show basic'
		],
		subcommands: [
			{
				name: 'list',
				description: 'List available templates',
				usage: '/templates list [--agent <agent-name>] [--verbose]',
				examples: [
					'/templates list',
					'/templates list --agent prd-creator',
					'/templates list --verbose'
				],
				flags: [
					{
						name: 'agent',
						shortName: 'a',
						description: 'Filter templates by agent',
						type: 'string'
					},
					{
						name: 'verbose',
						shortName: 'v',
						description: 'Show detailed template information',
						type: 'boolean'
					}
				]
			},
			{
				name: 'show',
				description: 'Show details of a specific template',
				usage: '/templates show <template-id>',
				examples: [
					'/templates show basic',
					'/templates show prd'
				]
			},
			{
				name: 'open',
				description: 'Open a template file in the editor',
				usage: '/templates open <template-id> [--mode <edit|view>]',
				examples: [
					'/templates open basic',
					'/templates open prd --mode edit'
				],
				flags: [
					{
						name: 'mode',
						shortName: 'm',
						description: 'Open mode: edit or view',
						type: 'string',
						defaultValue: 'view'
					}
				]
			},
			{
				name: 'validate',
				description: 'Validate a template file',
				usage: '/templates validate <template-id>',
				examples: [
					'/templates validate basic',
					'/templates validate my-custom-template'
				]
			},
			{
				name: 'create',
				description: 'Create a new template file',
				usage: '/templates create <template-id> [--name <name>] [--description <desc>] [--interactive]',
				examples: [
					'/templates create my-template --interactive',
					'/templates create api-doc --name "API Documentation" --description "Template for API docs"'
				],
				flags: [
					{
						name: 'name',
						shortName: 'n',
						description: 'Display name for the template',
						type: 'string'
					},
					{
						name: 'description',
						shortName: 'd',
						description: 'Description of the template',
						type: 'string'
					},
					{
						name: 'interactive',
						shortName: 'i',
						description: 'Open interactive template creation wizard',
						type: 'boolean'
					}
				]
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleTemplatesCommand(parsedCommand, context);
		}
	};

	// Override the /update command with actual implementation
	const updateCommand: CommandDefinition = {
		name: 'update',
		description: 'Update an existing document',
		usage: '/update --file <path> --section <header> [--mode <mode>] <content>',
		examples: [
			'/update --file README.md --section "Installation" "Run npm install"',
			'/update --file docs/api.md --section "Authentication" --mode append "New auth method"'
		],
		flags: [
			{
				name: 'file',
				shortName: 'f',
				description: 'Path to the file to update',
				type: 'string',
				required: true
			},
			{
				name: 'section',
				shortName: 's',
				description: 'Section header to update',
				type: 'string',
				required: true
			},
			{
				name: 'mode',
				shortName: 'm',
				description: 'Update mode: replace, append, or prepend',
				type: 'string',
				defaultValue: 'replace'
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleUpdateCommand(parsedCommand, context);
		}
	};

	// Override the /review command with actual implementation
	const reviewCommand: CommandDefinition = {
		name: 'review',
		description: 'Review a document for quality and consistency',
		usage: '/review --file <path> [--level <level>] [--fix]',
		examples: [
			'/review --file README.md',
			'/review --file docs/api.md --level strict',
			'/review --file requirements.md --fix'
		],
		flags: [
			{
				name: 'file',
				shortName: 'f',
				description: 'Path to the file to review',
				type: 'string',
				required: true
			},
			{
				name: 'level',
				shortName: 'l',
				description: 'Review level: light, normal, or strict',
				type: 'string',
				defaultValue: 'normal'
			},
			{
				name: 'fix',
				description: 'Automatically apply suggested fixes',
				type: 'boolean'
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleReviewCommand(parsedCommand, context);
		}
	};

	// Override the /agent command with actual implementation
	const agentCommand: CommandDefinition = {
		name: 'agent',
		description: 'Manage AI agents',
		usage: '/agent <subcommand> [options]',
		examples: [
			'/agent list',
			'/agent set prd-creator',
			'/agent current'
		],
		subcommands: [
			{
				name: 'list',
				description: 'List available agents',
				usage: '/agent list',
				examples: ['/agent list']
			},
			{
				name: 'set',
				description: 'Set the active agent',
				usage: '/agent set <agent-name>',
				examples: ['/agent set prd-creator']
			},
			{
				name: 'current',
				description: 'Show the current active agent',
				usage: '/agent current',
				examples: ['/agent current']
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleAgentCommand(parsedCommand, context);
		}
	};

	// Override the /summarize command with actual implementation
	const summarizeCommand: CommandDefinition = {
		name: 'summarize',
		description: 'Generate summaries of multiple documents',
		usage: '/summarize --glob <pattern> [--output <path>]',
		examples: [
			'/summarize --glob "*.md"',
			'/summarize --glob "docs/**/*.md" --output summary.md',
			'/summarize --glob "requirements*.md"'
		],
		flags: [
			{
				name: 'glob',
				shortName: 'g',
				description: 'Glob pattern to match files',
				type: 'string',
				required: true
			},
			{
				name: 'output',
				shortName: 'o',
				description: 'Output file path for the summary',
				type: 'string',
				defaultValue: 'summary.md'
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleSummarizeCommand(parsedCommand, context);
		}
	};

	// Override the /catalog command with actual implementation
	const catalogCommand: CommandDefinition = {
		name: 'catalog',
		description: 'Generate a catalog/index of documents',
		usage: '/catalog [--glob <pattern>] [--output <path>]',
		examples: [
			'/catalog',
			'/catalog --glob "docs/**/*.md"',
			'/catalog --output index.md'
		],
		flags: [
			{
				name: 'glob',
				shortName: 'g',
				description: 'Glob pattern to match files (default: **/*.md)',
				type: 'string',
				defaultValue: '**/*.md'
			},
			{
				name: 'output',
				shortName: 'o',
				description: 'Output file path for the catalog',
				type: 'string',
				defaultValue: 'index.md'
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleCatalogCommand(parsedCommand, context);
		}
	};

	// Add the /chat command for agent conversations
	const chatCommand: CommandDefinition = {
		name: 'chat',
		description: 'Start a conversation with the current agent',
		usage: '/chat <message>',
		examples: [
			'/chat Help me develop a PRD for my product',
			'/chat What are the key requirements for an e-commerce platform?',
			'/chat Review my document structure and suggest improvements'
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleChatCommand(parsedCommand, context);
		}
	};

	// Add diagnostic command for conversation state
	const diagnosticCommand: CommandDefinition = {
		name: 'diagnostic',
		description: 'Show diagnostic information about conversation state',
		usage: '/diagnostic [--conversation] [--agents] [--all]',
		examples: [
			'/diagnostic',
			'/diagnostic --conversation',
			'/diagnostic --agents',
			'/diagnostic --all'
		],
		flags: [
			{
				name: 'conversation',
				shortName: 'c',
				description: 'Show conversation session information',
				type: 'boolean'
			},
			{
				name: 'agents',
				shortName: 'a',
				description: 'Show agent information',
				type: 'boolean'
			},
			{
				name: 'all',
				description: 'Show all diagnostic information',
				type: 'boolean'
			}
		],
		handler: async (parsedCommand: ParsedCommand, context: CommandContext) => {
			return await handleDiagnosticCommand(parsedCommand, context);
		}
	};

	getCommandRouter().registerCommand(newCommand);
	getCommandRouter().registerCommand(templatesCommand);
	getCommandRouter().registerCommand(updateCommand);
	getCommandRouter().registerCommand(reviewCommand);
	getCommandRouter().registerCommand(agentCommand);
	getCommandRouter().registerCommand(summarizeCommand);
	getCommandRouter().registerCommand(catalogCommand);
	getCommandRouter().registerCommand(chatCommand);
	getCommandRouter().registerCommand(diagnosticCommand);
}




/**
	try {
		const key = `offline_document_${sessionId}`;
		await globalExtensionContext.globalState.update(key, documentPath);
	} catch (error) {
		logger.extension.warn('Failed to store document path for session', { error });
	}
}



// Legacy function removed - agent configuration now handled by AgentManager

// Legacy function removed - conversation flow now handled by ConversationSessionRouter

// Legacy function removed - conversation flow now handled by ConversationSessionRouter

// Legacy function removed - offline conversation flow now handled by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - offline handling now done by OfflineManager

// Legacy function removed - document generation now handled by ConversationManager

// Legacy function removed - offline document generation now handled by OfflineManager

// Legacy function removed - offline document handling now done by OfflineManager

// Legacy function removed - context extraction now handled by ConversationManager

// Legacy function removed - context prompts now handled by agents
	const responses = (gatheredContext.responses as string[]) || [];
	
	if (phase === 'prd') {
		return `Generate a comprehensive PRD based on this context:
Problem: ${responses[0] || 'Not specified'}
Target Users: ${responses[1] || 'Not specified'}
Solution: ${responses[2] || 'Not specified'}
Success Metrics: ${responses[3] || 'Not specified'}
Constraints: ${responses[4] || 'Not specified'}

Please create detailed sections for Executive Summary, Product Objectives, User Personas, Scope and Constraints, and Acceptance Criteria.`;
	}
	
	if (phase === 'requirements') {
		return `Generate detailed requirements based on this context:
// Legacy function body removed

// Legacy function removed - document updates now handled by ConversationManager



/**
 * Handle the /new command
 */
async function handleNewCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	const startTime = performance.now();
	getLogger().command.info('Handling /new command', { title: parsedCommand.arguments[0] });
	getTelemetryManager().startPerformanceMetric('command.new');

	try {
		getLogger().command.info('New command started', { arguments: parsedCommand.arguments, flags: parsedCommand.flags });
		
		// Get the title from arguments
		const title = parsedCommand.arguments[0];
		if (!title) {
			const error = 'Document title is required';
			getLogger().command.warn('New command failed: missing title');
			getTelemetryManager().trackCommand('new', false, performance.now() - startTime, error);
			context.stream.markdown('❌ **Error:** Document title is required\n\n**Usage:** `/new <title> [--template <template-id>] [--path <output-path>]`');
			return { success: false, error };
		}

		// Get template ID from flags
		const templateId = (parsedCommand.flags.template as string) || (parsedCommand.flags.t as string) || 'basic';
		
		// Get output path from flags or generate one
		let outputPath = (parsedCommand.flags.path as string) || (parsedCommand.flags.p as string);
		if (!outputPath) {
			// Generate a filename from the title
			const filename = title.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, '')
				.replace(/\s+/g, '-')
				.replace(/-+/g, '-')
				.trim();
			outputPath = `${filename}.md`;
		}

		// Handle path that includes directories - ensure it ends with .md if it's not a full filename
		if (!outputPath.endsWith('.md') && !outputPath.includes('.')) {
			// If path doesn't have an extension and doesn't end with .md, treat it as a directory
			const filename = title.toLowerCase()
				.replace(/[^a-z0-9\s-]/g, '')
				.replace(/\s+/g, '-')
				.replace(/-+/g, '-')
				.trim();
			outputPath = path.join(outputPath, `${filename}.md`);
		}

		// Ensure the path is absolute within the workspace
		if (!path.isAbsolute(outputPath)) {
			outputPath = path.join(context.workspaceRoot, outputPath);
		}

		context.stream.markdown(`📝 Creating document: **${title}**\n`);
		context.stream.markdown(`📄 Template: **${templateId}**\n`);
		context.stream.markdown(`📁 Path: **${path.relative(context.workspaceRoot, outputPath)}**\n\n`);

		// Prepare template variables
		const variables: Record<string, any> = {
			title: title,
			author: vscode.workspace.getConfiguration('git').get('user.name') || 'Unknown'
		};

		// Check if --with-placeholders flag is set
		const withPlaceholders = Boolean(parsedCommand.flags['with-placeholders'] || parsedCommand.flags['wp']);
		
		if (withPlaceholders) {
			// Get the template to add placeholder values for required variables
			const template = await getTemplateService().getTemplate(templateId);
			if (template) {
				// Add placeholder values for required variables that are missing
				for (const variable of template.variables) {
					if (variable.required && !(variable.name in variables)) {
						// Provide sensible placeholders based on variable name and type
						if (variable.name.includes('Summary') || variable.name.includes('summary')) {
							variables[variable.name] = `[TODO: Add ${variable.description || variable.name}]`;
						} else if (variable.name.includes('Goal') || variable.name.includes('goal')) {
							variables[variable.name] = `[TODO: Define ${variable.description || variable.name}]`;
						} else if (variable.name.includes('Criteria') || variable.name.includes('criteria')) {
							variables[variable.name] = `[TODO: Specify ${variable.description || variable.name}]`;
						} else if (variable.name.includes('Persona') || variable.name.includes('persona')) {
							if (variable.name.includes('Role') || variable.name.includes('role')) {
								variables[variable.name] = '[TODO: Define user role]';
							} else if (variable.name.includes('Goals') || variable.name.includes('goals')) {
								variables[variable.name] = '[TODO: List user goals]';
							} else if (variable.name.includes('Pain') || variable.name.includes('pain')) {
								variables[variable.name] = '[TODO: Identify pain points]';
							} else {
								variables[variable.name] = '[TODO: Define user persona]';
							}
						} else if (variable.name.includes('Scope') || variable.name.includes('scope')) {
							variables[variable.name] = `[TODO: Define ${variable.name.includes('out') ? 'out of scope' : 'in scope'} items]`;
						} else if (variable.name.includes('Constraint') || variable.name.includes('constraint')) {
							variables[variable.name] = '[TODO: List constraints]';
						} else if (variable.name.includes('executiveSummary')) {
							variables[variable.name] = '[TODO: Brief overview of the product, its purpose, and key value proposition]';
						} else if (variable.name.includes('Goal') || variable.name.includes('goal')) {
							variables[variable.name] = '[TODO: Define primary goal]';
						} else if (variable.name.includes('successCriteria') || variable.name.includes('Criteria')) {
							variables[variable.name] = '[TODO: Define success criteria]';
						} else if (variable.name.includes('acceptanceCriteria')) {
							variables[variable.name] = '[TODO: Define acceptance criteria]';
						} else {
							// Generic placeholder
							variables[variable.name] = `[TODO: ${variable.description || `Add ${variable.name}`}]`;
						}
					}
				}
				context.stream.markdown(`🔧 Using placeholders for missing variables\n`);
			}
		}

		// Apply the template
		const toolContext = {
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext,
			cancellationToken: context.token
		};

		getLogger().command.info('Executing applyTemplate tool', { templateId, outputPath, variables });
		
		const result = await getToolManager().executeTool('applyTemplate', {
			templateId: templateId,
			variables: JSON.stringify(variables),
			outputPath: outputPath
		}, toolContext);
		
		getLogger().command.info('ApplyTemplate tool result', { success: result.success, error: result.error });

		if (result.success) {
			context.stream.markdown('✅ **Document created successfully!**\n\n');
			
			// Create clickable link to open the file and use openInEditor tool
			const relativePath = path.relative(context.workspaceRoot, outputPath);
			const fileUri = vscode.Uri.file(outputPath);
			context.stream.markdown(`📖 [Open ${relativePath}](${fileUri.toString()})\n\n`);
			
			// Also open the file automatically if autoSaveDocuments is enabled
			const config = getConfigManager().getConfiguration();
			if (config && config.autoSaveDocuments) {
				const openResult = await getToolManager().executeTool('openInEditor', {
					path: relativePath,
					preview: false,
					viewColumn: 1
				}, toolContext);
				
				if (openResult.success) {
				context.stream.markdown('✨ *File opened in editor*\n\n');
			}
		}
			
			// Show some details about what was created
			if (result.data) {
				context.stream.markdown(`**Details:**\n`);
				context.stream.markdown(`- Template used: ${result.data.templateId}\n`);
				context.stream.markdown(`- File size: ${result.data.bytesWritten} bytes\n`);
				
				if (result.data.frontMatter && Object.keys(result.data.frontMatter).length > 0) {
					context.stream.markdown(`- Front matter: ${Object.keys(result.data.frontMatter).join(', ')}\n`);
				}
			}

			const duration = getTelemetryManager().endPerformanceMetric('command.new');
			getLogger().command.info('New command completed successfully', { title, templateId, duration });
			getTelemetryManager().trackCommand('new', true, duration);
			getTelemetryManager().trackTemplateUsage(templateId, 'create', true);
			
			// Prepare conversation configuration for continuation using consolidated manager
			const conversationManager = getConversationManager();
			const shouldContinue = conversationManager ? (conversationManager as any).shouldContinueWithConversation('new', parsedCommand.flags, templateId) : false;
			let conversationConfig = null;
			
			if (shouldContinue && conversationManager) {
				conversationConfig = (conversationManager as any).getConversationConfig('new', templateId);
				if (conversationConfig) {
					// Fill in the specific values
					conversationConfig.documentPath = outputPath;
					conversationConfig.title = title;
					conversationConfig.conversationContext.documentPath = outputPath;
					conversationConfig.conversationContext.title = title;
					conversationConfig.conversationContext.workspaceRoot = context.workspaceRoot;
					conversationConfig.conversationContext.extensionContext = context.extensionContext;
				}
		}
			
			// Show tips if not starting conversation automatically
			if (!shouldContinue) {
				const tipProvider = CommandTipProvider.getInstance();
				const tips = tipProvider.getTipsForCommand('new', templateId, parsedCommand.flags);
				const outputCoordinator = OutputCoordinator.getInstance();
				outputCoordinator.addTips('new-command-tips', tips);
			}

			return { 
				success: true, 
				data: { path: outputPath, templateId },
				shouldContinueConversation: shouldContinue,
				conversationConfig: conversationConfig,
				agentName: conversationConfig?.agentName,
				documentPath: outputPath
			};
		} else {
			const duration = performance.now() - startTime;
			getLogger().command.error('New command failed', undefined, { title, templateId, error: result.error });
			getTelemetryManager().trackCommand('new', false, duration, result.error);
			
			// Enhanced error handling for different error types
			if (result.metadata?.workspaceRequired || result.error?.includes('workspace')) {
				context.stream.markdown(`❌ **Error creating document:** ${result.error}\n\n`);
				context.stream.markdown('**What to do:**\n');
				context.stream.markdown('1. Open a folder or workspace in VS Code\n');
				context.stream.markdown('2. Use File → Open Folder to select a project directory\n');
				context.stream.markdown('3. Try the `/new` command again once a workspace is open\n\n');
				context.stream.markdown('**Alternative options:**\n');
				context.stream.markdown('- Create a new folder on your computer and open it in VS Code\n');
				context.stream.markdown('- Use File → Open Recent to select a previously used workspace\n\n');
				context.stream.markdown('💡 *For more help, try: `/help workspace`*\n');
			} else if (result.metadata?.templateError && result.metadata?.missingVariables) {
				context.stream.markdown(`❌ **Error creating document:** ${result.error}\n\n`);
				
				if (templateId === 'prd') {
					context.stream.markdown('**The PRD template requires specific variables. Here are your options:**\n\n');
					context.stream.markdown(`**Option 1 (Recommended):** Use placeholders that will be filled during conversation:\n`);
					context.stream.markdown(`\`/new "${title}" --template prd --with-placeholders --path ${parsedCommand.flags.path || ''}\`\n\n`);
					context.stream.markdown(`**Option 2:** Use the basic template and build structure through conversation:\n`);
					context.stream.markdown(`\`/new "${title}" --template basic --path ${parsedCommand.flags.path || ''}\`\n\n`);
					context.stream.markdown('💡 *Both options work great with the PRD Creator agent for guided document creation*\n\n');
				} else {
					context.stream.markdown('**What to do:**\n');
					context.stream.markdown(`1. Use the basic template instead: \`/new "${title}" --template basic --path ${parsedCommand.flags.path || ''}\`\n`);
					context.stream.markdown(`2. Check template requirements: \`/templates show ${templateId}\`\n`);
					context.stream.markdown(`3. Create with placeholders: \`/new "${title}" --template ${templateId} --with-placeholders --path ${parsedCommand.flags.path || ''}\`\n\n`);
					context.stream.markdown('💡 *Tip: The basic template works great with all agents and doesn\'t require specific variables*\n\n');
				}
				
				context.stream.markdown('**Missing variables:**\n');
				for (const variable of result.metadata.missingVariables) {
					context.stream.markdown(`- \`${variable}\`\n`);
				}
			} else {
				context.stream.markdown(`❌ **Error creating document:** ${result.error}`);
			}
			return { success: false, error: result.error };
		}

	} catch (error) {
		const duration = performance.now() - startTime;
		const err = error instanceof Error ? error : new Error(String(error));
		
		// Enhanced error handling with recovery
		const { ErrorHandler } = await import('./error/ErrorHandler.js');
		const errorHandler = ErrorHandler.getInstance();
		const errorContext = ErrorHandler.createContext('new-command', {
			userInput: parsedCommand.arguments[0],
			filePath: parsedCommand.flags.path as string
		});
		
		const errorReport = await errorHandler.handleErrorWithRecovery(err, errorContext, 1);
		
		// Log with enhanced context
		getLogger().command.error('New command exception', err, {
			title: parsedCommand.arguments[0],
			errorSeverity: errorReport.severity,
			recoveryAttempted: errorReport.userMessage.includes('recovered')
		});
		getTelemetryManager().trackCommand('new', false, duration, errorReport.userMessage);
		getTelemetryManager().trackError(err, { 
			command: 'new',
			errorSeverity: errorReport.severity
		});
		
		// Show user-friendly error with recovery options
		const errorIcon = errorReport.severity === 'critical' ? '🚨' : 
						 errorReport.severity === 'high' ? '⚠️' : '❌';
		
		context.stream.markdown(`${errorIcon} **Error:** ${errorReport.userMessage}`);
		
		// Show recovery options if available
		if (errorReport.recoveryOptions && errorReport.recoveryOptions.length > 0) {
			context.stream.markdown('\n\n**What you can try:**\n');
			for (const option of errorReport.recoveryOptions) {
				context.stream.markdown(`- ${option.description || option.label}\n`);
			}
		}
		
		// Add specific guidance for new command errors
		if (err.message.toLowerCase().includes('workspace')) {
			context.stream.markdown('\n\n💡 **Tip:** Open a folder in VS Code first, then try creating the document again.');
		} else if (err.message.toLowerCase().includes('template')) {
			context.stream.markdown('\n\n💡 **Tip:** Try using the basic template: `/new "Your Title" --template basic`');
		}
		
		return { 
			success: false, 
			error: errorReport.userMessage,
			metadata: {
				errorSeverity: errorReport.severity,
				recoveryAttempted: errorReport.userMessage.includes('recovered'),
				canRetry: errorReport.recoveryOptions?.some((opt: any) => opt.label?.toLowerCase().includes('retry')) || false
			}
		};
	}
}



/**
 * Handle the /templates command
 */
async function handleTemplatesCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const subcommand = parsedCommand.subcommand || 'list';

		if (subcommand === 'list') {
			const agentFilter = (parsedCommand.flags.agent as string) || (parsedCommand.flags.a as string);
			const verbose = parsedCommand.flags.verbose || parsedCommand.flags.v;

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const toolManagerForList = getToolManager();
			if (!toolManagerForList) {
				context.stream.markdown('❌ **Error:** Tool manager not available');
				return { success: false, error: 'Tool manager not available' };
			}
			const result = await (toolManagerForList as any).executeTool('listTemplates', {
				agentName: agentFilter,
				includeVariables: verbose
			}, toolContext);

			if (result.success && result.data) {
				context.stream.markdown('## 📋 Available Templates\n\n');
				
				// Show workspace status
				if (result.data.hasWorkspace) {
					context.stream.markdown(`📁 **Workspace:** Available (${result.data.builtInCount} built-in, ${result.data.userCount} user templates)\n\n`);
				} else {
					context.stream.markdown(`📁 **Workspace:** Not available (showing ${result.data.builtInCount} built-in templates only)\n\n`);
					if (result.data.userCount === 0) {
						context.stream.markdown('💡 *Open a folder or workspace to access user-defined templates*\n\n');
					}
				}
				
				if (agentFilter) {
					context.stream.markdown(`*Filtered by agent: **${agentFilter}***\n\n`);
				}

				for (const template of result.data.templates) {
					context.stream.markdown(`### 📄 ${template.name} \`(${template.id})\`\n`);
					context.stream.markdown(`${template.description}\n\n`);
					context.stream.markdown(`**Built-in:** ${template.builtIn ? '✅ Yes' : '❌ No'}\n\n`);
					
					if (verbose && template.variables && template.variables.length > 0) {
						context.stream.markdown('**Variables:**\n');
						for (const variable of template.variables) {
							const required = variable.required ? ' *(required)*' : ' *(optional)*';
							const defaultValue = variable.defaultValue ? ` [default: \`${variable.defaultValue}\`]` : '';
							context.stream.markdown(`- **${variable.name}** (\`${variable.type}\`)${required}: ${variable.description}${defaultValue}\n`);
						}
						context.stream.markdown('\n');
					}
				}
				
				context.stream.markdown(`\n📊 **Total templates:** ${result.data.count}\n`);
				
				if (!verbose) {
				context.stream.markdown('\n💡 *Use `--verbose` flag to see template variables*\n');
			}
			} else {
				context.stream.markdown(`❌ **Error listing templates:** ${result.error || 'Unknown error'}`);
				return { 
					success: false, 
					error: result.error,
					shouldContinueConversation: false
				};
			}

		} else if (subcommand === 'show') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates show <template-id>`');
				return { 
					success: false, 
					error: 'Template ID is required',
					shouldContinueConversation: false
				};
			}

			// Get template details
			const templateService = getTemplateService();
			if (!templateService) {
				context.stream.markdown('❌ **Error:** Template service not available');
				return { success: false, error: 'Template service not available', shouldContinueConversation: false };
			}
			const template = await (templateService as any).getTemplate(templateId);
			if (!template) {
				context.stream.markdown(`❌ **Error:** Template '${templateId}' not found`);
				return {
					success: false,
					error: 'Template not found',
					shouldContinueConversation: false
				};
			}

			context.stream.markdown(`## 📄 Template: ${template.name}\n\n`);
			context.stream.markdown(`**ID:** \`${template.id}\`\n`);
			context.stream.markdown(`**Description:** ${template.description}\n`);
			context.stream.markdown(`**Built-in:** ${getTemplateService().listTemplates().find((t: any) => t.id === templateId) ? '✅ Yes' : '❌ No'}\n\n`);

			if (template.variables.length > 0) {
				context.stream.markdown('### Variables\n\n');
				for (const variable of template.variables) {
					const required = variable.required ? ' *(required)*' : ' *(optional)*';
					const defaultValue = variable.defaultValue ? ` [default: \`${variable.defaultValue}\`]` : '';
					context.stream.markdown(`- **${variable.name}** (\`${variable.type}\`)${required}: ${variable.description}${defaultValue}\n`);
				}
				context.stream.markdown('\n');
			}

			if (template.agentRestrictions && template.agentRestrictions.length > 0) {
				context.stream.markdown(`**Agent restrictions:** ${template.agentRestrictions.join(', ')}\n\n`);
			}

			// Show a preview of the template content (first few lines)
			const lines = template.content.split('\n');
			const preview = lines.slice(0, 10).join('\n');
			context.stream.markdown('### Preview\n\n```markdown\n' + preview);
			if (lines.length > 10) {
				context.stream.markdown('\n... (truncated)');
			}
			context.stream.markdown('\n```\n');

		} else if (subcommand === 'open') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** \`/templates open <template-id> [--mode <edit|view>]\`');
				return {
					success: false,
					error: 'Template ID is required',
					shouldContinueConversation: false
				};
			}

		} else if (subcommand === 'open') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** \`/templates open <template-id> [--mode <edit|view>]\`');
				return { 
					success: false, 
					error: 'Template ID is required',
					shouldContinueConversation: false
				};
			}

			const mode = (parsedCommand.flags.mode as string) || (parsedCommand.flags.m as string) || 'view';

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const toolManagerForOpen = getToolManager();
			const result = toolManagerForOpen ? await (toolManagerForOpen as any).executeTool('openTemplate', {
				templateId: templateId,
				mode: mode
			}, toolContext) : { success: false, error: 'Tool manager not available' };

			if (result.success) {
				context.stream.markdown(`✅ **Template opened successfully!**\n\n`);
				context.stream.markdown(`**Template:** ${templateId}\n`);
				context.stream.markdown(`**Mode:** ${mode}\n`);
				
				if (result.data) {
					context.stream.markdown(`**Type:** ${result.data.isBuiltIn ? 'Built-in' : 'User-defined'}\n`);
					if (result.data.filePath) {
						context.stream.markdown(`**File:** ${result.data.filePath}\n`);
					}
					context.stream.markdown(`\n${result.data.message}\n`);
				}
			} else {
				context.stream.markdown(`❌ **Error opening template:** ${result.error}`);
				return { 
					success: false, 
					error: result.error,
					shouldContinueConversation: false
				};
			}

		} else if (subcommand === 'validate') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates validate <template-id>`');
				return {
					success: false,
					error: 'Template ID is required',
					shouldContinueConversation: false
				};
			}

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const toolManagerForValidate = getToolManager();
			const result = toolManagerForValidate ? await (toolManagerForValidate as any).executeTool('validateTemplate', {
				templateId: templateId
			}, toolContext) : { success: false, error: 'Tool manager not available' };

			if (result.success && result.data) {
				const { valid, issues, summary } = result.data;
				
				context.stream.markdown(`## 🔍 Template Validation: ${templateId}\n\n`);
				
				if (valid) {
						context.stream.markdown('✅ **Template is valid!**\n\n');
					} else {
						context.stream.markdown('❌ **Template has validation errors**\n\n');
					}

				context.stream.markdown(`**Summary:**\n`);
				context.stream.markdown(`- Errors: ${summary.errors}\n`);
				context.stream.markdown(`- Warnings: ${summary.warnings}\n`);
				context.stream.markdown(`- Info: ${summary.info}\n\n`);

				if (issues.length > 0) {
					context.stream.markdown('**Issues Found:**\n\n');
					
					for (const issue of issues) {
						const icon = issue.type === 'error' ? '❌' : issue.type === 'warning' ? '⚠️' : 'ℹ️';
						context.stream.markdown(`${icon} **${issue.type.toUpperCase()}:** ${issue.message}\n`);
						
						if (issue.line) {
							context.stream.markdown(`   *Line ${issue.line}*\n`);
						}
						
						if (issue.suggestion) {
							context.stream.markdown(`   💡 *Suggestion: ${issue.suggestion}*\n`);
						}
						
						context.stream.markdown('\n');
					}
				}
			} else {
				context.stream.markdown(`❌ **Error validating template:** ${result.error}`);
				return { 
					success: false, 
					error: result.error,
					shouldContinueConversation: false
				};
			}

		} else if (subcommand === 'create') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates create <template-id> [--name <name>] [--description <desc>] [--interactive]`');
				return {
					success: false,
					error: 'Template ID is required',
					shouldContinueConversation: false
				};
			}

			const name = (parsedCommand.flags.name as string) || (parsedCommand.flags.n as string);
			const description = (parsedCommand.flags.description as string) || (parsedCommand.flags.d as string);
			const interactive = parsedCommand.flags.interactive || parsedCommand.flags.i || false;

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const toolManagerForCreate = getToolManager();
			const result = toolManagerForCreate ? await (toolManagerForCreate as any).executeTool('createTemplate', {
				id: templateId,
				name: name,
				description: description,
				interactive: interactive
			}, toolContext) : { success: false, error: 'Tool manager not available' };

			if (result.success && result.data) {
				context.stream.markdown(`✅ **Template created successfully!**\n\n`);
				context.stream.markdown(`**Template ID:** ${result.data.templateId}\n`);
				context.stream.markdown(`**File:** ${result.data.relativePath}\n`);
				
				if (result.data.interactive) {
						context.stream.markdown(`**Mode:** Interactive (opened for editing)\n`);
						context.stream.markdown(`\n📝 *Template file opened in editor. Customize it to your needs!*\n`);
					} else {
						context.stream.markdown(`**Variables:** ${result.data.variableCount}\n`);
						context.stream.markdown(`**Agent Restrictions:** ${result.data.hasAgentRestrictions ? 'Yes' : 'None'}\n`);
					}

				// Reload templates to make the new template available
				await getTemplateService().reloadTemplates();
				context.stream.markdown(`\n🔄 *Templates reloaded - new template is now available*\n`);
		} else {
				context.stream.markdown(`❌ **Error creating template:** ${result.error}`);
				return { 
					success: false, 
					error: result.error,
					shouldContinueConversation: false
				};
			}

		} else {
			context.stream.markdown(`❌ **Error:** Unknown subcommand '${subcommand}'\n\n**Available subcommands:** list, show, open, validate, create`);
			return {
				success: false,
				error: 'Unknown subcommand',
				shouldContinueConversation: false
			};
		}

		return {
			success: true,
			shouldContinueConversation: false
		};

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return {
			success: false,
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}

/**
*
 * Handle the /update command
 */
async function handleUpdateCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		// Get required parameters
		const filePath = (parsedCommand.flags.file as string) || (parsedCommand.flags.f as string);
		const sectionHeader = (parsedCommand.flags.section as string) || (parsedCommand.flags.s as string);
		const mode = (parsedCommand.flags.mode as string) || (parsedCommand.flags.m as string) || 'replace';
		const content = parsedCommand.arguments.join(' ');

		if (!filePath) {
			context.stream.markdown('❌ **Error:** File path is required\n\n**Usage:** `/update --file <path> --section <header> [--mode <mode>] <content>`');
			return { success: false, error: 'File path is required' };
		}

		if (!sectionHeader) {
			context.stream.markdown('❌ **Error:** Section header is required\n\n**Usage:** `/update --file <path> --section <header> [--mode <mode>] <content>`');
			return { success: false, error: 'Section header is required' };
		}

		if (!content) {
			context.stream.markdown('❌ **Error:** Content is required\n\n**Usage:** `/update --file <path> --section <header> [--mode <mode>] <content>`');
			return { success: false, error: 'Content is required' };
		}

		// Validate mode
		const validModes = ['replace', 'append', 'prepend'];
		if (!validModes.includes(mode)) {
			context.stream.markdown(`❌ **Error:** Invalid mode '${mode}'. Valid modes are: ${validModes.join(', ')}`);
			return { success: false, error: 'Invalid mode' };
		}

		context.stream.markdown(`📝 Updating document: **${filePath}**\n`);
		context.stream.markdown(`📍 Section: **${sectionHeader}**\n`);
		context.stream.markdown(`🔄 Mode: **${mode}**\n\n`);

		// Prepare tool context
		const toolContext = {
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext,
			cancellationToken: context.token
		};

		// Execute the insertSection tool
		const result = await getToolManager().executeTool('insertSection', {
			path: filePath,
			header: sectionHeader,
			mode: mode,
			content: content
		}, toolContext);

		if (result.success) {
			context.stream.markdown('✅ **Document updated successfully!**\n\n');
			
			// Show the diff if available
			if (result.data && result.data.diff) {
				context.stream.markdown('**Changes made:**\n\n```diff\n' + result.data.diff + '\n```\n\n');
			}

			// Create clickable link to open the file
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolder.uri.fsPath, filePath);
				const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath);
				const fileUri = vscode.Uri.file(fullPath);
				context.stream.markdown(`📖 [Open ${relativePath}](${fileUri.toString()})\n\n`);
				
				// Also open the file automatically if autoSaveDocuments is enabled
				const config = getConfigManager().getConfiguration();
				if (config.autoSaveDocuments) {
					const openResult = await getToolManager().executeTool('openInEditor', {
						path: relativePath,
						preview: false,
						viewColumn: 1
					}, toolContext);
					
					if (openResult.success) {
						context.stream.markdown('✨ *File opened in editor*\n\n');
					}
				}
			}

			// Show summary
			context.stream.markdown(`**Summary:**\n`);
			context.stream.markdown(`- File: ${filePath}\n`);
			context.stream.markdown(`- Section: ${sectionHeader}\n`);
			context.stream.markdown(`- Mode: ${mode}\n`);
			context.stream.markdown(`- Changed: ${result.data?.changed ? '✅ Yes' : '❌ No'}\n`);

			// Check if conversation continuation is requested using consolidated manager
			const conversationManagerForContinue = getConversationManager();
			const shouldContinue = conversationManagerForContinue ? (conversationManagerForContinue as any).shouldContinueWithConversation('update', parsedCommand.flags) : false;
			let conversationConfig = null;
			
			if (shouldContinue) {
				conversationConfig = conversationManagerForContinue ? (conversationManagerForContinue as any).getConversationConfig('update') : null;
				if (conversationConfig) {
					conversationConfig.documentPath = filePath;
					conversationConfig.title = `Review of ${path.basename(filePath)}`;
					conversationConfig.conversationContext.documentPath = filePath;
					conversationConfig.conversationContext.title = conversationConfig.title;
					conversationConfig.conversationContext.workspaceRoot = context.workspaceRoot;
					conversationConfig.conversationContext.extensionContext = context.extensionContext;
				}
			}

			return { 
				success: true, 
				data: { path: filePath, section: sectionHeader, mode, changed: result.data?.changed },
				shouldContinueConversation: shouldContinue,
				conversationConfig: conversationConfig,
				agentName: conversationConfig?.agentName,
				documentPath: filePath
			};
		} else {
			context.stream.markdown(`❌ **Error updating document:** ${result.error}`);
			
			// Provide helpful suggestions based on common errors
			if (result.error?.includes('File not found')) {
				context.stream.markdown('\n💡 **Suggestions:**\n');
				context.stream.markdown('- Check if the file path is correct\n');
				context.stream.markdown('- Use `/new` command to create the file first\n');
				context.stream.markdown('- Make sure the file is in your workspace\n');
			}

			return { success: false, error: result.error };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
	}
}
/**

 * Handle the /review command
 */
async function handleReviewCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		// Get required parameters
		const filePath = (parsedCommand.flags.file as string) || (parsedCommand.flags.f as string);
		const level = (parsedCommand.flags.level as string) || (parsedCommand.flags.l as string) || 'normal';
		const autoFix = parsedCommand.flags.fix || false;

		if (!filePath) {
			context.stream.markdown('❌ **Error:** File path is required\n\n**Usage:** `/review --file <path> [--level <level>] [--fix]`');
			return { 
				success: false, 
				error: 'File path is required',
				shouldContinueConversation: false
			};
		}

		// Validate review level
		const validLevels = ['light', 'normal', 'strict'];
		if (!validLevels.includes(level)) {
			context.stream.markdown(`❌ **Error:** Invalid review level '${level}'. Valid levels are: ${validLevels.join(', ')}`);
			return { 
				success: false, 
				error: 'Invalid review level',
				shouldContinueConversation: false
			};
		}

		context.stream.markdown(`🔍 Reviewing document: **${filePath}**\n`);
		context.stream.markdown(`📊 Review level: **${level}**\n`);
		context.stream.markdown(`🔧 Auto-fix: **${autoFix ? 'Enabled' : 'Disabled'}**\n\n`);

		// Create a mock quality reviewer agent request
		const reviewPrompt = `/review --file ${filePath} --level ${level}${autoFix ? ' --fix' : ''}`;
		
		// Import the QualityReviewerAgent
		const { QualityReviewerAgent } = await import('./agents/QualityReviewerAgent.js');
		const qualityReviewer = new QualityReviewerAgent(
			'quality-reviewer',
			'You are a quality reviewer focused on document validation and improvement suggestions.',
			['readFile', 'writeFile', 'listFiles', 'applyTemplate', 'insertSection'],
			'implementation'
		);

		// Create agent context
		const agentContext = {
			workspaceRoot: context.workspaceRoot,
			previousOutputs: [],
			userPreferences: {
				defaultDirectory: 'docs',
				defaultAgent: 'quality-reviewer',
				templateDirectory: undefined
			},
			workflowState: {
				projectId: 'current',
				currentPhase: 'implementation' as const,
				activeAgent: 'quality-reviewer',
				documents: {},
				context: {},
				history: []
			},
			extensionContext: context.extensionContext,
			toolManager: getToolManager(),
			toolContext: {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			}
		};

		// Execute the review
		const result = await qualityReviewer.handleRequest(
			{ prompt: reviewPrompt, command: undefined, parameters: {}, originalRequest: context.request },
			agentContext
		);

		if (result.success) {
			context.stream.markdown(result.message || '');
			
			// Create clickable link to open the file
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceFolder.uri.fsPath, filePath);
				const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath);
				const fileUri = vscode.Uri.file(fullPath);
				context.stream.markdown(`\n📖 [Open ${relativePath}](${fileUri.toString()})\n`);
				
				// Open the file in preview mode for review
				const openResult = await getToolManager().executeTool('openInEditor', {
					path: relativePath,
					preview: true,
					viewColumn: 2
				}, agentContext);
				
				if (openResult.success) {
					context.stream.markdown('✨ *File opened in preview mode for review*\n');
				}
			}

			// Check if there are issues that might need follow-up
			const issuesFound = result.data?.issuesFound || 0;
			const shouldContinue = issuesFound > 0 && !autoFix;
			
			if (shouldContinue) {
				context.stream.markdown('\n💬 **Would you like me to help fix any of these issues or provide more detailed explanations?**\n');
			}

			return { 
				success: true, 
				data: { 
					path: filePath, 
					level, 
					autoFix,
					issuesFound: result.data?.issuesFound || 0,
					fixesApplied: result.data?.fixesApplied || 0
				},
				shouldContinueConversation: shouldContinue,
				conversationContext: {
					command: 'review',
					filePath,
					level,
					autoFix,
					issuesFound,
					agent: 'quality-reviewer'
				}
			};
		} else {
			context.stream.markdown(`❌ **Error during review:** ${result.message}`);
			
			// Provide helpful suggestions based on common errors
			if (result.message?.includes('Could not read file')) {
				context.stream.markdown('\n💡 **Suggestions:**\n');
				context.stream.markdown('- Check if the file path is correct\n');
				context.stream.markdown('- Make sure the file exists in your workspace\n');
				context.stream.markdown('- Verify you have read permissions for the file\n');
			}

			return { 
				success: false, 
				error: result.message,
				shouldContinueConversation: false
			};
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { 
			success: false, 
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}/*
*
 * Handle the /agent command
 */
async function handleAgentCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const subcommand = parsedCommand.subcommand || 'list';

		if (subcommand === 'list') {
			const agents = getAgentManager().listAgents();
			
			context.stream.markdown('## 🤖 Available Agents\n\n');
			
			// Group agents by workflow phase
			const phases = ['prd', 'requirements', 'design', 'implementation'];
			const phaseNames = {
				'prd': 'PRD & Ideation',
				'requirements': 'Requirements Gathering',
				'design': 'Solution Design',
				'implementation': 'Implementation & Review'
			};

			for (const phase of phases) {
				const phaseAgents = agents.filter((agent: any) => agent.phase === phase);
				if (phaseAgents.length > 0) {
					context.stream.markdown(`### 📋 ${phaseNames[phase as keyof typeof phaseNames]}\n\n`);
					
					for (const agent of phaseAgents) {
						const activeIndicator = agent.active ? ' ✅ **ACTIVE**' : '';
						context.stream.markdown(`- **${agent.name}**${activeIndicator}\n`);
						context.stream.markdown(`  ${agent.description}\n\n`);
					}
				}
			}

			context.stream.markdown(`\n📊 **Total agents:** ${agents.length}\n`);
			context.stream.markdown(`🎯 **Current active agent:** ${agents.find((a: any) => a.active)?.name || 'None'}\n\n`);
			context.stream.markdown('💡 *Use `/agent set <name>` to switch agents*\n');

			return { 
				success: true, 
				data: { agents, count: agents.length },
				shouldContinueConversation: false
			};

		} else if (subcommand === 'set') {
			const agentName = parsedCommand.arguments[0];
			if (!agentName) {
				context.stream.markdown('❌ **Error:** Agent name is required\n\n**Usage:** `/agent set <agent-name>`');
				return { success: false, error: 'Agent name is required' };
			}

			const agentManagerForSet = getAgentManager();
			const success = agentManagerForSet.setCurrentAgent(agentName);
			if (success) {
				const agent = agentManagerForSet.getAgent(agentName);
				
				// Check if auto-chat should be enabled after agent set
				const config = vscode.workspace.getConfiguration('docu.autoChat');
				const enableAfterAgentSet = config.get('enableAfterAgentSet', true);
				
				// Enable auto-chat mode if configured
				const autoChatManager = getConversationSessionRouter().getAutoChatManager();
				if (autoChatManager && enableAfterAgentSet) {
					autoChatManager.enableAutoChat(agentName);
					
					// Show auto-chat prompt
					autoChatManager.showAutoChatPrompt(context.stream);
				} else {
					// Fallback display if auto-chat manager not available
					context.stream.markdown(`✅ **Agent switched successfully!**\n\n`);
					context.stream.markdown(`🤖 **Active agent:** ${agentName}\n`);
					context.stream.markdown(`📋 **Workflow phase:** ${agent?.workflowPhase}\n`);
					context.stream.markdown(`🛠️ **Available tools:** ${agent?.allowedTools.join(', ')}\n\n`);
					
					// Provide context about what this agent does
					const agents = getAgentManager().listAgents();
					const agentInfo = agents.find((a: any) => a.name === agentName);
					if (agentInfo) {
						context.stream.markdown(`**About this agent:**\n${agentInfo.description}\n\n`);
					}

					// Suggest next steps based on the agent
					context.stream.markdown('**Suggested next steps:**\n');
					switch (agent?.workflowPhase) {
						case 'prd':
							context.stream.markdown('- Start with `/new "Product Name"` to create a PRD\n');
							context.stream.markdown('- Use conversational prompts to explore your product idea\n');
							break;
						case 'requirements':
							context.stream.markdown('- Create requirements with `/new "Requirements" --template requirements`\n');
							context.stream.markdown('- Update sections with `/update --file requirements.md --section "Requirements"`\n');
							break;
						case 'design':
							context.stream.markdown('- Create design document with `/new "Design" --template design`\n');
							context.stream.markdown('- Focus on architecture and technical decisions\n');
							break;
						case 'implementation':
							context.stream.markdown('- Review documents with `/review --file <path>`\n');
							context.stream.markdown('- Create implementation plans and specifications\n');
							break;
					}
				}

				return { 
					success: true, 
					data: { agentName, phase: agent?.workflowPhase },
					shouldContinueConversation: false,
					autoChatEnabled: true
				};
			} else {
				const availableAgents = getAgentManager().listAgents().map((a: any) => a.name);
				context.stream.markdown(`❌ **Error:** Agent '${agentName}' not found\n\n`);
				context.stream.markdown(`**Available agents:** ${availableAgents.join(', ')}\n\n`);
				context.stream.markdown('💡 *Use `/agent list` to see all available agents*\n');
				return { 
					success: false, 
					error: 'Agent not found',
					shouldContinueConversation: false
				};
			}

		} else if (subcommand === 'current') {
			const agentManager = getAgentManager();
			const currentAgent = agentManager.getCurrentAgent();
			if (currentAgent) {
				const agents = agentManager.listAgents();
			const agentInfo = agents.find((a: any) => a.name === currentAgent.name);
				
				context.stream.markdown(`## 🎯 Current Active Agent\n\n`);
				context.stream.markdown(`**Name:** ${currentAgent.name}\n`);
				context.stream.markdown(`**Workflow Phase:** ${currentAgent.workflowPhase}\n`);
				context.stream.markdown(`**Available Tools:** ${currentAgent.allowedTools.join(', ')}\n\n`);
				
				if (agentInfo) {
					context.stream.markdown(`**Description:**\n${agentInfo.description}\n\n`);
				}

				// Show workflow state
				const workflowState = (agentManager as any)['workflowState']; // Access private property for demo
				if (workflowState) {
					context.stream.markdown(`**Workflow State:**\n`);
					context.stream.markdown(`- Project ID: ${workflowState.projectId}\n`);
					context.stream.markdown(`- Current Phase: ${workflowState.currentPhase}\n`);
					context.stream.markdown(`- Documents: ${Object.keys(workflowState.documents).length} tracked\n\n`);
				}

				return { 
					success: true, 
					data: { agent: currentAgent.name, phase: currentAgent.workflowPhase },
					shouldContinueConversation: false
				};
			} else {
				context.stream.markdown('❌ **No active agent set**\n\n');
				context.stream.markdown('💡 *Use `/agent set <name>` to activate an agent*\n');
				context.stream.markdown('📋 *Use `/agent list` to see available agents*\n');
				return { 
					success: false, 
					error: 'No active agent',
					shouldContinueConversation: false
				};
			}

		} else {
			context.stream.markdown(`❌ **Error:** Unknown subcommand '${subcommand}'\n\n**Available subcommands:** list, set, current`);
			return { 
				success: false, 
				error: 'Unknown subcommand',
				shouldContinueConversation: false
			};
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { 
			success: false, 
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}

/**
 * Handle the /summarize command
 */
async function handleSummarizeCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const globPattern = (parsedCommand.flags.glob as string) || (parsedCommand.flags.g as string);
		const outputPath = (parsedCommand.flags.output as string) || (parsedCommand.flags.o as string) || 'summary.md';

		if (!globPattern) {
			context.stream.markdown('❌ **Error:** Glob pattern is required\n\n**Usage:** `/summarize --glob <pattern> [--output <path>]`');
			return { 
				success: false, 
				error: 'Glob pattern is required',
				shouldContinueConversation: false
			};
		}

		context.stream.markdown(`📊 Generating summary for pattern: **${globPattern}**\n`);
		context.stream.markdown(`📄 Output file: **${outputPath}**\n\n`);

		// Find matching files
		const toolContext = {
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext,
			cancellationToken: context.token
		};

		const toolManager = getToolManager();

		const listResult = await (toolManager as any).executeTool('listFiles', {
			glob: globPattern
		}, toolContext);

		if (!listResult.success || !listResult.data?.files) {
			context.stream.markdown(`❌ **Error:** ${listResult.error || 'No files found matching pattern'}`);
			return { 
				success: false, 
				error: listResult.error,
				shouldContinueConversation: false
			};
		}

		const files = listResult.data.files;
		context.stream.markdown(`🔍 Found **${files.length}** files to summarize\n\n`);

		if (files.length === 0) {
			context.stream.markdown('ℹ️ No files found matching the pattern.');
			return { 
				success: true, 
				data: { filesProcessed: 0 },
				shouldContinueConversation: false
			};
		}

		// Process files asynchronously to prevent UI blocking
		const summaries: Array<{ file: string; title: string; summary: string; wordCount: number }> = [];
		let processedCount = 0;

		for (const file of files) {
			try {
				// Update progress
				processedCount++;
				context.stream.markdown(`📖 Processing ${processedCount}/${files.length}: ${file.path}\n`);

				// Read file content
			const readResult = await (toolManager as any).executeTool('readFile', {
				path: file.path
			}, toolContext);

				if (readResult.success && readResult.data) {
					const content = readResult.data.content;
					const summary = await generateDocumentSummary(content, file.path);
					summaries.push(summary);
				} else {
					context.stream.markdown(`⚠️ Could not read ${file.path}: ${readResult.error}\n`);
				}

				// Add small delay to prevent overwhelming the system
				await new Promise(resolve => setTimeout(resolve, 100));

			} catch (error) {
				context.stream.markdown(`⚠️ Error processing ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
			}
		}

		// Generate summary document
		const summaryContent = generateSummaryDocument(summaries, globPattern);

		// Write summary file
		const writeResult = toolManager ? await (toolManager as any).executeTool('writeFile', {
			path: outputPath,
			content: summaryContent,
			createIfMissing: true
		}, toolContext) : { success: false, error: 'Tool manager not available' };

		if (writeResult.success) {
			context.stream.markdown(`\n✅ **Summary generated successfully!**\n\n`);
			context.stream.markdown(`📊 **Statistics:**\n`);
			context.stream.markdown(`- Files processed: ${summaries.length}\n`);
			context.stream.markdown(`- Total words: ${summaries.reduce((sum, s) => sum + s.wordCount, 0)}\n`);
			context.stream.markdown(`- Output file: ${outputPath}\n\n`);

			// Create clickable link
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const fullPath = path.isAbsolute(outputPath) ? outputPath : path.join(workspaceFolder.uri.fsPath, outputPath);
				const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath);
				const fileUri = vscode.Uri.file(fullPath);
				context.stream.markdown(`📖 [Open ${relativePath}](${fileUri.toString()})\n`);
			}

			return { 
				success: true, 
				data: { 
					filesProcessed: summaries.length, 
					outputPath,
					totalWords: summaries.reduce((sum, s) => sum + s.wordCount, 0)
				},
				shouldContinueConversation: false
			};
		} else {
			context.stream.markdown(`❌ **Error writing summary:** ${writeResult.error}`);
			return { 
				success: false, 
				error: writeResult.error,
				shouldContinueConversation: false
			};
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { 
			success: false, 
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}

/**
 * Handle the /diagnostic command
 */
async function handleDiagnosticCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const showConversation = parsedCommand.flags.conversation || parsedCommand.flags.c || parsedCommand.flags.all;
		const showAgents = parsedCommand.flags.agents || parsedCommand.flags.a || parsedCommand.flags.all;
		const showAll = parsedCommand.flags.all;

		context.stream.markdown('# 🔍 Docu Diagnostic Information\n\n');

		// Show conversation session information
		if (showConversation || showAll) {
			context.stream.markdown('## 💬 Conversation Sessions\n\n');
			
			const conversationSessionRouter = getConversationSessionRouter();
			const sessionState = (conversationSessionRouter as any).getSessionState();
			
			if (sessionState.activeSessionId) {
				context.stream.markdown(`**Active Session:** ${sessionState.activeSessionId}\n\n`);
				
				const metadata = (conversationSessionRouter as any).getSessionMetadata(sessionState.activeSessionId);
				if (metadata) {
					context.stream.markdown('**Session Details:**\n');
					context.stream.markdown(`- Agent: ${metadata.agentName}\n`);
					context.stream.markdown(`- Document: ${metadata.documentPath || 'None'}\n`);
					context.stream.markdown(`- Template: ${metadata.templateId || 'None'}\n`);
					context.stream.markdown(`- Started: ${metadata.startedAt.toLocaleString()}\n`);
					context.stream.markdown(`- Last Activity: ${metadata.lastActivity.toLocaleString()}\n`);
					context.stream.markdown(`- Questions: ${metadata.questionCount}\n`);
					context.stream.markdown(`- Responses: ${metadata.responseCount}\n\n`);
				}
			} else {
				context.stream.markdown('**No active conversation session**\n\n');
			}

			if (sessionState.sessionsByAgent.size > 0) {
				context.stream.markdown('**Sessions by Agent:**\n');
				for (const [agent, sessionId] of sessionState.sessionsByAgent.entries()) {
					context.stream.markdown(`- ${agent}: ${sessionId}\n`);
				}
				context.stream.markdown('\n');
			}

			if (sessionState.sessionMetadata.size > 0) {
				context.stream.markdown(`**Total Sessions:** ${sessionState.sessionMetadata.size}\n\n`);
			}
		}

		// Show agent information
		if (showAgents || showAll) {
			context.stream.markdown('## 🤖 Agent Information\n\n');
			
			const agentManager = getAgentManager();
			const currentAgent = (agentManager as any).getCurrentAgent();
			if (currentAgent) {
				context.stream.markdown(`**Current Agent:** ${currentAgent.name}\n`);
				context.stream.markdown(`**Workflow Phase:** ${currentAgent.workflowPhase}\n\n`);
			} else {
				context.stream.markdown('**No active agent**\n\n');
			}

			const availableAgents = (agentManager as any).listAgents();
			context.stream.markdown('**Available Agents:**\n');
			for (const agent of availableAgents) {
				const isCurrent = currentAgent?.name === agent.name;
				const marker = isCurrent ? '→' : ' ';
				context.stream.markdown(`${marker} **${agent.name}**: ${agent.description}\n`);
			}
			context.stream.markdown('\n');
		}

		// Show system information if showing all
		if (showAll) {
			context.stream.markdown('## ⚙️ System Information\n\n');
			
			const isOffline = getOfflineManager().isOffline();
			context.stream.markdown(`**Offline Mode:** ${isOffline ? 'Active' : 'Inactive'}\n`);
			
			const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || 'None';
			context.stream.markdown(`**Workspace:** ${workspaceRoot}\n`);
			
			context.stream.markdown(`**Extension Version:** ${globalExtensionContext.extension.packageJSON.version}\n\n`);
		}

		// Show helpful commands
		context.stream.markdown('## 🛠️ Helpful Commands\n\n');
		context.stream.markdown('- `/agent list` - List all available agents\n');
		context.stream.markdown('- `/agent current` - Show current active agent\n');
		context.stream.markdown('- `/agent set <name>` - Set active agent\n');
		context.stream.markdown('- `/chat <message>` - Start conversation\n');
		context.stream.markdown('- `/help` - Show command help\n\n');

		return { success: true };

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		getLogger().extension.error('Diagnostic command failed', error instanceof Error ? error : new Error(errorMessage));
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
	}
}

/**
 * Handle the /chat command
 */
async function handleChatCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		// Get the message from arguments
		const message = parsedCommand.arguments.join(' ').trim();
		
		if (!message) {
			context.stream.markdown('❌ **Error:** Message is required\n\n**Usage:** `/chat <message>`\n\n**Examples:**\n');
			context.stream.markdown('- `/chat Help me develop a PRD for my product`\n');
			context.stream.markdown('- `/chat What are the key requirements for an e-commerce platform?`\n');
			context.stream.markdown('- `/chat Review my document structure and suggest improvements`\n');
			return { 
				success: false, 
				error: 'Message is required',
				shouldContinueConversation: false
			};
		}

		// Provide conversation state feedback using consolidated manager
		const agentManager = getAgentManager();
		const currentAgent = (agentManager as any).getCurrentAgent();
		
		if (currentAgent) {
			const outputCoordinator = OutputCoordinator.getInstance();
			outputCoordinator.addSecondaryFeedback('conversation-state', {
				type: 'conversation',
				message: `Active conversation with ${currentAgent.name} agent`,
				priority: 5,
				source: 'conversation-state'
			});
		}
		if (!currentAgent) {
			context.stream.markdown('❌ **No active agent set**\n\n');
			context.stream.markdown('You need to set an agent before starting a conversation.\n\n');
			context.stream.markdown('**Available agents:**\n');
			
			const agents = getAgentManager().listAgents();
			for (const agentInfo of agents) {
				context.stream.markdown(`- **${agentInfo.name}** - ${agentInfo.description}\n`);
			}
			
			context.stream.markdown('\n💡 *Use `/agent set <name>` to activate an agent, then try your chat command again.*\n');
			return { 
				success: false, 
				error: 'No active agent',
				shouldContinueConversation: false
			};
		}

		// Check offline mode
		if (getOfflineManager().isOffline()) {
			context.stream.markdown('⚠️ **Offline Mode Active** - AI features are unavailable.\n\n');
			context.stream.markdown('**Your message:** ' + message + '\n\n');
			context.stream.markdown('**Offline guidance for ' + currentAgent.name + ':**\n\n');
			
			// Provide offline guidance based on agent type
			const offlineGuidance = getOfflineAgentGuidance(currentAgent.name, message);
			context.stream.markdown(offlineGuidance);
			
			return { 
				success: true, 
				data: { mode: 'offline', agent: currentAgent.name },
				shouldContinueConversation: false
			};
		}

		// Process the chat message with the current agent
		getLogger().extension.info('Processing chat command with agent', { agent: currentAgent.name, message: message.substring(0, 100) });
		getTelemetryManager().trackEvent('chat.agent.interaction', { agent: currentAgent.name });
		
		try {
			// Build agent context
			const agentContext = (agentManager as any).buildAgentContext(context.request);
			
			// Convert to Agent ChatRequest
			const agentRequest: import('./agents/types').ChatRequest = {
				command: context.request.command,
				prompt: message,
				parameters: {},
				originalRequest: context.request
			};
			
			// Handle request with current agent
			const agentResponse = await currentAgent.handleRequest(agentRequest, agentContext);
			
			// Stream the agent response
			if (agentResponse.content) {
				context.stream.markdown(agentResponse.content);
			}
			
			// Add follow-up suggestions if available
			if (agentResponse.followupSuggestions && agentResponse.followupSuggestions.length > 0) {
				context.stream.markdown('\n\n**Suggestions:**\n');
				agentResponse.followupSuggestions.forEach((suggestion: any) => {
					context.stream.markdown(`- ${suggestion}\n`);
				});
			}

			return { 
				success: true, 
				data: { agent: currentAgent.name, responseLength: agentResponse.content?.length || 0 },
				shouldContinueConversation: true,
				conversationContext: {
					command: 'chat',
					agent: currentAgent.name,
					lastMessage: message
				}
			};
			
		} catch (agentError) {
			getLogger().extension.error('Agent interaction failed', agentError instanceof Error ? agentError : new Error(String(agentError)));
			
			context.stream.markdown(`❌ **Agent Error:** ${agentError instanceof Error ? agentError.message : String(agentError)}\n\n`);
			context.stream.markdown('**What you can try:**\n');
			context.stream.markdown('- `/agent list` - See available agents\n');
			context.stream.markdown('- `/agent set <agent-name>` - Switch to a different agent\n');
			context.stream.markdown('- `/help` - Get help with commands\n');

			return { 
				success: false, 
				error: agentError instanceof Error ? agentError.message : String(agentError),
				shouldContinueConversation: false
			};
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { 
			success: false, 
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}

/**
 * Get offline guidance for specific agent types
 */
function getOfflineAgentGuidance(agentName: string, userMessage: string): string {
	const baseGuidance: Record<string, string> = {
		'prd-creator': `**PRD Creator Offline Guidance:**

Since AI is unavailable, here's how to develop your PRD manually:

1. **Problem Definition**: Clearly articulate the problem you're solving
2. **Target Market**: Define your user personas and market size
3. **Solution Overview**: Describe your product concept and key features
4. **Success Metrics**: Define measurable goals and KPIs
5. **Competitive Analysis**: Research and compare with existing solutions
6. **Technical Requirements**: Outline high-level technical needs

**Your message suggests you want to:** ${userMessage}

**Next steps:**
- Open your PRD document and start with the problem definition
- Use the \`/templates show prd\` command to see the full structure
- Fill out each section systematically`,

		'requirements-gatherer': `**Requirements Gatherer Offline Guidance:**

For systematic requirements gathering without AI:

1. **User Stories**: Write in "As a... I want... So that..." format
2. **Acceptance Criteria**: Use EARS format (WHEN... THEN... SHALL...)
3. **Functional Requirements**: Core system capabilities
4. **Non-Functional Requirements**: Performance, security, usability
5. **Business Rules**: Constraints and validation rules

**Your message suggests:** ${userMessage}

**Manual approach:**
- Break down features into specific user stories
- Define clear acceptance criteria for each story
- Consider edge cases and error scenarios`,

		'solution-architect': `**Solution Architect Offline Guidance:**

For technical architecture design:

1. **System Overview**: High-level architecture diagram
2. **Component Design**: Break down into services/modules
3. **Data Architecture**: Database design and data flow
4. **Integration Points**: External systems and APIs
5. **Security Architecture**: Authentication, authorization, data protection
6. **Scalability Considerations**: Performance and growth planning

**Your message indicates:** ${userMessage}

**Design approach:**
- Start with system context and boundaries
- Define major components and their responsibilities
- Document data flow and integration patterns`,

		'specification-writer': `**Specification Writer Offline Guidance:**

For implementation planning:

1. **Task Breakdown**: Divide work into manageable tasks
2. **Dependencies**: Identify task relationships and blockers
3. **Estimates**: Provide time and effort estimates
4. **Acceptance Criteria**: Define "done" for each task
5. **Risk Assessment**: Identify potential issues and mitigation

**Your message suggests:** ${userMessage}

**Planning approach:**
- Break features into development tasks
- Estimate effort and identify dependencies
- Create implementation timeline and milestones`,

		'quality-reviewer': `**Quality Reviewer Offline Guidance:**

For document review and validation:

1. **Completeness Check**: Ensure all required sections are present
2. **Consistency Review**: Check for contradictions and alignment
3. **Clarity Assessment**: Verify content is clear and understandable
4. **Standards Compliance**: Ensure adherence to documentation standards
5. **Actionability**: Verify requirements are implementable

**Your message indicates:** ${userMessage}

**Review approach:**
- Use checklists for systematic review
- Check cross-references and traceability
- Validate technical feasibility`,

		'brainstormer': `**Brainstormer Offline Guidance:**

For creative ideation and exploration:

1. **Divergent Thinking**: Generate many ideas without judgment
2. **Mind Mapping**: Create visual connections between concepts
3. **SCAMPER Method**: Substitute, Combine, Adapt, Modify, Put to other uses, Eliminate, Reverse
4. **User Journey Mapping**: Explore user experience touchpoints
5. **Competitive Analysis**: Study what others are doing differently

**Your message suggests:** ${userMessage}

**Ideation techniques:**
- Set aside judgment and generate quantity first
- Build on ideas rather than dismissing them
- Consider multiple perspectives and use cases`
	};

	return baseGuidance[agentName] || `**General Offline Guidance:**

AI features are currently unavailable. Here are some manual approaches:

1. **Structure your thinking** using templates and frameworks
2. **Research** similar solutions and best practices
3. **Break down complex problems** into smaller, manageable parts
4. **Document your decisions** and reasoning
5. **Iterate and refine** your approach

**Your message:** ${userMessage}

**Suggestion:** Use the available commands like \`/templates list\` and \`/help\` to guide your manual work.`;
}

/**
 * Handle the /catalog command
 */
async function handleCatalogCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const globPattern = (parsedCommand.flags.glob as string) || (parsedCommand.flags.g as string) || '**/*.md';
		const outputPath = (parsedCommand.flags.output as string) || (parsedCommand.flags.o as string) || 'index.md';

		context.stream.markdown(`📚 Generating catalog for pattern: **${globPattern}**\n`);
		context.stream.markdown(`📄 Output file: **${outputPath}**\n\n`);

		// Find matching files
		const toolContext = {
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext,
			cancellationToken: context.token
		};

		const toolManager = getToolManager();

		const listResult = await (toolManager as any).executeTool('listFiles', {
			glob: globPattern
		}, toolContext);

		if (!listResult.success || !listResult.data?.files) {
			context.stream.markdown(`❌ **Error:** ${listResult.error || 'No files found matching pattern'}`);
			return { 
				success: false, 
				error: listResult.error,
				shouldContinueConversation: false
			};
		}

		const files = listResult.data.files;
		context.stream.markdown(`🔍 Found **${files.length}** files to catalog\n\n`);

		if (files.length === 0) {
			context.stream.markdown('ℹ️ No files found matching the pattern.');
			return { 
				success: true, 
				data: { filesProcessed: 0 },
				shouldContinueConversation: false
			};
		}

		// Process files to extract metadata
		const catalogEntries: Array<{
			path: string;
			title: string;
			description: string;
			size: number;
			modified: Date;
			type: string;
		}> = [];

		let processedCount = 0;

		for (const file of files) {
			try {
				processedCount++;
				context.stream.markdown(`📖 Processing ${processedCount}/${files.length}: ${file.path}\n`);

				// Read file content to extract metadata
				const readResult = await (toolManager as any).executeTool('readFile', {
					path: file.path
				}, toolContext);

				if (readResult.success && readResult.data) {
					const content = readResult.data.content;
					const metadata = extractDocumentMetadata(content, file.path);
					catalogEntries.push({
						path: file.path,
						title: metadata.title,
						description: metadata.description,
						size: file.size || content.length,
						modified: new Date(file.mtime || Date.now()),
						type: metadata.type
					});
				} else {
					// Add entry even if we can't read the file
					catalogEntries.push({
						path: file.path,
						title: path.basename(file.path, path.extname(file.path)),
						description: 'Could not read file content',
						size: file.size || 0,
						modified: new Date(file.mtime || Date.now()),
						type: 'unknown'
					});
				}

				// Add small delay to prevent overwhelming the system
				await new Promise(resolve => setTimeout(resolve, 50));

			} catch (error) {
				context.stream.markdown(`⚠️ Error processing ${file.path}: ${error instanceof Error ? error.message : 'Unknown error'}\n`);
			}
		}

		// Generate catalog document
		const catalogContent = generateCatalogDocument(catalogEntries, globPattern);

		// Write catalog file
		const writeResult = await (toolManager as any).executeTool('writeFile', {
			path: outputPath,
			content: catalogContent,
			createIfMissing: true
		}, toolContext);

		if (writeResult.success) {
			context.stream.markdown(`\n✅ **Catalog generated successfully!**\n\n`);
			context.stream.markdown(`📊 **Statistics:**\n`);
			context.stream.markdown(`- Files cataloged: ${catalogEntries.length}\n`);
			context.stream.markdown(`- Total size: ${formatBytes(catalogEntries.reduce((sum, e) => sum + e.size, 0))}\n`);
			context.stream.markdown(`- Output file: ${outputPath}\n\n`);

			// Create clickable link
			const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
			if (workspaceFolder) {
				const fullPath = path.isAbsolute(outputPath) ? outputPath : path.join(workspaceFolder.uri.fsPath, outputPath);
				const relativePath = path.relative(workspaceFolder.uri.fsPath, fullPath);
				const fileUri = vscode.Uri.file(fullPath);
				context.stream.markdown(`📖 [Open ${relativePath}](${fileUri.toString()})\n`);
			}

			return { 
				success: true, 
				data: { 
					filesProcessed: catalogEntries.length, 
					outputPath,
					totalSize: catalogEntries.reduce((sum, e) => sum + e.size, 0)
				},
				shouldContinueConversation: false
			};
		} else {
			context.stream.markdown(`❌ **Error writing catalog:** ${writeResult.error}`);
			return { 
				success: false, 
				error: writeResult.error,
				shouldContinueConversation: false
			};
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { 
			success: false, 
			error: errorMessage,
			shouldContinueConversation: false
		};
	}
}

/**
 * Generate a summary for a single document
 */
async function generateDocumentSummary(content: string, filePath: string): Promise<{
	file: string;
	title: string;
	summary: string;
	wordCount: number;
}> {
	// Extract title from content (first heading or filename)
	const titleMatch = content.match(/^#\s+(.+)$/m);
	const title = titleMatch ? titleMatch[1] : path.basename(filePath, path.extname(filePath));

	// Generate a simple summary (first paragraph or first few sentences)
	const lines = content.split('\n').filter(line => line.trim() && !line.startsWith('#'));
	const firstParagraph = lines.find(line => line.length > 50) || lines[0] || '';
	
	// Truncate to reasonable length
	let summary = firstParagraph.substring(0, 200);
	if (firstParagraph.length > 200) {
		summary += '...';
	}

	// Count words (approximate)
	const wordCount = content.split(/\s+/).filter(word => word.length > 0).length;

	return {
		file: filePath,
		title,
		summary: summary || 'No content summary available',
		wordCount
	};
}

/**
 * Generate the summary document content
 */
function generateSummaryDocument(summaries: Array<{
	file: string;
	title: string;
	summary: string;
	wordCount: number;
}>, globPattern: string): string {
	const now = new Date().toISOString().split('T')[0];
	
	let content = `# Document Summary\n\n`;
	content += `**Generated:** ${now}\n`;
	content += `**Pattern:** \`${globPattern}\`\n`;
	content += `**Files processed:** ${summaries.length}\n`;
	content += `**Total words:** ${summaries.reduce((sum, s) => sum + s.wordCount, 0)}\n\n`;

	content += `## Summary by Document\n\n`;

	// Sort by file path
	summaries.sort((a, b) => a.file.localeCompare(b.file));

	for (const summary of summaries) {
		content += `### ${summary.title}\n\n`;
		content += `**File:** \`${summary.file}\`\n`;
		content += `**Word count:** ${summary.wordCount}\n\n`;
		content += `${summary.summary}\n\n`;
		content += `---\n\n`;
	}

	content += `## Statistics\n\n`;
	content += `| Metric | Value |\n`;
	content += `|--------|-------|\n`;
	content += `| Total files | ${summaries.length} |\n`;
	content += `| Total words | ${summaries.reduce((sum, s) => sum + s.wordCount, 0)} |\n`;
	content += `| Average words per file | ${Math.round(summaries.reduce((sum, s) => sum + s.wordCount, 0) / summaries.length)} |\n`;
	content += `| Largest file | ${summaries.reduce((max, s) => s.wordCount > max.wordCount ? s : max, summaries[0])?.title || 'N/A'} (${summaries.reduce((max, s) => Math.max(max, s.wordCount), 0)} words) |\n`;

	return content;
}

/**
 * Extract metadata from document content
 */
function extractDocumentMetadata(content: string, filePath: string): {
	title: string;
	description: string;
	type: string;
} {
	// Extract title from first heading or filename
	const titleMatch = content.match(/^#\s+(.+)$/m);
	const title = titleMatch ? titleMatch[1] : path.basename(filePath, path.extname(filePath));

	// Determine document type based on content and filename
	let type = 'document';
	if (filePath.toLowerCase().includes('readme')) {
		type = 'readme';
	} else if (filePath.toLowerCase().includes('requirement')) {
		type = 'requirements';
	} else if (filePath.toLowerCase().includes('design')) {
		type = 'design';
	} else if (filePath.toLowerCase().includes('prd')) {
		type = 'prd';
	} else if (filePath.toLowerCase().includes('task')) {
		type = 'tasks';
	} else if (content.includes('## Requirements') || content.includes('### Requirement')) {
		type = 'requirements';
	} else if (content.includes('## Architecture') || content.includes('## Design')) {
		type = 'design';
	}

	// Extract description (first paragraph after title)
	const lines = content.split('\n');
	let description = '';
	let foundTitle = false;
	
	for (const line of lines) {
		if (line.startsWith('#') && !foundTitle) {
			foundTitle = true;
			continue;
		}
		if (foundTitle && line.trim() && !line.startsWith('#')) {
			description = line.trim();
			break;
		}
	}

	// Truncate description
	if (description.length > 150) {
		description = description.substring(0, 150) + '...';
	}

	return {
		title,
		description: description || 'No description available',
		type
	};
}

/**
 * Generate the catalog document content
 */
function generateCatalogDocument(entries: Array<{
	path: string;
	title: string;
	description: string;
	size: number;
	modified: Date;
	type: string;
}>, globPattern: string): string {
	const now = new Date().toISOString().split('T')[0];
	
	let content = `# Document Catalog\n\n`;
	content += `**Generated:** ${now}\n`;
	content += `**Pattern:** \`${globPattern}\`\n`;
	content += `**Files cataloged:** ${entries.length}\n\n`;

	// Group by type
	const typeGroups = entries.reduce((groups, entry) => {
		const type = entry.type;
		if (!groups[type]) {
			groups[type] = [];
		}
		groups[type].push(entry);
		return groups;
	}, {} as Record<string, typeof entries>);

	content += `## Documents by Type\n\n`;

	for (const [type, typeEntries] of Object.entries(typeGroups)) {
		content += `### ${type.charAt(0).toUpperCase() + type.slice(1)} Documents (${typeEntries.length})\n\n`;
		
		// Sort by title
		typeEntries.sort((a, b) => a.title.localeCompare(b.title));
		
		for (const entry of typeEntries) {
			content += `#### [${entry.title}](${entry.path})\n\n`;
			content += `${entry.description}\n\n`;
			content += `**Path:** \`${entry.path}\`  \n`;
			content += `**Size:** ${formatBytes(entry.size)}  \n`;
			content += `**Modified:** ${entry.modified.toISOString().split('T')[0]}\n\n`;
		}
	}

	content += `## Complete File List\n\n`;
	content += `| Title | Type | Size | Modified | Path |\n`;
	content += `|-------|------|------|----------|------|\n`;

	// Sort all entries by path
	entries.sort((a, b) => a.path.localeCompare(b.path));

	for (const entry of entries) {
		const title = entry.title.length > 30 ? entry.title.substring(0, 27) + '...' : entry.title;
		const modifiedDate = entry.modified.toISOString().split('T')[0];
		content += `| [${title}](${entry.path}) | ${entry.type} | ${formatBytes(entry.size)} | ${modifiedDate} | \`${entry.path}\` |\n`;
	}

	return content;
}

/**
 * Format bytes to human readable format
 */
function formatBytes(bytes: number): string {
	if (bytes === 0) {
		return '0 B';
	}
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}/**

 * Setup configuration change handlers
 */
function setupConfigurationHandlers(context: vscode.ExtensionContext): void {
	// Listen for configuration changes
	const configDisposable = getConfigManager().onConfigurationChanged(async (config: any) => {
		if (config.enableDebugLogging) {
			console.log('Docu configuration updated:', config);
		}

		// Update agent manager with new default agent
		const agentManager = getAgentManager();
		if ((agentManager as any).getCurrentAgent()?.name !== config.defaultAgent) {
			const success = (agentManager as any).setCurrentAgent(config.defaultAgent);
			if (!success && config.enableDebugLogging) {
				console.warn(`Could not set default agent to ${config.defaultAgent}`);
			}
		}

		// Reload templates if template directory changed
		await getTemplateService().loadUserTemplates();

		// Reload agent configurations if config directory changed
		await (agentManager as any).loadConfigurations();
	});

	context.subscriptions.push(configDisposable);

	// Register internal commands for file change notifications
	const fileChangeCommand = vscode.commands.registerCommand('docu.internal.fileChanged', async (event: {
		type: 'template' | 'agent-config';
		action: 'created' | 'changed' | 'deleted';
		uri: string;
	}) => {
		const config = getConfigManager().getConfiguration();
		
		if (!config.enableHotReload) {
			return;
		}

		if (config.enableDebugLogging) {
			console.log('Hot reload triggered:', event);
		}

		try {
			if (event.type === 'template') {
				await getTemplateService().loadUserTemplates();
				if (config.enableDebugLogging) {
					console.log('Templates reloaded');
				}
			} else if (event.type === 'agent-config') {
				await getAgentManager().loadConfigurations();
				if (config.enableDebugLogging) {
					console.log('Agent configurations reloaded');
				}
			}
		} catch (error) {
			if (config.enableDebugLogging) {
				console.error('Hot reload error:', error);
			}
		}
	});

	// Legacy context gathering command removed - conversation flow now handled by ConversationSessionRouter

	// Register conversation continuation command
	const continueConversationCommand = vscode.commands.registerCommand('docu.continueConversation', async (sessionId: string, responseType: string) => {
		try {
			const conversationManager = getConversationManager();

			let userResponse = '';
			switch (responseType) {
				case 'continue':
					userResponse = await vscode.window.showInputBox({
						prompt: 'Describe the problem or pain point you want to solve',
						placeHolder: 'e.g., Users struggle with slow authentication processes...'
					}) || '';
					break;
				case 'help':
					userResponse = 'I need help defining the problem my product should solve';
					break;
				case 'examples':
					userResponse = 'Can you give me more examples of problems I could solve?';
					break;
				case 'preview':
					userResponse = 'What other questions will you ask me during this process?';
					break;
				default:
					userResponse = responseType;
			}

			if (userResponse) {
				const response = await (conversationManager as any).continueConversation(sessionId, userResponse);
				// The response will be handled by the conversation system
				vscode.window.showInformationMessage('Response recorded. Continue the conversation in the chat.');
			}
		} catch (error) {
			getLogger().extension.error('Failed to continue conversation', error instanceof Error ? error : new Error(String(error)));
			vscode.window.showErrorMessage(`Failed to continue conversation: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	context.subscriptions.push(fileChangeCommand, continueConversationCommand);
}

/**

 * Generate enhanced file link with VS Code command
 */
function generateFileLink(filePath: string, workspaceRoot: string, options: {
	preview?: boolean;
	viewColumn?: number;
	linkText?: string;
} = {}): string {
	const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath;
	const fullPath = path.isAbsolute(filePath) ? filePath : path.join(workspaceRoot, filePath);
	const fileUri = vscode.Uri.file(fullPath);
	
	const linkText = options.linkText || relativePath;
	const preview = options.preview ? 'true' : 'false';
	const viewColumn = options.viewColumn || 1;
	
	// Create VS Code command URI to open file with specific options
	const commandUri = vscode.Uri.parse(`command:vscode.open?${encodeURIComponent(JSON.stringify([
		fileUri,
		{
			preview: options.preview,
			viewColumn: options.viewColumn
		}
	]))}`);
	
	return `[${linkText}](${commandUri.toString()})`;
}

/**
 * Generate file link with icon based on file type
 */
function generateFileIconLink(filePath: string, workspaceRoot: string): string {
	const ext = path.extname(filePath).toLowerCase();
	let icon = '📄';
	
	switch (ext) {
		case '.md':
			icon = '📝';
			break;
		case '.json':
			icon = '📋';
			break;
		case '.yaml':
		case '.yml':
			icon = '⚙️';
			break;
		case '.txt':
			icon = '📄';
			break;
		case '.js':
		case '.ts':
			icon = '📜';
			break;
		default:
			icon = '📄';
	}
	
	const relativePath = path.isAbsolute(filePath) ? path.relative(workspaceRoot, filePath) : filePath;
	return `${icon} ${generateFileLink(filePath, workspaceRoot, { linkText: relativePath })}`;
}/**

 * Register debug and diagnostic commands
 */
function registerDebugCommands(context: vscode.ExtensionContext): void {
	// Show diagnostics panel
	const showDiagnosticsCommand = vscode.commands.registerCommand('docu.showDiagnostics', async () => {
		getLogger().extension.info('Showing diagnostics panel');
		await getDebugManager().showDiagnosticsPanel();
	});

	// Export diagnostics
	const exportDiagnosticsCommand = vscode.commands.registerCommand('docu.exportDiagnostics', async () => {
		getLogger().extension.info('Exporting diagnostics');
		await getDebugManager().exportDiagnostics();
	});

	// Show output channel
	const showOutputCommand = vscode.commands.registerCommand('docu.showOutput', () => {
		getLogger().extension.info('Showing output channel');
		getLogger().showOutputChannel();
	});

	// Clear logs
	const clearLogsCommand = vscode.commands.registerCommand('docu.clearLogs', () => {
		getLogger().extension.info('Clearing logs');
		getLogger().clearLogs();
		getDebugManager().clearDebugInfo();
		vscode.window.showInformationMessage('Docu logs cleared');
	});

	// Toggle debug mode
	const toggleDebugCommand = vscode.commands.registerCommand('docu.toggleDebug', () => {
		const config = vscode.workspace.getConfiguration('docu.logging');
		const currentLevel = config.get<'info' | 'debug'>('level', 'info');
		const newLevel: 'info' | 'debug' = currentLevel === 'debug' ? 'info' : 'debug';
		
		config.update('level', newLevel, vscode.ConfigurationTarget.Workspace);
		getLogger().updateConfiguration();
		
		getLogger().extension.info(`Debug mode ${newLevel === 'debug' ? 'enabled' : 'disabled'}`);
		vscode.window.showInformationMessage(`Docu debug mode ${newLevel === 'debug' ? 'enabled' : 'disabled'}`);
	});

	// Check offline mode status
	const checkOfflineStatusCommand = vscode.commands.registerCommand('docu.checkOfflineStatus', async () => {
		getLogger().extension.info('Checking offline mode status');
		const status = getOfflineManager().getDetailedStatus();
		const statusMessage = `Offline Mode: ${status.isOffline ? 'ACTIVE' : 'INACTIVE'}
Reason: ${status.reason}
Last Check: ${status.lastCheck.toLocaleString()}
Models Found: ${status.modelStatus.modelsFound}
${status.modelStatus.lastError ? `Last Error: ${status.modelStatus.lastError} (${status.modelStatus.errorType})` : ''}`;
		
		vscode.window.showInformationMessage(statusMessage, { modal: true });
	});

	// Force offline mode check
	const forceOfflineCheckCommand = vscode.commands.registerCommand('docu.forceOfflineCheck', async () => {
		getLogger().extension.info('Forcing offline mode check');
		vscode.window.showInformationMessage('Checking model availability...');
		
		const result = await getOfflineManager().checkModelAvailability(true);
		const resultMessage = `Model Check Result:
Available: ${result.available}
Models Found: ${result.models.length}
${result.error ? `Error: ${result.error} (${result.errorType})` : ''}
${result.retryAfter ? `Retry After: ${result.retryAfter}ms` : ''}`;
		
		vscode.window.showInformationMessage(resultMessage, { modal: true });
	});

	// Toggle offline mode
	const toggleOfflineModeCommand = vscode.commands.registerCommand('docu.toggleOfflineMode', async () => {
		const status = getOfflineManager().getDetailedStatus();
		const newMode = !status.isOffline;
		
		getOfflineManager().setOfflineMode(newMode, `Manually toggled via debug command`);
		getLogger().extension.info(`Offline mode ${newMode ? 'enabled' : 'disabled'} via debug command`);
		vscode.window.showInformationMessage(`Docu offline mode ${newMode ? 'enabled' : 'disabled'}`);
	});

	context.subscriptions.push(
		showDiagnosticsCommand,
		exportDiagnosticsCommand,
		showOutputCommand,
		clearLogsCommand,
		toggleDebugCommand,
		checkOfflineStatusCommand,
		forceOfflineCheckCommand,
		toggleOfflineModeCommand
	);

	getLogger().extension.debug('Debug commands registered');
}

