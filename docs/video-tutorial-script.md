# Video Tutorial Script: Getting Started with Docu

This script provides a comprehensive guide for creating video tutorials demonstrating Docu's features and workflows.

## Video 1: Installation and Setup (5 minutes)

### Opening (30 seconds)
**[Screen: VS Code welcome screen]**

**Narrator:** "Welcome to Docu, the AI-powered documentation assistant for VS Code. In this tutorial, we'll show you how to install and set up Docu to start creating professional documentation with AI assistance."

**[Text overlay: "Docu - AI Documentation Assistant"]**

### Prerequisites Check (1 minute)
**[Screen: VS Code about dialog]**

**Narrator:** "Before we begin, let's check our prerequisites. First, ensure you have VS Code version 1.97.0 or higher."

**[Action: Help → About, highlight version number]**

**[Screen: Extensions view]**

**Narrator:** "Next, you'll need GitHub Copilot installed and active. Let's check the Extensions view."

**[Action: Ctrl+Shift+X, search "GitHub Copilot", show installed]**

**[Screen: Copilot Chat]**

**Narrator:** "Open Copilot Chat to verify it's working."

**[Action: Ctrl+Shift+I, show chat interface]**

### Installing Docu (1.5 minutes)
**[Screen: Extensions marketplace]**

**Narrator:** "Now let's install Docu. Go to the Extensions view and search for 'Docu'."

**[Action: Search "Docu", click Install button]**

**[Screen: Installation progress]**

**Narrator:** "The extension will install automatically. You may need to restart VS Code."

**[Action: Show restart notification, click Restart]**

### Verification (1 minute)
**[Screen: Fresh VS Code window]**

**Narrator:** "Let's verify Docu is working correctly. Open Copilot Chat and type '@docu'."

**[Action: Ctrl+Shift+I, type "@docu"]**

**[Screen: Docu response]**

**Narrator:** "Perfect! Docu responds with available commands. Let's try a simple command."

**[Action: Type "@docu /help"]**

**[Screen: Help response]**

**Narrator:** "Excellent! Docu is installed and ready to use."

### Basic Configuration (1 minute)
**[Screen: VS Code settings]**

**Narrator:** "Let's set up basic configuration. Open Settings and search for 'docu'."

**[Action: Ctrl+comma, search "docu"]**

**[Screen: Docu settings]**

**Narrator:** "Set your default directory to 'docs' and choose your preferred default agent."

**[Action: Set docu.defaultDirectory to "docs", docu.defaultAgent to "prd-creator"]**

### Closing (30 seconds)
**[Screen: Docu welcome message]**

**Narrator:** "That's it! Docu is now installed and configured. In the next video, we'll create our first document and explore the AI agents."

**[Text overlay: "Next: Creating Your First Document"]**

## Video 2: Creating Your First Document (7 minutes)

### Opening (30 seconds)
**[Screen: VS Code with empty workspace]**

**Narrator:** "Welcome back! Now that Docu is installed, let's create our first AI-powered document. We'll explore templates, agents, and basic commands."

### Creating a Basic Document (2 minutes)
**[Screen: Copilot Chat]**

**Narrator:** "Let's start with a simple document. Open Copilot Chat and type the new document command."

**[Action: Type "@docu /new 'My First Document'"]**

**[Screen: Document creation response]**

**Narrator:** "Docu creates the document and provides a clickable link. Notice the file structure and front-matter."

**[Action: Click the file link, show opened document]**

**[Screen: Created document content]**

**Narrator:** "The document includes a title, metadata, and basic structure. This is the foundation for all Docu documents."

### Using Templates (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "Now let's create a document with a template. First, let's see what templates are available."

**[Action: Type "@docu /templates list"]**

**[Screen: Template list response]**

**Narrator:** "Docu includes several built-in templates. Let's create a Product Requirements Document using the PRD template."

**[Action: Type "@docu /new 'Product Requirements' --template prd"]**

**[Screen: PRD document creation]**

**Narrator:** "Notice how the PRD template includes structured sections, variables, and professional formatting."

**[Action: Show created PRD document]**

### Understanding Document Structure (1.5 minutes)
**[Screen: PRD document]**

**Narrator:** "Let's examine the document structure. The front-matter contains metadata, and the content follows a professional template."

**[Action: Scroll through document sections]**

**Narrator:** "Each section has placeholders and guidance. The template provides a complete framework for product requirements."

### Organizing Documents (1 minute)
**[Screen: Chat interface]**

**Narrator:** "You can organize documents by specifying paths. Let's create a document in a specific directory."

**[Action: Type "@docu /new 'User Guide' --path docs/guides/"]**

**[Screen: File explorer showing created structure]**

**Narrator:** "Docu automatically creates the directory structure and places the document in the right location."

### Closing (30 seconds)
**[Screen: Workspace with created documents]**

**Narrator:** "Great! We've created multiple documents with different templates and organization. Next, we'll explore AI agents and how they specialize in different types of documentation."

## Video 3: Working with AI Agents (10 minutes)

### Opening (30 seconds)
**[Screen: Docu agent overview graphic]**

