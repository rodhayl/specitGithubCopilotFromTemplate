// extension.ts
import * as vscode from 'vscode';
import * as path from 'path';
import { TemplateManager } from './templates';
import { ToolManager } from './tools';
import { CommandRouter, CommandDefinition, ParsedCommand, CommandContext } from './commands';
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
import { LLMService } from './llm/LLMService';
import { SettingsWebviewProvider } from './config/SettingsWebviewProvider';
import { SettingsCommand } from './commands/SettingsCommand';

let templateManager: TemplateManager;
let toolManager: ToolManager;
let commandRouter: CommandRouter;
let agentManager: AgentManager;
let configManager: ConfigurationManager;
let errorHandler: ErrorHandler;
let offlineManager: OfflineManager;
let securityManager: SecurityManager;
let logger: Logger;
let telemetryManager: TelemetryManager;
let debugManager: DebugManager;
let conversationManager: ConversationManager;
let llmService: LLMService;
let settingsProvider: SettingsWebviewProvider;
let globalExtensionContext: vscode.ExtensionContext;

export async function activate(context: vscode.ExtensionContext) {
	// Store global extension context
	globalExtensionContext = context;
	
	// Initialize logging system first
	logger = Logger.initialize(context);
	logger.extension.info('Docu extension activation started');

	// Initialize telemetry and debugging
	telemetryManager = TelemetryManager.initialize(context);
	debugManager = DebugManager.initialize(context);

	// Initialize error handling and offline management
	errorHandler = ErrorHandler.getInstance();
	offlineManager = OfflineManager.getInstance();

	// Track activation start
	telemetryManager.startPerformanceMetric('extension.activation');
	debugManager.addDebugInfo('extension', 'info', 'Extension activation started');

	// Initialize configuration manager
	configManager = new ConfigurationManager(context);

	// Initialize security manager
	const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';
	if (workspaceRoot) {
		securityManager = new SecurityManager(workspaceRoot);
		
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
			});
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
		});
	}

	// Initialize template system
	templateManager = new TemplateManager(context);
	templateManager.loadUserTemplates();

	// Initialize tool system with template manager
	toolManager = new ToolManager(templateManager);

	// Initialize conversation system
	const questionEngine = new QuestionEngine();
	const responseProcessor = new ResponseProcessor();
	const contentCapture = new ContentCapture();
	const workflowOrchestrator = new WorkflowOrchestrator();
	const progressTracker = new ProgressTracker();
	
	conversationManager = new ConversationManager(
		questionEngine,
		responseProcessor,
		contentCapture,
		workflowOrchestrator,
		progressTracker,
		context
	);

	// Initialize agent manager
	agentManager = new AgentManager(context);
	await agentManager.loadConfigurations();

	// Initialize LLM service
	const preferredModel = configManager.get('preferredModel') as string;
	llmService = new LLMService({ preferredModel: preferredModel || undefined });
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
		});
	}

	// Initialize settings webview provider
	settingsProvider = new SettingsWebviewProvider(context.extensionUri, agentManager, llmService);
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

	// Initialize command router
	commandRouter = new CommandRouter();
	registerCustomCommands();

	// Setup configuration change handlers
	setupConfigurationHandlers(context);

	// Register the @docu chat participant
	logger.extension.info('Registering chat participant');
	const participant = vscode.chat.createChatParticipant('docu', handleChatRequest);
	participant.iconPath = vscode.Uri.joinPath(context.extensionUri, 'icon.png');
	participant.followupProvider = {
		provideFollowups(result: vscode.ChatResult, context: vscode.ChatContext, token: vscode.CancellationToken) {
			return [
				{
					prompt: 'Help me create a new document',
					label: vscode.l10n.t('Create Document'),
					command: 'new'
				},
				{
					prompt: 'Show me available agents',
					label: vscode.l10n.t('List Agents'),
					command: 'agent'
				},
				{
					prompt: 'Show me available templates',
					label: vscode.l10n.t('List Templates'),
					command: 'templates'
				}
			];
		}
	};

	context.subscriptions.push(participant);

	// Complete activation
	const activationDuration = telemetryManager.endPerformanceMetric('extension.activation');
	logger.extension.info('Docu extension activation completed', { duration: activationDuration });
	debugManager.addDebugInfo('extension', 'info', 'Extension activation completed', { duration: activationDuration });
	telemetryManager.trackEvent('extension.activated', { success: true }, { duration: activationDuration || 0 });

	// Register debug commands
	registerDebugCommands(context);

	// Register settings command
	context.subscriptions.push(
		SettingsCommand.register(context, settingsProvider)
	);
}

async function handleChatRequest(
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
	const startTime = performance.now();
	logger.extension.info('Chat request received', { prompt: request.prompt.substring(0, 100) });
	telemetryManager.startPerformanceMetric('chat.request');

	try {
		const prompt = request.prompt.trim();
		const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

		// Ensure model availability (especially if startup check was skipped)
		await offlineManager.ensureModelAvailability();
		
		// Check offline mode status
		if (offlineManager.isOffline()) {
			logger.extension.warn('Chat request in offline mode');
			stream.markdown('⚠️ **Offline Mode Active** - Some AI features are unavailable.\n\n');
		}

		// Check if this is a command
		if (commandRouter.isCommand(prompt)) {
			logger.extension.info('Processing command', { prompt });
			
			const commandContext: CommandContext = {
				request,
				stream,
				token,
				workspaceRoot,
				extensionContext: context as any
			};

			try {
				const result = await commandRouter.routeCommand(prompt, commandContext);
				
				logger.extension.info('Command execution result', { success: result.success, error: result.error });
				
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

				const duration = telemetryManager.endPerformanceMetric('chat.request');
				logger.extension.info('Chat command processed', { command: result.success, duration });
				return { metadata: { command: request.command, success: result.success } };
			} catch (commandError) {
				logger.extension.error('Command execution failed', commandError instanceof Error ? commandError : new Error(String(commandError)));
				stream.markdown(`❌ **Command execution failed:** ${commandError instanceof Error ? commandError.message : String(commandError)}`);
				
				const duration = telemetryManager.endPerformanceMetric('chat.request');
				return { metadata: { command: request.command, success: false, error: commandError } };
			}
		}

		// Handle non-command input - show help and available commands
		logger.extension.debug('Non-command chat input received, showing help');
		telemetryManager.trackEvent('chat.help.shown');
		
		// Show helpful guidance instead of routing to agents
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
		const agents = agentManager.listAgents();
		for (const agentInfo of agents) {
			stream.markdown(`- **${agentInfo.name}** - ${agentInfo.description}\n`);
		}
		
		stream.markdown('\n## 📝 **Example Workflow**\n\n');
		stream.markdown('1. `/agent set prd-creator` - Set the PRD Creator agent\n');
		stream.markdown('2. `/new "My Product PRD"` - Create a new document\n');
		stream.markdown('3. `/chat Help me develop a PRD for my card game shop` - Start conversation\n\n');
		
		stream.markdown('**💬 Tip:** Use `/chat` to have conversations with agents. All interactions now require explicit commands for better control!\n');

		const duration = telemetryManager.endPerformanceMetric('chat.request');
		return { metadata: { command: request.command, type: 'help', duration } };
	} catch (error) {
		const duration = performance.now() - startTime;
		
		// Handle error with comprehensive error handling
		const err = error instanceof Error ? error : new Error(String(error));
		logger.extension.error('Chat request failed', err, { prompt: request.prompt.substring(0, 100) });
		telemetryManager.trackError(err, { operation: 'chat-request', prompt: request.prompt.substring(0, 100) });
		
		const errorReport = await errorHandler.handleError(err, {
			operation: 'chat-request',
			userInput: request.prompt,
			timestamp: new Date()
		});

		stream.markdown(`❌ **Error:** ${errorReport.userMessage}`);
		
		if (errorReport.recoveryOptions.length > 0) {
			stream.markdown('\n**What you can try:**\n');
			for (const option of errorReport.recoveryOptions) {
				stream.markdown(`- ${option.description}\n`);
			}
		}

		telemetryManager.endPerformanceMetric('chat.request');
		return { metadata: { command: request.command, error: true, severity: errorReport.severity, duration } };
	}
}

