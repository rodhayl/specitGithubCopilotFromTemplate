import * as vscode from 'vscode';
import { SettingsWebviewProvider } from '../config/SettingsWebviewProvider';

export class SettingsCommand {
    constructor(
        private settingsProvider: SettingsWebviewProvider
    ) {}

    /**
     * Register the settings command
     */
    static register(
        context: vscode.ExtensionContext,
        settingsProvider: SettingsWebviewProvider
    ): vscode.Disposable {
        const command = new SettingsCommand(settingsProvider);
        
        const disposable = vscode.commands.registerCommand('docu.openSettings', () => {
            command.execute();
        });
        
        return disposable;
    }

    /**
     * Execute the settings command
     */
    private async execute(): Promise<void> {
        try {
            // Show the settings view
            await vscode.commands.executeCommand('docu.settingsView.focus');
        } catch (error) {
            vscode.window.showErrorMessage(
                `Failed to open settings: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
        }
    }
}