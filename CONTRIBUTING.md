# Contributing to Docu

Thank you for your interest in contributing to Docu! This guide will help you get started with contributing to the project.

## 🤝 Ways to Contribute

- **Bug Reports** - Help us identify and fix issues
- **Feature Requests** - Suggest new features and improvements
- **Code Contributions** - Submit bug fixes and new features
- **Documentation** - Improve guides, examples, and API documentation
- **Templates** - Create and share custom templates
- **Testing** - Help test new features and report issues
- **Community Support** - Help other users in discussions

## 🚀 Getting Started

### Prerequisites

- **VS Code 1.97.0+** - Latest version recommended
- **Node.js 20.x+** - For development and building
- **Git** - For version control
- **GitHub Copilot** - For testing AI features

### Development Setup

1. **Fork the Repository**
   ```bash
   # Fork on GitHub, then clone your fork
   git clone https://github.com/your-username/vscode-docu-extension.git
   cd vscode-docu-extension
   ```

2. **Install Dependencies**
   ```bash
   npm install
   ```

3. **Build the Extension**
   ```bash
   npm run compile
   ```

4. **Run Tests**
   ```bash
   npm test
   ```

5. **Start Development**
   ```bash
   # Open in VS Code
   code .
   
   # Press F5 to launch Extension Development Host
   # Test your changes in the development environment
   ```

### Development Workflow

1. **Create a Branch**
   ```bash
   git checkout -b feature/your-feature-name
   # or
   git checkout -b fix/issue-description
   ```

2. **Make Changes**
   - Follow the coding standards
   - Add tests for new functionality
   - Update documentation as needed

3. **Test Changes**
   ```bash
   # Run tests
   npm test
   
   # Test in Extension Development Host
   # Press F5 in VS Code
   ```

4. **Commit Changes**
   ```bash
   git add .
   git commit -m "feat: add new feature description"
   # or
   git commit -m "fix: resolve issue description"
   ```

5. **Push and Create PR**
   ```bash
   git push origin your-branch-name
   # Create Pull Request on GitHub
   ```

## 📝 Coding Standards

### TypeScript Guidelines

- **Use TypeScript** - All code should be written in TypeScript
- **Strict Mode** - Enable strict TypeScript checking
- **Type Safety** - Avoid `any` types, use proper type definitions
- **Interfaces** - Define interfaces for complex objects
- **Error Handling** - Use proper error handling and logging

### Code Style

- **ESLint** - Follow the configured ESLint rules
- **Formatting** - Use consistent formatting (Prettier recommended)
- **Naming** - Use descriptive names for variables, functions, and classes
- **Comments** - Add JSDoc comments for public APIs
- **Imports** - Use absolute imports where possible

### Example Code Structure

```typescript
/**
 * Example service class following project conventions
 */
export class ExampleService {
    private readonly logger: Logger;
    
    constructor(private context: vscode.ExtensionContext) {
        this.logger = Logger.getInstance();
    }
    
    /**
     * Example method with proper error handling
     */
    async performOperation(params: OperationParams): Promise<OperationResult> {
        try {
            this.logger.info('example', 'Starting operation', { params });
            
            // Implementation here
            const result = await this.doWork(params);
            
            this.logger.info('example', 'Operation completed', { result });
            return { success: true, data: result };
            
        } catch (error) {
            this.logger.error('example', 'Operation failed', error, { params });
            return { success: false, error: error.message };
        }
    }
    
    private async doWork(params: OperationParams): Promise<any> {
        // Implementation details
    }
}
```

### File Organization

