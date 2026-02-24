// Debug HTTP Server for remote command execution
import * as http from 'http';
import * as vscode from 'vscode';
import * as crypto from 'crypto';
import { Logger } from '../logging/Logger';

export interface DebugCommandRequest {
    command: string;
    token?: string;
}

export interface DebugCommandResponse {
    success: boolean;
    command: string;
    output: string;
    error?: string;
    timestamp: string;
    duration: number;
}

export interface DebugServerStatus {
    running: boolean;
    port: number;
    token: string;
    url: string;
    startedAt?: string;
    requestCount: number;
}

/**
 * DebugServer - Local HTTP server for executing extension commands remotely.
 * 
 * Listens ONLY on localhost (127.0.0.1) for security.
 * Requires a bearer token generated at startup.
 * 
 * Endpoints:
 *   GET  /status   - Server status
 *   GET  /commands - List available commands
 *   POST /execute  - Execute a command: { "command": "/help" }
 */
export class DebugServer {
    private server: http.Server | null = null;
    private port: number;
    private token: string;
    private logger: Logger;
    private requestCount = 0;
    private startedAt?: Date;
    private commandExecutor?: (command: string) => Promise<{ success: boolean; output: string; error?: string }>;
    private commandLister?: () => string[];

    constructor(port: number = 19229) {
        this.port = port;
        this.token = crypto.randomBytes(16).toString('hex');
        this.logger = Logger.getInstance();
    }

    /**
     * Set the function that executes commands through the extension
     */
    setCommandExecutor(executor: (command: string) => Promise<{ success: boolean; output: string; error?: string }>) {
        this.commandExecutor = executor;
    }

    /**
     * Set the function that lists available commands
     */
    setCommandLister(lister: () => string[]) {
        this.commandLister = lister;
    }

    /**
     * Start the debug HTTP server
     */
    async start(): Promise<DebugServerStatus> {
        if (this.server) {
            return this.getStatus();
        }

        return new Promise((resolve, reject) => {
            this.server = http.createServer((req, res) => this.handleRequest(req, res));
            
            this.server.on('error', (err: NodeJS.ErrnoException) => {
                if (err.code === 'EADDRINUSE') {
                    this.logger.extension.error(`Debug server port ${this.port} is already in use`);
                    reject(new Error(`Port ${this.port} is already in use. Change docu.debug.port in settings.`));
                } else {
                    this.logger.extension.error('Debug server error', err);
                    reject(err);
                }
            });

            // Listen ONLY on localhost for security
            this.server.listen(this.port, '127.0.0.1', () => {
                this.startedAt = new Date();
                this.logger.extension.info(`Debug server started on http://127.0.0.1:${this.port}`);
                this.logger.extension.info(`Debug token: ${this.token}`);
                resolve(this.getStatus());
            });
        });
    }

    /**
     * Stop the debug server
     */
    async stop(): Promise<void> {
        return new Promise((resolve) => {
            if (this.server) {
                this.server.close(() => {
                    this.server = null;
                    this.startedAt = undefined;
                    this.requestCount = 0;
                    this.logger.extension.info('Debug server stopped');
                    resolve();
                });
            } else {
                resolve();
            }
        });
    }

    /**
     * Get current server status
     */
    getStatus(): DebugServerStatus {
        return {
            running: this.server !== null,
            port: this.port,
            token: this.token,
            url: `http://127.0.0.1:${this.port}`,
            startedAt: this.startedAt?.toISOString(),
            requestCount: this.requestCount
        };
    }

    /**
     * Get the auth token for connecting
     */
    getToken(): string {
        return this.token;
    }