**Narrator:** "Docu includes six specialized AI agents, each designed for different phases of documentation. Let's explore how these agents work and when to use them."

### Agent Overview (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "First, let's see all available agents."

**[Action: Type "@docu /agent list"]**

**[Screen: Agent list with descriptions]**

**Narrator:** "Each agent has a specific role: PRD Creator for product planning, Requirements Gatherer for detailed requirements, Solution Architect for technical design, and so on."

**[Action: Highlight each agent as described]**

### PRD Creator Agent (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "Let's start with the PRD Creator agent. This agent specializes in product strategy and business planning."

**[Action: Type "@docu /agent set prd-creator"]**

**[Screen: Agent switch confirmation]**

**Narrator:** "Now let's engage with the PRD Creator about a new product idea."

**[Action: Type "I want to create a mobile task management app"]**

**[Screen: Agent response with strategic questions]**

**Narrator:** "Notice how the PRD Creator asks strategic questions about business objectives, target users, and market positioning. This is exactly what you need for product planning."

### Requirements Gatherer Agent (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "Now let's switch to the Requirements Gatherer agent for detailed requirements."

**[Action: Type "@docu /agent set requirements-gatherer"]**

**[Action: Type "I need detailed requirements for user authentication"]**

**[Screen: Agent response with EARS format requirements]**

**Narrator:** "The Requirements Gatherer specializes in EARS format - Easy Approach to Requirements Syntax. It creates structured user stories and acceptance criteria."

### Solution Architect Agent (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "For technical design, we use the Solution Architect agent."

**[Action: Type "@docu /agent set solution-architect"]**

**[Action: Type "How should I architect a scalable authentication system?"]**

**[Screen: Agent response with technical recommendations]**

**Narrator:** "The Solution Architect focuses on technical decisions, architecture patterns, and system design. Perfect for the design phase."

### Quality Reviewer Agent (1 minute)
**[Screen: Chat interface]**

**Narrator:** "Finally, let's see the Quality Reviewer in action."

**[Action: Type "@docu /agent set quality-reviewer"]**

**[Action: Type "@docu /review --file requirements.md --level normal"]**

**[Screen: Quality review results]**

**Narrator:** "The Quality Reviewer analyzes documents for completeness, accuracy, and best practices, providing specific improvement suggestions."

### Closing (30 seconds)
**[Screen: Agent workflow diagram]**

**Narrator:** "Each agent brings specialized expertise to different phases of documentation. In our next video, we'll see how to use these agents together in a complete workflow."

## Video 4: Complete Workflow Example (15 minutes)

### Opening (1 minute)
**[Screen: Workflow overview diagram]**

**Narrator:** "In this video, we'll walk through a complete documentation workflow using all of Docu's agents. We'll document a user authentication feature from concept to implementation plan."

### Phase 1: Product Requirements (3 minutes)
**[Screen: Empty workspace]**

**Narrator:** "Let's start with the PRD Creator agent to establish our product vision."

**[Action: Type "@docu /agent set prd-creator"]**

**[Action: Type "@docu /new 'User Authentication PRD' --template prd"]**

**[Screen: PRD document creation]**

**Narrator:** "Now let's engage with the agent about our authentication feature."

**[Action: Type conversation about business goals, target users, success metrics]**

**[Screen: Agent responses and document updates]**

**Narrator:** "The PRD Creator helps us think strategically about the feature, asking about business impact, user needs, and success criteria."

### Phase 2: Requirements Gathering (4 minutes)
**[Screen: Chat interface]**

**Narrator:** "With our PRD complete, let's gather detailed requirements using the Requirements Gatherer agent."

**[Action: Type "@docu /agent set requirements-gatherer"]**

**[Action: Type "@docu /new 'User Authentication Requirements' --template requirements"]**

**[Screen: Requirements document creation]**

**Narrator:** "Now let's define specific user stories and acceptance criteria."

**[Action: Engage in conversation about login flows, security requirements, error handling]**

**[Screen: EARS format requirements being generated]**

**Narrator:** "Notice how the agent structures requirements in EARS format with clear user stories and testable acceptance criteria."

### Phase 3: Technical Architecture (3 minutes)
**[Screen: Chat interface]**

**Narrator:** "Next, we'll design the technical solution using the Solution Architect agent."

**[Action: Type "@docu /agent set solution-architect"]**

**[Action: Type "@docu /new 'User Authentication Architecture' --template basic"]**

**[Screen: Architecture document creation]**

**Narrator:** "Let's discuss the technical approach with the architect."

**[Action: Conversation about database design, API endpoints, security measures]**

**[Screen: Technical recommendations and architecture decisions]**

**Narrator:** "The Solution Architect helps us make informed technical decisions and documents the rationale behind our choices."

### Phase 4: Implementation Planning (3 minutes)
**[Screen: Chat interface]**

**Narrator:** "Now let's create an implementation plan using the Specification Writer agent."

**[Action: Type "@docu /agent set specification-writer"]**

**[Action: Type "@docu /new 'User Authentication Implementation' --template basic"]**

**[Screen: Implementation document creation]**

**Narrator:** "The Specification Writer breaks down our feature into concrete development tasks."

