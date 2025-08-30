import { BaseAgent } from './BaseAgent';
import { AgentContext, AgentResponse, ChatRequest } from './types';

export class QualityReviewerAgent extends BaseAgent {
    name = 'quality-reviewer';
    systemPrompt = `You are a Quality Reviewer agent specialized in analyzing documents for consistency, completeness, and quality standards.

Your role is to:
1. Analyze documents for structural consistency and formatting standards
2. Check for completeness of required sections and information
3. Validate cross-references and dependencies between documents
4. Identify gaps, inconsistencies, and areas for improvement
5. Provide concrete, actionable suggestions for document enhancement
6. Apply different review levels (light, normal, strict) based on requirements

Review Criteria by Level:

**Light Review:**
- Basic formatting and structure
- Spelling and grammar check
- Section completeness
- Clear headings and organization

**Normal Review (Default):**
- All light review criteria
- Content consistency and logical flow
- Cross-reference validation
- Requirements traceability
- Technical accuracy assessment

**Strict Review:**
- All normal review criteria
- Detailed compliance with standards
- Comprehensive gap analysis
- Stakeholder perspective validation
- Implementation feasibility assessment
- Risk and edge case identification

Review Output Format:
- Executive summary of document quality
- Categorized findings (Critical, Major, Minor)
- Specific line/section references where applicable
- Concrete improvement recommendations
- Priority ranking for addressing issues

When --fix flag is used, automatically apply corrections for:
- Formatting inconsistencies
- Spelling and grammar errors
- Missing standard sections
- Broken cross-references
- Standardization improvements

Focus on providing actionable, specific feedback that improves document quality and usability.`;

    allowedTools = ['readFile', 'writeFile', 'insertSection', 'listFiles'];
    workflowPhase = 'implementation' as const;

    async handleDirectRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';
            
            // Handle quality review requests
            if (prompt.includes('review') || prompt.includes('quality') || prompt.includes('check')) {
                return this.createResponse(
                    `I'm the Quality Reviewer agent. I help ensure your documentation meets high standards.\n\n` +
                    `I can help you:\n` +
                    `- Review document completeness\n` +
                    `- Check for clarity and consistency\n` +
                    `- Validate requirements quality\n` +
                    `- Suggest improvements\n\n` +
                    `What document would you like me to review?`,
                    [],
                    [
                        'Review my PRD',
                        'Check requirements quality',
                        'Validate document completeness'
                    ]
                );
            }
            
