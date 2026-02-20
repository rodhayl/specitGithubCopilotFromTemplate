import { TestRunner } from '../../src/commands/TestRunner';

describe('TestRunner', () => {
    function createRunner(): TestRunner {
        return new TestRunner(
            {} as any,
            {} as any,
            {} as any,
            {} as any
        );
    }

    it('exposes conversation group selectors', () => {
        const runner = createRunner();
        const groups = runner.getGroups();

        expect(groups).toContain('conversation');
        expect(groups).toContain('conversations');
        expect(groups).toContain('full');
    });

    it('includes conversation scenarios in scenario catalog', () => {
        const runner = createRunner();
        const conversationScenarios = runner
            .listScenarios()
            .filter((scenario) => scenario.group === 'conversation');

        expect(conversationScenarios.length).toBeGreaterThanOrEqual(4);
        expect(conversationScenarios.map((s) => s.id)).toEqual(
            expect.arrayContaining([
                'conversation:non-kickoff-routes-to-agent',
                'conversation:resume-after-done',
                'conversation:switch-requires-confirmation',
                'conversation:confirm-switch-creates-new-doc'
            ])
        );
    });
});