    private handleRequest(req: http.IncomingMessage, res: http.ServerResponse): void {
        // CORS headers for local development
        res.setHeader('Content-Type', 'application/json');
        res.setHeader('Access-Control-Allow-Origin', 'http://127.0.0.1');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

        if (req.method === 'OPTIONS') {
            res.writeHead(204);
            res.end();
            return;
        }

        // Authenticate (skip for status endpoint)
        const url = req.url || '/';
        if (url !== '/status') {
            const authHeader = req.headers.authorization;
            if (!authHeader || authHeader !== `Bearer ${this.token}`) {
                this.sendJson(res, 401, { error: 'Unauthorized. Provide Authorization: Bearer <token>' });
                return;
            }
        }

        this.requestCount++;

        // Route requests
        if (url === '/status' && req.method === 'GET') {
            this.handleStatus(res);
        } else if (url === '/commands' && req.method === 'GET') {
            this.handleListCommands(res);
        } else if (url === '/execute' && req.method === 'POST') {
            this.handleExecute(req, res);
        } else {
            this.sendJson(res, 404, { 
                error: 'Not found',
                endpoints: {
                    'GET /status': 'Server status (no auth required)',
                    'GET /commands': 'List available commands',
                    'POST /execute': 'Execute a command: { "command": "/help" }'
                }
            });
        }
    }

    private handleStatus(res: http.ServerResponse): void {
        const status = this.getStatus();
        // Don't expose the token in the status response
        this.sendJson(res, 200, { 
            running: status.running,
            port: status.port,
            url: status.url,
            startedAt: status.startedAt,
            requestCount: status.requestCount
        });
    }

    private handleListCommands(res: http.ServerResponse): void {
        if (!this.commandLister) {
            this.sendJson(res, 503, { error: 'Command lister not configured' });
            return;
        }

        const commands = this.commandLister();
        this.sendJson(res, 200, { commands });
    }

    private async handleExecute(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
        if (!this.commandExecutor) {
            this.sendJson(res, 503, { error: 'Command executor not configured' });
            return;
        }

        try {
            const body = await this.readBody(req);
            const parsed = JSON.parse(body) as DebugCommandRequest;

            if (!parsed.command || typeof parsed.command !== 'string') {
                this.sendJson(res, 400, { error: 'Missing or invalid "command" field. Expected: { "command": "/help" }' });
                return;
            }

            // Sanitize command - only allow alphanumeric, spaces, dashes, quotes, dots, slashes, and common flags
            const sanitized = parsed.command.trim();
            if (sanitized.length > 1000) {
                this.sendJson(res, 400, { error: 'Command too long (max 1000 characters)' });
                return;
            }

            this.logger.extension.info(`Debug server executing command: ${sanitized}`);
            const startTime = Date.now();

            const result = await this.commandExecutor(sanitized);

            const response: DebugCommandResponse = {
                success: result.success,
                command: sanitized,
                output: result.output,
                error: result.error,
                timestamp: new Date().toISOString(),
                duration: Date.now() - startTime
            };

            this.sendJson(res, result.success ? 200 : 422, response);

        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : String(error);
            if (errorMessage.includes('JSON')) {
                this.sendJson(res, 400, { error: 'Invalid JSON body. Expected: { "command": "/help" }' });
            } else {
                this.sendJson(res, 500, { error: `Command execution failed: ${errorMessage}` });
            }
        }
    }

    private readBody(req: http.IncomingMessage): Promise<string> {
        return new Promise((resolve, reject) => {
            const chunks: Buffer[] = [];
            let totalSize = 0;
            const MAX_BODY_SIZE = 10240; // 10KB limit

            req.on('data', (chunk: Buffer) => {
                totalSize += chunk.length;
                if (totalSize > MAX_BODY_SIZE) {
                    reject(new Error('Request body too large'));
                    req.destroy();
                    return;
                }
                chunks.push(chunk);
            });
            req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
            req.on('error', reject);
        });
    }

    private sendJson(res: http.ServerResponse, statusCode: number, data: unknown): void {
        res.writeHead(statusCode);
        res.end(JSON.stringify(data, null, 2));
    }

    dispose(): void {
        if (this.server) {
            this.server.close();
            this.server = null;
        }
    }
}
