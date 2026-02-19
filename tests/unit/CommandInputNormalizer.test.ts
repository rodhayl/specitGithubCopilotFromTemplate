import { deriveCommandInput } from '../../src/commands/CommandInputNormalizer';

describe('CommandInputNormalizer', () => {
    const knownCommands = new Set(['new', 'help', 'agent']);
    const isKnownCommand = (candidate: string): boolean => {
        const normalized = candidate.startsWith('/') ? candidate.slice(1) : candidate;
        const name = normalized.split(/\s+/)[0];
        return knownCommands.has(name);
    };

    test('reconstructs /new when command is split from prompt', () => {
        const input = deriveCommandInput('trainingForForexTrading', 'new', isKnownCommand);
        expect(input).toBe('/new trainingForForexTrading');
    });

    test('reconstructs /help when command is split from prompt', () => {
        const input = deriveCommandInput('', 'help', isKnownCommand);
        expect(input).toBe('/help');
    });

    test('reconstructs /agent list when command is split from prompt', () => {
        const input = deriveCommandInput('list', 'agent', isKnownCommand);
        expect(input).toBe('/agent list');
    });

    test('keeps mention-prefixed slash command unchanged', () => {
        const input = deriveCommandInput('@docu /new trainingForForexTrading', 'new', isKnownCommand);
        expect(input).toBe('@docu /new trainingForForexTrading');
    });
});
