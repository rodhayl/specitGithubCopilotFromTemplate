import * as vscode from 'vscode';
import * as path from 'path';
import { Logger } from '../logging/Logger';
import { TemplateService } from '../templates/TemplateService';
import { ParsedCommand, CommandContext, CommandResult } from './types';
import { OutputCoordinator, OutputContent } from './OutputCoordinator';
import { FileUtils } from '../utils/FileUtils';
import { AutoChatStateManager } from '../conversation/AutoChatStateManager';
import { DocumentUpdateEngine } from '../conversation/DocumentUpdateEngine';

export interface DocumentCreationResult {
    success: boolean;
    filePath?: string;
    templateUsed?: string;
    fileSize?: number;
    error?: string;
}

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

/**
 * Handles the /new command for creating documents
 */
export class NewCommandHandler {
    private logger: Logger;
    private templateService: TemplateService;
    private outputCoordinator: OutputCoordinator;
    private autoChatManager?: AutoChatStateManager;
    private documentUpdateEngine?: DocumentUpdateEngine;

    constructor() {
        this.logger = Logger.getInstance();
        this.templateService = TemplateService.getInstance();
        this.outputCoordinator = OutputCoordinator.getInstance();
    }

    /**
     * Set auto-chat manager for conversation integration
     */
    setAutoChatManager(autoChatManager: AutoChatStateManager): void {
        this.autoChatManager = autoChatManager;
    }

    /**
     * Set document update engine for real-time updates
     */
    setDocumentUpdateEngine(documentUpdateEngine: DocumentUpdateEngine): void {
        this.documentUpdateEngine = documentUpdateEngine;
    }

