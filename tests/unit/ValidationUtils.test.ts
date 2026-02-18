/**
 * Unit tests for ValidationUtils
 * Covers all static validation methods.
 */
import { ValidationUtils } from '../../src/utils/ValidationUtils';

describe('ValidationUtils', () => {
    describe('isNotNull()', () => {
        it('should return true for a non-null value', () => {
            expect(ValidationUtils.isNotNull('hello')).toBe(true);
            expect(ValidationUtils.isNotNull(0)).toBe(true);
            expect(ValidationUtils.isNotNull(false)).toBe(true);
            expect(ValidationUtils.isNotNull({})).toBe(true);
        });

        it('should return false for null', () => {
            expect(ValidationUtils.isNotNull(null)).toBe(false);
        });

        it('should return false for undefined', () => {
            expect(ValidationUtils.isNotNull(undefined)).toBe(false);
        });
    });

    describe('isNotEmpty()', () => {
        it('should return true for a non-empty string', () => {
            expect(ValidationUtils.isNotEmpty('hello')).toBe(true);
            expect(ValidationUtils.isNotEmpty(' a ')).toBe(true);
        });

        it('should return false for an empty string', () => {
            expect(ValidationUtils.isNotEmpty('')).toBe(false);
        });

        it('should return false for whitespace-only string', () => {
            expect(ValidationUtils.isNotEmpty('   ')).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(ValidationUtils.isNotEmpty(null)).toBe(false);
            expect(ValidationUtils.isNotEmpty(undefined)).toBe(false);
        });
    });

    describe('isNotEmptyArray()', () => {
        it('should return true for a non-empty array', () => {
            expect(ValidationUtils.isNotEmptyArray([1, 2, 3])).toBe(true);
        });

        it('should return false for an empty array', () => {
            expect(ValidationUtils.isNotEmptyArray([])).toBe(false);
        });

        it('should return false for null/undefined', () => {
            expect(ValidationUtils.isNotEmptyArray(null)).toBe(false);
            expect(ValidationUtils.isNotEmptyArray(undefined)).toBe(false);
        });
    });

    describe('hasRequiredProperties()', () => {
        it('should return true when all required props are present', () => {
            expect(ValidationUtils.hasRequiredProperties({ a: 1, b: 2 }, ['a', 'b'])).toBe(true);
        });

        it('should return false when a required prop is missing', () => {
            expect(ValidationUtils.hasRequiredProperties({ a: 1 }, ['a', 'b'])).toBe(false);
        });

        it('should return false for null objects', () => {
            expect(ValidationUtils.hasRequiredProperties(null, ['a'])).toBe(false);
        });
    });

    describe('isValidFilePath()', () => {
        it('should return true for a valid file path', () => {
            expect(ValidationUtils.isValidFilePath('/workspace/docs/PRD.md')).toBe(true);
            expect(ValidationUtils.isValidFilePath('relative/path/file.ts')).toBe(true);
        });

        it('should return false for paths with invalid characters', () => {
            expect(ValidationUtils.isValidFilePath('file<name>.md')).toBe(false);
            expect(ValidationUtils.isValidFilePath('file|name.md')).toBe(false);
        });

        it('should return false for Windows reserved names', () => {
            expect(ValidationUtils.isValidFilePath('CON')).toBe(false);
            expect(ValidationUtils.isValidFilePath('docs/NUL.txt')).toBe(false);
        });

        it('should return false for empty string', () => {
            expect(ValidationUtils.isValidFilePath('')).toBe(false);
        });
    });

    describe('isValidTemplateId()', () => {
        it('should accept valid template IDs', () => {
            expect(ValidationUtils.isValidTemplateId('prd-template')).toBe(true);
            expect(ValidationUtils.isValidTemplateId('basic')).toBe(true);
            expect(ValidationUtils.isValidTemplateId('my-template-v2')).toBe(true);
        });

        it('should reject IDs with uppercase letters', () => {
            expect(ValidationUtils.isValidTemplateId('MyTemplate')).toBe(false);
        });

        it('should reject IDs with spaces or special characters', () => {
            expect(ValidationUtils.isValidTemplateId('my template')).toBe(false);
            expect(ValidationUtils.isValidTemplateId('my_template')).toBe(false);
        });

        it('should reject empty string', () => {
            expect(ValidationUtils.isValidTemplateId('')).toBe(false);
        });
    });

    describe('isValidAgentName()', () => {
        it('should accept valid agent names', () => {
            expect(ValidationUtils.isValidAgentName('prd-creator')).toBe(true);
            expect(ValidationUtils.isValidAgentName('requirements-gatherer')).toBe(true);
        });

        it('should reject names with uppercase letters', () => {
            expect(ValidationUtils.isValidAgentName('PRDCreator')).toBe(false);
        });
    });

    describe('isInRange()', () => {
        it('should return true when value is within range', () => {
            expect(ValidationUtils.isInRange(5, 0, 10)).toBe(true);
            expect(ValidationUtils.isInRange(0, 0, 10)).toBe(true);
            expect(ValidationUtils.isInRange(10, 0, 10)).toBe(true);
        });

        it('should return false when value is outside range', () => {
            expect(ValidationUtils.isInRange(-1, 0, 10)).toBe(false);
            expect(ValidationUtils.isInRange(11, 0, 10)).toBe(false);
        });

        it('should return false for NaN', () => {
            expect(ValidationUtils.isInRange(NaN, 0, 10)).toBe(false);
        });
    });

    describe('isValidJson()', () => {
        it('should return true for valid JSON', () => {
            expect(ValidationUtils.isValidJson('{"key":"value"}')).toBe(true);
            expect(ValidationUtils.isValidJson('[1,2,3]')).toBe(true);
            expect(ValidationUtils.isValidJson('"string"')).toBe(true);
        });

        it('should return false for invalid JSON', () => {
            expect(ValidationUtils.isValidJson('{invalid}')).toBe(false);
            expect(ValidationUtils.isValidJson('')).toBe(false);
        });
    });

    describe('isValidMarkdown()', () => {
        it('should return true for markdown with balanced code blocks', () => {
            const content = '# Title\n\n```\ncode\n```\n\nText';
            expect(ValidationUtils.isValidMarkdown(content)).toBe(true);
        });

        it('should return false for markdown with unbalanced code blocks', () => {
            const content = '# Title\n\n```\nunclosed code block\n\nText';
            expect(ValidationUtils.isValidMarkdown(content)).toBe(false);
        });

        it('should return true for plain markdown with no code blocks', () => {
            expect(ValidationUtils.isValidMarkdown('# Hello\n\nworld')).toBe(true);
        });
    });
});
