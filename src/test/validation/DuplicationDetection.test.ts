import { describe, it, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('Code Duplication Detection Tests', () => {
    
    describe('Duplicate Class Detection', () => {
        it('should not have duplicate class names across the codebase', async () => {
            const classNames = new Map<string, string[]>();
            const files = await getAllTypeScriptFiles('src');

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                // Extract exported class names
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
            }

            // Check for duplicates
            const duplicates: string[] = [];
            for (const [className, files] of classNames) {
                if (files.length > 1) {
                    duplicates.push(`Class ${className} found in: ${files.join(', ')}`);
                }
            }

            expect(duplicates).toEqual([]);
        });

        it('should not have duplicate interface names across the codebase', async () => {
            const interfaceNames = new Map<string, string[]>();
            const files = await getAllTypeScriptFiles('src');

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                // Extract exported interface names
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
            }

            // Check for duplicates (allow some common interfaces)
            const allowedDuplicates = ['Config', 'Options', 'Result', 'Response'];
            const duplicates: string[] = [];
            
            for (const [interfaceName, files] of interfaceNames) {
                if (files.length > 1 && !allowedDuplicates.includes(interfaceName)) {
                    duplicates.push(`Interface ${interfaceName} found in: ${files.join(', ')}`);
                }
            }

            expect(duplicates).toEqual([]);
        });
    });

    describe('Duplicate Function Detection', () => {
        it('should not have duplicate utility functions', async () => {
            const functionSignatures = new Map<string, string[]>();
            const files = await getAllTypeScriptFiles('src');

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                // Extract function signatures (simplified)
                const functionMatches = content.match(/export\s+function\s+(\w+)\s*\([^)]*\)/g);
                if (functionMatches) {
                    for (const match of functionMatches) {
                        const signature = match.replace(/export\s+/, '');
                        if (!functionSignatures.has(signature)) {
                            functionSignatures.set(signature, []);
                        }
                        functionSignatures.get(signature)!.push(file);
                    }
                }
            }

            // Check for duplicates
            const duplicates: string[] = [];
            for (const [signature, files] of functionSignatures) {
                if (files.length > 1) {
                    duplicates.push(`Function ${signature} found in: ${files.join(', ')}`);
                }
            }

            expect(duplicates).toEqual([]);
        });

        it('should not have similar method implementations', async () => {
            const methodPatterns = new Map<string, string[]>();
            const files = await getAllTypeScriptFiles('src');

            // Common patterns that might indicate duplication
            const patterns = [
                /async\s+\w+\s*\([^)]*\):\s*Promise<[^>]+>\s*{[^}]*validate[^}]*}/g,
                /\w+\s*\([^)]*\):\s*\w+\s*{[^}]*sanitize[^}]*}/g,
                /\w+\s*\([^)]*\):\s*\w+\s*{[^}]*format[^}]*}/g
            ];

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                for (const pattern of patterns) {
                    const matches = content.match(pattern);
                    if (matches) {
                        for (const match of matches) {
                            const normalized = match.replace(/\s+/g, ' ').substring(0, 100);
                            if (!methodPatterns.has(normalized)) {
                                methodPatterns.set(normalized, []);
                            }
                            methodPatterns.get(normalized)!.push(file);
                        }
                    }
                }
            }

            // Check for suspicious similarities
            const suspiciousDuplicates: string[] = [];
            for (const [pattern, files] of methodPatterns) {
                if (files.length > 1) {
                    suspiciousDuplicates.push(`Similar method pattern found in: ${files.join(', ')}`);
                }
            }

            // This is a warning test - we expect some similarities but not exact duplicates
            if (suspiciousDuplicates.length > 5) {
                console.warn('Many similar method patterns detected:', suspiciousDuplicates);
            }
        });
    });

    describe('Removed Duplicate Files Detection', () => {
        it('should verify that duplicate manager files have been removed', () => {
            const removedFiles = [
                'src/conversation/ConversationFeedbackManager.ts',
                'src/conversation/ConversationRecoveryManager.ts',
                'src/conversation/ConversationContinuationManager.ts',
                'src/commands/FeedbackCoordinator.ts'
            ];

            for (const file of removedFiles) {
                expect(fs.existsSync(file)).toBe(false);
            }
        });

        it('should verify that imports to removed files have been cleaned up', async () => {
            const files = await getAllTypeScriptFiles('src');
            const problematicImports: string[] = [];

            const removedClasses = [
                'ConversationFeedbackManager',
                'ConversationRecoveryManager', 
                'ConversationContinuationManager',
                'FeedbackCoordinator'
            ];

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                
                for (const className of removedClasses) {
                    if (content.includes(`import.*${className}`) || 
                        content.includes(`from.*${className}`)) {
                        problematicImports.push(`${file} still imports ${className}`);
                    }
                }
            }

            expect(problematicImports).toEqual([]);
        });
    });

    describe('Singleton Pattern Validation', () => {
        it('should verify that core services use singleton pattern', async () => {
            const singletonServices = [
                'ConversationManager',
                'OutputCoordinator', 
                'TemplateService',
                'MessageFormatter'
            ];

            const files = await getAllTypeScriptFiles('src');
            const singletonIssues: string[] = [];

            for (const service of singletonServices) {
                const serviceFiles = files.filter(f => f.includes(service));
                
                for (const file of serviceFiles) {
                    const content = await fs.promises.readFile(file, 'utf-8');
                    
                    // Check for singleton pattern
                    if (content.includes(`class ${service}`) && 
                        !content.includes('private static instance') &&
                        !content.includes('getInstance()')) {
                        singletonIssues.push(`${service} in ${file} may not implement singleton pattern`);
                    }
                }
            }

            expect(singletonIssues).toEqual([]);
        });
    });

    describe('Architecture Consistency', () => {
        it('should verify consistent import patterns', async () => {
            const files = await getAllTypeScriptFiles('src');
            const inconsistentImports: string[] = [];

            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                const lines = content.split('\n');
                
                // Check for consistent VS Code import pattern
                const vscodeImports = lines.filter(line => line.includes("import") && line.includes("vscode"));
                for (const importLine of vscodeImports) {
                    if (!importLine.includes("import * as vscode from 'vscode'") && 
                        !importLine.includes('import { ') && 
                        importLine.includes('vscode')) {
                        inconsistentImports.push(`${file}: ${importLine.trim()}`);
                    }
                }
            }

            expect(inconsistentImports).toEqual([]);
        });

        it('should verify no circular dependencies', async () => {
            const files = await getAllTypeScriptFiles('src');
            const dependencies = new Map<string, string[]>();

            // Build dependency graph
            for (const file of files) {
                const content = await fs.promises.readFile(file, 'utf-8');
                const imports = content.match(/import.*from\s+['"]([^'"]+)['"]/g) || [];
                
                const fileDeps: string[] = [];
                for (const importLine of imports) {
                    const match = importLine.match(/from\s+['"]([^'"]+)['"]/);
                    if (match && match[1].startsWith('.')) {
                        // Resolve relative import
                        const resolvedPath = path.resolve(path.dirname(file), match[1]);
                        fileDeps.push(resolvedPath);
                    }
                }
                
                dependencies.set(file, fileDeps);
            }

            // Simple circular dependency check (could be more sophisticated)
            const circularDeps: string[] = [];
            for (const [file, deps] of dependencies) {
                for (const dep of deps) {
                    const depDeps = dependencies.get(dep) || [];
                    if (depDeps.includes(file)) {
                        circularDeps.push(`Circular dependency: ${file} <-> ${dep}`);
                    }
                }
            }

            expect(circularDeps).toEqual([]);
        });
    });
});

// Helper function to get all TypeScript files
async function getAllTypeScriptFiles(directory: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dir: string): Promise<void> => {
        if (!fs.existsSync(dir)) {
            return;
        }
        
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            
            if (entry.isDirectory() && 
                !entry.name.startsWith('.') && 
                entry.name !== 'node_modules' &&
                entry.name !== 'out') {
                await scanDirectory(fullPath);
            } else if (entry.isFile() && 
                       entry.name.endsWith('.ts') && 
                       !entry.name.endsWith('.d.ts') &&
                       !entry.name.endsWith('.test.ts') &&
                       !entry.name.endsWith('.spec.ts')) {
                files.push(fullPath);
            }
        }
    };

    await scanDirectory(directory);
    return files;
}