// Comprehensive logging system
import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3,
    NONE = 4
}

export interface LogEntry {
    timestamp: Date;
    level: LogLevel;
    category: string;
    message: string;
    data?: any;
    error?: Error;
    context?: Record<string, any>;
}

export interface LoggerConfig {
    level: LogLevel;
    enableConsole: boolean;
    enableOutputChannel: boolean;
    enableFile: boolean;
    maxLogEntries: number;
    categories: string[];
}

export class Logger {
    private static instance: Logger;
    private config: LoggerConfig;
    private logEntries: LogEntry[] = [];
    private outputChannel: vscode.OutputChannel;
    private context: vscode.ExtensionContext;

    private constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.outputChannel = vscode.window.createOutputChannel('Docu Extension');
        
        // Default configuration
        this.config = {
            level: LogLevel.INFO,
            enableConsole: true,
            enableOutputChannel: true,
            enableFile: false,
            maxLogEntries: 1000,
            categories: ['extension', 'agent', 'tool', 'template', 'command', 'error', 'security']
        };

        this.loadConfiguration();
    }

    static initialize(context: vscode.ExtensionContext): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger(context);
        }
        return Logger.instance;
    }

    static getInstance(): Logger {
        if (!Logger.instance) {
            throw new Error('Logger not initialized. Call Logger.initialize() first.');
        }
        return Logger.instance;
    }

    private loadConfiguration(): void {
        const config = vscode.workspace.getConfiguration('docu.logging');
        
        this.config.level = this.parseLogLevel(config.get('level', 'info'));
        this.config.enableConsole = config.get('enableConsole', true);
        this.config.enableOutputChannel = config.get('enableOutputChannel', true);
        this.config.enableFile = config.get('enableFile', false);
        this.config.maxLogEntries = config.get('maxLogEntries', 1000);
        
        const categories = config.get('categories', []);
        if (categories.length > 0) {
            this.config.categories = categories;
        }
    }

    private parseLogLevel(level: string): LogLevel {
        switch (level.toLowerCase()) {
            case 'debug': return LogLevel.DEBUG;
            case 'info': return LogLevel.INFO;
            case 'warn': return LogLevel.WARN;
            case 'error': return LogLevel.ERROR;
            case 'none': return LogLevel.NONE;
            default: return LogLevel.INFO;
        }
    }

    private shouldLog(level: LogLevel, category: string): boolean {
        if (level < this.config.level) {
            return false;
        }

        if (this.config.categories.length > 0 && !this.config.categories.includes(category)) {
            return false;
        }

        return true;
    }

    private formatLogMessage(entry: LogEntry): string {
        const timestamp = entry.timestamp.toISOString();
        const level = LogLevel[entry.level];
        const category = entry.category.toUpperCase();
        
        let message = `[${timestamp}] [${level}] [${category}] ${entry.message}`;
        
        if (entry.data) {
            message += `\nData: ${JSON.stringify(entry.data, null, 2)}`;
        }
        
        if (entry.context) {
            message += `\nContext: ${JSON.stringify(entry.context, null, 2)}`;
        }
        
        if (entry.error) {
            message += `\nError: ${entry.error.message}`;
            if (entry.error.stack) {
                message += `\nStack: ${entry.error.stack}`;
            }
        }
        
        return message;
    }

    private writeLog(entry: LogEntry): void {
        const message = this.formatLogMessage(entry);
        
        // Console logging
        if (this.config.enableConsole) {
            switch (entry.level) {
                case LogLevel.DEBUG:
                    console.debug(message);
                    break;
                case LogLevel.INFO:
                    console.info(message);
                    break;
                case LogLevel.WARN:
                    console.warn(message);
                    break;
                case LogLevel.ERROR:
                    console.error(message);
                    break;
            }
        }
        
        // Output channel logging
        if (this.config.enableOutputChannel) {
            this.outputChannel.appendLine(message);
        }
        
        // File logging (if enabled)
        if (this.config.enableFile) {
            this.writeToFile(message);
        }
    }

    private async writeToFile(message: string): Promise<void> {
        try {
            const logDir = vscode.Uri.joinPath(this.context.globalStorageUri, 'logs');
            await vscode.workspace.fs.createDirectory(logDir);
            
            const logFile = vscode.Uri.joinPath(logDir, `docu-${new Date().toISOString().split('T')[0]}.log`);
            const content = `${message}\n`;
            
            try {
                const existingContent = await vscode.workspace.fs.readFile(logFile);
                const newContent = Buffer.concat([existingContent, Buffer.from(content, 'utf8')]);
                await vscode.workspace.fs.writeFile(logFile, newContent);
            } catch {
                // File doesn't exist, create new
                await vscode.workspace.fs.writeFile(logFile, Buffer.from(content, 'utf8'));
            }
        } catch (error) {
            console.error('Failed to write log to file:', error);
        }
    }

    private log(level: LogLevel, category: string, message: string, data?: any, error?: Error, context?: Record<string, any>): void {
        if (!this.shouldLog(level, category)) {
            return;
        }

        const entry: LogEntry = {
            timestamp: new Date(),
            level,
            category,
            message,
            data,
            error,
            context
        };

        // Add to memory log
        this.logEntries.push(entry);
        
        // Trim log entries if exceeding max
        if (this.logEntries.length > this.config.maxLogEntries) {
            this.logEntries = this.logEntries.slice(-this.config.maxLogEntries);
        }

        // Write log
        this.writeLog(entry);
    }

    debug(category: string, message: string, data?: any, context?: Record<string, any>): void {
        this.log(LogLevel.DEBUG, category, message, data, undefined, context);
    }

    info(category: string, message: string, data?: any, context?: Record<string, any>): void {
        this.log(LogLevel.INFO, category, message, data, undefined, context);
    }

    warn(category: string, message: string, data?: any, context?: Record<string, any>): void {
        this.log(LogLevel.WARN, category, message, data, undefined, context);
    }

    error(category: string, message: string, error?: Error, data?: any, context?: Record<string, any>): void {
        this.log(LogLevel.ERROR, category, message, data, error, context);
    }

    // Convenience methods for common categories
    extension = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('extension', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('extension', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('extension', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('extension', message, error, data, context)
    };

    agent = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('agent', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('agent', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('agent', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('agent', message, error, data, context)
    };

    tool = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('tool', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('tool', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('tool', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('tool', message, error, data, context)
    };

    template = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('template', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('template', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('template', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('template', message, error, data, context)
    };

    command = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('command', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('command', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('command', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('command', message, error, data, context)
    };

    security = {
        debug: (message: string, data?: any, context?: Record<string, any>) => 
            this.debug('security', message, data, context),
        info: (message: string, data?: any, context?: Record<string, any>) => 
            this.info('security', message, data, context),
        warn: (message: string, data?: any, context?: Record<string, any>) => 
            this.warn('security', message, data, context),
        error: (message: string, error?: Error, data?: any, context?: Record<string, any>) => 
            this.error('security', message, error, data, context)
    };

    // Log management methods
    getLogEntries(category?: string, level?: LogLevel, limit?: number): LogEntry[] {
        let entries = this.logEntries;
        
        if (category) {
            entries = entries.filter(entry => entry.category === category);
        }
        
        if (level !== undefined) {
            entries = entries.filter(entry => entry.level >= level);
        }
        
        if (limit) {
            entries = entries.slice(-limit);
        }
        
        return entries;
    }

    clearLogs(): void {
        this.logEntries = [];
        this.info('extension', 'Log entries cleared');
    }

    exportLogs(): string {
        return this.logEntries.map(entry => this.formatLogMessage(entry)).join('\n\n');
    }

    showOutputChannel(): void {
        this.outputChannel.show();
    }

    updateConfiguration(): void {
        this.loadConfiguration();
        this.info('extension', 'Logger configuration updated', this.config);
    }

    getStatistics(): {
        totalEntries: number;
        entriesByLevel: Record<string, number>;
        entriesByCategory: Record<string, number>;
        oldestEntry?: Date;
        newestEntry?: Date;
    } {
        const entriesByLevel: Record<string, number> = {};
        const entriesByCategory: Record<string, number> = {};
        
        for (const entry of this.logEntries) {
            const levelName = LogLevel[entry.level];
            entriesByLevel[levelName] = (entriesByLevel[levelName] || 0) + 1;
            entriesByCategory[entry.category] = (entriesByCategory[entry.category] || 0) + 1;
        }
        
        return {
            totalEntries: this.logEntries.length,
            entriesByLevel,
            entriesByCategory,
            oldestEntry: this.logEntries.length > 0 ? this.logEntries[0].timestamp : undefined,
            newestEntry: this.logEntries.length > 0 ? this.logEntries[this.logEntries.length - 1].timestamp : undefined
        };
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}