**[Action: Show task breakdown conversation]**

**[Screen: Detailed implementation tasks with requirements traceability]**

**Narrator:** "Each task includes specific requirements references and implementation details, making it easy for developers to understand what needs to be built."

### Phase 5: Quality Review (1 minute)
**[Screen: Chat interface]**

**Narrator:** "Finally, let's review our documentation with the Quality Reviewer agent."

**[Action: Type "@docu /agent set quality-reviewer"]**

**[Action: Type "@docu /review --file 'user-authentication-requirements.md' --level strict"]**

**[Screen: Quality review results]**

**Narrator:** "The Quality Reviewer identifies areas for improvement and ensures our documentation meets professional standards."

### Closing (30 seconds)
**[Screen: Complete documentation set]**

**Narrator:** "We now have a complete documentation set: PRD, requirements, architecture, and implementation plan. This systematic approach ensures nothing is missed and provides a solid foundation for development."

## Video 5: Advanced Features and Tips (12 minutes)

### Opening (30 seconds)
**[Screen: Advanced features overview]**

**Narrator:** "In this final video, we'll explore Docu's advanced features including custom templates, document updates, multi-document operations, and best practices."

### Custom Templates (3 minutes)
**[Screen: Chat interface]**

**Narrator:** "Let's create a custom template for meeting notes."

**[Action: Type "@docu /templates create meeting-notes --interactive"]**

**[Screen: Interactive template creation wizard]**

**Narrator:** "The interactive wizard guides us through template creation, asking for variables, descriptions, and content structure."

**[Action: Complete wizard steps]**

**[Screen: Generated template file]**

**Narrator:** "Docu creates a YAML template file that we can customize further. Let's test our new template."

**[Action: Type "@docu /new 'Team Meeting' --template meeting-notes"]**

**[Screen: Document created with custom template]**

### Document Updates (2 minutes)
**[Screen: Existing document]**

**Narrator:** "Docu can update existing documents. Let's add a new section to our requirements document."

**[Action: Type "@docu /update --file 'requirements.md' --section 'Security Requirements' 'New security requirements here'"]**

**[Screen: Document update confirmation and diff]**

**Narrator:** "Docu shows exactly what changed and provides a summary of the updates."

### Multi-Document Operations (2 minutes)
**[Screen: Workspace with multiple documents]**

**Narrator:** "For large projects, Docu can work with multiple documents at once."

**[Action: Type "@docu /summarize --pattern '*.md' --output project-summary.md"]**

**[Screen: Summary generation process]**

**Narrator:** "This creates a comprehensive summary of all markdown files in your project."

**[Action: Type "@docu /catalog --output project-index.md"]**

**[Screen: Catalog generation]**

**Narrator:** "The catalog command creates an index of all your documentation with metadata and cross-references."

### Quality and Review Features (2 minutes)
**[Screen: Chat interface]**

**Narrator:** "Docu includes powerful quality assurance features."

**[Action: Type "@docu /review --file 'architecture.md' --level strict --fix"]**

**[Screen: Detailed quality review with auto-fixes]**

**Narrator:** "The --fix flag automatically applies suggested improvements, saving time while maintaining quality."

### Configuration and Customization (2 minutes)
**[Screen: VS Code settings]**

**Narrator:** "Let's explore advanced configuration options."

**[Action: Show workspace settings.json]**

**[Screen: Configuration options]**

**Narrator:** "You can customize default directories, agents, logging levels, and more. These settings can be shared across your team."

**[Action: Show template directory structure]**

**[Screen: Custom template organization]**

**Narrator:** "Organize custom templates by category and use agent restrictions to control which agents can use specific templates."

### Best Practices (30 seconds)
**[Screen: Best practices checklist]**

**Narrator:** "Remember these best practices: follow the agent workflow, maintain document relationships, use templates consistently, and review regularly for quality."

### Closing (30 seconds)
**[Screen: Docu logo and resources]**

**Narrator:** "That's a complete overview of Docu! Check out our documentation, examples, and community resources to continue learning. Happy documenting!"

**[Text overlay: Links to documentation, GitHub, and community]**

## Production Notes

### Technical Requirements
- **Screen Recording**: 1080p minimum, 60fps preferred
- **Audio**: Clear narration with noise cancellation
- **Editing**: Smooth transitions, highlighted UI elements
- **Captions**: Include closed captions for accessibility

### Visual Elements
- **Callouts**: Highlight important UI elements
- **Zoom**: Zoom in on relevant screen areas
- **Overlays**: Add text overlays for key concepts
- **Transitions**: Smooth transitions between sections

### Accessibility
- **Captions**: Full closed captions
- **Audio Description**: Describe visual elements
- **High Contrast**: Ensure good contrast in recordings
- **Keyboard Navigation**: Show keyboard shortcuts

### Distribution
- **YouTube**: Primary platform with chapters
- **Documentation**: Embed in documentation site
- **GitHub**: Link from repository README
- **Social Media**: Create shorter clips for promotion

---

**This script provides a comprehensive foundation for creating professional video tutorials that effectively demonstrate Docu's capabilities and help users get started quickly.**