    /**
     * Execute the /new command
     */
    async execute(parsedCommand: ParsedCommand, context: CommandContext): Promise<CommandResult> {
        try {
            this.logger.info('command', 'Executing /new command', {
                arguments: parsedCommand.arguments,
                flags: parsedCommand.flags
            });

            // Clear any previous output state
            this.outputCoordinator.clear();

            // Validate inputs
            const validation = this.validateInputs(parsedCommand);
            if (!validation.valid) {
                const errorOutput: OutputContent = {
                    type: 'error',
                    title: 'Invalid Command Parameters',
                    message: `❌ Cannot create document due to parameter validation errors.`,
                    details: validation.errors.map(error => `• ${error}`),
                    nextSteps: [
                        'Fix the parameter errors listed above',
                        'Use correct syntax: `/new "Document Title" [--template <id>] [--path <path>]`',
                        'Example: `/new "My PRD" --template prd --path docs/my-prd.md`',
                        'Use `/help new` for detailed command help',
                        'Use `/templates list` to see available templates'
                    ]
                };

                this.outputCoordinator.registerPrimaryOutput('new-command', errorOutput);
                await this.outputCoordinator.render(context.stream);

                return {
                    success: false,
                    error: validation.errors.join(', ')
                };
            }

            // Extract parameters
            const title = parsedCommand.arguments[0];
            const templateId = (parsedCommand.flags.template as string) || 'basic';
            const customPath = parsedCommand.flags.path as string;
            const withConversation = parsedCommand.flags['with-conversation'] || parsedCommand.flags['wc'];

            // Create the document
            const result = await this.createDocument(title, templateId, customPath);

            if (!result.success) {
                const errorOutput: OutputContent = {
                    type: 'error',
                    title: 'Document Creation Failed',
                    message: `❌ Failed to create document "${title}": ${result.error || 'Unknown error occurred'}`,
                    details: [
                        `**Title:** ${title}`,
                        `**Template:** ${templateId}`,
                        `**Target Path:** ${customPath || 'Auto-generated'}`,
                        `**Error:** ${result.error || 'Unknown error'}`
                    ],
                    nextSteps: [
                        'Check that the output directory exists and is writable',
                        'Verify the template ID is valid with `/templates list`',
                        'Ensure the file path doesn\'t contain invalid characters',
                        'Try with a different path using `--path` flag',
                        'Try with a different template using `--template` flag',
                        'Check VS Code output panel for detailed error information'
                    ]
                };

                this.outputCoordinator.registerPrimaryOutput('new-command', errorOutput);
                await this.outputCoordinator.render(context.stream);

                return {
                    success: false,
                    error: result.error
                };
            }

            // Success - register meaningful, specific output
            const relativePath = result.filePath!.replace(context.workspaceRoot + path.sep, '');
            const successOutput: OutputContent = {
                type: 'success',
                title: 'Document Created Successfully',
                message: `📝 Created "${title}" document at \`${relativePath}\` using ${result.templateUsed} template (${result.fileSize} bytes).`,
                details: [
                    `📁 **Full Path:** ${result.filePath}`,
                    `📄 **Template Used:** ${result.templateUsed}`,
                    `📊 **File Size:** ${result.fileSize} bytes`,
                    `✨ **Status:** File opened in editor`,
                    `🎯 **Template ID:** ${templateId}`
                ],
                nextSteps: [
                    `Edit the document content in the opened editor`,
                    `Review the template structure and customize as needed`,
                    withConversation ? 'Continue with AI conversation to develop content' : 'Use `/chat <message>` to start AI assistance',
                    `Use \`/review --file "${relativePath}"\` to get quality feedback`,
                    `Use \`/update --file "${relativePath}" --section "<section>"\` to update specific sections`
                ]
            };

            this.outputCoordinator.registerPrimaryOutput('new-command', successOutput);

            // Open the file in editor
            try {
                const uri = vscode.Uri.file(result.filePath!);
                await vscode.window.showTextDocument(uri);
                this.logger.info('command', 'Opened document in editor', { filePath: result.filePath });
            } catch (error) {
                this.logger.warn('command', 'Failed to open document in editor', error instanceof Error ? error : new Error(String(error)));
            }

            // Render output
            await this.outputCoordinator.render(context.stream);

            // Handle conversation integration if requested
            const commandResult: CommandResult = {
                success: true,
                message: `Document created: ${result.filePath}`
            };

            if (withConversation) {
                const recommendedAgent = this.getRecommendedAgent(templateId);
                
                // Check if auto-chat should be enabled after document creation
                const config = vscode.workspace.getConfiguration('docu.autoChat');
                const enableAfterDocumentCreation = config.get('enableAfterDocumentCreation', true);
                
                // Enable auto-chat mode with document integration if configured
                if (this.autoChatManager && enableAfterDocumentCreation) {
                    this.autoChatManager.enableAutoChat(
                        recommendedAgent,
                        result.filePath!,
                        {
                            templateId,
                            documentPath: result.filePath!
                        }
                    );

                    // Show auto-chat prompt with document context
                    this.showDocumentCreationPrompt(context.stream, title, result.filePath!, recommendedAgent);
                    
                    commandResult.autoChatEnabled = true;
                } else {
                    // Fallback to traditional conversation config
                    commandResult.shouldContinueConversation = true;
                    commandResult.conversationConfig = {
                        agentName: recommendedAgent,
                        templateId,
                        title,
                        documentPath: result.filePath!,
                        conversationContext: {
                            documentType: templateId,
                            documentPath: result.filePath!,
                            title,
                            workflowPhase: 'creation',
                            workspaceRoot: context.workspaceRoot,
                            extensionContext: context.extensionContext
                        }
                    };
                }
            }

            return commandResult;

        } catch (error) {
            this.logger.error('command', 'Unexpected error in /new command', error instanceof Error ? error : new Error(String(error)));

            const errorOutput: OutputContent = {
                type: 'error',
                title: 'Unexpected Error',
                message: 'An unexpected error occurred while creating the document.',
                details: [error instanceof Error ? error.message : String(error)],
                nextSteps: [
                    'Try the command again',
                    'Check the VS Code output panel for more details',
                    'Report this issue if it persists'
                ]
            };

            this.outputCoordinator.registerPrimaryOutput('new-command', errorOutput);
            await this.outputCoordinator.render(context.stream);

            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Create a document with the specified parameters
     */
    async createDocument(title: string, templateId: string, outputPath?: string): Promise<DocumentCreationResult> {
        try {
            this.logger.info('command', 'Creating document', { title, templateId, outputPath });

            // Get the template
            const template = await this.templateService.getTemplate(templateId);

            // Generate output path
            const filePath = this.generateOutputPath(title, templateId, outputPath);

            // Prepare template variables
            const variables = {
                title,
                ...this.templateService.getDefaultVariables(templateId)
            };

            // Render the template
            const renderResult = await this.templateService.renderTemplate(template, variables);
            if (!renderResult.success) {
                return {
                    success: false,
                    error: renderResult.error
                };
            }

            // Ensure directory exists
            await this.ensureDirectoryExists(path.dirname(filePath));

            // Write the file
            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(filePath),
                Buffer.from(renderResult.content!, 'utf8')
            );

            // Get file stats
            const stats = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));

            this.logger.info('command', 'Document created successfully', {
                filePath,
                templateUsed: template.name,
                fileSize: stats.size
            });

            return {
                success: true,
                filePath,
                templateUsed: template.name,
                fileSize: stats.size
            };

        } catch (error) {
            this.logger.error('command', 'Failed to create document', error instanceof Error ? error : new Error(String(error)));
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    }