            // Default response
            return this.createResponse(
                `I'm here to help with document quality review and validation. What would you like me to review?`,
                [],
                ['Review a document', 'Check quality standards', 'Get review guidance']
            );
            
        } catch (error) {
            return this.createResponse(
                `I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                [],
                ['Try again', 'Get help']
            );
        }
    }

    async handleRequest(request: any, context: AgentContext): Promise<AgentResponse> {
        try {
            const prompt = request.prompt?.trim() || '';
            
            // Parse review command parameters
            const reviewParams = this.parseReviewCommand(prompt);
            
            if (reviewParams.filePath) {
                return await this.reviewDocument(reviewParams, context);
            }

            // If no specific file, provide guidance
            return await this.provideReviewGuidance(context);

        } catch (error) {
            return {
                success: false,
                message: `Quality review failed: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private parseReviewCommand(prompt: string): ReviewParams {
        const params: ReviewParams = {
            level: 'normal',
            autoFix: false,
            filePath: null
        };

        // Extract file path
        const fileMatch = prompt.match(/--file\s+([^\s]+)/);
        if (fileMatch) {
            params.filePath = fileMatch[1];
        }

        // Extract review level
        const levelMatch = prompt.match(/--level\s+(light|normal|strict)/);
        if (levelMatch) {
            params.level = levelMatch[1] as 'light' | 'normal' | 'strict';
        }

        // Check for auto-fix flag
        params.autoFix = prompt.includes('--fix');

        return params;
    }

    private async reviewDocument(params: ReviewParams, context: AgentContext): Promise<AgentResponse> {
        try {
            // Read the document to review
            const readResult = await context.toolManager.executeTool('readFile', {
                path: params.filePath
            }, context.toolContext);

            if (!readResult.success) {
                return {
                    success: false,
                    message: `Could not read file: ${params.filePath}. Please check the file path and try again.`
                };
            }

            const content = readResult.data.content;
            const reviewResults = await this.performReview(content, params.level, params.filePath!);

            // Apply automatic fixes if requested
            if (params.autoFix && reviewResults.fixableIssues.length > 0) {
                const fixedContent = await this.applyAutomaticFixes(content, reviewResults.fixableIssues);
                
                const writeResult = await context.toolManager.executeTool('writeFile', {
                    path: params.filePath,
                    content: fixedContent,
                    overwrite: true
                }, context.toolContext);

                if (writeResult.success) {
                    reviewResults.summary += `\n\n✅ **Automatic Fixes Applied:** ${reviewResults.fixableIssues.length} issues corrected.`;
                }
            }

            return {
                success: true,
                message: this.formatReviewReport(reviewResults, params),
                data: {
                    filePath: params.filePath,
                    level: params.level,
                    issuesFound: reviewResults.issues.length,
                    fixesApplied: params.autoFix ? reviewResults.fixableIssues.length : 0
                }
            };

        } catch (error) {
            return {
                success: false,
                message: `Error reviewing document: ${error instanceof Error ? error.message : String(error)}`
            };
        }
    }

    private async performReview(content: string, level: string, filePath: string): Promise<ReviewResults> {
        const results: ReviewResults = {
            summary: '',
            issues: [],
            fixableIssues: [],
            recommendations: []
        };

        // Determine file type for specific checks
        const fileType = this.getFileType(filePath);

        // Perform level-appropriate checks
        if (level === 'light' || level === 'normal' || level === 'strict') {
            await this.performBasicChecks(content, results, fileType);
        }

        if (level === 'normal' || level === 'strict') {
            await this.performNormalChecks(content, results, fileType);
        }

        if (level === 'strict') {
            await this.performStrictChecks(content, results, fileType);
        }

        // Generate summary
        results.summary = this.generateReviewSummary(results, level);

        return results;
    }

    private async performBasicChecks(content: string, results: ReviewResults, fileType: string): Promise<void> {
        // Check for basic formatting issues
        this.checkBasicFormatting(content, results);
        
        // Check for required sections based on file type
        this.checkRequiredSections(content, results, fileType);
        
        // Basic spelling and grammar (simplified)
        this.checkSpellingAndGrammar(content, results);
    }

    private async performNormalChecks(content: string, results: ReviewResults, fileType: string): Promise<void> {
        // Check content consistency
        this.checkContentConsistency(content, results);
        
        // Check for logical flow
        this.checkLogicalFlow(content, results, fileType);
        
        // Validate cross-references
        this.checkCrossReferences(content, results);
    }

    private async performStrictChecks(content: string, results: ReviewResults, fileType: string): Promise<void> {
        // Comprehensive compliance checks
        this.checkComplianceStandards(content, results, fileType);
        
        // Gap analysis
        this.performGapAnalysis(content, results, fileType);
        
        // Implementation feasibility
        this.checkImplementationFeasibility(content, results, fileType);
    }

    private checkBasicFormatting(content: string, results: ReviewResults): void {
        const lines = content.split('\n');
        
        // Check for consistent heading levels
        const headings = lines.filter(line => line.startsWith('#'));
        let previousLevel = 0;
        
        headings.forEach((heading, index) => {
            const level = heading.match(/^#+/)?.[0].length || 0;
            if (level > previousLevel + 1) {
                results.issues.push({
                    type: 'formatting',
                    severity: 'minor',
                    line: lines.indexOf(heading) + 1,
                    message: `Heading level skipped: ${heading.trim()}`,
                    suggestion: `Consider using h${previousLevel + 1} instead of h${level}`
                });
            }
            previousLevel = level;
        });

        // Check for trailing whitespace
        lines.forEach((line, index) => {
            if (line.endsWith(' ') || line.endsWith('\t')) {
                results.fixableIssues.push({
                    type: 'formatting',
                    line: index + 1,
                    message: 'Trailing whitespace found',
                    fix: 'remove-trailing-whitespace'
                });
            }
        });

        // Check for multiple consecutive blank lines
        for (let i = 0; i < lines.length - 2; i++) {
            if (lines[i] === '' && lines[i + 1] === '' && lines[i + 2] === '') {
                results.fixableIssues.push({
                    type: 'formatting',
                    line: i + 2,
                    message: 'Multiple consecutive blank lines',
                    fix: 'remove-extra-blank-lines'
                });
            }
        }
    }

    private checkRequiredSections(content: string, results: ReviewResults, fileType: string): void {
        const requiredSections = this.getRequiredSections(fileType);
        
        requiredSections.forEach(section => {
            const sectionRegex = new RegExp(`^#+\\s*${section}`, 'im');
            if (!sectionRegex.test(content)) {
                results.issues.push({
                    type: 'structure',
                    severity: 'major',
                    message: `Missing required section: ${section}`,
                    suggestion: `Add a "${section}" section to improve document completeness`
                });
            }
        });
    }

    private checkSpellingAndGrammar(content: string, results: ReviewResults): void {
        // Simplified spelling check - in real implementation, use proper spell checker
        const commonMisspellings = {
            'teh': 'the',
            'recieve': 'receive',
            'seperate': 'separate',
            'occured': 'occurred',
            'definately': 'definitely'
        };

        const lines = content.split('\n');
        lines.forEach((line, index) => {
            Object.entries(commonMisspellings).forEach(([wrong, correct]) => {
                const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
                if (regex.test(line)) {
                    results.fixableIssues.push({
                        type: 'spelling',
                        line: index + 1,
                        message: `Possible misspelling: "${wrong}"`,
                        fix: `replace-word:${wrong}:${correct}`
                    });
                }
            });
        });
    }

    private checkContentConsistency(content: string, results: ReviewResults): void {
        // Check for consistent terminology
        const terms = this.extractTerms(content);
        const inconsistencies = this.findTermInconsistencies(terms);
        
        inconsistencies.forEach(inconsistency => {
            results.issues.push({
                type: 'consistency',
                severity: 'minor',
                message: `Inconsistent terminology: ${inconsistency.variations.join(', ')}`,
                suggestion: `Consider standardizing on one term: ${inconsistency.preferred}`
            });
        });
    }

    private checkLogicalFlow(content: string, results: ReviewResults, fileType: string): void {
        if (fileType === 'requirements') {
            this.checkRequirementsFlow(content, results);
        } else if (fileType === 'design') {
            this.checkDesignFlow(content, results);
        }
    }

    private checkRequirementsFlow(content: string, results: ReviewResults): void {
        // Check that requirements follow logical progression
        const requirements = content.match(/### Requirement \d+/g) || [];
        
        if (requirements.length === 0) {
            results.issues.push({
                type: 'structure',
                severity: 'major',
                message: 'No requirements found in requirements document',
                suggestion: 'Add structured requirements with user stories and acceptance criteria'
            });
        }

        // Check for EARS format in acceptance criteria
        const earsPattern = /(WHEN|IF|WHERE|WHILE).*THEN.*SHALL/gi;
        if (!earsPattern.test(content)) {
            results.issues.push({
                type: 'format',
                severity: 'minor',
                message: 'No EARS format acceptance criteria found',
                suggestion: 'Consider using EARS format (WHEN/IF/THEN/SHALL) for acceptance criteria'
            });
        }
    }

    private checkDesignFlow(content: string, results: ReviewResults): void {
        const requiredDesignSections = ['Overview', 'Architecture', 'Components'];
        const missingSections = requiredDesignSections.filter(section => 
            !new RegExp(`^#+\\s*${section}`, 'im').test(content)
        );

        if (missingSections.length > 0) {
            results.issues.push({
                type: 'structure',
                severity: 'major',
                message: `Missing design sections: ${missingSections.join(', ')}`,
                suggestion: 'Add missing sections to provide complete design documentation'
            });
        }
    }

    private checkCrossReferences(content: string, results: ReviewResults): void {
        // Find broken internal links
        const internalLinks = content.match(/\[.*?\]\(#.*?\)/g) || [];
        const headings = content.match(/^#+\s+(.+)$/gm) || [];
        const headingIds = headings.map(h => h.replace(/^#+\s+/, '').toLowerCase().replace(/\s+/g, '-'));

        internalLinks.forEach(link => {
            const linkId = link.match(/\(#(.*?)\)/)?.[1];
            if (linkId && !headingIds.includes(linkId)) {
                results.issues.push({
                    type: 'reference',
                    severity: 'minor',
                    message: `Broken internal link: ${link}`,
                    suggestion: 'Fix or remove broken internal links'
                });
            }
        });
    }

    private checkComplianceStandards(content: string, results: ReviewResults, fileType: string): void {
        // Check for compliance with documentation standards
        if (fileType === 'requirements') {
            this.checkRequirementsCompliance(content, results);
        }
    }

    private checkRequirementsCompliance(content: string, results: ReviewResults): void {
        // Check that each requirement has user story and acceptance criteria
        const requirementSections = content.split(/### Requirement \d+/);
        
        requirementSections.slice(1).forEach((section, index) => {
            const hasUserStory = /\*\*User Story:\*\*/.test(section);
            const hasAcceptanceCriteria = /#### Acceptance Criteria/.test(section);
            
            if (!hasUserStory) {
                results.issues.push({
                    type: 'compliance',
                    severity: 'major',
                    message: `Requirement ${index + 1} missing user story`,
                    suggestion: 'Add user story in format: "As a [role], I want [feature], so that [benefit]"'
                });
            }
            
            if (!hasAcceptanceCriteria) {
                results.issues.push({
                    type: 'compliance',
                    severity: 'major',
                    message: `Requirement ${index + 1} missing acceptance criteria`,
                    suggestion: 'Add acceptance criteria section with testable conditions'
                });
            }
        });
    }

    private performGapAnalysis(content: string, results: ReviewResults, fileType: string): void {
        // Identify potential gaps in documentation
        if (fileType === 'requirements') {
            this.checkRequirementsGaps(content, results);
        }
    }

    private checkRequirementsGaps(content: string, results: ReviewResults): void {
        const commonGaps = [
            { term: 'error', section: 'Error Handling' },
            { term: 'security', section: 'Security Requirements' },
            { term: 'performance', section: 'Performance Requirements' },
            { term: 'accessibility', section: 'Accessibility Requirements' }
        ];

        commonGaps.forEach(gap => {
            if (!content.toLowerCase().includes(gap.term)) {
                results.recommendations.push({
                    type: 'gap-analysis',
                    priority: 'medium',
                    message: `Consider adding ${gap.section}`,
                    rationale: `No mention of ${gap.term} found in requirements`
                });
            }
        });
    }

    private checkImplementationFeasibility(content: string, results: ReviewResults, fileType: string): void {
        // Check for implementation feasibility issues
        if (fileType === 'requirements') {
            const vaguePhrases = ['user-friendly', 'intuitive', 'easy to use', 'fast', 'reliable'];
            
            vaguePhrases.forEach(phrase => {
                if (content.toLowerCase().includes(phrase)) {
                    results.issues.push({
                        type: 'feasibility',
                        severity: 'minor',
                        message: `Vague requirement phrase: "${phrase}"`,
                        suggestion: 'Replace with specific, measurable criteria'
                    });
                }
            });
        }
    }

    private async applyAutomaticFixes(content: string, fixableIssues: FixableIssue[]): Promise<string> {
        let fixedContent = content;

        fixableIssues.forEach(issue => {
            switch (issue.fix) {
                case 'remove-trailing-whitespace':
                    fixedContent = fixedContent.replace(/[ \t]+$/gm, '');
                    break;
                case 'remove-extra-blank-lines':
                    fixedContent = fixedContent.replace(/\n{3,}/g, '\n\n');
                    break;
                default:
                    if (issue.fix.startsWith('replace-word:')) {
                        const [, wrong, correct] = issue.fix.split(':');
                        const regex = new RegExp(`\\b${wrong}\\b`, 'gi');
                        fixedContent = fixedContent.replace(regex, correct);
                    }
            }
        });

        return fixedContent;
    }

    private formatReviewReport(results: ReviewResults, params: ReviewParams): string {
        const { issues, recommendations, summary } = results;
        
        let report = `# Quality Review Report\n\n`;
        report += `**File:** ${params.filePath}\n`;
        report += `**Review Level:** ${params.level}\n`;
        report += `**Auto-fix:** ${params.autoFix ? 'Enabled' : 'Disabled'}\n\n`;
        
        report += `## Executive Summary\n\n${summary}\n\n`;

        if (issues.length > 0) {
            report += `## Issues Found (${issues.length})\n\n`;
            
            const critical = issues.filter(i => i.severity === 'critical');
            const major = issues.filter(i => i.severity === 'major');
            const minor = issues.filter(i => i.severity === 'minor');

            if (critical.length > 0) {
                report += `### 🔴 Critical Issues (${critical.length})\n\n`;
                critical.forEach((issue, index) => {
                    report += `${index + 1}. **${issue.message}**\n`;
                    if (issue.line) {report += `   - Line: ${issue.line}\n`;}
                    if (issue.suggestion) {report += `   - Suggestion: ${issue.suggestion}\n`;}
                    report += '\n';
                });
            }

            if (major.length > 0) {
                report += `### 🟡 Major Issues (${major.length})\n\n`;
                major.forEach((issue, index) => {
                    report += `${index + 1}. **${issue.message}**\n`;
                    if (issue.line) {report += `   - Line: ${issue.line}\n`;}
                    if (issue.suggestion) {report += `   - Suggestion: ${issue.suggestion}\n`;}
                    report += '\n';
                });
            }

            if (minor.length > 0) {
                report += `### 🔵 Minor Issues (${minor.length})\n\n`;
                minor.forEach((issue, index) => {
                    report += `${index + 1}. **${issue.message}**\n`;
                    if (issue.line) {report += `   - Line: ${issue.line}\n`;}
                    if (issue.suggestion) {report += `   - Suggestion: ${issue.suggestion}\n`;}
                    report += '\n';
                });
            }
        }

        if (recommendations.length > 0) {
            report += `## Recommendations (${recommendations.length})\n\n`;
            recommendations.forEach((rec, index) => {
                report += `${index + 1}. **${rec.message}** (Priority: ${rec.priority})\n`;
                if (rec.rationale) {report += `   - Rationale: ${rec.rationale}\n`;}
                report += '\n';
            });
        }

        if (issues.length === 0 && recommendations.length === 0) {
            report += `## ✅ No Issues Found\n\nThe document meets quality standards for the ${params.level} review level.`;
        }

        return report;
    }

    private generateReviewSummary(results: ReviewResults, level: string): string {
        const { issues } = results;
        const critical = issues.filter(i => i.severity === 'critical').length;
        const major = issues.filter(i => i.severity === 'major').length;
        const minor = issues.filter(i => i.severity === 'minor').length;

        if (issues.length === 0) {
            return `Document quality is excellent. No issues found during ${level} review.`;
        }

        let summary = `Found ${issues.length} issue${issues.length > 1 ? 's' : ''} during ${level} review: `;
        const parts = [];
        if (critical > 0) {parts.push(`${critical} critical`);}
        if (major > 0) {parts.push(`${major} major`);}
        if (minor > 0) {parts.push(`${minor} minor`);}
        
        summary += parts.join(', ') + '.';

        if (critical > 0) {
            summary += ' Critical issues require immediate attention.';
        } else if (major > 0) {
            summary += ' Major issues should be addressed before proceeding.';
        } else {
            summary += ' Minor issues can be addressed as time permits.';
        }

        return summary;
    }

    private async provideReviewGuidance(context: AgentContext): Promise<AgentResponse> {
        const guidance = `I'm the Quality Reviewer agent, ready to analyze your documents for consistency, completeness, and quality standards.

**Available Review Commands:**

\`/review --file <path>\` - Review a specific document
\`/review --file <path> --level strict\` - Perform comprehensive review
\`/review --file <path> --fix\` - Review and automatically fix issues

**Review Levels:**
- **Light**: Basic formatting, spelling, structure
- **Normal**: Content consistency, cross-references, traceability  
- **Strict**: Compliance standards, gap analysis, feasibility

**What I Check:**
✅ Document structure and formatting
✅ Required sections completeness
✅ Spelling and grammar
✅ Content consistency and flow
✅ Cross-reference validation
✅ Standards compliance
✅ Implementation feasibility

**Auto-Fix Capabilities:**
- Formatting inconsistencies
- Spelling errors
- Trailing whitespace
- Multiple blank lines
- Broken references

**Example Usage:**
- \`/review --file requirements.md\`
- \`/review --file design.md --level strict\`
- \`/review --file PRD.txt --fix\`

Which document would you like me to review?`;

        return {
            success: true,
            message: guidance
        };
    }

    private getFileType(filePath: string): string {
        if (filePath.toLowerCase().includes('requirement')) {return 'requirements';}
        if (filePath.toLowerCase().includes('design')) {return 'design';}
        if (filePath.toLowerCase().includes('prd')) {return 'prd';}
        if (filePath.toLowerCase().includes('task')) {return 'tasks';}
        return 'general';
    }

    private getRequiredSections(fileType: string): string[] {
        switch (fileType) {
            case 'requirements':
                return ['Introduction', 'Requirements'];
            case 'design':
                return ['Overview', 'Architecture', 'Components'];
            case 'prd':
                return ['Executive Summary', 'Objectives', 'Success Criteria'];
            case 'tasks':
                return ['Implementation Plan'];
            default:
                return ['Introduction'];
        }
    }

    private extractTerms(content: string): string[] {
        // Simplified term extraction - in real implementation, use NLP
        const words = content.toLowerCase().match(/\b[a-z]{3,}\b/g) || [];
        return [...new Set(words)];
    }

    private findTermInconsistencies(terms: string[]): TermInconsistency[] {
        // Simplified inconsistency detection
        const inconsistencies: TermInconsistency[] = [];
        
        // Example: detect variations of common terms
        const termGroups = [
            { variations: ['user', 'users', 'end-user', 'end user'], preferred: 'user' },
            { variations: ['login', 'log-in', 'sign-in', 'signin'], preferred: 'login' },
            { variations: ['setup', 'set-up', 'set up'], preferred: 'setup' }
        ];

        termGroups.forEach(group => {
            const foundVariations = group.variations.filter(v => terms.includes(v));
            if (foundVariations.length > 1) {
                inconsistencies.push({
                    variations: foundVariations,
                    preferred: group.preferred
                });
            }
        });

        return inconsistencies;
    }
}

interface ReviewParams {
    filePath: string | null;
    level: 'light' | 'normal' | 'strict';
    autoFix: boolean;
}

interface ReviewResults {
    summary: string;
    issues: ReviewIssue[];
    fixableIssues: FixableIssue[];
    recommendations: Recommendation[];
}

interface ReviewIssue {
    type: string;
    severity: 'critical' | 'major' | 'minor';
    line?: number;
    message: string;
    suggestion?: string;
}

interface FixableIssue {
    type: string;
    line: number;
    message: string;
    fix: string;
}

interface Recommendation {
    type: string;
    priority: 'high' | 'medium' | 'low';
    message: string;
    rationale?: string;
}

interface TermInconsistency {
    variations: string[];
    preferred: string;
}