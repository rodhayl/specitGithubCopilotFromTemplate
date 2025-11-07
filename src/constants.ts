/**
 * Central constants file for the Docu extension
 * Contains only actively used constants to maintain a clean codebase
 */

/**
 * Agent names
 */
export const AGENTS = {
    PRD_CREATOR: 'prd-creator',
    BRAINSTORMER: 'brainstormer',
    REQUIREMENTS_GATHERER: 'requirements-gatherer',
    SOLUTION_ARCHITECT: 'solution-architect',
    SPECIFICATION_WRITER: 'specification-writer',
    QUALITY_REVIEWER: 'quality-reviewer'
} as const;

/**
 * Workflow phases
 */
export const WORKFLOW_PHASES = {
    PRD: 'prd',
    REQUIREMENTS: 'requirements',
    DESIGN: 'design',
    IMPLEMENTATION: 'implementation'
} as const;

/**
 * File paths and directories
 */
export const PATHS = {
    VSCODE_DIR: '.vscode',
    DOCU_DIR: '.vscode/docu',
    TEMPLATES_DIR: '.vscode/docu/templates',
    AGENTS_CONFIG: 'agents.json',
    BUILTIN_TEMPLATES_DIR: 'templates'
} as const;