export function deactivate() {
	logger?.extension.info('Docu extension deactivation started');
	telemetryManager?.trackEvent('extension.deactivating');

	// Clean up managers
	if (configManager) {
		configManager.dispose();
	}

	if (errorHandler) {
		errorHandler.clearHistory();
	}

	if (telemetryManager) {
		telemetryManager.dispose();
	}

	if (debugManager) {
		debugManager.dispose();
	}

	if (logger) {
		logger.extension.info('Docu extension deactivated');
		logger.dispose();
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

	commandRouter.registerCommand(newCommand);
	commandRouter.registerCommand(templatesCommand);
	commandRouter.registerCommand(updateCommand);
	commandRouter.registerCommand(reviewCommand);
	commandRouter.registerCommand(agentCommand);
	commandRouter.registerCommand(summarizeCommand);
	commandRouter.registerCommand(catalogCommand);
	commandRouter.registerCommand(chatCommand);
}

/**
 * Start context gathering conversation for structured templates
 */
async function startContextGatheringConversation(
	templateId: string, 
	title: string, 
	outputPath: string, 
	context: CommandContext, 
	conversationManager: ConversationManager
): Promise<void> {
	try {
		// Check if we're in offline mode
		const isOffline = offlineManager.isOffline();
		
		// Determine appropriate agent and questions based on template
		const agentConfig = getAgentConfigForTemplate(templateId);
		if (!agentConfig) {
			return; // No automatic conversation for this template
		}

		if (isOffline) {
			// Provide offline fallback conversation
			const offlineSessionId = generateOfflineSessionId();
			await storeDocumentPathForSession(offlineSessionId, outputPath);
			await startOfflineConversation(templateId, title, outputPath, context, agentConfig, offlineSessionId);
			return;
		}

		context.stream.markdown(`\n🚀 **Starting ${agentConfig.name} Context Gathering**\n\n`);
		context.stream.markdown(`I'll ask you ${agentConfig.questions.length} quick questions to gather context for your ${templateId.toUpperCase()}. You can skip any question by typing "skip".\n\n`);

		// Start structured conversation
		const conversationContext = {
			documentType: templateId,
			workflowPhase: agentConfig.phase,
			documentPath: outputPath,
			title: title,
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext
		};

		const session = await conversationManager.startConversation(agentConfig.agentName, conversationContext);
		
		// Store document path for later retrieval (both online and offline modes)
		await storeDocumentPathForSession(session.sessionId, outputPath);
		
		// Start with first question
		const firstQuestion = agentConfig.questions[0];
		context.stream.markdown(`**Question 1/${agentConfig.questions.length}:** ${firstQuestion.text}\n\n`);
		
		if (firstQuestion.examples && firstQuestion.examples.length > 0) {
			context.stream.markdown('💡 **Examples:**\n');
			for (const example of firstQuestion.examples) {
				context.stream.markdown(`• ${example}\n`);
			}
			context.stream.markdown('\n');
		}

		// Add interactive buttons for online mode
		context.stream.button({
			command: 'docu.continueContextGathering',
			title: 'Answer this question',
			arguments: [session.sessionId, 0, 'answer']
		});
		
		context.stream.button({
			command: 'docu.continueContextGathering',
			title: 'Skip this question',
			arguments: [session.sessionId, 0, 'skip']
		});

		context.stream.button({
			command: 'docu.continueContextGathering',
			title: 'Skip all and generate now',
			arguments: [session.sessionId, -1, 'generate']
		});

	} catch (error) {
		logger.command.warn('Failed to start context gathering conversation', { error });
		
		// Fallback to offline mode if conversation fails
		const agentConfig = getAgentConfigForTemplate(templateId);
		if (agentConfig) {
			const fallbackSessionId = generateOfflineSessionId();
			await storeDocumentPathForSession(fallbackSessionId, outputPath);
			await startOfflineConversation(templateId, title, outputPath, context, agentConfig, fallbackSessionId);
		} else {
			context.stream.markdown('\n💡 *You can start working on your document by chatting with the appropriate agent!*\n');
		}
	}
}

/**
 * Generate offline session ID
 */
function generateOfflineSessionId(): string {
	return `offline_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Store document path for session
 */
async function storeDocumentPathForSession(sessionId: string, documentPath: string): Promise<void> {
	try {
		const key = `offline_document_${sessionId}`;
		await globalExtensionContext.globalState.update(key, documentPath);
	} catch (error) {
		logger.extension.warn('Failed to store document path for session', { error });
	}
}

/**
 * Start offline conversation fallback for structured templates
 */
async function startOfflineConversation(
	templateId: string,
	title: string,
	outputPath: string,
	context: CommandContext,
	agentConfig: { agentName: string; name: string; phase: string; questions: any[] },
	sessionId: string
): Promise<void> {
	try {
		context.stream.markdown(`\n📴 **Offline Mode - ${agentConfig.name} Guidance**\n\n`);
		context.stream.markdown(`Since AI features are currently unavailable, I'll provide structured guidance to help you complete your ${templateId.toUpperCase()} document.\n\n`);

		// Provide structured offline guidance
		context.stream.markdown(`**Document Structure for ${templateId.toUpperCase()}:**\n\n`);
		
		// Generate offline guidance based on template type
		const offlineGuidance = generateOfflineGuidance(templateId, agentConfig.questions);
		context.stream.markdown(offlineGuidance);

		// Provide manual workflow suggestions
		context.stream.markdown(`\n**Manual Workflow:**\n`);
		context.stream.markdown(`1. Open your document: [${title}](${vscode.Uri.file(outputPath).toString()})\n`);
		context.stream.markdown(`2. Follow the structure above to fill in each section\n`);
		context.stream.markdown(`3. Use the examples provided as guidance\n`);
		context.stream.markdown(`4. When online features return, you can use the ${agentConfig.name} agent for AI assistance\n\n`);

		// Add helpful buttons for offline mode
		context.stream.button({
			command: 'vscode.open',
			title: 'Open Document',
			arguments: [vscode.Uri.file(outputPath)]
		});

		context.stream.button({
			command: 'docu.continueContextGathering',
			title: 'Start Manual Context Gathering',
			arguments: [sessionId, 0, 'answer']
		});

		context.stream.button({
			command: 'docu.showTemplate',
			title: 'View Template Details',
			arguments: [templateId]
		});

		context.stream.markdown(`\n💡 *Tip: When AI features are available again, you can chat with the ${agentConfig.name} agent to get personalized assistance!*\n`);

	} catch (error) {
		logger.command.warn('Failed to start offline conversation', { error });
		context.stream.markdown('\n📝 *Your document has been created. You can edit it manually and use AI features when they become available.*\n');
	}
}

/**
 * Generate offline guidance based on template type and questions
 */
function generateOfflineGuidance(templateId: string, questions: any[]): string {
	let guidance = '';

	// Generate section-based guidance from questions
	questions.forEach((question, index) => {
		const sectionNumber = index + 1;
		guidance += `**${sectionNumber}. ${question.section || `Section ${sectionNumber}`}**\n`;
		guidance += `*Question to consider:* ${question.text}\n\n`;
		
		if (question.examples && question.examples.length > 0) {
			guidance += `*Examples:*\n`;
			question.examples.slice(0, 2).forEach((example: string) => {
				guidance += `- ${example}\n`;
			});
			guidance += '\n';
		}
		
		guidance += `*Your response:* [TODO: ${question.text}]\n\n`;
	});

	// Add template-specific additional guidance
	const additionalGuidance = getAdditionalOfflineGuidance(templateId);
	if (additionalGuidance) {
		guidance += `\n**Additional Guidance:**\n${additionalGuidance}\n`;
	}

	return guidance;
}

/**
 * Get additional offline guidance for specific templates
 */