```
vscode-docu-extension/
├── src/                    # Production source code
│   ├── agents/             # AI agent implementations
│   ├── commands/           # Command parsing and routing
│   ├── config/             # Configuration management
│   ├── conversation/       # Conversation management
│   ├── debugging/          # Debug and diagnostic tools
│   ├── error/              # Error handling system
│   ├── llm/                # GitHub Copilot LLM integration
│   ├── logging/            # Logging infrastructure
│   ├── offline/            # Offline mode management
│   ├── security/           # Security and validation
│   ├── state/              # State management
│   ├── telemetry/          # Analytics and telemetry
│   ├── templates/          # Template system
│   ├── tools/              # File system tools
│   ├── utils/              # Shared utilities
│   ├── constants.ts        # Global constants
│   └── extension.ts        # Extension entry point
├── tests/                  # All test files (top-level, separate from src/)
│   ├── unit/               # Unit tests
│   ├── integration/        # Integration tests
│   ├── e2e/                # End-to-end tests
│   ├── conversation/       # Conversation module tests
│   ├── fixes/              # Regression tests
│   ├── mocks/              # VS Code API mocks
│   ├── utils/              # Test utilities
│   └── setup.ts            # Jest global setup
├── docs/                   # User-facing documentation
├── examples/               # Example workflows and demo projects
├── ARCHIVED/               # Archived development artifacts
└── package.json            # Extension manifest
```

## 🧪 Testing Guidelines

### Test Types

1. **Unit Tests** - Test individual components in isolation
2. **Integration Tests** - Test component interactions
3. **End-to-End Tests** - Test complete workflows

### Writing Tests

```typescript
// Example unit test
import * as assert from 'assert';
import { TemplateManager } from '../../src/templates/TemplateManager';

suite('TemplateManager Tests', () => {
    let templateManager: TemplateManager;
    
    setup(() => {
        templateManager = new TemplateManager(mockContext);
    });
    
    test('Should load built-in templates', () => {
        const templates = templateManager.getTemplates();
        assert.ok(templates.length >= 3);
        assert.ok(templates.some(t => t.id === 'basic'));
    });
    
    test('Should render template with variables', () => {
        const result = templateManager.renderTemplate('basic', {
            variables: { title: 'Test Document' },
            currentDate: new Date('2024-01-01'),
            workspaceRoot: '/test'
        });
        
        assert.ok(result);
        assert.ok(result.content.includes('Test Document'));
    });
});
```

### Test Coverage

- Aim for 80%+ test coverage
- Test both success and failure paths
- Include edge cases and boundary conditions
- Mock external dependencies

### Running Tests

```bash
# Run all tests
npm test

# Run specific test suite
npm run test:unit
npm run test:integration
npm run test:e2e

# Run tests with coverage
npm run test:coverage
```

## 📚 Documentation Guidelines

### Documentation Types

1. **API Documentation** - JSDoc comments in code
2. **User Guides** - Markdown files in `docs/`
3. **Examples** - Working examples in `examples/`
4. **README Updates** - Keep main README current

### Writing Documentation

- **Clear and Concise** - Use simple, direct language
- **Examples** - Include practical examples
- **Structure** - Use consistent formatting and structure
- **Screenshots** - Add screenshots for UI features
- **Links** - Link to related documentation

### Documentation Structure

```markdown
# Title

Brief description of the feature/concept.

## Overview

High-level explanation.

## Usage

### Basic Usage
```bash
# Example commands
```

### Advanced Usage
```bash
# More complex examples
```

## Configuration

Configuration options and examples.

## Troubleshooting

Common issues and solutions.

## See Also

Links to related documentation.
```

## 🐛 Bug Reports

### Before Reporting

1. **Search Existing Issues** - Check if the bug is already reported
2. **Test Latest Version** - Ensure you're using the latest version
3. **Minimal Reproduction** - Create a minimal example that reproduces the issue
4. **Gather Information** - Collect diagnostic information

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Environment
- VS Code Version: 
- Docu Extension Version: 
- Operating System: 
- GitHub Copilot Status: 

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Screenshots
If applicable, add screenshots

## Diagnostic Information
[Attach output from "Docu: Export Diagnostics"]

## Additional Context
Any other relevant information
```

## ✨ Feature Requests

### Before Requesting

1. **Check Existing Requests** - Search for similar feature requests
2. **Consider Scope** - Ensure the feature fits the project's goals
3. **Think About Implementation** - Consider how it might be implemented

### Feature Request Template

```markdown
## Feature Description
Clear description of the proposed feature

## Problem Statement
What problem does this feature solve?

## Proposed Solution
How should this feature work?

