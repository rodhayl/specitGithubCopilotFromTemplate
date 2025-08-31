// Integration tests for CommandRouter
import * as assert from 'assert';
import * as vscode from 'vscode';
import { CommandRouter, CommandContext } from '../../commands/CommandRouter';
import { TestUtilities } from '../utils/TestUtilities';
import { TestTimeoutManager } from '../utils/TestTimeoutManager';
import { VSCodeAPIMocks } from '../mocks/VSCodeAPIMocks';

describe('CommandRouter Integration Tests', () => {
    let commandRouter: CommandRouter;
    let mockContext: CommandContext;

    beforeAll(() => {
        // Create mock agent manager for CommandRouter
        const mockAgentManager = {
            listAgents: jest.fn().mockReturnValue([]),
            getAgent: jest.fn().mockReturnValue(null),
            loadConfigurations: jest.fn().mockResolvedValue(undefined)
        } as any;
        
        commandRouter = new CommandRouter(mockAgentManager);
        mockContext = VSCodeAPIMocks.createMockCommandContext();
    });

    afterAll(() => {
        // Cleanup after tests
    });

    test('Should identify commands correctly', () => {
        const commands = [
            '/new document',
            '/templates list',
            '/agent set prd-creator',
            '/review --file test.md',
            '/update --file test.md --section Overview'
        ];

        const nonCommands = [
            'regular text',
            'help me create a document',
            'what templates are available?',
            '// this is a comment'
        ];

        for (const command of commands) {
            assert.strictEqual(commandRouter.isCommand(command), true, 
                `Should identify as command: ${command}`);
        }

        for (const nonCommand of nonCommands) {
            assert.strictEqual(commandRouter.isCommand(nonCommand), false, 
                `Should not identify as command: ${nonCommand}`);
        }
    });

    test('Should parse command names correctly', () => {
        const testCases = [
            { input: '/new document', expected: 'new' },
            { input: '/templates list', expected: 'templates' },
            { input: '/agent set prd-creator', expected: 'agent' },
            { input: '/help', expected: 'help' },
            { input: '/review --file test.md', expected: 'review' }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            assert.strictEqual(parsed.command, testCase.expected, 
                `Command name should be ${testCase.expected} for: ${testCase.input}`);
        }
    });

    test('Should parse command arguments correctly', () => {
        const testCases = [
            {
                input: '/new "My Document" --template basic',
                expectedArgs: ['My Document'],
                expectedFlags: { template: 'basic' }
            },
            {
                input: '/templates list --agent prd-creator --verbose',
                expectedArgs: [],
                expectedFlags: { agent: 'prd-creator', verbose: true }
            },
            {
                input: '/update --file test.md --section "Overview" content here',
                expectedArgs: ['content', 'here'],
                expectedFlags: { file: 'test.md', section: 'Overview' }
            }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            
            assert.deepStrictEqual(parsed.arguments, testCase.expectedArgs, 
                `Arguments should match for: ${testCase.input}`);
            
            for (const [key, value] of Object.entries(testCase.expectedFlags)) {
                assert.strictEqual(parsed.flags[key], value, 
                    `Flag ${key} should be ${value} for: ${testCase.input}`);
            }
        }
    });

    test('Should parse subcommands correctly', () => {
        const testCases = [
            { input: '/templates list', expected: 'list' },
            { input: '/agent set prd-creator', expected: 'set' },
            { input: '/templates show basic', expected: 'show' },
            { input: '/agent current', expected: 'current' }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            assert.strictEqual(parsed.subcommand, testCase.expected, 
                `Subcommand should be ${testCase.expected} for: ${testCase.input}`);
        }
    });

    test('Should handle quoted arguments correctly', () => {
        const testCases = [
            {
                input: '/new "Document with spaces"',
                expected: ['Document with spaces']
            },
            {
                input: '/new "First Document" "Second Document"',
                expected: ['First Document', 'Second Document']
            },
            {
                input: '/update --section "Section Name" content',
                expectedFlags: { section: 'Section Name' },
                expectedArgs: ['content']
            }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            
            if (testCase.expected) {
                assert.deepStrictEqual(parsed.arguments, testCase.expected, 
                    `Quoted arguments should be parsed correctly: ${testCase.input}`);
            }
            
            if (testCase.expectedFlags) {
                for (const [key, value] of Object.entries(testCase.expectedFlags)) {
                    assert.strictEqual(parsed.flags[key], value, 
                        `Quoted flag ${key} should be ${value} for: ${testCase.input}`);
                }
            }
        }
    });

    test('Should handle boolean flags correctly', () => {
        const testCases = [
            {
                input: '/templates list --verbose',
                expectedFlags: { verbose: true }
            },
            {
                input: '/review --file test.md --fix',
                expectedFlags: { file: 'test.md', fix: true }
            },
            {
                input: '/new document --interactive',
                expectedFlags: { interactive: true }
            }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            
            for (const [key, value] of Object.entries(testCase.expectedFlags)) {
                assert.strictEqual(parsed.flags[key], value, 
                    `Boolean flag ${key} should be ${value} for: ${testCase.input}`);
            }
        }
    });

    test('Should handle short flags correctly', () => {
        const testCases = [
            {
                input: '/new document -t basic',
                expectedFlags: { t: 'basic' }
            },
            {
                input: '/templates list -a prd-creator -v',
                expectedFlags: { a: 'prd-creator', v: true }
            },
            {
                input: '/update -f test.md -s Overview content',
                expectedFlags: { f: 'test.md', s: 'Overview' }
            }
        ];

        for (const testCase of testCases) {
            const parsed = commandRouter.parseCommand(testCase.input);
            
            for (const [key, value] of Object.entries(testCase.expectedFlags)) {
                assert.strictEqual(parsed.flags[key], value, 
                    `Short flag ${key} should be ${value} for: ${testCase.input}`);
            }
        }
    });

    test('Should handle complex command parsing', () => {
        const complexCommand = '/update --file "my document.md" --section "Getting Started" --mode append "New content with spaces"';
        const parsed = commandRouter.parseCommand(complexCommand);

        assert.strictEqual(parsed.command, 'update');
        assert.strictEqual(parsed.flags.file, 'my document.md');
        assert.strictEqual(parsed.flags.section, 'Getting Started');
        assert.strictEqual(parsed.flags.mode, 'append');
        assert.deepStrictEqual(parsed.arguments, ['New content with spaces']);
    });

    test('Should provide help for unknown commands', async () => {
        const result = await TestTimeoutManager.wrapWithTimeout(
            commandRouter.routeCommand('/unknown-command', mockContext),
            'tool-execution'
        );
        
        assert.strictEqual(result.success, false);
        assert.ok(result.error?.includes('not found') || result.error?.includes('Unknown command'));
    });

    test('Should handle empty commands gracefully', () => {
        const emptyCases = ['/', '/ ', '/   '];

        for (const emptyCase of emptyCases) {
            assert.strictEqual(commandRouter.isCommand(emptyCase), false, 
                `Empty command should not be identified: "${emptyCase}"`);
        }
    });

    test('Should preserve command context', async () => {
        const testCommand = '/help';
        const testContext = {
            ...mockContext,
            request: {
                ...mockContext.request,
                prompt: testCommand
            }
        };

        const result = await TestTimeoutManager.wrapWithTimeout(
            commandRouter.routeCommand(testCommand, testContext),
            'tool-execution'
        );
        
        // Should handle the command without throwing errors
        assert.ok(typeof result.success === 'boolean');
    });
});