function getAdditionalOfflineGuidance(templateId: string): string {
	const guidanceMap: Record<string, string> = {
		'prd': `
- Start with a clear problem statement
- Define your target users and their needs
- Outline the proposed solution approach
- Include success metrics and constraints
- Keep it concise but comprehensive`,
		
		'requirements': `
- Use clear, testable requirements
- Include both functional and non-functional requirements
- Consider user stories and acceptance criteria
- Think about edge cases and error scenarios
- Prioritize requirements by importance`,
		
		'design': `
- Start with high-level architecture
- Break down into components and interfaces
- Consider data models and relationships
- Include error handling strategies
- Think about scalability and performance`,
		
		'specification': `
- Be precise and unambiguous
- Include detailed technical specifications
- Consider implementation constraints
- Add validation and testing criteria
- Include examples and use cases`
	};

	return guidanceMap[templateId] || `
- Structure your content logically
- Use clear headings and sections
- Include examples where helpful
- Consider your audience and purpose
- Review and refine as needed`;
}

/**
 * Get agent configuration for template-based context gathering
 */
function getAgentConfigForTemplate(templateId: string): { agentName: string; name: string; phase: string; questions: any[] } | null {
	const configs: Record<string, { agentName: string; name: string; phase: string; questions: any[] }> = {
		'prd': {
			agentName: 'prd-creator',
			name: 'PRD Creator',
			phase: 'prd',
			questions: [
				{
					id: 'problem_definition',
					text: 'What specific problem or pain point does your product solve?',
					examples: [
						'Users struggle with slow authentication processes',
						'Current data processing takes too long for real-time needs',
						'Customers can\'t easily find product information'
					],
					section: 'executiveSummary'
				},
				{
					id: 'target_users',
					text: 'Who are your primary target users?',
					examples: [
						'Software developers who need API access',
						'Business analysts creating reports',
						'E-commerce customers aged 25-45'
					],
					section: 'primaryPersona'
				},
				{
					id: 'solution_approach',
					text: 'What\'s your proposed solution approach?',
					examples: [
						'AI-powered recommendation engine',
						'Real-time data processing pipeline',
						'Unified authentication service'
					],
					section: 'primaryGoal1'
				},
				{
					id: 'success_metrics',
					text: 'How will you measure success?',
					examples: [
						'Reduce processing time by 50%',
						'Achieve 99.9% uptime',
						'Increase user satisfaction to 90%'
					],
					section: 'successCriteria1'
				},
				{
					id: 'constraints',
					text: 'What are your main constraints or limitations?',
					examples: [
						'Must integrate with existing systems',
						'Budget limit of $100K',
						'Launch deadline in 6 months'
					],
					section: 'constraint1'
				}
			]
		},
		'requirements': {
			agentName: 'requirements-gatherer',
			name: 'Requirements Gatherer',
			phase: 'requirements',
			questions: [
				{
					id: 'functional_requirements',
					text: 'What are the core functional requirements?',
					examples: [
						'User registration and authentication',
						'Product search and filtering',
						'Order processing and payment'
					],
					section: 'functionalRequirements'
				},
				{
					id: 'user_stories',
					text: 'Describe key user stories or use cases',
					examples: [
						'As a customer, I want to search products by category',
						'As an admin, I want to manage inventory',
						'As a user, I want to track my orders'
					],
					section: 'userStories'
				},
				{
					id: 'performance_requirements',
					text: 'What are your performance requirements?',
					examples: [
						'Page load time under 2 seconds',
						'Support 1000 concurrent users',
						'99.9% uptime requirement'
					],
					section: 'performanceRequirements'
				},
				{
					id: 'security_requirements',
					text: 'What security requirements do you have?',
					examples: [
						'GDPR compliance required',
						'Two-factor authentication',
						'Data encryption at rest and in transit'
					],
					section: 'securityRequirements'
				}
			]
		}
	};

	return configs[templateId] || null;
}

/**
 * Move to next question in context gathering or generate document
 */
async function moveToNextContextQuestion(
	sessionId: string, 
	currentQuestionIndex: number, 
	userResponse: string | null, 
	conversationManager: ConversationManager
): Promise<void> {
	try {
		// Check if we're in offline mode
		const isOffline = offlineManager.isOffline();
		
		// Store the response if provided
		if (userResponse && !isOffline) {
			await conversationManager.continueConversation(sessionId, userResponse);
		}

		// Get session to check progress
		let session = null;
		if (!isOffline) {
			session = conversationManager.getActiveSession('prd-creator') || 
					 conversationManager.getActiveSession('requirements-gatherer') ||
					 conversationManager.getActiveSession('solution-architect') ||
					 conversationManager.getActiveSession('specification-writer');
		}
		
		if (!session && !isOffline) {
			vscode.window.showErrorMessage('Context gathering session not found');
			return;
		}

		// Determine template type and get questions
		const templateId = session?.state.phase === 'prd' ? 'prd' : 
						 session?.state.phase === 'requirements' ? 'requirements' :
						 session?.state.phase === 'design' ? 'design' : 'prd';
		const agentConfig = getAgentConfigForTemplate(templateId);
		if (!agentConfig) {
			return;
		}

		const nextQuestionIndex = currentQuestionIndex + 1;
		
		if (nextQuestionIndex >= agentConfig.questions.length) {
			// All questions completed, generate document
			if (isOffline) {
				await handleOfflineDocumentCompletion(sessionId, agentConfig, userResponse);
			} else {
				await generateDocumentFromContext(sessionId, conversationManager);
			}
			return;
		}

		// Show next question
		const nextQuestion = agentConfig.questions[nextQuestionIndex];
		
		if (isOffline) {
			// Handle offline question progression
			await showOfflineQuestion(nextQuestion, nextQuestionIndex, agentConfig.questions.length, sessionId);
		} else {
			// Handle online question progression
			await showOnlineQuestion(nextQuestion, nextQuestionIndex, agentConfig.questions.length, sessionId);
		}

	} catch (error) {
		logger.extension.error('Failed to move to next context question', error instanceof Error ? error : new Error(String(error)));
		vscode.window.showErrorMessage(`Failed to continue: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Show question in online mode with interactive buttons
 */
async function showOnlineQuestion(
	question: any,
	questionIndex: number,
	totalQuestions: number,
	sessionId: string
): Promise<void> {
	// Create a temporary chat participant to show the question
	const chatParticipant = vscode.chat.createChatParticipant('docu', async (request, context, stream, token) => {
		stream.markdown(`\n**Question ${questionIndex + 1}/${totalQuestions}:** ${question.text}\n\n`);
		
		if (question.examples && question.examples.length > 0) {
			stream.markdown('💡 **Examples:**\n');
			for (const example of question.examples) {
				stream.markdown(`• ${example}\n`);
			}
			stream.markdown('\n');
		}

		// Add interactive buttons
		stream.button({
			command: 'docu.continueContextGathering',
			title: 'Answer this question',
			arguments: [sessionId, questionIndex, 'answer']
		});
		
		stream.button({
			command: 'docu.continueContextGathering',
			title: 'Skip this question',
			arguments: [sessionId, questionIndex, 'skip']
		});

		stream.button({
			command: 'docu.continueContextGathering',
			title: 'Skip remaining and generate',
			arguments: [sessionId, -1, 'generate']
		});
	});

	// Show notification to user
	vscode.window.showInformationMessage(`Question ${questionIndex + 1} ready. Check the chat for details.`);
}

/**
 * Show question in offline mode with manual guidance
 */
async function showOfflineQuestion(
	question: any,
	questionIndex: number,
	totalQuestions: number,
	sessionId: string
): Promise<void> {
	const questionText = `Question ${questionIndex + 1}/${totalQuestions}: ${question.text}`;
	
	let examplesText = '';
	if (question.examples && question.examples.length > 0) {
		examplesText = '\n\nExamples:\n' + question.examples.map((ex: string) => `• ${ex}`).join('\n');
	}

	const userResponse = await vscode.window.showInputBox({
		prompt: questionText,
		placeHolder: 'Type your answer here, or leave empty to skip...',
		ignoreFocusOut: true,
		value: '',
		title: `Offline Context Gathering - Question ${questionIndex + 1}/${totalQuestions}`
	});

	// Store response in a simple way for offline mode
	if (userResponse) {
		await storeOfflineResponse(sessionId, questionIndex, question.id, userResponse);
	}

	// Continue to next question or complete
	if (questionIndex + 1 >= totalQuestions) {
		await handleOfflineDocumentCompletion(sessionId, { questions: [] }, userResponse);
	} else {
		// Automatically continue to next question in offline mode
		const nextQuestionIndex = questionIndex + 1;
		// This will be handled by the calling function
	}
}

/**
 * Handle document completion in offline mode
 */
async function handleOfflineDocumentCompletion(
	sessionId: string,
	agentConfig: any,
	lastResponse?: string | null
): Promise<void> {
	try {
		// Get stored offline responses
		const responses = getStoredOfflineResponses(sessionId);
		
		// Show completion message
		const message = `Context gathering completed! ${responses.length} responses collected.`;
		vscode.window.showInformationMessage(message);

		// Offer to open document for manual editing
		const action = await vscode.window.showInformationMessage(
			'Your document is ready for manual editing. Would you like to open it now?',
			'Open Document',
			'View Responses',
			'Later'
		);

		if (action === 'Open Document') {
			// Try to find and open the document
			const documentPath = getDocumentPathFromSession(sessionId);
			if (documentPath) {
				await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(documentPath));
			}
		} else if (action === 'View Responses') {
			// Show collected responses
			await showCollectedResponses(sessionId, responses);
		}

		// Clean up offline session data
		clearOfflineSession(sessionId);

	} catch (error) {
		logger.extension.error('Failed to handle offline document completion', error instanceof Error ? error : new Error(String(error)));
		vscode.window.showErrorMessage('Failed to complete offline context gathering');
	}
}

/**
 * Store offline response in extension context
 */
async function storeOfflineResponse(
	sessionId: string,
	questionIndex: number,
	questionId: string,
	response: string
): Promise<void> {
	try {
		const key = `offline_responses_${sessionId}`;
		const existingResponses = globalExtensionContext.globalState.get(key, []) as any[];
		
		existingResponses.push({
			questionIndex,
			questionId,
			response,
			timestamp: new Date().toISOString()
		});

		await globalExtensionContext.globalState.update(key, existingResponses);
	} catch (error) {
		logger.extension.warn('Failed to store offline response', { error });
	}
}

/**
 * Get stored offline responses for a session
 */
function getStoredOfflineResponses(sessionId: string): any[] {
	try {
		const key = `offline_responses_${sessionId}`;
		return globalExtensionContext.globalState.get(key, []) as any[];
	} catch (error) {
		logger.extension.warn('Failed to get stored offline responses', { error });
		return [];
	}
}

/**
 * Get document path from session (simplified for offline mode)
 */
function getDocumentPathFromSession(sessionId: string): string | null {
	try {
		const key = `offline_document_${sessionId}`;
		return globalExtensionContext.globalState.get(key, null) as string | null;
	} catch (error) {
		logger.extension.warn('Failed to get document path from session', { error });
		return null;
	}
}

/**
 * Show collected responses to user
 */
async function showCollectedResponses(sessionId: string, responses: any[]): Promise<void> {
	try {
		let content = '# Collected Responses\n\n';
		
		responses.forEach((response, index) => {
			content += `## Question ${response.questionIndex + 1}\n`;
			content += `**ID:** ${response.questionId}\n`;
			content += `**Response:** ${response.response}\n`;
			content += `**Time:** ${response.timestamp}\n\n`;
		});

		// Create a new untitled document with the responses
		const doc = await vscode.workspace.openTextDocument({
			content,
			language: 'markdown'
		});
		
		await vscode.window.showTextDocument(doc);
	} catch (error) {
		logger.extension.error('Failed to show collected responses', error instanceof Error ? error : new Error(String(error)));
	}
}

