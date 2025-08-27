# Docu - AI Documentation Assistant

A VS Code extension that provides AI-powered documentation assistance through GitHub Copilot Chat with specialized agents for requirements gathering, design, and implementation planning.

## Features

- **@docu Chat Participant**: Interact with AI agents directly in GitHub Copilot Chat
- **Specialized Agents**: PRD Creator, Brainstormer, Requirements Gatherer, Solution Architect, Specification Writer, and Quality Reviewer
- **Document Management**: Create, update, and review Markdown documents with AI assistance
- **Template System**: Use built-in or custom templates for consistent documentation
- **Workflow Integration**: Follow Kiro-inspired spec-driven development methodology

## Development Setup

### Prerequisites

- VS Code 1.97.0 or higher
- Node.js 20.x or higher
- GitHub Copilot subscription

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Compile the TypeScript code:
   ```bash
   npm run compile
   ```
4. Run tests:
   ```bash
   npm test
   ```

### Development

- Press `F5` to open a new Extension Development Host window
- The extension will be automatically loaded
- Open GitHub Copilot Chat and type `@docu` to interact with the assistant

### Building

- Run `npm run compile` to compile TypeScript
- Run `npm run watch` for continuous compilation during development
- Run `npm run lint` to check code style
- Run `npm test` to run the test suite

## Usage

Once installed, you can interact with the Docu assistant in GitHub Copilot Chat:

- `@docu /new <title>` - Create a new document
- `@docu /agent list` - Show available agents
- `@docu /templates list` - Show available templates

## Architecture

The extension is built using:

- **VS Code Extension API**: For integration with VS Code
- **Chat Participant API**: For GitHub Copilot Chat integration
- **Language Model API**: For AI-powered responses using Copilot models
- **TypeScript**: For type-safe development
- **ESLint**: For code quality and consistency

## License

MIT License - see LICENSE file for details.