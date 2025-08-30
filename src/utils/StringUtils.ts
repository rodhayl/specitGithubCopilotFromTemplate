/**
 * Utility functions for string manipulation and validation
 */
export class StringUtils {
    /**
     * Sanitize a string for use as a filename
     */
    static sanitizeForFilename(input: string): string {
        return input
            .toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
            .replace(/\s+/g, '-') // Replace spaces with hyphens
            .replace(/-+/g, '-') // Replace multiple hyphens with single
            .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens
    }

    /**
     * Sanitize a string for use as an identifier
     */
    static sanitizeForIdentifier(input: string): string {
        return input
            .replace(/[^a-zA-Z0-9_]/g, '_')
            .replace(/^[0-9]/, '_$&') // Ensure doesn't start with number
            .replace(/_+/g, '_') // Replace multiple underscores with single
            .replace(/^_|_$/g, ''); // Remove leading/trailing underscores
    }

    /**
     * Truncate string to specified length with ellipsis
     */
    static truncate(text: string, maxLength: number, suffix: string = '...'): string {
        if (text.length <= maxLength) {
            return text;
        }
        return text.substring(0, maxLength - suffix.length) + suffix;
    }

    /**
     * Capitalize first letter of each word
     */
    static titleCase(text: string): string {
        return text.replace(/\w\S*/g, (txt) => 
            txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
        );
    }

    /**
     * Convert camelCase to kebab-case
     */
    static camelToKebab(text: string): string {
        return text.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
    }

    /**
     * Convert kebab-case to camelCase
     */
    static kebabToCamel(text: string): string {
        return text.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    }

    /**
     * Check if string is empty or only whitespace
     */
    static isBlank(text: string | null | undefined): boolean {
        return !text || text.trim().length === 0;
    }

    /**
     * Check if string is a valid email format
     */
    static isValidEmail(email: string): boolean {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    /**
     * Check if string is a valid URL format
     */
    static isValidUrl(url: string): boolean {
        try {
            new URL(url);
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Extract variables from template string (e.g., {{variable}})
     */
    static extractTemplateVariables(template: string): string[] {
        const variablePattern = /\{\{(\w+)\}\}/g;
        const variables: string[] = [];
        let match;
        
        while ((match = variablePattern.exec(template)) !== null) {
            if (!variables.includes(match[1])) {
                variables.push(match[1]);
            }
        }
        
        return variables;
    }

    /**
     * Replace template variables with values
     */
    static replaceTemplateVariables(template: string, variables: Record<string, string>): string {
        let result = template;
        
        for (const [key, value] of Object.entries(variables)) {
            const pattern = new RegExp(`\\{\\{${key}\\}\\}`, 'g');
            result = result.replace(pattern, value);
        }
        
        return result;
    }

    /**
     * Generate a random string of specified length
     */
    static generateRandomString(length: number, charset: string = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'): string {
        let result = '';
        for (let i = 0; i < length; i++) {
            result += charset.charAt(Math.floor(Math.random() * charset.length));
        }
        return result;
    }

    /**
     * Generate a unique identifier
     */
    static generateUniqueId(prefix: string = ''): string {
        const timestamp = Date.now().toString(36);
        const random = Math.random().toString(36).substr(2, 9);
        return prefix ? `${prefix}_${timestamp}_${random}` : `${timestamp}_${random}`;
    }

    /**
     * Count words in text
     */
    static countWords(text: string): number {
        return text.trim().split(/\s+/).filter(word => word.length > 0).length;
    }

    /**
     * Count lines in text
     */
    static countLines(text: string): number {
        return text.split('\n').length;
    }

    /**
     * Escape HTML special characters
     */
    static escapeHtml(text: string): string {
        const htmlEscapes: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#39;'
        };
        
        return text.replace(/[&<>"']/g, (match) => htmlEscapes[match]);
    }

    /**
     * Escape regex special characters
     */
    static escapeRegex(text: string): string {
        return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    /**
     * Compare two strings ignoring case and whitespace
     */
    static fuzzyEquals(a: string, b: string): boolean {
        const normalize = (str: string) => str.toLowerCase().replace(/\s+/g, '');
        return normalize(a) === normalize(b);
    }

    /**
     * Calculate similarity between two strings (0-1)
     */
    static similarity(a: string, b: string): number {
        if (a === b) return 1;
        if (a.length === 0 || b.length === 0) return 0;

        const longer = a.length > b.length ? a : b;
        const shorter = a.length > b.length ? b : a;

        if (longer.length === 0) return 1;

        const editDistance = this.levenshteinDistance(longer, shorter);
        return (longer.length - editDistance) / longer.length;
    }

    /**
     * Calculate Levenshtein distance between two strings
     */
    private static levenshteinDistance(a: string, b: string): number {
        const matrix = Array(b.length + 1).fill(null).map(() => Array(a.length + 1).fill(null));

        for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
        for (let j = 0; j <= b.length; j++) matrix[j][0] = j;

        for (let j = 1; j <= b.length; j++) {
            for (let i = 1; i <= a.length; i++) {
                const indicator = a[i - 1] === b[j - 1] ? 0 : 1;
                matrix[j][i] = Math.min(
                    matrix[j][i - 1] + 1, // deletion
                    matrix[j - 1][i] + 1, // insertion
                    matrix[j - 1][i - 1] + indicator // substitution
                );
            }
        }

        return matrix[b.length][a.length];
    }
}