/**
 * Clear offline session data
 */
function clearOfflineSession(sessionId: string): void {
	try {
		const responseKey = `offline_responses_${sessionId}`;
		const documentKey = `offline_document_${sessionId}`;
		
		globalExtensionContext.globalState.update(responseKey, undefined);
		globalExtensionContext.globalState.update(documentKey, undefined);
	} catch (error) {
		logger.extension.warn('Failed to clear offline session', { error });
	}
}

/**
 * Generate document content from gathered context
 */
async function generateDocumentFromContext(sessionId: string, conversationManager: ConversationManager): Promise<void> {
	try {
		// Check if we're in offline mode
		const isOffline = offlineManager.isOffline();
		
		if (isOffline) {
			// Handle offline document generation
			await handleOfflineDocumentGeneration(sessionId);
			return;
		}

		// Get conversation history to extract context
		const history = conversationManager.getConversationHistory(sessionId);
		const session = conversationManager.getActiveSession('prd-creator') || 
						conversationManager.getActiveSession('requirements-gatherer') ||
						conversationManager.getActiveSession('solution-architect') ||
						conversationManager.getActiveSession('specification-writer');
		
		if (!session) {
			vscode.window.showErrorMessage('Session not found for document generation');
			return;
		}

		// Extract gathered context from conversation
		const gatheredContext = extractContextFromHistory(history);
		
		// Get the appropriate agent for content generation
		const agentName = session.agentName;
		const agent = agentManager.getAgent(agentName);
		
		if (!agent) {
			vscode.window.showErrorMessage(`Agent ${agentName} not found`);
			return;
		}

		vscode.window.showInformationMessage('🔄 Generating document content from gathered context...');

		// Create agent request for document generation
		const agentContext: import('./agents/types').AgentContext = {
			workspaceRoot: session.state.extractedData.get('workspaceRoot') || '',
			extensionContext: globalExtensionContext,
			previousOutputs: [],
			workflowState: {
				projectId: 'auto-generated',
				currentPhase: session.state.phase as import('./agents/types').WorkflowPhase,
				activeAgent: session.state.agentName || 'prd-creator',
				documents: {},
				context: {},
				history: []
			},
			userPreferences: {
				defaultDirectory: 'docs',
				defaultAgent: session.state.agentName || 'prd-creator'
			}
		};

		// Build prompt with gathered context
		const contextPrompt = buildContextPrompt(gatheredContext, session.state.phase);
		
		// Create a mock ChatRequest for the originalRequest
		const mockChatRequest = {
			prompt: contextPrompt,
			command: 'generate-content',
			references: [],
			location: undefined,
			participant: 'docu',
			toolReferences: [],
			toolInvocationToken: undefined,
			model: undefined
		} as unknown as vscode.ChatRequest;
		
		const agentRequest: import('./agents/types').ChatRequest = {
			prompt: contextPrompt,
			command: 'generate-content',
			parameters: {},
			originalRequest: mockChatRequest
		};

		try {
			// Generate content using the agent
			const response = await agent.handleRequest(agentRequest, agentContext);
			
			if (response.success && response.content) {
				// Update the document with generated content
				const documentPath = session.state.extractedData.get('documentPath') || '';
				await updateDocumentWithGeneratedContent(documentPath, response.content, gatheredContext);
				
				vscode.window.showInformationMessage('✅ Document updated with generated content!');
				
				// End the conversation
				await conversationManager.endConversation(sessionId);
			} else {
				// Fallback to offline mode if AI generation fails
				vscode.window.showWarningMessage('AI generation failed. Falling back to manual editing mode.');
				await handleOfflineDocumentGeneration(sessionId, gatheredContext);
			}
		} catch (agentError) {
			// Fallback to offline mode if agent fails
			logger.extension.warn('Agent failed, falling back to offline mode', { error: agentError });
			vscode.window.showWarningMessage('AI features unavailable. Falling back to manual editing mode.');
			await handleOfflineDocumentGeneration(sessionId, gatheredContext);
		}

	} catch (error) {
		logger.extension.error('Failed to generate document from context', error instanceof Error ? error : new Error(String(error)));
		vscode.window.showErrorMessage(`Failed to generate document: ${error instanceof Error ? error.message : String(error)}`);
	}
}

/**
 * Handle document generation in offline mode
 */
