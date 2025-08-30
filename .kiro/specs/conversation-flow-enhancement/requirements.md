# Requirements Document

## Introduction

The Docu extension has critical issues with conversation flow continuity after commands like `/new` create documents and start conversations. While the conversation initiation works, subsequent user responses are not properly routed to the conversation manager, causing the conversation to break. Additionally, the tip system needs improvement to provide better examples and guidance for users. This spec addresses these core conversation flow issues and enhances the user experience.

## Requirements

### Requirement 1

**User Story:** As a developer using the Docu extension, I want my responses to conversation questions to be properly processed so that the conversation continues seamlessly after command execution.

#### Acceptance Criteria

1. WHEN a user responds to a conversation question after a command THEN the system SHALL route the response to the active conversation session
2. WHEN a conversation session is active THEN non-command user input SHALL be processed by the conversation manager instead of the agent directly
3. WHEN a conversation response is processed THEN the system SHALL continue the conversation flow with the next question or completion

### Requirement 2

**User Story:** As a developer, I want clear and helpful tips when creating documents so that I understand how to start conversations and continue working with the document.

#### Acceptance Criteria

1. WHEN a user executes `/new` command THEN the system SHALL provide relevant examples including conversation starting commands
2. WHEN tips are shown THEN they SHALL include examples like `/new "Document Title" --with-conversation` and `/chat <message>`
3. WHEN a document is created with conversation potential THEN the system SHALL automatically start the conversation flow

### Requirement 3

**User Story:** As a developer, I want the conversation state to be properly managed so that I can have multiple conversations and switch between them seamlessly.

#### Acceptance Criteria

1. WHEN a conversation is active THEN the system SHALL track the session ID and route messages appropriately
2. WHEN multiple conversations exist THEN the system SHALL route messages to the correct active session
3. WHEN a conversation ends THEN the system SHALL clean up the session state properly

### Requirement 4

**User Story:** As a developer, I want consistent conversation behavior across all commands that can initiate conversations so that the user experience is predictable.

#### Acceptance Criteria

1. WHEN any command starts a conversation THEN the system SHALL use the same conversation routing mechanism
2. WHEN conversation flags are used THEN they SHALL work consistently across all commands
3. WHEN conversations are started automatically THEN the user SHALL receive clear feedback about the active conversation

### Requirement 5

**User Story:** As a developer, I want proper error handling and recovery options when conversations fail so that I can continue working productively.

#### Acceptance Criteria

1. WHEN a conversation fails to start THEN the system SHALL provide clear recovery options
2. WHEN a conversation session is lost THEN the system SHALL offer to restart the conversation
3. WHEN offline mode is active THEN the system SHALL provide appropriate fallback guidance

### Requirement 6

**User Story:** As a developer, I want the tutorial and help system to be updated with accurate examples so that I can learn how to use the conversation features effectively.

#### Acceptance Criteria

1. WHEN tutorials are accessed THEN they SHALL include current conversation flow examples
2. WHEN help is requested THEN it SHALL show accurate command syntax and conversation examples
3. WHEN examples are provided THEN they SHALL demonstrate both automatic and manual conversation starting