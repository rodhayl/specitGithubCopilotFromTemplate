# Implementation Plan

- [x] 1. Create output coordination infrastructure


  - Implement OutputCoordinator class with deduplication logic and priority handling
  - Create interfaces for OutputContent, FeedbackContent, and CoordinatedOutput
  - Add methods for registering primary output, secondary feedback, and tips
  - _Requirements: 1.1, 1.3, 3.1, 3.2_

- [x] 2. Implement FeedbackCoordinator for managing multiple feedback sources


  - Create FeedbackCoordinator class to coordinate between different feedback systems
  - Add logic to detect and prevent duplicate feedback messages
  - Implement priority-based ordering for feedback display
  - Add methods to determine when to show conversation feedback vs tips
  - _Requirements: 1.1, 1.2, 4.1, 4.4_

- [x] 3. Create TemplateService for document template management


  - Implement TemplateService class for loading and rendering templates
  - Add methods for template retrieval, variable substitution, and front matter processing
  - Create Template and TemplateVariable interfaces
  - Add default variable generation for different template types
  - _Requirements: 2.2_

- [x] 4. Implement complete NewCommand handler


  - Create NewCommandHandler class to replace placeholder implementation
  - Add document creation logic with template integration
  - Implement path generation and validation for output files
  - Add input validation for command parameters and flags
  - _Requirements: 2.1, 2.2, 2.3_

- [x] 5. Add file creation and path handling utilities


  - Create utility functions for safe file path generation
  - Add directory creation logic for nested paths
  - Implement file writing with proper error handling
  - Add file size calculation and metadata collection
  - _Requirements: 2.1, 2.2_

- [x] 6. Integrate OutputCoordinator with CommandRouter


  - Modify CommandRouter to use OutputCoordinator for all command output
  - Update command handlers to register output with coordinator
  - Replace direct stream writing with coordinated output
  - Add cleanup logic to clear coordinator state between commands
  - _Requirements: 1.1, 1.2, 3.1, 3.3_

- [x] 7. Update ConversationFeedbackManager to use coordination


  - Modify ConversationFeedbackManager to register feedback with OutputCoordinator
  - Remove direct stream writing from feedback methods
  - Add priority levels for different types of conversation feedback
  - Update feedback timing to work with coordinated output
  - _Requirements: 1.1, 4.1, 4.2, 4.4_

- [x] 8. Update CommandTipProvider to register with coordinator


  - Modify CommandTipProvider to register tips with OutputCoordinator instead of direct formatting
  - Add logic to prevent tip display when conversation feedback is active
  - Update tip priority and categorization for better coordination
  - Remove duplicate tip detection logic (handled by coordinator)
  - _Requirements: 1.1, 3.3, 4.3, 4.4_

- [x] 9. Add error handling and recovery mechanisms


  - Implement ErrorRecoveryStrategy interface for graceful degradation
  - Add fallback logic for template loading failures
  - Create recovery options for file creation errors
  - Add user-friendly error messages with actionable recovery steps
  - _Requirements: 2.3, 3.2_

- [x] 10. Create comprehensive unit tests for new components


  - Write unit tests for OutputCoordinator deduplication and priority logic
  - Create tests for FeedbackCoordinator coordination algorithms
  - Add tests for NewCommandHandler document creation and validation
  - Write tests for TemplateService template loading and rendering
  - _Requirements: 1.1, 1.2, 2.1, 2.2_

- [x] 11. Add integration tests for command flow


  - Create integration tests for complete `/new` command execution
  - Test output coordination across multiple feedback sources
  - Add tests for conversation integration without duplication
  - Test error scenarios and recovery mechanisms
  - _Requirements: 1.1, 1.2, 4.1, 4.2_

- [x] 12. Update existing command handlers to use coordination






  - Modify `/update`, `/review`, and other command handlers to use OutputCoordinator
  - Ensure consistent output formatting across all commands
  - Remove direct stream writing from command implementations
  - Add proper error handling and feedback coordination
  - _Requirements: 3.1, 3.2, 3.3_