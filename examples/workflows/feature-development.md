# Complete Feature Development Workflow

This example demonstrates a complete feature development workflow using Docu, from initial concept to implementation planning.

## Scenario

We're developing a **User Profile Management** feature for a web application. This workflow will take us through all phases of documentation using Docu's specialized agents.

## Prerequisites

- Docu extension installed and configured
- GitHub Copilot active
- Workspace folder open in VS Code

## Phase 1: Product Requirements Document (PRD)

### Step 1: Set PRD Creator Agent

```bash
@docu /agent set prd-creator
```

### Step 2: Create PRD Document

```bash
@docu /new "User Profile Management PRD" --template prd
```

**Expected Output:**
- New PRD document created with structured sections
- Template variables populated with placeholders
- Document opened in VS Code editor

### Step 3: Engage with PRD Creator

The PRD Creator agent will guide you through strategic questions:

**Sample Conversation:**
```
User: "I want to create a user profile management feature"

Agent: "Great! Let's explore this product concept. Can you tell me:
1. What are the primary goals for this user profile feature?
2. Who are the target users?
3. What specific profile information needs to be managed?"

User: "Users should be able to update their personal information, profile picture, and privacy settings"

Agent: "Excellent. Let's dive deeper:
- What privacy controls are most important to your users?
- Are there any compliance requirements (GDPR, CCPA)?
- How does this fit into your overall product strategy?"
```

### Step 4: Complete PRD Sections

Work with the agent to complete:
- Executive Summary
- Product Objectives
- User Personas
- Success Criteria
- Scope and Constraints

## Phase 2: Ideation and Brainstorming

### Step 5: Switch to Brainstormer Agent

```bash
@docu /agent set brainstormer
```

### Step 6: Explore Feature Ideas

**Sample Brainstorming Session:**
```
User: "What innovative features could we add to user profile management?"

Agent: "Let's explore some creative possibilities:
1. AI-powered profile suggestions based on user behavior
2. Social verification features for profile authenticity
3. Dynamic privacy controls that adapt to context
4. Integration with external identity providers
5. Gamification elements for profile completion

Which of these resonates with your product vision?"

User: "I like the dynamic privacy controls idea. How could that work?"

Agent: "Dynamic privacy controls could include:
- Location-based privacy (more restrictive in public places)
- Time-based settings (different privacy levels during work hours)
- Relationship-based visibility (different info for colleagues vs friends)
- Activity-based adjustments (more private during sensitive tasks)

What specific use cases would be most valuable for your users?"
```

## Phase 3: Requirements Gathering

### Step 7: Switch to Requirements Gatherer Agent

```bash
@docu /agent set requirements-gatherer
```

### Step 8: Create Requirements Document

```bash
@docu /new "User Profile Management Requirements" --template requirements
```

### Step 9: Define User Stories and Acceptance Criteria

The agent will help create structured requirements:

**Example User Story:**
```
**User Story:** As a registered user, I want to update my profile information, so that I can keep my account current and accurate.

#### Acceptance Criteria
1. WHEN a user accesses their profile page THEN the system SHALL display current profile information in editable fields
2. WHEN a user updates profile information THEN the system SHALL validate the data before saving
3. WHEN profile updates are saved THEN the system SHALL display a confirmation message
4. IF validation fails THEN the system SHALL display specific error messages for each invalid field
```

### Step 10: Complete Requirements Sections

Work through:
- Functional requirements
- Non-functional requirements
- User interface requirements
- Security requirements
- Performance requirements

## Phase 4: Solution Architecture

### Step 11: Switch to Solution Architect Agent

```bash
@docu /agent set solution-architect
```

### Step 12: Create Architecture Document

```bash
@docu /new "User Profile Management Architecture" --template basic
```

### Step 13: Design Technical Solution

**Sample Architecture Discussion:**
```
User: "How should we architect the user profile management system?"

Agent: "Let's consider the architecture patterns and components:

**Recommended Architecture:**
1. **Frontend Layer:**
   - React components for profile forms
   - State management with Redux/Context
   - Form validation library

2. **API Layer:**
   - RESTful endpoints for profile operations
   - Authentication middleware
   - Input validation and sanitization

3. **Business Logic Layer:**
   - Profile service for business rules
   - Privacy service for access control
   - Notification service for updates

4. **Data Layer:**
   - User profile database schema
   - File storage for profile images
   - Audit logging for changes

**Key Considerations:**
- Microservices vs monolithic approach
- Database design for profile data
- Caching strategy for performance
- Security measures for sensitive data"
```

## Phase 5: Implementation Planning

### Step 14: Switch to Specification Writer Agent

```bash
@docu /agent set specification-writer
```

### Step 15: Create Implementation Plan

```bash
@docu /new "User Profile Management Implementation Plan" --template basic
```

### Step 16: Break Down Implementation Tasks

The agent will help create detailed implementation tasks:

**Example Implementation Tasks:**

