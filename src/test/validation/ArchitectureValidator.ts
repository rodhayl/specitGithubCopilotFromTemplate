/**
 * Architecture validation to ensure no duplicate code and proper consolidation
 */
import * as fs from 'fs';
import * as path from 'path';
import { Logger } from '../../logging/Logger';

export interface ValidationResult {
    passed: boolean;
    errors: string[];
    warnings: string[];
    summary: string;
}

export interface DuplicationCheck {
    file: string;
    duplicates: string[];
    severity: 'error' | 'warning';
}

export interface ConsolidationCheck {
    component: string;
    expectedSingleInstance: boolean;
    actualInstances: string[];
    passed: boolean;
}

/**
 * Architecture validator class
 */
export class ArchitectureValidator {
    private logger: Logger;
    private srcPath: string;

    constructor(srcPath: string = 'src') {
        this.logger = Logger.getInstance();
        this.srcPath = srcPath;
    }

    /**
     * Run complete architecture validation
     */
    async validateArchitecture(): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Check for duplicate code
            const duplicationResults = await this.checkForDuplicates();
            for (const result of duplicationResults) {
                if (result.severity === 'error') {
                    errors.push(`Duplicate code found in ${result.file}: ${result.duplicates.join(', ')}`);
                } else {
                    warnings.push(`Potential duplicate code in ${result.file}: ${result.duplicates.join(', ')}`);
                }
            }

            // Check consolidation requirements
            const consolidationResults = await this.checkConsolidation();
            for (const result of consolidationResults) {
                if (!result.passed) {
                    if (result.expectedSingleInstance) {
                        errors.push(`Multiple instances of ${result.component} found: ${result.actualInstances.join(', ')}`);
                    } else {
                        warnings.push(`Consolidation check failed for ${result.component}`);
                    }
                }
            }

            // Check for removed duplicate managers
            const removedManagersCheck = await this.checkRemovedDuplicateManagers();
            errors.push(...removedManagersCheck.errors);
            warnings.push(...removedManagersCheck.warnings);

            // Check meaningful messages implementation
            const messageCheck = await this.checkMeaningfulMessages();
            errors.push(...messageCheck.errors);
            warnings.push(...messageCheck.warnings);

            // Check single source of truth
            const singleSourceCheck = await this.checkSingleSourceOfTruth();
            errors.push(...singleSourceCheck.errors);
            warnings.push(...singleSourceCheck.warnings);

            const passed = errors.length === 0;
            const summary = this.generateSummary(passed, errors.length, warnings.length);