## Alternatives Considered
What other approaches did you consider?

## Use Cases
Specific scenarios where this would be useful

## Implementation Ideas
Any thoughts on how this could be implemented

## Additional Context
Any other relevant information
```

## 🔄 Pull Request Process

### Before Submitting

1. **Issue First** - For significant changes, create an issue first
2. **Branch Naming** - Use descriptive branch names
3. **Commit Messages** - Follow conventional commit format
4. **Tests** - Add tests for new functionality
5. **Documentation** - Update relevant documentation

### PR Guidelines

1. **Clear Description** - Explain what the PR does and why
2. **Link Issues** - Reference related issues
3. **Small Changes** - Keep PRs focused and manageable
4. **Review Ready** - Ensure CI passes before requesting review

### PR Template

```markdown
## Description
Brief description of changes

## Related Issues
Fixes #123
Relates to #456

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests added/updated
- [ ] Integration tests added/updated
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated
- [ ] Tests pass locally
```

### Review Process

1. **Automated Checks** - CI must pass
2. **Code Review** - At least one maintainer review required
3. **Testing** - Reviewers may test functionality
4. **Feedback** - Address review comments
5. **Approval** - Maintainer approval required for merge

## 🏗️ Architecture Guidelines

### Extension Structure

- **Modular Design** - Keep components loosely coupled
- **Dependency Injection** - Use dependency injection where appropriate
- **Error Handling** - Comprehensive error handling throughout
- **Logging** - Extensive logging for debugging
- **Security** - Security-first approach to all operations

### Adding New Features

1. **Design First** - Consider architecture and integration points
2. **Interfaces** - Define clear interfaces
3. **Testing** - Plan testing strategy
4. **Documentation** - Plan documentation needs
5. **Migration** - Consider upgrade/migration paths

### Performance Considerations

- **Async Operations** - Use async/await for I/O operations
- **Memory Management** - Avoid memory leaks
- **Caching** - Cache expensive operations appropriately
- **Lazy Loading** - Load resources only when needed

## 🎯 Contribution Areas

### High Priority

- **Bug Fixes** - Critical and high-priority bugs
- **Performance Improvements** - Memory usage, response times
- **Security Enhancements** - Security vulnerabilities and improvements
- **Documentation** - Missing or outdated documentation
- **Test Coverage** - Areas with low test coverage

### Medium Priority

- **New Features** - Well-defined feature requests
- **Template Library** - Additional built-in templates
- **Agent Improvements** - Enhanced agent capabilities
- **Developer Experience** - Tooling and development improvements

### Low Priority

- **Code Cleanup** - Refactoring and code quality improvements
- **Examples** - Additional examples and tutorials
- **Localization** - Translation and internationalization
- **Experimental Features** - Proof-of-concept implementations

## 🏆 Recognition

### Contributors

All contributors are recognized in:
- **README.md** - Contributors section
- **Release Notes** - Feature/fix attribution
- **GitHub** - Contributor graphs and statistics

### Maintainers

Active contributors may be invited to become maintainers with:
- **Commit Access** - Direct commit privileges
- **Review Rights** - Ability to approve PRs
- **Release Management** - Participation in release process

## 📞 Communication

### Channels

- **GitHub Issues** - Bug reports and feature requests
- **GitHub Discussions** - General questions and discussions
- **Pull Requests** - Code review and collaboration
- **Email** - Private communication with maintainers

### Guidelines

- **Be Respectful** - Treat all community members with respect
- **Be Constructive** - Provide helpful feedback and suggestions
- **Be Patient** - Maintainers are volunteers with limited time
- **Be Clear** - Communicate clearly and provide context

## 📄 License

By contributing to Docu, you agree that your contributions will be licensed under the MIT License.

## ❓ Questions?

If you have questions about contributing:

1. **Check Documentation** - Review existing documentation
2. **Search Issues** - Look for similar questions
3. **Ask in Discussions** - Use GitHub Discussions for questions
4. **Contact Maintainers** - Reach out directly if needed

---

**Thank you for contributing to Docu! Your contributions help make documentation better for everyone.** 🎉