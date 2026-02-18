import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out-test/tests/e2e/**/*.test.js',
	workspaceFolder: 'test-fixtures',
	launchArgs: [
		"--disable-extensions"
	]
});