```markdown
## Implementation Plan

### Phase 1: Backend API Development
- [ ] 1.1 Create user profile database schema
  - Design tables for user_profiles, profile_images, privacy_settings
  - Add indexes for performance optimization
  - _Requirements: REQ-001, REQ-003_

- [ ] 1.2 Implement profile API endpoints
  - GET /api/profile - Retrieve user profile
  - PUT /api/profile - Update profile information
  - POST /api/profile/image - Upload profile image
  - _Requirements: REQ-001, REQ-002_

### Phase 2: Frontend Development
- [ ] 2.1 Create profile management components
  - ProfileForm component with validation
  - ImageUpload component with preview
  - PrivacySettings component
  - _Requirements: REQ-004, REQ-005_

### Phase 3: Integration and Testing
- [ ] 3.1 Implement end-to-end workflows
  - Profile update workflow
  - Image upload workflow
  - Privacy settings workflow
  - _Requirements: All requirements_
```

## Phase 6: Quality Review

### Step 17: Switch to Quality Reviewer Agent

```bash
@docu /agent set quality-reviewer
```

### Step 18: Review All Documents

```bash
# Review PRD
@docu /review --file "user-profile-management-prd.md" --level normal

# Review Requirements
@docu /review --file "user-profile-management-requirements.md" --level strict

# Review Architecture
@docu /review --file "user-profile-management-architecture.md" --level normal

# Review Implementation Plan
@docu /review --file "user-profile-management-implementation-plan.md" --level strict --fix
```

### Step 19: Address Review Feedback

The Quality Reviewer will provide specific feedback:

**Example Review Output:**
```
## Review Results: User Profile Management Requirements

✅ **Document is valid!**

**Summary:**
- Errors: 0
- Warnings: 2
- Info: 3

**Issues Found:**

⚠️ **WARNING:** Section "Non-functional Requirements" could be more detailed
   💡 *Suggestion: Add specific performance metrics and scalability requirements*

⚠️ **WARNING:** Missing traceability to PRD objectives
   💡 *Suggestion: Add references to specific PRD sections for each requirement*

ℹ️ **INFO:** Consider adding more edge case scenarios
   💡 *Suggestion: Include requirements for error handling and recovery*
```

## Phase 7: Documentation Maintenance

### Step 20: Update Documents Based on Feedback

```bash
# Update requirements based on review
@docu /update --file "user-profile-management-requirements.md" --section "Non-functional Requirements" --mode append "
### Performance Requirements
- Profile page load time: < 2 seconds
- Image upload processing: < 5 seconds
- Concurrent user support: 1000+ users
- API response time: < 500ms for 95th percentile
"

# Add traceability section
@docu /update --file "user-profile-management-requirements.md" --section "Traceability" --mode replace "
## Requirements Traceability

| Requirement | PRD Reference | Priority |
|-------------|---------------|----------|
| REQ-001 | PRD-OBJ-001 | High |
| REQ-002 | PRD-OBJ-002 | Medium |
| REQ-003 | PRD-OBJ-001 | High |
"
```

### Step 21: Final Review

```bash
@docu /review --file "user-profile-management-requirements.md" --level strict
```

## Workflow Summary

### Documents Created

1. **User Profile Management PRD** - Strategic product document
2. **User Profile Management Requirements** - Detailed functional requirements
3. **User Profile Management Architecture** - Technical solution design
4. **User Profile Management Implementation Plan** - Development roadmap

### Agents Used

1. **PRD Creator** - Strategic planning and product vision
2. **Brainstormer** - Creative ideation and feature exploration
3. **Requirements Gatherer** - Systematic requirements collection
4. **Solution Architect** - Technical architecture design
5. **Specification Writer** - Implementation planning
6. **Quality Reviewer** - Document validation and improvement

### Key Benefits

- **Systematic Approach** - Structured progression through documentation phases
- **Consistency** - Standardized templates and formats
- **Traceability** - Clear links between documents and requirements
- **Quality Assurance** - Built-in review and validation processes
- **Collaboration** - Shared understanding through comprehensive documentation

## Next Steps

### Implementation Phase

1. **Development Setup**
   - Set up development environment
   - Create project structure
   - Initialize version control

2. **Sprint Planning**
   - Break down implementation tasks into sprints
   - Assign tasks to team members
   - Set up project tracking

3. **Continuous Documentation**
   - Update documents as implementation progresses
   - Document design decisions and changes
   - Maintain requirements traceability

### Maintenance Phase

1. **Regular Reviews**
   - Schedule periodic document reviews
   - Update based on user feedback
   - Maintain accuracy and relevance

2. **Version Control**
   - Track document changes
   - Maintain version history
   - Coordinate updates across team

## Tips for Success

### Best Practices

1. **Follow the Workflow** - Use agents in their intended sequence
2. **Engage Actively** - Provide detailed context and feedback to agents
3. **Iterate as Needed** - Return to previous phases for refinement
4. **Maintain Consistency** - Use consistent terminology across documents
5. **Review Regularly** - Use Quality Reviewer throughout the process

### Common Pitfalls

1. **Skipping Phases** - Don't jump directly to implementation without proper planning
2. **Insufficient Detail** - Provide enough context for agents to be effective
3. **Ignoring Reviews** - Address quality reviewer feedback promptly
4. **Poor Traceability** - Maintain clear links between documents
5. **Outdated Documents** - Keep documentation current with implementation

---

**This workflow demonstrates the power of Docu's agent-based approach to documentation. By following this systematic process, you can create comprehensive, high-quality documentation that supports successful feature development.**