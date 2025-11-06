/**
 * Central constants file for the Docu extension
 * Eliminates magic strings and numbers across the codebase
 */

/**
 * Extension commands
 */
export const COMMANDS = {
    OPEN_SETTINGS: 'docu.openSettings',
    SHOW_DIAGNOSTICS: 'docu.showDiagnostics',
    EXPORT_DIAGNOSTICS: 'docu.exportDiagnostics',
    SHOW_OUTPUT: 'docu.showOutput',
    CLEAR_LOGS: 'docu.clearLogs',
    TOGGLE_DEBUG: 'docu.toggleDebug',
    CHECK_OFFLINE_STATUS: 'docu.checkOfflineStatus',
    FORCE_OFFLINE_CHECK: 'docu.forceOfflineCheck',
    TOGGLE_OFFLINE_MODE: 'docu.toggleOfflineMode',
    INTERNAL_FILE_CHANGED: 'docu.internal.fileChanged',
    CONTINUE_CONVERSATION: 'docu.continueConversation',
    TEST: 'docu.test'
} as const;

/**
 * Slash commands (user-facing)
 */
export const SLASH_COMMANDS = {
    NEW: '/new',
    AGENT: '/agent',
    TEMPLATES: '/templates',
    UPDATE: '/update',
    REVIEW: '/review',
    SUMMARIZE: '/summarize',
    CATALOG: '/catalog',
    CHAT: '/chat',
    HELP: '/help',
    DIAGNOSTIC: '/diagnostic'
} as const;

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
 * Configuration keys
 */
export const CONFIG_KEYS = {
    DEFAULT_DIRECTORY: 'docu.defaultDirectory',
    DEFAULT_AGENT: 'docu.defaultAgent',
    PREFERRED_MODEL: 'docu.preferredModel',
    TEMPLATE_DIRECTORY: 'docu.templateDirectory',
    AGENT_CONFIG_DIRECTORY: 'docu.agentConfigDirectory',
    AUTO_SAVE_DOCUMENTS: 'docu.autoSaveDocuments',
    SHOW_WORKFLOW_PROGRESS: 'docu.showWorkflowProgress',
    ENABLE_HOT_RELOAD: 'docu.enableHotReload',
    REVIEW_LEVEL: 'docu.reviewLevel',
    MAX_FILES_IN_SUMMARY: 'docu.maxFilesInSummary',
    ENABLE_DEBUG_LOGGING: 'docu.enableDebugLogging',
    ENABLE_TELEMETRY: 'docu.telemetry.enabled',
    ENABLE_OUTPUT_CHANNEL: 'docu.logging.enableOutputChannel'
} as const;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    DIRECTORY: 'docs',
    AGENT: AGENTS.PRD_CREATOR,
    TEMPLATE_DIR: '.vscode/docu/templates',
    AGENT_CONFIG_DIR: '.vscode/docu',
    AUTO_SAVE: true,
    SHOW_PROGRESS: true,
    ENABLE_HOT_RELOAD: false,
    REVIEW_LEVEL: 'standard',
    MAX_FILES: 50,
    DEBUG_LOGGING: false
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

/**
 * Tool names
 */
export const TOOLS = {
    WRITE_FILE: 'writeFile',
    READ_FILE: 'readFile',
    INSERT_SECTION: 'insertSection',
    APPLY_TEMPLATE: 'applyTemplate',
    CREATE_TEMPLATE: 'createTemplate',
    VALIDATE_TEMPLATE: 'validateTemplate',
    OPEN_TEMPLATE: 'openTemplate',
    LIST_TEMPLATES: 'listTemplates',
    LIST_FILES: 'listFiles',
    OPEN_IN_EDITOR: 'openInEditor'
} as const;

/**
 * Template names
 */
export const TEMPLATES = {
    PRD: 'prd',
    REQUIREMENTS: 'requirements',
    BASIC: 'basic',
    ARCHITECTURE: 'architecture',
    SPECIFICATION: 'specification'
} as const;

/**
 * View and webview IDs
 */
export const VIEWS = {
    SETTINGS: 'docu.settingsView',
    DIAGNOSTICS: 'docuDiagnostics',
    OFFLINE_INFO: 'docuOfflineInfo',
    CONFIG: 'docuConfig'
} as const;

/**
 * Output channel name
 */
export const OUTPUT_CHANNEL = 'Docu Extension' as const;

/**
 * Error messages
 */
export const ERRORS = {
    NO_WORKSPACE: 'No workspace folder is open',
    FILE_NOT_FOUND: 'File not found',
    PERMISSION_DENIED: 'Permission denied',
    INVALID_TEMPLATE: 'Invalid template format',
    AGENT_NOT_FOUND: 'Agent not found',
    TOOL_NOT_FOUND: 'Tool not found',
    OFFLINE_MODE: 'This operation is not available in offline mode',
    MODEL_UNAVAILABLE: 'No language models are available',
    INVALID_INPUT: 'Invalid input provided'
} as const;

/**
 * Success messages
 */
export const MESSAGES = {
    AGENT_UPDATED: 'Agent updated successfully',
    AGENT_RESET: 'Agent reset to default configuration',
    MODEL_SELECTED: 'Model selected successfully',
    SETTINGS_SAVED: 'Settings saved successfully',
    FILE_CREATED: 'File created successfully',
    TEMPLATE_APPLIED: 'Template applied successfully',
    CONFIG_RESET: 'Configuration reset to defaults'
} as const;

/**
 * Limits and constraints
 */
export const LIMITS = {
    MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    MAX_HISTORY_SIZE: 100,
    MAX_CONVERSATION_LENGTH: 50,
    MAX_RETRY_ATTEMPTS: 3,
    DEFAULT_TIMEOUT: 30000, // 30 seconds
    DEBOUNCE_DELAY: 300 // 300ms
} as const;

/**
 * Log levels
 */
export const LOG_LEVELS = {
    DEBUG: 'debug',
    INFO: 'info',
    WARN: 'warn',
    ERROR: 'error'
} as const;

/**
 * Event names
 */
export const EVENTS = {
    STATE_CHANGED: 'stateChanged',
    COMPONENT_REGISTERED: 'componentRegistered',
    CONFIGURATION_CHANGED: 'configurationChanged',
    AGENT_SWITCHED: 'agentSwitched',
    OFFLINE_MODE_CHANGED: 'offlineModeChanged'
} as const;

/**
 * HTTP status codes (for future API integration)
 */
export const HTTP_STATUS = {
    OK: 200,
    BAD_REQUEST: 400,
    UNAUTHORIZED: 401,
    FORBIDDEN: 403,
    NOT_FOUND: 404,
    INTERNAL_ERROR: 500
} as const;

/**
 * Regular expressions
 */
export const REGEX = {
    VARIABLE: /\{\{(\w+)\}\}/g,
    FRONT_MATTER: /^---\n([\s\S]*?)\n---\n([\s\S]*)$/,
    MARKDOWN_HEADER: /^(#{1,6})\s+(.+)$/gm,
    VALID_FILENAME: /^[a-zA-Z0-9_\-\.]+$/
} as const;