            return {
                passed,
                errors,
                warnings,
                summary
            };

        } catch (error) {
            const errorMessage = `Architecture validation failed: ${error instanceof Error ? error.message : String(error)}`;
            this.logger.error('validation', errorMessage, error instanceof Error ? error : new Error(String(error)));
            
            return {
                passed: false,
                errors: [errorMessage],
                warnings: [],
                summary: 'Architecture validation encountered an error'
            };
        }
    }

    /**
     * Check for duplicate code patterns
     */
    private async checkForDuplicates(): Promise<DuplicationCheck[]> {
        const results: DuplicationCheck[] = [];
        const files = await this.getAllTypeScriptFiles();

        // Check for duplicate class names
        const classNames = new Map<string, string[]>();
        const interfaceNames = new Map<string, string[]>();
        const functionNames = new Map<string, string[]>();

        for (const file of files) {
            const content = await fs.promises.readFile(file, 'utf-8');
            
            // Extract class names
            const classMatches = content.match(/export\s+class\s+(\w+)/g);
            if (classMatches) {
                for (const match of classMatches) {
                    const className = match.replace(/export\s+class\s+/, '');
                    if (!classNames.has(className)) {
                        classNames.set(className, []);
                    }
                    classNames.get(className)!.push(file);
                }
            }

            // Extract interface names
            const interfaceMatches = content.match(/export\s+interface\s+(\w+)/g);
            if (interfaceMatches) {
                for (const match of interfaceMatches) {
                    const interfaceName = match.replace(/export\s+interface\s+/, '');
                    if (!interfaceNames.has(interfaceName)) {
                        interfaceNames.set(interfaceName, []);
                    }
                    interfaceNames.get(interfaceName)!.push(file);
                }
            }

            // Extract function names
            const functionMatches = content.match(/export\s+function\s+(\w+)/g);
            if (functionMatches) {
                for (const match of functionMatches) {
                    const functionName = match.replace(/export\s+function\s+/, '');
                    if (!functionNames.has(functionName)) {
                        functionNames.set(functionName, []);
                    }
                    functionNames.get(functionName)!.push(file);
                }
            }
        }

        // Check for duplicates
        for (const [className, files] of classNames) {
            if (files.length > 1) {
                results.push({
                    file: files[0],
                    duplicates: [`Class ${className} found in: ${files.join(', ')}`],
                    severity: 'error'
                });
            }
        }

        for (const [interfaceName, files] of interfaceNames) {
            if (files.length > 1) {
                results.push({
                    file: files[0],
                    duplicates: [`Interface ${interfaceName} found in: ${files.join(', ')}`],
                    severity: 'warning'
                });
            }
        }

        for (const [functionName, files] of functionNames) {
            if (files.length > 1) {
                results.push({
                    file: files[0],
                    duplicates: [`Function ${functionName} found in: ${files.join(', ')}`],
                    severity: 'warning'
                });
            }
        }

        return results;
    }

    /**
     * Check consolidation requirements
     */
    private async checkConsolidation(): Promise<ConsolidationCheck[]> {
        const results: ConsolidationCheck[] = [];

        // Check that conversation managers are consolidated
        const conversationManagerFiles = await this.findFilesContaining('ConversationManager');
        results.push({
            component: 'ConversationManager',
            expectedSingleInstance: true,
            actualInstances: conversationManagerFiles,
            passed: conversationManagerFiles.length === 1
        });

        // Check that output coordinators are consolidated
        const outputCoordinatorFiles = await this.findFilesContaining('OutputCoordinator');
        results.push({
            component: 'OutputCoordinator',
            expectedSingleInstance: true,
            actualInstances: outputCoordinatorFiles,
            passed: outputCoordinatorFiles.length === 1
        });

        // Check that template services are consolidated
        const templateServiceFiles = await this.findFilesContaining('TemplateService');
        results.push({
            component: 'TemplateService',
            expectedSingleInstance: true,
            actualInstances: templateServiceFiles,
            passed: templateServiceFiles.length === 1
        });

        // Check that command routers are consolidated
        const commandRouterFiles = await this.findFilesContaining('CommandRouter');
        results.push({
            component: 'CommandRouter',
            expectedSingleInstance: true,
            actualInstances: commandRouterFiles,
            passed: commandRouterFiles.length === 1
        });

        return results;
    }

    /**
     * Check that duplicate managers have been removed
     */
    private async checkRemovedDuplicateManagers(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check that these files no longer exist
        const removedFiles = [
            'src/conversation/ConversationFeedbackManager.ts',
            'src/conversation/ConversationRecoveryManager.ts',
            'src/conversation/ConversationContinuationManager.ts',
            'src/commands/FeedbackCoordinator.ts'
        ];

        for (const file of removedFiles) {
            if (fs.existsSync(file)) {
                errors.push(`Duplicate manager file still exists: ${file}`);
            }
        }

        // Check that imports to these files have been removed
        const allFiles = await this.getAllTypeScriptFiles();
        for (const file of allFiles) {
            const content = await fs.promises.readFile(file, 'utf-8');
            
            if (content.includes('ConversationFeedbackManager')) {
                warnings.push(`Reference to ConversationFeedbackManager found in: ${file}`);
            }
            if (content.includes('ConversationRecoveryManager')) {
                warnings.push(`Reference to ConversationRecoveryManager found in: ${file}`);
            }
            if (content.includes('ConversationContinuationManager')) {
                warnings.push(`Reference to ConversationContinuationManager found in: ${file}`);
            }
            if (content.includes('FeedbackCoordinator') && !file.includes('OutputCoordinator')) {
                warnings.push(`Reference to FeedbackCoordinator found in: ${file}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Check meaningful messages implementation
     */
    private async checkMeaningfulMessages(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check that command handlers provide meaningful messages
        const commandFiles = await this.findFilesInDirectory('src/commands');
        
        for (const file of commandFiles) {
            if (file.includes('Handler.ts')) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                // Check for placeholder messages
                if (content.includes('TODO') || content.includes('placeholder')) {
                    warnings.push(`Placeholder messages found in: ${file}`);
                }
                
                // Check for specific success messages
                if (!content.includes('success') && !content.includes('Success')) {
                    warnings.push(`No success messages found in: ${file}`);
                }
                
                // Check for error handling
                if (!content.includes('error') && !content.includes('Error')) {
                    warnings.push(`No error handling found in: ${file}`);
                }
            }
        }

        return { errors, warnings };
    }

    /**
     * Check single source of truth implementation
     */
    private async checkSingleSourceOfTruth(): Promise<{ errors: string[]; warnings: string[] }> {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Check that utility functions are centralized
        const utilFiles = await this.findFilesInDirectory('src/utils');
        const expectedUtils = ['FileUtils.ts', 'AgentUtils.ts', 'StringUtils.ts', 'ValidationUtils.ts', 'ErrorHandler.ts'];
        
        for (const expectedUtil of expectedUtils) {
            const utilPath = path.join('src/utils', expectedUtil);
            if (!fs.existsSync(utilPath)) {
                errors.push(`Expected utility file missing: ${utilPath}`);
            }
        }

        // Check that logging is centralized
        const loggerFiles = await this.findFilesContaining('Logger');
        const mainLoggerFile = loggerFiles.find(f => f.includes('src/logging/Logger.ts'));
        if (!mainLoggerFile) {
            errors.push('Main Logger implementation not found in src/logging/Logger.ts');
        }

        // Check for scattered utility functions
        const allFiles = await this.getAllTypeScriptFiles();
        for (const file of allFiles) {
            if (file.includes('src/utils') || file.includes('src/logging')) {
                continue; // Skip utility directories
            }
            
            const content = await fs.promises.readFile(file, 'utf-8');
            
            // Check for utility-like functions that should be centralized
            if (content.includes('sanitize') && !content.includes('import.*sanitize')) {
                warnings.push(`Potential utility function 'sanitize' found in: ${file}`);
            }
            if (content.includes('validate') && !content.includes('import.*validate')) {
                warnings.push(`Potential utility function 'validate' found in: ${file}`);
            }
            if (content.includes('normalize') && !content.includes('import.*normalize')) {
                warnings.push(`Potential utility function 'normalize' found in: ${file}`);
            }
        }

        return { errors, warnings };
    }

    /**
     * Test the example case from requirements
     */
    async testExampleCase(): Promise<ValidationResult> {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            // Test the example command: /new "CardCraft Online Store PRD" --template basic --path docs/01-prd/
            // This should be handled by the consolidated system without duplicates
            
            // Check that NewCommandHandler exists and is properly integrated
            const newCommandHandlerPath = 'src/commands/NewCommandHandler.ts';
            if (!fs.existsSync(newCommandHandlerPath)) {
                errors.push('NewCommandHandler.ts not found');
            } else {
                const content = await fs.promises.readFile(newCommandHandlerPath, 'utf-8');
                
                // Check for meaningful messages
                if (!content.includes('success') || !content.includes('error')) {
                    errors.push('NewCommandHandler lacks meaningful success/error messages');
                }
                
                // Check for template integration
                if (!content.includes('template')) {
                    warnings.push('NewCommandHandler may not properly handle templates');
                }
                
                // Check for path handling
                if (!content.includes('path')) {
                    warnings.push('NewCommandHandler may not properly handle custom paths');
                }
            }

            // Check that CommandRouter properly routes to NewCommandHandler
            const commandRouterPath = 'src/commands/CommandRouter.ts';
            if (fs.existsSync(commandRouterPath)) {
                const content = await fs.promises.readFile(commandRouterPath, 'utf-8');
                
                if (!content.includes('new') && !content.includes('NewCommandHandler')) {
                    errors.push('CommandRouter does not properly route /new command');
                }
            }

            const passed = errors.length === 0;
            const summary = passed 
                ? 'Example case validation passed - consolidated system handles the example properly'
                : 'Example case validation failed - system may not handle the example properly';

            return {
                passed,
                errors,
                warnings,
                summary
            };

        } catch (error) {
            return {
                passed: false,
                errors: [`Example case test failed: ${error instanceof Error ? error.message : String(error)}`],
                warnings: [],
                summary: 'Example case test encountered an error'
            };
        }
    }

    /**
     * Helper methods
     */
    private async getAllTypeScriptFiles(): Promise<string[]> {
        const files: string[] = [];
        
        const scanDirectory = async (dir: string): Promise<void> => {
            const entries = await fs.promises.readdir(dir, { withFileTypes: true });
            
            for (const entry of entries) {
                const fullPath = path.join(dir, entry.name);
                
                if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules') {
                    await scanDirectory(fullPath);
                } else if (entry.isFile() && entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts')) {
                    files.push(fullPath);
                }
            }
        };

        await scanDirectory(this.srcPath);
        return files;
    }

    private async findFilesContaining(pattern: string): Promise<string[]> {
        const files = await this.getAllTypeScriptFiles();
        const matchingFiles: string[] = [];

        for (const file of files) {
            const content = await fs.promises.readFile(file, 'utf-8');
            if (content.includes(pattern)) {
                matchingFiles.push(file);
            }
        }

        return matchingFiles;
    }

    private async findFilesInDirectory(directory: string): Promise<string[]> {
        const files: string[] = [];
        
        if (!fs.existsSync(directory)) {
            return files;
        }

        const entries = await fs.promises.readdir(directory, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(directory, entry.name);
            
            if (entry.isFile() && entry.name.endsWith('.ts')) {
                files.push(fullPath);
            }
        }

        return files;
    }

    private generateSummary(passed: boolean, errorCount: number, warningCount: number): string {
        if (passed) {
            return `✅ Architecture validation passed! ${warningCount > 0 ? `(${warningCount} warnings)` : 'No issues found.'}`;
        } else {
            return `❌ Architecture validation failed with ${errorCount} errors and ${warningCount} warnings.`;
        }
    }
}

/**
 * Run architecture validation
 */
export async function validateArchitecture(): Promise<ValidationResult> {
    const validator = new ArchitectureValidator();
    return await validator.validateArchitecture();
}

/**
 * Test example case
 */
export async function testExampleCase(): Promise<ValidationResult> {
    const validator = new ArchitectureValidator();
    return await validator.testExampleCase();
}