/**
 * Utility functions and classes
 * Centralized exports for all utility modules
 */

// File operations
export { FileUtils } from './FileUtils';

// Agent utilities
export { AgentUtils } from './AgentUtils';

// String manipulation and formatting
export { StringUtils } from './StringUtils';

// Validation utilities
export { ValidationUtils, ValidationError } from './ValidationUtils';
export type { ValidationResult } from './ValidationUtils';

// Error handling
export { 
    ErrorHandler, 
    ErrorCategory, 
    ErrorSeverity, 
    RecoveryAction,
    handleError,
    attemptRecovery,
    withErrorHandling
} from './ErrorHandler';
export type { 
    ErrorInfo, 
    RecoveryOptions, 
    ErrorHandlingResult 
} from './ErrorHandler';

// Performance monitoring
export {
    PerformanceMonitor,
    withPerformanceMonitoring,
    startPerformanceTracking,
    endPerformanceTracking,
    trackPerformance
} from './PerformanceMonitor';
export type {
    PerformanceMetrics,
    PerformanceThresholds,
    OptimizationSuggestion
} from './PerformanceMonitor';

// Logging (re-export from logging directory for convenience)
export { Logger, LogLevel } from '../logging/Logger';
export type { LogEntry, LoggerConfig } from '../logging/Logger';