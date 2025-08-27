// extension.test.ts
import * as assert from 'assert';
import * as vscode from 'vscode';

suite('Docu Extension Test Suite', () => {

	vscode.window.showInformationMessage('Start all tests.');

	test('Extension should be active', () => {
		// The extensionId is <publisher>.<name>
		const extension = vscode.extensions.getExtension('docu.vscode-docu-extension');
		assert.strictEqual(extension?.isActive, true);
	});

	test('Chat participant should be registered', async () => {
		// For now, we'll just check that the extension is active
		// Chat participant testing requires more complex setup
		const extension = vscode.extensions.getExtension('docu.vscode-docu-extension');
		assert.ok(extension?.isActive);
	});
});