async function handleOfflineDocumentGeneration(sessionId: string, gatheredContext?: Record<string, any>): Promise<void> {
	try {
		// Get offline responses if available
		const offlineResponses = getStoredOfflineResponses(sessionId);
		const documentPath = getDocumentPathFromSession(sessionId);
		
		if (!documentPath) {
			vscode.window.showErrorMessage('Document path not found for offline generation');
			return;
		}

		// Create structured content from responses
		let content = '# Document Content\n\n';
		content += '*Generated from offline context gathering*\n\n';
		
		if (offlineResponses.length > 0) {
			content += '## Gathered Information\n\n';
			offlineResponses.forEach((response, index) => {
				content += `### ${response.questionId || `Question ${index + 1}`}\n`;
				content += `${response.response}\n\n`;
			});
		}

		if (gatheredContext && gatheredContext.responses) {
			content += '## Additional Context\n\n';
			(gatheredContext.responses as string[]).forEach((response, index) => {
				content += `**Response ${index + 1}:** ${response}\n\n`;
			});
		}

		content += '\n---\n\n';
		content += '*This document was created in offline mode. You can now edit it manually or use AI features when they become available.*\n';

		// Update the document with offline content
		await updateDocumentWithOfflineContent(documentPath, content);
		
		// Open the document for editing
		await vscode.commands.executeCommand('vscode.open', vscode.Uri.file(documentPath));
		
		vscode.window.showInformationMessage('✅ Document updated with offline content. You can now edit it manually.');
		
		// Clean up offline session
		clearOfflineSession(sessionId);

	} catch (error) {
		logger.extension.error('Failed to handle offline document generation', error instanceof Error ? error : new Error(String(error)));
		vscode.window.showErrorMessage('Failed to generate offline document content');
	}
}

/**
 * Update document with offline content
 */
async function updateDocumentWithOfflineContent(documentPath: string, content: string): Promise<void> {
	try {
		// Read existing document
		const uri = vscode.Uri.file(documentPath);
		let existingContent = '';
		
		try {
			const document = await vscode.workspace.openTextDocument(uri);
			existingContent = document.getText();
		} catch (error) {
			// Document doesn't exist or can't be read, will create new
		}

		// Append or replace content
		let newContent = content;
		if (existingContent.trim()) {
			newContent = existingContent + '\n\n' + content;
		}

		// Write updated content
		const edit = new vscode.WorkspaceEdit();
		edit.createFile(uri, { overwrite: true });
		edit.insert(uri, new vscode.Position(0, 0), newContent);
		
		await vscode.workspace.applyEdit(edit);
		
	} catch (error) {
		logger.extension.error('Failed to update document with offline content', error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}

/**
 * Extract structured context from conversation history
 */
function extractContextFromHistory(history: any[]): Record<string, any> {
	const context: Record<string, any> = {};
	const responses: string[] = [];
	
	// Simple extraction - in a real implementation, this would be more sophisticated
	for (const turn of history) {
		if (turn.type === 'response' && turn.content) {
			responses.push(turn.content);
		}
	}
	
	context.responses = responses;
	return context;
}

/**
 * Build context prompt for agent
 */
function buildContextPrompt(gatheredContext: Record<string, any>, phase: string): string {
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
Functional Requirements: ${responses[0] || 'Not specified'}
User Stories: ${responses[1] || 'Not specified'}
Performance Requirements: ${responses[2] || 'Not specified'}
Security Requirements: ${responses[3] || 'Not specified'}

Please create structured requirements with clear acceptance criteria.`;
	}
	
	return 'Generate appropriate content based on the gathered context.';
}

/**
 * Update document with generated content
 */
async function updateDocumentWithGeneratedContent(
	documentPath: string, 
	generatedContent: string, 
	gatheredContext: Record<string, any>
): Promise<void> {
	try {
		// Read current document
		const document = await vscode.workspace.openTextDocument(documentPath);
		const currentContent = document.getText();
		
		// Replace placeholders with generated content
		let updatedContent = currentContent;
		const responses = (gatheredContext.responses as string[]) || [];
		
		// Simple placeholder replacement - in a real implementation, 
		// this would be more sophisticated and section-specific
		updatedContent = updatedContent.replace(/\[TODO: Brief overview.*?\]/g, responses[0] || '[Generated content]');
		updatedContent = updatedContent.replace(/\[TODO: Define primary goal\]/g, responses[2] || '[Generated goal]');
		updatedContent = updatedContent.replace(/\[TODO: Define success criteria\]/g, responses[3] || '[Generated criteria]');
		
		// Write updated content
		const edit = new vscode.WorkspaceEdit();
		edit.replace(document.uri, new vscode.Range(0, 0, document.lineCount, 0), updatedContent);
		await vscode.workspace.applyEdit(edit);
		
		// Save the document
		await document.save();
		
	} catch (error) {
		logger.extension.error('Failed to update document with generated content', error instanceof Error ? error : new Error(String(error)));
		throw error;
	}
}

/**
 * Determine if a conversation should be started for the given template and flags
 */
function shouldStartConversation(templateId: string, withPlaceholders: boolean, flags: Record<string, any>): boolean {
	// Check for explicit conversation flags
	if (flags['with-conversation'] || flags['wc']) {
		return true;
	}
	
	// Check for explicit no-conversation flags
	if (flags['no-conversation'] || flags['nc']) {
		return false;
	}
	
	// Auto-start for structured templates with placeholders
	if (withPlaceholders) {
		return true;
	}
	
	// Auto-start for specific templates that benefit from conversations
	const conversationTemplates = ['prd', 'requirements', 'design', 'specification'];
	if (conversationTemplates.includes(templateId)) {
		return true;
	}
	
	// Default to no conversation for basic templates
	return false;
}

/**
 * Handle the /new command
 */
async function handleNewCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	const startTime = performance.now();
	logger.command.info('Handling /new command', { title: parsedCommand.arguments[0] });
	telemetryManager.startPerformanceMetric('command.new');

	try {
		logger.command.info('New command started', { arguments: parsedCommand.arguments, flags: parsedCommand.flags });
		
		// Get the title from arguments
		const title = parsedCommand.arguments[0];
		if (!title) {
			const error = 'Document title is required';
			logger.command.warn('New command failed: missing title');
			telemetryManager.trackCommand('new', false, performance.now() - startTime, error);
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
			const template = templateManager.getTemplate(templateId);
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

		logger.command.info('Executing applyTemplate tool', { templateId, outputPath, variables });
		
		const result = await toolManager.executeTool('applyTemplate', {
			templateId: templateId,
			variables: JSON.stringify(variables),
			outputPath: outputPath
		}, toolContext);
		
		logger.command.info('ApplyTemplate tool result', { success: result.success, error: result.error });

		if (result.success) {
			context.stream.markdown('✅ **Document created successfully!**\n\n');
			
			// Create clickable link to open the file and use openInEditor tool
			const relativePath = path.relative(context.workspaceRoot, outputPath);
			const fileUri = vscode.Uri.file(outputPath);
			context.stream.markdown(`📖 [Open ${relativePath}](${fileUri.toString()})\n\n`);
			
			// Also open the file automatically if autoSaveDocuments is enabled
			const config = configManager.getConfiguration();
			if (config.autoSaveDocuments) {
				const openResult = await toolManager.executeTool('openInEditor', {
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

			// Auto-start context gathering conversation for structured templates or when appropriate
			if (conversationManager && shouldStartConversation(templateId, withPlaceholders, parsedCommand.flags)) {
				await startContextGatheringConversation(templateId, title, outputPath, context, conversationManager);
			}



			const duration = telemetryManager.endPerformanceMetric('command.new');
			logger.command.info('New command completed successfully', { title, templateId, duration });
			telemetryManager.trackCommand('new', true, duration);
			telemetryManager.trackTemplateUsage(templateId, 'create', true);
			
			return { success: true, data: { path: outputPath, templateId } };
		} else {
			const duration = performance.now() - startTime;
			logger.command.error('New command failed', undefined, { title, templateId, error: result.error });
			telemetryManager.trackCommand('new', false, duration, result.error);
			
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
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		logger.command.error('New command exception', error instanceof Error ? error : new Error(errorMessage), { title: parsedCommand.arguments[0] });
		telemetryManager.trackCommand('new', false, duration, errorMessage);
		telemetryManager.trackError(error instanceof Error ? error : new Error(errorMessage), { command: 'new' });
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
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

			const result = await toolManager.executeTool('listTemplates', {
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
				return { success: false, error: result.error };
			}

		} else if (subcommand === 'show') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates show <template-id>`');
				return { success: false, error: 'Template ID is required' };
			}

			// Get template details
			const template = templateManager.getTemplate(templateId);
			if (!template) {
				context.stream.markdown(`❌ **Error:** Template '${templateId}' not found`);
				return { success: false, error: 'Template not found' };
			}

			context.stream.markdown(`## 📄 Template: ${template.name}\n\n`);
			context.stream.markdown(`**ID:** \`${template.id}\`\n`);
			context.stream.markdown(`**Description:** ${template.description}\n`);
			context.stream.markdown(`**Built-in:** ${templateManager.getTemplates().find(t => t.id === templateId)?.builtIn ? '✅ Yes' : '❌ No'}\n\n`);

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
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates open <template-id> [--mode <edit|view>]`');
				return { success: false, error: 'Template ID is required' };
			}

			const mode = (parsedCommand.flags.mode as string) || (parsedCommand.flags.m as string) || 'view';

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const result = await toolManager.executeTool('openTemplate', {
				templateId: templateId,
				mode: mode
			}, toolContext);

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
				return { success: false, error: result.error };
			}

		} else if (subcommand === 'validate') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates validate <template-id>`');
				return { success: false, error: 'Template ID is required' };
			}

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const result = await toolManager.executeTool('validateTemplate', {
				templateId: templateId
			}, toolContext);

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
				return { success: false, error: result.error };
			}

		} else if (subcommand === 'create') {
			const templateId = parsedCommand.arguments[0];
			if (!templateId) {
				context.stream.markdown('❌ **Error:** Template ID is required\n\n**Usage:** `/templates create <template-id> [--name <name>] [--description <desc>] [--interactive]`');
				return { success: false, error: 'Template ID is required' };
			}

			const name = (parsedCommand.flags.name as string) || (parsedCommand.flags.n as string);
			const description = (parsedCommand.flags.description as string) || (parsedCommand.flags.d as string);
			const interactive = parsedCommand.flags.interactive || parsedCommand.flags.i || false;

			const toolContext = {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			};

			const result = await toolManager.executeTool('createTemplate', {
				id: templateId,
				name: name,
				description: description,
				interactive: interactive
			}, toolContext);

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
				await templateManager.reloadTemplates();
				context.stream.markdown(`\n🔄 *Templates reloaded - new template is now available*\n`);
			} else {
				context.stream.markdown(`❌ **Error creating template:** ${result.error}`);
				return { success: false, error: result.error };
			}

		} else {
			context.stream.markdown(`❌ **Error:** Unknown subcommand '${subcommand}'\n\n**Available subcommands:** list, show, open, validate, create`);
			return { success: false, error: 'Unknown subcommand' };
		}

		return { success: true };

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
	}
}/*
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
		const result = await toolManager.executeTool('insertSection', {
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
				const config = configManager.getConfiguration();
				if (config.autoSaveDocuments) {
					const openResult = await toolManager.executeTool('openInEditor', {
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

			return { success: true, data: { path: filePath, section: sectionHeader, mode, changed: result.data?.changed } };
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
			return { success: false, error: 'File path is required' };
		}

		// Validate review level
		const validLevels = ['light', 'normal', 'strict'];
		if (!validLevels.includes(level)) {
			context.stream.markdown(`❌ **Error:** Invalid review level '${level}'. Valid levels are: ${validLevels.join(', ')}`);
			return { success: false, error: 'Invalid review level' };
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
			toolManager: toolManager,
			toolContext: {
				workspaceRoot: context.workspaceRoot,
				extensionContext: context.extensionContext,
				cancellationToken: context.token
			}
		};

		// Execute the review
		const result = await qualityReviewer.handleRequest({ prompt: reviewPrompt }, agentContext);

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
				const openResult = await toolManager.executeTool('openInEditor', {
					path: relativePath,
					preview: true,
					viewColumn: 2
				}, agentContext);
				
				if (openResult.success) {
					context.stream.markdown('✨ *File opened in preview mode for review*\n');
				}
			}

			return { 
				success: true, 
				data: { 
					path: filePath, 
					level, 
					autoFix,
					issuesFound: result.data?.issuesFound || 0,
					fixesApplied: result.data?.fixesApplied || 0
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

			return { success: false, error: result.message };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
	}
}/*
*
 * Handle the /agent command
 */
