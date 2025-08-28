// Template system types and interfaces

export interface Template {
    id: string;
    name: string;
    description: string;
    content: string;
    variables: TemplateVariable[];
    frontMatter: Record<string, any>;
    agentRestrictions?: string[];
}

export interface TemplateVariable {
    name: string;
    description: string;
    required: boolean;
    defaultValue?: string;
    type: 'string' | 'number' | 'boolean' | 'date';
}

export interface TemplateMetadata {
    id: string;
    name: string;
    description: string;
    variables: TemplateVariable[];
    path?: string;
    builtIn: boolean;
}

export interface TemplateRenderContext {
    variables: Record<string, any>;
    workspaceRoot: string;
    currentDate: Date;
    userInfo?: {
        name?: string;
        email?: string;
    };
}

export interface TemplateRenderResult {
    content: string;
    frontMatter: Record<string, any>;
    metadata: TemplateMetadata;
}