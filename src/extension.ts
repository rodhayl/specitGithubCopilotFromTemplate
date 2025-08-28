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

export async function activate(context: vscode.ExtensionContext) {
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
	await offlineManager.checkModelAvailability();

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

		// Handle non-command input with current agent
		logger.extension.debug('Non-command chat input received, routing to current agent');
		telemetryManager.trackEvent('chat.agent.interaction');
		
		try {
			const currentAgent = agentManager.getCurrentAgent();
			if (currentAgent) {
				// Build agent context
				const agentContext = agentManager.buildAgentContext(request);
				
				// Convert VSCode ChatRequest to Agent ChatRequest
				const agentRequest: import('./agents/types').ChatRequest = {
					command: request.command,
					prompt: request.prompt,
					parameters: {}, // Extract from request if needed
					originalRequest: request
				};
				
				// Handle request with current agent
				const agentResponse = await currentAgent.handleRequest(agentRequest, agentContext);
				
				// Stream the agent response
				if (agentResponse.content) {
					stream.markdown(agentResponse.content);
				}
				
				// Add follow-up suggestions if available
				if (agentResponse.followupSuggestions && agentResponse.followupSuggestions.length > 0) {
					stream.markdown('\n\n**Suggestions:**\n');
					agentResponse.followupSuggestions.forEach(suggestion => {
						stream.markdown(`- ${suggestion}\n`);
					});
				}

				const duration = telemetryManager.endPerformanceMetric('chat.request');
				return { metadata: { command: request.command, agent: currentAgent.name, duration } };
			} else {
				// No current agent, show help
				stream.markdown('Hello! I am the Docu AI assistant. I can help you with documentation tasks.\n\n');
				stream.markdown('Available commands:\n');
				stream.markdown('- `/new <title>` - Create a new document\n');
				stream.markdown('- `/agent list` - Show available agents\n');
				stream.markdown('- `/agent set <agent-name>` - Set active agent\n');
				stream.markdown('- `/templates list` - Show available templates\n');
				stream.markdown('- `/help` - Show detailed help\n');
				stream.markdown('\nI am ready to help you with your documentation needs!');

				const duration = telemetryManager.endPerformanceMetric('chat.request');
				return { metadata: { command: request.command, duration } };
			}
		} catch (agentError) {
			logger.extension.error('Agent interaction failed', agentError instanceof Error ? agentError : new Error(String(agentError)));
			
			stream.markdown(`❌ **Agent Error:** ${agentError instanceof Error ? agentError.message : String(agentError)}`);
			stream.markdown('\n\nYou can try:\n');
			stream.markdown('- `/agent list` - See available agents\n');
			stream.markdown('- `/agent set <agent-name>` - Switch to a different agent\n');
			stream.markdown('- `/help` - Get help with commands\n');

			const duration = telemetryManager.endPerformanceMetric('chat.request');
			return { metadata: { command: request.command, error: true, duration } };
		}
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
		usage: '/new <title> [--template <template-id>] [--path <output-path>]',
		examples: [
			'/new "My Product Requirements"',
			'/new "API Design" --template basic',
			'/new "User Guide" --template basic --path docs/user-guide.md'
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

	commandRouter.registerCommand(newCommand);
	commandRouter.registerCommand(templatesCommand);
	commandRouter.registerCommand(updateCommand);
	commandRouter.registerCommand(reviewCommand);
	commandRouter.registerCommand(agentCommand);
	commandRouter.registerCommand(summarizeCommand);
	commandRouter.registerCommand(catalogCommand);
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

		// Ensure the path is absolute within the workspace
		if (!path.isAbsolute(outputPath)) {
			outputPath = path.join(context.workspaceRoot, outputPath);
		}

		context.stream.markdown(`📝 Creating document: **${title}**\n`);
		context.stream.markdown(`📄 Template: **${templateId}**\n`);
		context.stream.markdown(`📁 Path: **${path.relative(context.workspaceRoot, outputPath)}**\n\n`);

		// Prepare template variables
		const variables = {
			title: title,
			author: vscode.workspace.getConfiguration('git').get('user.name') || 'Unknown'
		};

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
				context.stream.markdown('**What to do:**\n');
				context.stream.markdown(`1. Use the basic template instead: \`/new "${title}" --template basic --path ${parsedCommand.flags.path || ''}\`\n`);
				context.stream.markdown(`2. Check template requirements: \`/templates show ${templateId}\`\n`);
				context.stream.markdown(`3. Provide the missing variables when creating the document\n\n`);
				context.stream.markdown('**Missing variables:**\n');
				for (const variable of result.metadata.missingVariables) {
					context.stream.markdown(`- \`${variable}\`\n`);
				}
				context.stream.markdown('\n💡 *Tip: The basic template works great with all agents and doesn\'t require specific variables*\n');
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

	context.subscriptions.push(fileChangeCommand);

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

	context.subscriptions.push(
		showDiagnosticsCommand,
		exportDiagnosticsCommand,
		showOutputCommand,
		clearLogsCommand,
		toggleDebugCommand
	);

	logger.extension.debug('Debug commands registered');
}

