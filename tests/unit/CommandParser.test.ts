/**
 * Unit tests for CommandParser
 * Covers command parsing, subcommands, quoted arguments, flags, and edge cases.
 */
import { CommandParser } from '../../src/commands/CommandParser';
import { CommandDefinition } from '../../src/commands/types';

const helpCommand: CommandDefinition = {
    name: 'help',
    description: 'Show help',
    usage: '/help',
    examples: ['/help'],
    handler: jest.fn(),
};

const newCommand: CommandDefinition = {
    name: 'new',
    description: 'Create a document',
    usage: '/new [subcommand] [title]',
    examples: ['/new prd "My App"'],
    handler: jest.fn(),
    subcommands: [
        { name: 'prd', description: 'Create PRD', usage: '/new prd', examples: [] },
        { name: 'spec', description: 'Create spec', usage: '/new spec', examples: [] },
    ],
};

const agentCommand: CommandDefinition = {
    name: 'agent',
    description: 'Manage agents',
    usage: '/agent [subcommand]',
    examples: ['/agent list'],
    handler: jest.fn(),
    subcommands: [
        { name: 'list', description: 'List agents', usage: '/agent list', examples: [] },
        { name: 'set', description: 'Set agent', usage: '/agent set', examples: [] },
    ],
};

describe('CommandParser', () => {
    let parser: CommandParser;

    beforeEach(() => {
        parser = new CommandParser();
        parser.registerCommand(helpCommand);
        parser.registerCommand(newCommand);
        parser.registerCommand(agentCommand);
    });

    describe('parseCommand() — basic parsing', () => {
        it('should parse a simple command', () => {
            const result = parser.parseCommand('/help');
            expect(result.command).toBe('help');
            expect(result.subcommand).toBeUndefined();
            expect(result.arguments).toEqual([]);
        });

        it('should throw for input not starting with /', () => {
            expect(() => parser.parseCommand('help')).toThrow(
                'Commands must start with a forward slash'
            );
        });

        it('should throw for empty command after slash', () => {
            expect(() => parser.parseCommand('/')).toThrow();
        });

        it('should preserve rawInput', () => {
            const input = '/new "My Document"';
            const result = parser.parseCommand(input);
            expect(result.rawInput).toBe(input);
        });
    });

    describe('parseCommand() — subcommands', () => {
        it('should parse a subcommand', () => {
            const result = parser.parseCommand('/agent list');
            expect(result.command).toBe('agent');
            expect(result.subcommand).toBe('list');
        });

        it('should leave second token as argument when it is not a registered subcommand', () => {
            const result = parser.parseCommand('/help unknown');
            expect(result.subcommand).toBeUndefined();
            expect(result.arguments).toContain('unknown');
        });

        it('should parse subcommand with additional arguments', () => {
            const result = parser.parseCommand('/new prd "My PRD Title"');
            expect(result.command).toBe('new');
            expect(result.subcommand).toBe('prd');
            expect(result.arguments).toContain('My PRD Title');
        });
    });

    describe('parseCommand() — quoted arguments', () => {
        it('should treat double-quoted strings as single arguments', () => {
            const result = parser.parseCommand('/new "My Document Title"');
            expect(result.arguments).toContain('My Document Title');
            expect(result.arguments).toHaveLength(1);
        });

        it('should treat single-quoted strings as single arguments', () => {
            const result = parser.parseCommand("/new 'My Document Title'");
            expect(result.arguments).toContain('My Document Title');
        });

        it('should handle multiple quoted arguments', () => {
            const result = parser.parseCommand('/new "Title" "Description"');
            expect(result.arguments).toHaveLength(2);
            expect(result.arguments[0]).toBe('Title');
            expect(result.arguments[1]).toBe('Description');
        });
    });

    describe('parseCommand() — flags', () => {
        it('should parse a boolean flag', () => {
            const result = parser.parseCommand('/new prd --verbose');
            expect(result.flags['verbose']).toBe(true);
        });

        it('should parse a key=value flag', () => {
            const result = parser.parseCommand('/new prd --format markdown');
            expect(result.flags['format']).toBe('markdown');
        });

        it('should parse multiple flags', () => {
            const result = parser.parseCommand('/new prd --verbose --format pdf');
            expect(result.flags['verbose']).toBe(true);
            expect(result.flags['format']).toBe('pdf');
        });

        it('should separate flags from positional arguments', () => {
            const result = parser.parseCommand('/new "Title" --format markdown');
            expect(result.arguments).toContain('Title');
            expect(result.flags['format']).toBe('markdown');
        });
    });

    describe('registerCommand()', () => {
        it('should override a previously registered command', () => {
            const updated: CommandDefinition = {
                name: 'help',
                description: 'Updated help',
                usage: '/help',
                examples: [],
                handler: jest.fn(),
            };
            parser.registerCommand(updated);
            // Should not throw and the parser should still work
            const result = parser.parseCommand('/help');
            expect(result.command).toBe('help');
        });
    });
});
