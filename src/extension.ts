// extension.ts
import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	console.log('Docu extension is now active!');

	// Register the @docu chat participant
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
				}
			];
		}
	};

	context.subscriptions.push(participant);
}

async function handleChatRequest(
	request: vscode.ChatRequest,
	context: vscode.ChatContext,
	stream: vscode.ChatResponseStream,
	token: vscode.CancellationToken
): Promise<vscode.ChatResult> {
	try {
		// Basic response for now - will be expanded in later tasks
		stream.markdown('Hello! I am the Docu AI assistant. I can help you with documentation tasks.\n\n');
		stream.markdown('Available commands:\n');
		stream.markdown('- `/new <title>` - Create a new document\n');
		stream.markdown('- `/agent list` - Show available agents\n');
		stream.markdown('- `/templates list` - Show available templates\n');
		stream.markdown('\nI am ready to help you with your documentation needs!');

		return { metadata: { command: request.command } };
	} catch (error) {
		stream.markdown(`Error: ${error instanceof Error ? error.message : 'Unknown error occurred'}`);
		return { metadata: { command: request.command, error: true } };
	}
}

export function deactivate() { }
