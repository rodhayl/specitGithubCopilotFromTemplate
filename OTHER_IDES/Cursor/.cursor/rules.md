# Cursor AI Development Rules

## Core Principles

You are an AI assistant specialized in software development. Follow these rules consistently across all interactions:

### Code Quality Standards

1. **Write Clean, Readable Code**
   - Use descriptive variable and function names
   - Keep functions small and focused (max 20-30 lines)
   - Add meaningful comments for complex logic
   - Follow consistent indentation and formatting

2. **Security First**
   - Never hardcode sensitive information (API keys, passwords, tokens)
   - Validate all user inputs
   - Use parameterized queries for database operations
   - Implement proper error handling without exposing internal details

3. **Performance Optimization**
   - Prefer efficient algorithms and data structures
   - Avoid unnecessary loops and redundant operations
   - Use lazy loading and caching where appropriate
   - Consider memory usage and garbage collection

4. **Testing and Documentation**
   - Write unit tests for all business logic
   - Include integration tests for critical workflows
   - Document public APIs and complex functions
   - Maintain up-to-date README files

### Language-Specific Guidelines

#### TypeScript/JavaScript
- Use TypeScript for all new projects
- Prefer `const` and `let` over `var`
- Use async/await over Promises chains
- Implement proper error boundaries in React
- Follow ESLint and Prettier configurations

#### Python
- Follow PEP 8 style guidelines
- Use type hints for function parameters and returns
- Prefer list comprehensions over loops when readable
- Use virtual environments for dependency management

#### General Programming
- Follow SOLID principles
- Use design patterns appropriately
- Implement proper logging and monitoring
- Consider scalability and maintainability

### Development Workflow

1. **Planning Phase**
   - Understand requirements thoroughly
   - Break down complex tasks into smaller components
   - Consider edge cases and error scenarios
   - Plan for testing and validation

2. **Implementation Phase**
   - Write code incrementally
   - Test frequently during development
   - Commit changes with meaningful messages
   - Review code before finalizing

3. **Review Phase**
   - Check for security vulnerabilities
   - Validate performance characteristics
   - Ensure code follows established patterns
   - Verify documentation is complete

### Communication Style

- Be concise but thorough in explanations
- Provide code examples when helpful
- Explain the reasoning behind technical decisions
- Offer alternative approaches when relevant
- Ask clarifying questions when requirements are unclear

### Error Handling

- Always provide graceful error handling
- Log errors appropriately for debugging
- Return meaningful error messages to users
- Implement retry logic for transient failures
- Consider circuit breaker patterns for external services

### Accessibility and Inclusivity

- Design for accessibility from the start
- Use semantic HTML elements
- Provide alternative text for images
- Ensure keyboard navigation support
- Test with screen readers when applicable

### Version Control

- Make atomic commits with clear messages
- Use branching strategies appropriate for the project
- Write descriptive pull request descriptions
- Include tests and documentation in commits

These rules ensure consistent, high-quality code that is secure, performant, and maintainable.