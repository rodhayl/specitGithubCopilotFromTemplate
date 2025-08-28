// Template system exports
export * from './types';
export * from './TemplateManager';

// Re-export commonly used types for convenience
export type { 
    Template, 
    TemplateVariable, 
    TemplateMetadata, 
    TemplateRenderContext, 
    TemplateRenderResult 
} from './types';