/**
 * Unit tests for LLMService
 * Covers model selection, message role mapping, request/streaming, and error handling.
 */
import { LLMService } from '../../src/llm/LLMService';
import { LLMRequest } from '../../src/llm/types';

const vscode = require('vscode');

describe('LLMService', () => {
    let service: LLMService;

    const mockModel = {
        id: 'gpt-4o',
        name: 'GPT-4o',
        vendor: 'copilot',
        family: 'gpt-4o',
        maxInputTokens: 128000,
        sendRequest: jest.fn(),
    };

    beforeEach(() => {
        jest.clearAllMocks();
        service = new LLMService();
    });

    describe('initialize()', () => {
        it('should select gpt-4o family models first', async () => {
            vscode.lm.selectChatModels.mockResolvedValueOnce([mockModel]);

            await service.initialize();

            expect(vscode.lm.selectChatModels).toHaveBeenCalledWith({
                vendor: 'copilot',
                family: 'gpt-4o',
            });
        });

        it('should fall back to any Copilot model when no gpt-4o models are available', async () => {
            vscode.lm.selectChatModels
                .mockResolvedValueOnce([]) // no gpt-4o
                .mockResolvedValueOnce([mockModel]); // fallback

            await service.initialize();

            expect(vscode.lm.selectChatModels).toHaveBeenCalledTimes(2);
            expect(vscode.lm.selectChatModels).toHaveBeenNthCalledWith(2, { vendor: 'copilot' });
        });

        it('should throw when no Copilot models are available at all', async () => {
            vscode.lm.selectChatModels.mockRejectedValueOnce(new Error('No models'));

            await expect(service.initialize()).rejects.toThrow('GitHub Copilot is not available');
        });

        it('should expose model info after successful initialization', async () => {
            vscode.lm.selectChatModels.mockResolvedValueOnce([mockModel]);

            await service.initialize();

            const models = service.getAvailableModels();
            expect(models).toHaveLength(1);
            expect(models[0]).toMatchObject({ id: 'gpt-4o', vendor: 'copilot' });
        });
    });

    describe('sendRequest() — message role mapping', () => {
        const makeTextStream = (text: string) => ({
            text: (async function* () { yield text; })(),
        });

        beforeEach(async () => {
            vscode.lm.selectChatModels.mockResolvedValueOnce([mockModel]);
            await service.initialize();
        });

        it('should map user messages using LanguageModelChatMessage.User()', async () => {
            mockModel.sendRequest.mockResolvedValueOnce(makeTextStream('response'));
            vscode.LanguageModelChatMessage = {
                User: jest.fn((content: string) => ({ role: 'user', content })),
                Assistant: jest.fn((content: string) => ({ role: 'assistant', content })),
            };

            const request: LLMRequest = {
                messages: [{ role: 'user', content: 'Hello' }],
            };

            await service.sendRequest(request);

            const sentMessages = mockModel.sendRequest.mock.calls[0][0];
            expect(sentMessages[0]).toMatchObject({ role: 'user', content: 'Hello' });
        });

        it('should map assistant messages using LanguageModelChatMessage.Assistant()', async () => {
            mockModel.sendRequest.mockResolvedValueOnce(makeTextStream('ok'));
            vscode.LanguageModelChatMessage = {
                User: jest.fn((content: string) => ({ role: 'user', content })),
                Assistant: jest.fn((content: string) => ({ role: 'assistant', content })),
            };

            const request: LLMRequest = {
                messages: [
                    { role: 'user', content: 'question' },
                    { role: 'assistant', content: 'previous answer' },
                    { role: 'user', content: 'follow-up' },
                ],
            };

            await service.sendRequest(request);

            const sentMessages = mockModel.sendRequest.mock.calls[0][0];
            expect(sentMessages[1]).toMatchObject({ role: 'assistant', content: 'previous answer' });
        });

        it('should use the requestedModel param over selectModel()', async () => {
            const alternateModel = { ...mockModel, id: 'gpt-4-turbo', sendRequest: jest.fn() };
            alternateModel.sendRequest.mockResolvedValueOnce(makeTextStream('alt'));

            const request: LLMRequest = {
                messages: [{ role: 'user', content: 'test' }],
            };

            await service.sendRequest(request, undefined, alternateModel as any);

            expect(alternateModel.sendRequest).toHaveBeenCalled();
            expect(mockModel.sendRequest).not.toHaveBeenCalled();
        });

        it('should throw when no models are available', async () => {
            // Create a fresh service with no models initialized
            const emptyService = new LLMService();

            const request: LLMRequest = {
                messages: [{ role: 'user', content: 'test' }],
            };

            await expect(emptyService.sendRequest(request)).rejects.toThrow(
                'No language models available'
            );
        });
    });

    describe('sendStreamingRequest()', () => {
        beforeEach(async () => {
            vscode.lm.selectChatModels.mockResolvedValueOnce([mockModel]);
            await service.initialize();
        });

        it('should call onChunk for each yielded text fragment', async () => {
            const fragments = ['Hello', ', ', 'world!'];
            mockModel.sendRequest.mockResolvedValueOnce({
                text: (async function* () {
                    for (const f of fragments) { yield f; }
                })(),
            });

            const chunks: string[] = [];
            await service.sendStreamingRequest(
                { messages: [{ role: 'user', content: 'hi' }] },
                (chunk) => { if (chunk.content) { chunks.push(chunk.content); } },
            );

            expect(chunks).toEqual(fragments);
        });
    });
});