async function handleAgentCommand(parsedCommand: ParsedCommand, context: CommandContext): Promise<any> {
	try {
		const subcommand = parsedCommand.subcommand || 'list';

		if (subcommand === 'list') {
			const agents = agentManager.listAgents();
			
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
				const phaseAgents = agents.filter(agent => agent.phase === phase);
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
			context.stream.markdown(`🎯 **Current active agent:** ${agents.find(a => a.active)?.name || 'None'}\n\n`);
			context.stream.markdown('💡 *Use `/agent set <name>` to switch agents*\n');

			return { success: true, data: { agents, count: agents.length } };

		} else if (subcommand === 'set') {
			const agentName = parsedCommand.arguments[0];
			if (!agentName) {
				context.stream.markdown('❌ **Error:** Agent name is required\n\n**Usage:** `/agent set <agent-name>`');
				return { success: false, error: 'Agent name is required' };
			}

			const success = agentManager.setCurrentAgent(agentName);
			if (success) {
				const agent = agentManager.getAgent(agentName);
				context.stream.markdown(`✅ **Agent switched successfully!**\n\n`);
				context.stream.markdown(`🤖 **Active agent:** ${agentName}\n`);
				context.stream.markdown(`📋 **Workflow phase:** ${agent?.workflowPhase}\n`);
				context.stream.markdown(`🛠️ **Available tools:** ${agent?.allowedTools.join(', ')}\n\n`);
				
				// Provide context about what this agent does
				const agents = agentManager.listAgents();
				const agentInfo = agents.find(a => a.name === agentName);
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

				return { success: true, data: { agentName, phase: agent?.workflowPhase } };
			} else {
				const availableAgents = agentManager.listAgents().map(a => a.name);
				context.stream.markdown(`❌ **Error:** Agent '${agentName}' not found\n\n`);
				context.stream.markdown(`**Available agents:** ${availableAgents.join(', ')}\n\n`);
				context.stream.markdown('💡 *Use `/agent list` to see all available agents*\n');
				return { success: false, error: 'Agent not found' };
			}

		} else if (subcommand === 'current') {
			const currentAgent = agentManager.getCurrentAgent();
			if (currentAgent) {
				const agents = agentManager.listAgents();
				const agentInfo = agents.find(a => a.name === currentAgent.name);
				
				context.stream.markdown(`## 🎯 Current Active Agent\n\n`);
				context.stream.markdown(`**Name:** ${currentAgent.name}\n`);
				context.stream.markdown(`**Workflow Phase:** ${currentAgent.workflowPhase}\n`);
				context.stream.markdown(`**Available Tools:** ${currentAgent.allowedTools.join(', ')}\n\n`);
				
				if (agentInfo) {
					context.stream.markdown(`**Description:**\n${agentInfo.description}\n\n`);
				}

				// Show workflow state
				const workflowState = agentManager['workflowState']; // Access private property for demo
				if (workflowState) {
					context.stream.markdown(`**Workflow State:**\n`);
					context.stream.markdown(`- Project ID: ${workflowState.projectId}\n`);
					context.stream.markdown(`- Current Phase: ${workflowState.currentPhase}\n`);
					context.stream.markdown(`- Documents: ${Object.keys(workflowState.documents).length} tracked\n\n`);
				}

				return { success: true, data: { agent: currentAgent.name, phase: currentAgent.workflowPhase } };
			} else {
				context.stream.markdown('❌ **No active agent set**\n\n');
				context.stream.markdown('💡 *Use `/agent set <name>` to activate an agent*\n');
				context.stream.markdown('📋 *Use `/agent list` to see available agents*\n');
				return { success: false, error: 'No active agent' };
			}

		} else {
			context.stream.markdown(`❌ **Error:** Unknown subcommand '${subcommand}'\n\n**Available subcommands:** list, set, current`);
			return { success: false, error: 'Unknown subcommand' };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
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
			return { success: false, error: 'Glob pattern is required' };
		}

		context.stream.markdown(`📊 Generating summary for pattern: **${globPattern}**\n`);
		context.stream.markdown(`📄 Output file: **${outputPath}**\n\n`);

		// Find matching files
		const toolContext = {
			workspaceRoot: context.workspaceRoot,
			extensionContext: context.extensionContext,
			cancellationToken: context.token
		};

		const listResult = await toolManager.executeTool('listFiles', {
			glob: globPattern
		}, toolContext);

		if (!listResult.success || !listResult.data?.files) {
			context.stream.markdown(`❌ **Error:** ${listResult.error || 'No files found matching pattern'}`);
			return { success: false, error: listResult.error };
		}

		const files = listResult.data.files;
		context.stream.markdown(`🔍 Found **${files.length}** files to summarize\n\n`);

		if (files.length === 0) {
			context.stream.markdown('ℹ️ No files found matching the pattern.');
			return { success: true, data: { filesProcessed: 0 } };
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
				const readResult = await toolManager.executeTool('readFile', {
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
		const writeResult = await toolManager.executeTool('writeFile', {
			path: outputPath,
			content: summaryContent,
			createIfMissing: true
		}, toolContext);

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
				} 
			};
		} else {
			context.stream.markdown(`❌ **Error writing summary:** ${writeResult.error}`);
			return { success: false, error: writeResult.error };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
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
			return { success: false, error: 'Message is required' };
		}

		// Check if there's an active agent
		const currentAgent = agentManager.getCurrentAgent();
		if (!currentAgent) {
			context.stream.markdown('❌ **No active agent set**\n\n');
			context.stream.markdown('You need to set an agent before starting a conversation.\n\n');
			context.stream.markdown('**Available agents:**\n');
			
			const agents = agentManager.listAgents();
			for (const agentInfo of agents) {
				context.stream.markdown(`- **${agentInfo.name}** - ${agentInfo.description}\n`);
			}
			
			context.stream.markdown('\n💡 *Use `/agent set <name>` to activate an agent, then try your chat command again.*\n');
			return { success: false, error: 'No active agent' };
		}

		// Check offline mode
		if (offlineManager.isOffline()) {
			context.stream.markdown('⚠️ **Offline Mode Active** - AI features are unavailable.\n\n');
			context.stream.markdown('**Your message:** ' + message + '\n\n');
			context.stream.markdown('**Offline guidance for ' + currentAgent.name + ':**\n\n');
			
			// Provide offline guidance based on agent type
			const offlineGuidance = getOfflineAgentGuidance(currentAgent.name, message);
			context.stream.markdown(offlineGuidance);
			
			return { success: true, data: { mode: 'offline', agent: currentAgent.name } };
		}

		// Process the chat message with the current agent
		logger.extension.info('Processing chat command with agent', { agent: currentAgent.name, message: message.substring(0, 100) });
		telemetryManager.trackEvent('chat.agent.interaction', { agent: currentAgent.name });
		
		try {
			// Build agent context
			const agentContext = agentManager.buildAgentContext(context.request);
			
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
				agentResponse.followupSuggestions.forEach(suggestion => {
					context.stream.markdown(`- ${suggestion}\n`);
				});
			}

			return { success: true, data: { agent: currentAgent.name, responseLength: agentResponse.content?.length || 0 } };
			
		} catch (agentError) {
			logger.extension.error('Agent interaction failed', agentError instanceof Error ? agentError : new Error(String(agentError)));
			
			context.stream.markdown(`❌ **Agent Error:** ${agentError instanceof Error ? agentError.message : String(agentError)}\n\n`);
			context.stream.markdown('**What you can try:**\n');
			context.stream.markdown('- `/agent list` - See available agents\n');
			context.stream.markdown('- `/agent set <agent-name>` - Switch to a different agent\n');
			context.stream.markdown('- `/help` - Get help with commands\n');

			return { success: false, error: agentError instanceof Error ? agentError.message : String(agentError) };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
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

		const listResult = await toolManager.executeTool('listFiles', {
			glob: globPattern
		}, toolContext);

		if (!listResult.success || !listResult.data?.files) {
			context.stream.markdown(`❌ **Error:** ${listResult.error || 'No files found matching pattern'}`);
			return { success: false, error: listResult.error };
		}

		const files = listResult.data.files;
		context.stream.markdown(`🔍 Found **${files.length}** files to catalog\n\n`);

		if (files.length === 0) {
			context.stream.markdown('ℹ️ No files found matching the pattern.');
			return { success: true, data: { filesProcessed: 0 } };
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
				const readResult = await toolManager.executeTool('readFile', {
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
		const writeResult = await toolManager.executeTool('writeFile', {
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
				} 
			};
		} else {
			context.stream.markdown(`❌ **Error writing catalog:** ${writeResult.error}`);
			return { success: false, error: writeResult.error };
		}

	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		context.stream.markdown(`❌ **Error:** ${errorMessage}`);
		return { success: false, error: errorMessage };
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
	const configDisposable = configManager.onConfigurationChanged(async (config) => {
		if (config.enableDebugLogging) {
			console.log('Docu configuration updated:', config);
		}

		// Update agent manager with new default agent
		if (agentManager.getCurrentAgent()?.name !== config.defaultAgent) {
			const success = agentManager.setCurrentAgent(config.defaultAgent);
			if (!success && config.enableDebugLogging) {
				console.warn(`Could not set default agent to ${config.defaultAgent}`);
			}
		}

		// Reload templates if template directory changed
		if (templateManager) {
			await templateManager.loadUserTemplates();
		}

		// Reload agent configurations if config directory changed
		if (agentManager) {
			await agentManager.loadConfigurations();
		}
	});

	context.subscriptions.push(configDisposable);

	// Register internal commands for file change notifications
	const fileChangeCommand = vscode.commands.registerCommand('docu.internal.fileChanged', async (event: {
		type: 'template' | 'agent-config';
		action: 'created' | 'changed' | 'deleted';
		uri: string;
	}) => {
		const config = configManager.getConfiguration();
		
		if (!config.enableHotReload) {
			return;
		}

		if (config.enableDebugLogging) {
			console.log('Hot reload triggered:', event);
		}

		try {
			if (event.type === 'template') {
				await templateManager.loadUserTemplates();
				if (config.enableDebugLogging) {
					console.log('Templates reloaded');
				}
			} else if (event.type === 'agent-config') {
				await agentManager.loadConfigurations();
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

	// Register context gathering continuation command
	const continueContextGatheringCommand = vscode.commands.registerCommand('docu.continueContextGathering', async (sessionId: string, questionIndex: number, action: string) => {
		try {
			// Check if we're in offline mode
			const isOffline = offlineManager.isOffline();
			
			if (!conversationManager && !isOffline) {
				vscode.window.showErrorMessage('Conversation manager not available');
				return;
			}

			if (action === 'generate') {
				// Skip all remaining questions and generate document
				if (isOffline) {
					await handleOfflineDocumentCompletion(sessionId, { questions: [] });
				} else {
					await generateDocumentFromContext(sessionId, conversationManager!);
				}
				return;
			}

			if (action === 'skip') {
				// Skip current question and move to next
				if (isOffline) {
					// In offline mode, just move to next question without storing response
					await moveToNextContextQuestion(sessionId, questionIndex, null, conversationManager!);
				} else {
					await moveToNextContextQuestion(sessionId, questionIndex, null, conversationManager!);
				}
				return;
			}

			if (action === 'answer') {
				// Prompt user for answer
				const userResponse = await vscode.window.showInputBox({
					prompt: 'Please provide your answer',
					placeHolder: 'Type your answer here...',
					ignoreFocusOut: true
				});

				if (userResponse) {
					if (isOffline) {
						// Store response offline and continue
						await storeOfflineResponse(sessionId, questionIndex, `question_${questionIndex}`, userResponse);
						await moveToNextContextQuestion(sessionId, questionIndex, userResponse, conversationManager!);
					} else {
						await moveToNextContextQuestion(sessionId, questionIndex, userResponse, conversationManager!);
					}
				}
				return;
			}

		} catch (error) {
			logger.extension.error('Failed to continue context gathering', error instanceof Error ? error : new Error(String(error)));
			
			// Provide helpful error message based on mode
			const isOffline = offlineManager.isOffline();
			const errorMsg = isOffline 
				? 'Failed to continue offline context gathering. You can still edit your document manually.'
				: `Failed to continue context gathering: ${error instanceof Error ? error.message : String(error)}`;
			
			vscode.window.showErrorMessage(errorMsg);
		}
	});

	// Register conversation continuation command
	const continueConversationCommand = vscode.commands.registerCommand('docu.continueConversation', async (sessionId: string, responseType: string) => {
		try {
			if (!conversationManager) {
				vscode.window.showErrorMessage('Conversation manager not available');
				return;
			}

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
				const response = await conversationManager.continueConversation(sessionId, userResponse);
				// The response will be handled by the conversation system
				vscode.window.showInformationMessage('Response recorded. Continue the conversation in the chat.');
			}
		} catch (error) {
			logger.extension.error('Failed to continue conversation', error instanceof Error ? error : new Error(String(error)));
			vscode.window.showErrorMessage(`Failed to continue conversation: ${error instanceof Error ? error.message : String(error)}`);
		}
	});

	context.subscriptions.push(fileChangeCommand, continueContextGatheringCommand, continueConversationCommand);

	// Register configuration management commands
	const showConfigCommand = vscode.commands.registerCommand('docu.showConfiguration', () => {
		const config = configManager.getConfiguration();
		const panel = vscode.window.createWebviewPanel(
			'docuConfig',
			'Docu Configuration',
			vscode.ViewColumn.One,
			{ enableScripts: true }
		);

		panel.webview.html = generateConfigurationWebview(config);
	});

	const exportConfigCommand = vscode.commands.registerCommand('docu.exportConfiguration', async () => {
		const configJson = configManager.exportConfiguration();
		const doc = await vscode.workspace.openTextDocument({
			content: configJson,
			language: 'json'
		});
		await vscode.window.showTextDocument(doc);
	});

	const resetConfigCommand = vscode.commands.registerCommand('docu.resetConfiguration', async () => {
		const result = await vscode.window.showWarningMessage(
			'Are you sure you want to reset all Docu settings to their default values?',
			{ modal: true },
			'Reset',
			'Cancel'
		);

		if (result === 'Reset') {
			await configManager.resetToDefaults();
			vscode.window.showInformationMessage('Docu configuration has been reset to defaults.');
		}
	});

	context.subscriptions.push(showConfigCommand, exportConfigCommand, resetConfigCommand);
}

/**
 * Generate HTML for configuration webview
 */
function generateConfigurationWebview(config: any): string {
	return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Docu Configuration</title>
    <style>
        body {
            font-family: var(--vscode-font-family);
            color: var(--vscode-foreground);
            background-color: var(--vscode-editor-background);
            padding: 20px;
        }
        .config-section {
            margin-bottom: 20px;
            padding: 15px;
            border: 1px solid var(--vscode-panel-border);
            border-radius: 5px;
        }
        .config-item {
            margin-bottom: 10px;
        }
        .config-key {
            font-weight: bold;
            color: var(--vscode-textLink-foreground);
        }
        .config-value {
            margin-left: 10px;
            font-family: var(--vscode-editor-font-family);
        }
        .boolean-true {
            color: var(--vscode-debugConsole-infoForeground);
        }
        .boolean-false {
            color: var(--vscode-debugConsole-errorForeground);
        }
        .number {
            color: var(--vscode-debugConsole-warningForeground);
        }
        .string {
            color: var(--vscode-debugConsole-sourceForeground);
        }
    </style>
</head>
<body>
    <h1>Docu Configuration</h1>
    
    <div class="config-section">
        <h2>General Settings</h2>
        <div class="config-item">
            <span class="config-key">Default Directory:</span>
            <span class="config-value string">${config.defaultDirectory}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Default Agent:</span>
            <span class="config-value string">${config.defaultAgent}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Auto Save Documents:</span>
            <span class="config-value boolean-${config.autoSaveDocuments}">${config.autoSaveDocuments}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Show Workflow Progress:</span>
            <span class="config-value boolean-${config.showWorkflowProgress}">${config.showWorkflowProgress}</span>
        </div>
    </div>

    <div class="config-section">
        <h2>Directories</h2>
        <div class="config-item">
            <span class="config-key">Template Directory:</span>
            <span class="config-value string">${config.templateDirectory}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Agent Config Directory:</span>
            <span class="config-value string">${config.agentConfigDirectory}</span>
        </div>
    </div>

    <div class="config-section">
        <h2>Advanced Settings</h2>
        <div class="config-item">
            <span class="config-key">Enable Hot Reload:</span>
            <span class="config-value boolean-${config.enableHotReload}">${config.enableHotReload}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Review Level:</span>
            <span class="config-value string">${config.reviewLevel}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Max Files in Summary:</span>
            <span class="config-value number">${config.maxFilesInSummary}</span>
        </div>
        <div class="config-item">
            <span class="config-key">Enable Debug Logging:</span>
            <span class="config-value boolean-${config.enableDebugLogging}">${config.enableDebugLogging}</span>
        </div>
    </div>

    <p><em>To modify these settings, use VS Code's Settings UI (Ctrl+,) and search for "docu".</em></p>
</body>
</html>`;
}/**

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
		logger.extension.info('Showing diagnostics panel');
		await debugManager.showDiagnosticsPanel();
	});

	// Export diagnostics
	const exportDiagnosticsCommand = vscode.commands.registerCommand('docu.exportDiagnostics', async () => {
		logger.extension.info('Exporting diagnostics');
		await debugManager.exportDiagnostics();
	});

	// Show output channel
	const showOutputCommand = vscode.commands.registerCommand('docu.showOutput', () => {
		logger.extension.info('Showing output channel');
		logger.showOutputChannel();
	});

	// Clear logs
	const clearLogsCommand = vscode.commands.registerCommand('docu.clearLogs', () => {
		logger.extension.info('Clearing logs');
		logger.clearLogs();
		debugManager.clearDebugInfo();
		vscode.window.showInformationMessage('Docu logs cleared');
	});

	// Toggle debug mode
	const toggleDebugCommand = vscode.commands.registerCommand('docu.toggleDebug', () => {
		const config = vscode.workspace.getConfiguration('docu.logging');
		const currentLevel = config.get<'info' | 'debug'>('level', 'info');
		const newLevel: 'info' | 'debug' = currentLevel === 'debug' ? 'info' : 'debug';
		
		config.update('level', newLevel, vscode.ConfigurationTarget.Workspace);
		logger.updateConfiguration();
		
		logger.extension.info(`Debug mode ${newLevel === 'debug' ? 'enabled' : 'disabled'}`);
		vscode.window.showInformationMessage(`Docu debug mode ${newLevel === 'debug' ? 'enabled' : 'disabled'}`);
	});

	// Check offline mode status
	const checkOfflineStatusCommand = vscode.commands.registerCommand('docu.checkOfflineStatus', async () => {
		logger.extension.info('Checking offline mode status');
		const status = offlineManager.getDetailedStatus();
		const statusMessage = `Offline Mode: ${status.isOffline ? 'ACTIVE' : 'INACTIVE'}
Reason: ${status.reason}
Last Check: ${status.lastCheck.toLocaleString()}
Models Found: ${status.modelStatus.modelsFound}
${status.modelStatus.lastError ? `Last Error: ${status.modelStatus.lastError} (${status.modelStatus.errorType})` : ''}`;
		
		vscode.window.showInformationMessage(statusMessage, { modal: true });
	});

	// Force offline mode check
	const forceOfflineCheckCommand = vscode.commands.registerCommand('docu.forceOfflineCheck', async () => {
		logger.extension.info('Forcing offline mode check');
		vscode.window.showInformationMessage('Checking model availability...');
		
		const result = await offlineManager.checkModelAvailability(true);
		const resultMessage = `Model Check Result:
Available: ${result.available}
Models Found: ${result.models.length}
${result.error ? `Error: ${result.error} (${result.errorType})` : ''}
${result.retryAfter ? `Retry After: ${result.retryAfter}ms` : ''}`;
		
		vscode.window.showInformationMessage(resultMessage, { modal: true });
	});

	// Toggle offline mode
	const toggleOfflineModeCommand = vscode.commands.registerCommand('docu.toggleOfflineMode', async () => {
		const status = offlineManager.getDetailedStatus();
		const newMode = !status.isOffline;
		
		offlineManager.setOfflineMode(newMode, `Manually toggled via debug command`);
		logger.extension.info(`Offline mode ${newMode ? 'enabled' : 'disabled'} via debug command`);
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

	logger.extension.debug('Debug commands registered');
}

