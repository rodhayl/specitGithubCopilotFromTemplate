/**
 * Unit tests for StateManager
 * Covers singleton pattern, component registration, retrieval, and state transitions.
 */
import { StateManager } from '../../src/state/StateManager';

const vscode = require('vscode');

describe('StateManager', () => {
    let mockContext: any;

    beforeEach(() => {
        // Reset singleton between tests
        (StateManager as any).instance = undefined;

        mockContext = {
            subscriptions: [],
            extensionUri: { fsPath: '/ext' },
            extensionPath: '/ext',
            extension: { packageJSON: { version: '0.1.0' } },
            globalState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
            workspaceState: { get: jest.fn(), update: jest.fn(), keys: jest.fn(() => []) },
            secrets: { get: jest.fn(), store: jest.fn(), delete: jest.fn() },
            asAbsolutePath: jest.fn((p: string) => `/ext/${p}`),
            storagePath: '/storage',
            globalStoragePath: '/global-storage',
            logPath: '/logs',
            extensionMode: 1,
        };
    });

    describe('getInstance()', () => {
        it('should return a singleton instance', () => {
            const instance1 = StateManager.getInstance(mockContext);
            const instance2 = StateManager.getInstance();
            expect(instance1).toBe(instance2);
        });

        it('should throw when called without context on first use', () => {
            expect(() => StateManager.getInstance()).toThrow(
                'StateManager requires extension context for initialization'
            );
        });

        it('should use a cached instance even when called without context after first init', () => {
            const first = StateManager.getInstance(mockContext);
            const second = StateManager.getInstance(); // no context
            expect(second).toBe(first);
        });
    });

    describe('initialize()', () => {
        it('should complete without throwing', async () => {
            const manager = StateManager.getInstance(mockContext);
            await expect(manager.initialize()).resolves.not.toThrow();
        });
    });

    describe('registerComponent() / getComponent()', () => {
        let manager: StateManager;

        beforeEach(async () => {
            manager = StateManager.getInstance(mockContext);
            await manager.initialize();
        });

        it('should store and retrieve a component', () => {
            const component = { foo: 'bar' };
            manager.registerComponent('myComponent', component);
            expect(manager.getComponent('myComponent')).toBe(component);
        });

        it('should return undefined for unregistered component', () => {
            expect(manager.getComponent('nonExistent')).toBeUndefined();
        });

        it('should mark the component as initialized after registration', () => {
            manager.registerComponent('logger', { extension: { info: jest.fn() } });
            // For known component names the status should update
            // (stateManager tracks known components in initializationOrder)
            expect(manager.isComponentInitialized('logger')).toBe(true);
        });

        it('should overwrite a previously registered component', () => {
            const v1 = { version: 1 };
            const v2 = { version: 2 };
            manager.registerComponent('config', v1);
            manager.registerComponent('config', v2);
            expect(manager.getComponent('config')).toBe(v2);
        });
    });
});
