// Unit tests for OfflineManager
import * as assert from 'assert';
import { OfflineManager } from '../../offline/OfflineManager';

suite('OfflineManager Unit Tests', () => {
    let offlineManager: OfflineManager;

    setup(() => {
        offlineManager = OfflineManager.getInstance();
    });

    test('Should be singleton', () => {
        const instance1 = OfflineManager.getInstance();
        const instance2 = OfflineManager.getInstance();
        assert.strictEqual(instance1, instance2, 'Should return same instance');
    });

    test('Should start in online mode', () => {
        // Reset to online mode for test
        offlineManager.disableOfflineMode();
        assert.strictEqual(offlineManager.isOffline(), false, 'Should start in online mode');
    });

    test('Should enable offline mode', () => {
        offlineManager.enableOfflineMode('Test reason');
        assert.strictEqual(offlineManager.isOffline(), true, 'Should be in offline mode');
    });

    test('Should disable offline mode', () => {
        offlineManager.enableOfflineMode('Test reason');
        assert.strictEqual(offlineManager.isOffline(), true, 'Should be in offline mode');
        
        offlineManager.disableOfflineMode();
        assert.strictEqual(offlineManager.isOffline(), false, 'Should be back online');
    });

    test('Should provide correct capabilities in online mode', () => {
        offlineManager.disableOfflineMode();
        const capabilities = offlineManager.getCapabilities();

        assert.strictEqual(capabilities.fileOperations, true);
        assert.strictEqual(capabilities.templateProcessing, true);
        assert.strictEqual(capabilities.basicCommands, true);
        assert.strictEqual(capabilities.aiFeatures, true);
        assert.strictEqual(capabilities.networkRequiredFeatures.length, 0);
    });

    test('Should provide correct capabilities in offline mode', () => {
        offlineManager.enableOfflineMode('Test offline mode');
        const capabilities = offlineManager.getCapabilities();

        assert.strictEqual(capabilities.fileOperations, true);
        assert.strictEqual(capabilities.templateProcessing, true);
        assert.strictEqual(capabilities.basicCommands, true);
        assert.strictEqual(capabilities.aiFeatures, false);
        assert.ok(capabilities.networkRequiredFeatures.length > 0);
    });

    test('Should validate operations in online mode', () => {
        offlineManager.disableOfflineMode();
        
        const operations = [
            'readFile',
            'writeFile',
            'applyTemplate',
            'generateContent',
            'reviewDocument'
        ];

        for (const operation of operations) {
            const result = offlineManager.validateOperation(operation);
            assert.strictEqual(result.allowed, true, `Operation should be allowed online: ${operation}`);
        }
    });

    test('Should validate operations in offline mode', () => {
        offlineManager.enableOfflineMode('Test offline validation');
        
        const allowedOperations = [
            'readFile',
            'writeFile',
            'listFiles',
            'applyTemplate',
            'insertSection',
            'openInEditor'
        ];

        const blockedOperations = [
            'generateContent',
            'reviewDocument',
            'aiAssistance'
        ];

        for (const operation of allowedOperations) {
            const result = offlineManager.validateOperation(operation);
            assert.strictEqual(result.allowed, true, `Operation should be allowed offline: ${operation}`);
        }

        for (const operation of blockedOperations) {
            const result = offlineManager.validateOperation(operation);
            assert.strictEqual(result.allowed, false, `Operation should be blocked offline: ${operation}`);
            assert.ok(result.reason, `Should have reason for blocking: ${operation}`);
        }
    });

    test('Should provide fallback responses', async () => {
        const operations = [
            'document-creation',
            'document-review',
            'template-suggestion',
            'content-generation',
            'unknown-operation'
        ];

        for (const operation of operations) {
            const response = await offlineManager.getFallbackResponse(operation);
            assert.ok(typeof response === 'string', `Should return string response for: ${operation}`);
            assert.ok(response.length > 0, `Should return non-empty response for: ${operation}`);
        }
    });

    test('Should provide contextual fallback for document creation', async () => {
        const response = await offlineManager.getFallbackResponse('document-creation', {
            title: 'Test Document'
        });

        assert.ok(response.includes('Test Document'), 'Should include provided title');
        assert.ok(response.includes('offline mode'), 'Should mention offline mode');
    });

    test('Should provide offline error messages', () => {
        const operations = ['generateContent', 'reviewDocument', 'aiChat'];

        for (const operation of operations) {
            const message = offlineManager.getOfflineErrorMessage(operation);
            assert.ok(typeof message === 'string', `Should return string message for: ${operation}`);
            assert.ok(message.includes(operation), `Should mention operation: ${operation}`);
            assert.ok(message.includes('offline mode'), 'Should mention offline mode');
        }
    });

    test('Should handle multiple enable/disable cycles', () => {
        // Test multiple cycles
        for (let i = 0; i < 5; i++) {
            offlineManager.enableOfflineMode(`Test cycle ${i}`);
            assert.strictEqual(offlineManager.isOffline(), true, `Should be offline in cycle ${i}`);
            
            offlineManager.disableOfflineMode();
            assert.strictEqual(offlineManager.isOffline(), false, `Should be online in cycle ${i}`);
        }
    });

    test('Should not change state when already in target mode', () => {
        // Test enabling when already offline
        offlineManager.enableOfflineMode('First enable');
        assert.strictEqual(offlineManager.isOffline(), true);
        
        offlineManager.enableOfflineMode('Second enable');
        assert.strictEqual(offlineManager.isOffline(), true, 'Should remain offline');

        // Test disabling when already online
        offlineManager.disableOfflineMode();
        assert.strictEqual(offlineManager.isOffline(), false);
        
        offlineManager.disableOfflineMode();
        assert.strictEqual(offlineManager.isOffline(), false, 'Should remain online');
    });
});