    /**
     * Validate command inputs
     */
    validateInputs(parsedCommand: ParsedCommand): ValidationResult {
        const errors: string[] = [];

        // Check for title argument
        if (!parsedCommand.arguments[0] || parsedCommand.arguments[0].trim() === '') {
            errors.push('Document title is required');
        }

        // Validate template ID if provided
        const templateId = parsedCommand.flags.template as string;
        if (templateId) {
            const availableTemplates = this.templateService.listTemplates();
            const templateExists = availableTemplates.some(t => t.id === templateId);
            if (!templateExists) {
                const availableIds = availableTemplates.map(t => t.id).join(', ');
                errors.push(`Template '${templateId}' not found. Available templates: ${availableIds}`);
            }
        }

        // Validate path if provided
        const customPath = parsedCommand.flags.path as string;
        if (customPath) {
            if (path.isAbsolute(customPath)) {
                errors.push('Path must be relative to workspace root');
            }
            if (customPath.includes('..')) {
                errors.push('Path cannot contain ".." segments');
            }
        }

        return {
            valid: errors.length === 0,
            errors
        };
    }

    /**
     * Generate output path for the document
     */
    generateOutputPath(title: string, templateId: string, customPath?: string): string {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        return FileUtils.generateSafeFilePath(title, templateId, customPath, workspaceRoot);
    }

    /**
     * Get recommended agent for template type
     */
    private getRecommendedAgent(templateId: string): string {
        switch (templateId) {
            case 'prd':
                return 'prd-creator';
            case 'requirements':
                return 'requirements-gatherer';
            case 'design':
                return 'solution-architect';
            default:
                return 'brainstormer';
        }
    }



    /**
     * Show document creation prompt with auto-chat integration
     */
    private showDocumentCreationPrompt(
        stream: vscode.ChatResponseStream,
        title: string,
        filePath: string,
        agentName: string
    ): void {
        stream.markdown(`🚀 **Document Created: ${title}**\n\n`);
        stream.markdown(`📝 **File:** ${filePath}\n`);
        stream.markdown(`🤖 **Agent:** ${agentName} is ready to help!\n\n`);
        
        stream.markdown('💬 **Auto-chat enabled!** You can now chat directly to develop your document.\n\n');
        
        // Agent-specific prompts
        switch (agentName) {
            case 'prd-creator':
                stream.markdown('💡 **Let\'s build your PRD together! Tell me about:**\n');
                stream.markdown('- What problem does your product solve?\n');
                stream.markdown('- Who are your target users?\n');
                stream.markdown('- What are the key features you envision?\n\n');
                break;
            case 'requirements-gatherer':
                stream.markdown('💡 **Let\'s gather your requirements! Tell me about:**\n');
                stream.markdown('- What functionality do you need?\n');
                stream.markdown('- What are your performance requirements?\n');
                stream.markdown('- Are there any constraints or limitations?\n\n');
                break;
            case 'solution-architect':
                stream.markdown('💡 **Let\'s design your solution! Tell me about:**\n');
                stream.markdown('- What is the overall system architecture?\n');
                stream.markdown('- What are the main components?\n');
                stream.markdown('- How should data flow through the system?\n\n');
                break;
            default:
                stream.markdown('💡 **Let\'s develop your document! Tell me about:**\n');
                stream.markdown('- What is the main topic or focus?\n');
                stream.markdown('- What key points should be covered?\n');
                stream.markdown('- Who is the target audience?\n\n');
                break;
        }
        
        stream.markdown('💬 **Just type your response below - no need for `/chat`!**\n');
        stream.markdown('📊 **Your responses will automatically update the document.**\n');
    }

    /**
     * Ensure directory exists
     */
    private async ensureDirectoryExists(dirPath: string): Promise<void> {
        await FileUtils.ensureDirectoryExists(dirPath);
    }
}