/**
 * Normalize command input from VS Code ChatRequest fields.
 *
 * In some flows, VS Code provides the slash command name in `request.command`
 * while `request.prompt` only contains arguments. This helper reconstructs a
 * command string so routing remains consistent.
 */
export function deriveCommandInput(
    prompt: string,
    requestCommand: string | undefined,
    isKnownCommand: (candidate: string) => boolean
): string {
    const trimmedPrompt = prompt.trim();

    // Already a slash command (or mention-prefixed slash command handled later)
    if (trimmedPrompt.startsWith('/') || /^@\w+\s+\//.test(trimmedPrompt)) {
        return trimmedPrompt;
    }

    const rawCommand = (requestCommand ?? '').trim();
    if (!rawCommand) {
        return trimmedPrompt;
    }

    const normalizedCommand = rawCommand.startsWith('/') ? rawCommand.slice(1) : rawCommand;
    if (!normalizedCommand) {
        return trimmedPrompt;
    }

    const candidate = `/${normalizedCommand}`;
    if (!isKnownCommand(candidate)) {
        return trimmedPrompt;
    }

    return `${candidate}${trimmedPrompt ? ` ${trimmedPrompt}` : ''}`.trim();
}
