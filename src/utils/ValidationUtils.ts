/**
 * Utility functions for validation operations
 */
export class ValidationUtils {
    /**
     * Validate that a value is not null or undefined
     */
    static isNotNull<T>(value: T | null | undefined): value is T {
        return value !== null && value !== undefined;
    }

    /**
     * Validate that a string is not empty or whitespace
     */
    static isNotEmpty(value: string | null | undefined): value is string {
        return this.isNotNull(value) && value.trim().length > 0;
    }

    /**
     * Validate that an array is not empty
     */
    static isNotEmptyArray<T>(value: T[] | null | undefined): value is T[] {
        return this.isNotNull(value) && Array.isArray(value) && value.length > 0;
    }

    /**
     * Validate that an object has all required properties
     */
    static hasRequiredProperties(obj: any, properties: string[]): boolean {
        if (!this.isNotNull(obj) || typeof obj !== 'object') {
            return false;
        }

        return properties.every(prop => prop in obj);
    }

    /**
     * Validate file path format
     */
    static isValidFilePath(filePath: string): boolean {
        if (!this.isNotEmpty(filePath)) {
            return false;
        }

        // Check for invalid characters
        const invalidChars = /[<>:"|?*]/;
        if (invalidChars.test(filePath)) {
            return false;
        }

        // Check for reserved names on Windows
        const reservedNames = /^(CON|PRN|AUX|NUL|COM[1-9]|LPT[1-9])(\.|$)/i;
        const fileName = filePath.split(/[/\\]/).pop() || '';
        if (reservedNames.test(fileName)) {
            return false;
        }

        return true;
    }

    /**
     * Validate template ID format
     */
    static isValidTemplateId(templateId: string): boolean {
        if (!this.isNotEmpty(templateId)) {
            return false;
        }

        // Template ID should be lowercase alphanumeric with hyphens
        const validPattern = /^[a-z0-9-]+$/;
        return validPattern.test(templateId);
    }

    /**
     * Validate agent name format
     */
    static isValidAgentName(agentName: string): boolean {
        if (!this.isNotEmpty(agentName)) {
            return false;
        }

        // Agent name should be lowercase alphanumeric with hyphens
        const validPattern = /^[a-z0-9-]+$/;
        return validPattern.test(agentName);
    }

    /**
     * Validate variable name format
     */
    static isValidVariableName(variableName: string): boolean {
        if (!this.isNotEmpty(variableName)) {
            return false;
        }

        // Variable name should be alphanumeric with underscores, starting with letter
        const validPattern = /^[a-zA-Z][a-zA-Z0-9_]*$/;
        return validPattern.test(variableName);
    }

    /**
     * Validate command name format
     */
    static isValidCommandName(commandName: string): boolean {
        if (!this.isNotEmpty(commandName)) {
            return false;
        }

        // Command name should be lowercase alphanumeric
        const validPattern = /^[a-z][a-z0-9]*$/;
        return validPattern.test(commandName);
    }

    /**
     * Validate that a number is within a range
     */
    static isInRange(value: number, min: number, max: number): boolean {
        return typeof value === 'number' && !isNaN(value) && value >= min && value <= max;
    }

    /**
     * Validate that a string length is within limits
     */
    static isValidLength(value: string, minLength: number = 0, maxLength: number = Infinity): boolean {
        if (!this.isNotNull(value)) {
            return false;
        }

        return value.length >= minLength && value.length <= maxLength;
    }

    /**
     * Validate JSON string
     */
    static isValidJson(jsonString: string): boolean {
        try {
            JSON.parse(jsonString);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Validate YAML front matter format
     */
    static isValidFrontMatter(content: string): boolean {
        if (!this.isNotEmpty(content)) {
            return false;
        }

        // Check if content starts with --- and has closing ---
        const frontMatterPattern = /^---\s*\n([\s\S]*?)\n---\s*\n/;
        return frontMatterPattern.test(content);
    }

    /**
     * Validate markdown content structure
     */
    static isValidMarkdown(content: string): boolean {
        if (!this.isNotNull(content)) {
            return false;
        }

        // Basic markdown validation - check for common issues
        const lines = content.split('\n');
        
        // Check for balanced code blocks
        let codeBlockCount = 0;
        for (const line of lines) {
            if (line.trim().startsWith('```')) {
                codeBlockCount++;
            }
        }
        
        // Code blocks should be balanced (even number)
        return codeBlockCount % 2 === 0;
    }

    /**
     * Validate template variable definition
     */
    static isValidTemplateVariable(variable: any): boolean {
        if (!this.isNotNull(variable) || typeof variable !== 'object') {
            return false;
        }

        const requiredProps = ['name', 'description', 'required', 'type'];
        if (!this.hasRequiredProperties(variable, requiredProps)) {
            return false;
        }

        // Validate variable name
        if (!this.isValidVariableName(variable.name)) {
            return false;
        }

        // Validate type
        const validTypes = ['string', 'number', 'boolean', 'array', 'object'];
        if (!validTypes.includes(variable.type)) {
            return false;
        }

        // Validate required is boolean
        if (typeof variable.required !== 'boolean') {
            return false;
        }

        return true;
    }

    /**
     * Validate template structure
     */
    static isValidTemplate(template: any): boolean {
        if (!this.isNotNull(template) || typeof template !== 'object') {
            return false;
        }

        const requiredProps = ['id', 'name', 'description', 'content', 'variables'];
        if (!this.hasRequiredProperties(template, requiredProps)) {
            return false;
        }

        // Validate template ID
        if (!this.isValidTemplateId(template.id)) {
            return false;
        }

        // Validate variables array
        if (!Array.isArray(template.variables)) {
            return false;
        }

        // Validate each variable
        for (const variable of template.variables) {
            if (!this.isValidTemplateVariable(variable)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate agent configuration
     */
    static isValidAgentConfig(agent: any): boolean {
        if (!this.isNotNull(agent) || typeof agent !== 'object') {
            return false;
        }

        const requiredProps = ['name', 'description', 'phase', 'systemPrompt'];
        if (!this.hasRequiredProperties(agent, requiredProps)) {
            return false;
        }

        // Validate agent name
        if (!this.isValidAgentName(agent.name)) {
            return false;
        }

        // Validate phase
        const validPhases = ['planning', 'requirements', 'design', 'implementation', 'review'];
        if (!validPhases.includes(agent.phase)) {
            return false;
        }

        return true;
    }

    /**
     * Validate command result structure
     */
    static isValidCommandResult(result: any): boolean {
        if (!this.isNotNull(result) || typeof result !== 'object') {
            return false;
        }

        // Must have success property
        if (typeof result.success !== 'boolean') {
            return false;
        }

        // If failed, should have error message
        if (!result.success && !this.isNotEmpty(result.error)) {
            return false;
        }

        return true;
    }

    /**
     * Sanitize and validate user input
     */
    static sanitizeInput(input: string, maxLength: number = 1000): string {
        if (!this.isNotNull(input)) {
            return '';
        }

        // Remove potentially dangerous characters
        let sanitized = input
            .replace(/[<>]/g, '') // Remove angle brackets
            .replace(/javascript:/gi, '') // Remove javascript: protocol
            .replace(/on\w+=/gi, '') // Remove event handlers
            .trim();

        // Truncate if too long
        if (sanitized.length > maxLength) {
            sanitized = sanitized.substring(0, maxLength);
        }

        return sanitized;
    }

    /**
     * Validate workspace path security
     */
    static isSecureWorkspacePath(filePath: string, workspaceRoot: string): boolean {
        if (!this.isNotEmpty(filePath) || !this.isNotEmpty(workspaceRoot)) {
            return false;
        }

        // Normalize paths
        const normalizedFile = filePath.replace(/\\/g, '/');
        const normalizedRoot = workspaceRoot.replace(/\\/g, '/');

        // Check for path traversal attempts
        if (normalizedFile.includes('../') || normalizedFile.includes('..\\')) {
            return false;
        }

        // Check if file is within workspace
        return normalizedFile.startsWith(normalizedRoot);
    }

    /**
     * Create validation result object
     */
    static createValidationResult(isValid: boolean, errors: string[] = []): ValidationResult {
        return {
            isValid,
            errors,
            hasErrors: errors.length > 0
        };
    }

    /**
     * Combine multiple validation results
     */
    static combineValidationResults(...results: ValidationResult[]): ValidationResult {
        const allErrors = results.flatMap(result => result.errors);
        const isValid = results.every(result => result.isValid);

        return this.createValidationResult(isValid, allErrors);
    }
}

/**
 * Validation result interface
 */
export interface ValidationResult {
    isValid: boolean;
    errors: string[];
    hasErrors: boolean;
}

/**
 * Validation error class
 */
export class ValidationError extends Error {
    constructor(
        message: string,
        public readonly field?: string,
        public readonly code?: string
    ) {
        super(message);
        this.name = 'ValidationError';
    }
}