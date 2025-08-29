# Complete Tutorial: Building a Card Game Shop with Docu

This comprehensive tutorial demonstrates how to use all Docu agents in sequence to create complete documentation for a "Card Game Shop" project, from initial concept to implementation planning.

## Project Overview

We'll build documentation for **CardCraft**, an online card game shop that sells trading cards, board games, and gaming accessories. This tutorial will walk you through every command and agent interaction needed to create professional documentation.

## Prerequisites

Before starting, ensure you have:
- ✅ VS Code 1.97.0 or higher
- ✅ GitHub Copilot subscription and extension active
- ✅ Docu extension installed and configured
- ✅ A workspace folder open in VS Code

## 🔄 **Important: New Interaction Model**

Docu now uses an **explicit command-based interaction model** for better control:

- **❌ Old way:** `@docu some random message` (sent directly to AI)
- **✅ New way:** `@docu /chat some message` (explicit conversation command)

**Why this change?**
- Prevents accidental AI calls from random messages
- Gives you full control over when AI features are used
- Makes the interaction model clear and predictable
- Allows for better offline mode handling

**Key Commands:**
- `/chat <message>` - Start conversations with the active agent
- `/agent set <name>` - Set the active agent before chatting
- `/new "Title"` - Create documents
- `/help` - Get help and see all commands

## Verification Setup

Let's verify everything is working before we begin:

```bash
# Test Docu is responding
@docu /help

# Check available agents
@docu /agent list

# Check available templates
@docu /templates list
```

**Expected Response for `/help`:**
```
🤖 **Docu Assistant Help**

Available commands:
• /new <title> [--template <template-id>] [--path <output-path>] - Create a new document
• /agent <subcommand> - Manage AI agents (list, set, current)
• /templates <subcommand> - Manage templates (list, show, open)
• /update <file> --section <section> - Update document sections
• /review <file> [--level <level>] - Review document quality
```

**Expected Response for `/agent list`:**
```
📋 **Available Agents:**

• **prd-creator** - Product Requirements Document creation and strategic planning
• **brainstormer** - Creative ideation and concept exploration  
• **requirements-gatherer** - Structured requirements collection using EARS format
• **solution-architect** - Technical architecture and system design
• **specification-writer** - Implementation planning and task breakdown
• **quality-reviewer** - Document validation and quality assurance
```

**Expected Response for `/templates list`:**
```
📄 **Available Templates:**

• **basic** - Basic document template with standard structure
• **prd** - Product Requirements Document template
• **requirements** - Requirements document with EARS format structure
```

If you see similar responses to these commands, you're ready to proceed!

## Phase 1: Product Requirements Document (PRD Creation)

### Step 1: Set the PRD Creator Agent

```bash
@docu /agent set prd-creator
```

**Expected Response:**
```
✅ Switched to PRD Creator agent
🎯 I'm specialized in product concept exploration and PRD generation.
I'll help you think strategically about your product vision, objectives, and market positioning.
```

### Step 2: Create the Project Directory Structure
```

Let Docu create them automatically by omitting the path parameter.

### Step 2: Create the PRD Document

You have two main options for creating your PRD:

**Option A: Use Basic Template (Recommended for Beginners)**
```bash
@docu /new "CardCraft Online Store PRD" --template basic --path docs/01-prd/
```

**Option B: Use PRD Template (Advanced)**
```bash
@docu /new "CardCraft Online Store PRD" --template prd --path docs/01-prd/
```

**What Happens with Option A (Basic Template):**
- Creates `docs/01-prd/cardcraft-online-store-prd.md` with basic structure
- Creates the directory structure if it doesn't exist
- Opens the document in VS Code
- Works seamlessly with all agents for guided development
- No template variable requirements

**What Happens with Option B (PRD Template):**
- Attempts to create a structured PRD document
- May require specific template variables
- If variables are missing, you'll get helpful error messages with alternatives

**Expected Success Response:**
```
✅ **Document Created Successfully**

📄 **File:** docs/01-prd/cardcraft-online-store-prd.md
📁 **Directory:** Created docs/01-prd/ 
🚀 **Status:** Document opened in editor

**Next Steps:**
• Work with the PRD Creator agent to develop your content
• Use `/chat` commands to build out sections
• The agent will guide you through strategic questions
```

**If You Get Template Variable Errors:**
```
❌ **Error creating document:** Missing required variables

**The PRD template requires specific variables. Here are your options:**

**Option 1 (Recommended):** Use placeholders that will be filled during conversation:
`/new "CardCraft Online Store PRD" --template prd --with-placeholders --path docs/01-prd/`

**Option 2:** Use the basic template and build structure through conversation:
`/new "CardCraft Online Store PRD" --template basic --path docs/01-prd/`

💡 *Both options work great with the PRD Creator agent for guided document creation*
```

### 🎯 **Working with the PRD Creator Agent**

Once your document is created, you'll work with the PRD Creator agent to develop comprehensive content through conversation:

#### **What You'll Experience:**
The PRD Creator agent specializes in strategic product thinking and will guide you through:

- **Problem Definition** - Understanding the core problem you're solving
- **Market Analysis** - Identifying target users and competitive landscape  
- **Product Vision** - Defining objectives and success criteria
- **Feature Planning** - Outlining core functionality and requirements
- **Strategic Positioning** - How your product fits in the market

#### **Conversation Style:**
The agent uses a conversational approach, asking strategic questions like:

```
I'm here to help you develop CardCraft into a comprehensive PRD. Let me start with some strategic questions:

1. **Market Position**: How will CardCraft differentiate from existing competitors like TCGPlayer or local game stores?

2. **Business Model**: Are you planning:
   - Direct sales of sealed products?
   - Marketplace for individual cards?
   - Subscription boxes?
   - Tournament organization?

3. **Geographic Scope**: Starting locally, nationally, or internationally?

Let's start with your differentiation strategy - what unique value will CardCraft provide?
```

#### **Key Benefits:**
- ✅ **Strategic Guidance** - Expert-level product strategy questions
- ✅ **Iterative Development** - Build your PRD through natural conversation
- ✅ **Comprehensive Coverage** - Ensures all critical PRD sections are addressed
- ✅ **Professional Output** - Generates market-ready documentation

### Step 3: Develop PRD Content Through Conversation

Now that your document is created, start a conversation with the PRD Creator agent to develop comprehensive content:

**Your Initial Prompt:**
```
@docu /chat Help me develop a comprehensive PRD for CardCraft, an online card game shop. I want to create a marketplace that serves card game enthusiasts with competitive pricing, authentic products, and community features.
```

**Expected Agent Response:**
```
Excellent concept! Let me help you develop this into a comprehensive PRD. I have some strategic questions:

1. **Market Position**: How will CardCraft differentiate from existing competitors like TCGPlayer or local game stores?

2. **Business Model**: Are you planning:
   - Direct sales of sealed products?
   - Marketplace for individual cards?
   - Subscription boxes?
   - Tournament organization?

3. **Geographic Scope**: Starting locally, nationally, or internationally?

4. **Key Success Metrics**: What would make CardCraft successful in year one?

Let's start with your differentiation strategy - what unique value will CardCraft provide?
```

**Your Follow-up Response:**
```
@docu /chat CardCraft will differentiate by offering:
1. AI-powered deck building recommendations
2. Virtual card condition verification using photos
3. Community features like deck sharing and tournaments
4. Subscription boxes with personalized card selections
5. Trade-in program for unwanted cards

We'll start nationally in the US, focusing on competitive players and collectors.
```

**Agent's Strategic Development:**
The agent will then help you develop each section systematically:

- **Executive Summary** - Based on your problem definition and solution
- **Product Objectives** - Derived from your business goals
- **Target Market Analysis** - From your user descriptions
- **User Personas** - Detailed profiles of your target customers
- **Success Criteria** - Measurable goals and KPIs
- **Competitive Analysis** - How you compare to existing solutions
- **Technical Requirements** - High-level technical needs
- **Timeline and Milestones** - Development roadmap

**Agent Response (Example):**
```
Excellent concept! Let me help you develop this into a comprehensive PRD. I have some strategic questions:

1. **Market Position**: How will CardCraft differentiate from existing competitors like TCGPlayer or local game stores?

2. **Business Model**: Are you planning:
   - Direct sales of sealed products?
   - Marketplace for individual cards?
   - Subscription boxes?
   - Tournament organization?

3. **Geographic Scope**: Starting locally, nationally, or internationally?

4. **Key Success Metrics**: What would make CardCraft successful in year one?

Let's start with your differentiation strategy - what unique value will CardCraft provide?
```

**Your Follow-up:**
```
@docu /chat CardCraft will differentiate by offering:
1. AI-powered deck building recommendations
2. Virtual card condition verification using photos
3. Community features like deck sharing and tournaments
4. Subscription boxes with personalized card selections
5. Trade-in program for unwanted cards

We'll start nationally in the US, focusing on competitive players and collectors.
```

### Step 4: Complete PRD Sections

Continue working with the agent to fill out all PRD sections. The agent will guide you through:

- **Executive Summary**
- **Product Objectives** 
- **Target Market Analysis**
- **User Personas**
- **Success Criteria**
- **Competitive Analysis**
- **Technical Requirements**
- **Timeline and Milestones**

## Phase 2: Ideation and Feature Exploration

### Step 5: Switch to Brainstormer Agent

```bash
@docu /agent set brainstormer
```

**Expected Response:**
```
✅ Switched to Brainstormer agent
💡 I'm here to help explore creative possibilities and expand on your concepts.
Let's think outside the box and discover innovative features for CardCraft!
```

### Step 6: Brainstorm Innovative Features

**Your Input:**
```
@docu /chat Based on the CardCraft PRD, what innovative features could we add to make our card game shop stand out from competitors?
```

**Agent Response (Example):**
```
Great question! Let's explore some innovative possibilities for CardCraft:

🎮 **Gamification Features:**
- Achievement system for purchases and community participation
- Loyalty points that unlock exclusive cards or early access
- Seasonal challenges and tournaments with unique rewards

🤖 **AI-Powered Features:**
- Smart inventory alerts for cards you're collecting
- Price prediction algorithms for investment guidance
- Deck optimization suggestions based on meta analysis

🌐 **Community Innovation:**
- Virtual reality card viewing for high-value items
- Live streaming integration for pack openings
- Collaborative deck building with friends
- Card authentication through blockchain verification

📱 **Mobile-First Features:**
- Augmented reality card scanner for instant price checks
- Location-based features for finding local players
- Push notifications for price drops on wishlist items

Which of these directions excites you most? Let's dive deeper into the most promising ideas.
```

**Your Follow-up:**
```
@docu /chat I love the AI-powered features and the AR card scanner idea. How could we implement a comprehensive AI recommendation system that helps both new and experienced players?
```

Continue this creative exploration to generate innovative feature ideas.

## Phase 3: Requirements Gathering

### Step 7: Switch to Requirements Gatherer Agent

```bash
@docu /agent set requirements-gatherer
```

**Expected Response:**
```
✅ Switched to Requirements Gatherer agent
📋 I specialize in systematic requirements collection using EARS format.
I'll help you create structured user stories and detailed acceptance criteria.
```

### Step 8: Create Requirements Document

```bash
@docu /new "CardCraft Requirements Specification" --template basic --path docs/02-requirements/
```

**Alternative (if you want to try the requirements template):**
```bash
@docu /new "CardCraft Requirements Specification" --template requirements --path docs/02-requirements/
```

**What Happens:**
- Creates `docs/02-requirements/cardcraft-requirements-specification.md`
- Automatically creates the directory structure if it doesn't exist
- Opens the document in VS Code for editing
- Ready for agent-guided development

**Expected Success Response:**
```
✅ **Document Created Successfully**

📄 **File:** docs/02-requirements/cardcraft-requirements-specification.md
📁 **Directory:** Created docs/02-requirements/
🚀 **Status:** Document opened in editor

**Next Steps:**
• Work with the Requirements Gatherer agent
• Develop structured user stories and acceptance criteria
• Use EARS format for precise requirements
```

**Note:** If the requirements template has missing variables, you'll get helpful error messages suggesting to use the basic template or add placeholders.

### Step 9: Define User Stories and Acceptance Criteria

**Your Input:**
```
@docu /chat Based on our CardCraft PRD and brainstorming session, help me create comprehensive requirements for the core e-commerce functionality, user management, and AI recommendation features.
```

**Expected Agent Response:**
```
Perfect! Let's create structured requirements using EARS format. I'll help you develop user stories with clear acceptance criteria.

Let's start with core user management:

**User Story 1:** As a new customer, I want to create an account with my email and preferences, so that I can receive personalized recommendations and track my orders.

#### Acceptance Criteria
1. WHEN a user provides valid email and password THEN the system SHALL create a new account
2. WHEN creating an account THEN the system SHALL collect game preferences (Pokemon, MTG, etc.)
3. WHEN account creation is successful THEN the system SHALL send a verification email
4. WHEN email is already registered THEN the system SHALL display appropriate error message
5. WHEN password doesn't meet requirements THEN the system SHALL show password criteria

Should we continue with the product catalog requirements next?
```

**Your Follow-up:**
```
@docu /chat Yes, let's continue with product catalog requirements. I want to ensure we cover product search, filtering, and inventory management.
```

**Agent's Continued Development:**
The Requirements Gatherer agent will systematically help you develop:

- **Functional Requirements** - Core system capabilities
- **User Stories** - In "As a... I want... So that..." format  
- **Acceptance Criteria** - Using EARS format (WHEN... THEN... SHALL...)
- **Non-Functional Requirements** - Performance, security, usability
- **Business Rules** - Constraints and validation rules
- **Integration Requirements** - External system dependencies

### Step 11: Complete All Requirement Categories

Work through systematic requirements for:

- **User Management Requirements**
- **Product Catalog Requirements** 
- **Shopping Cart and Checkout Requirements**
- **AI Recommendation Requirements**
- **Community Features Requirements**
- **Mobile App Requirements**
- **Security and Privacy Requirements**
- **Performance Requirements**

**Example Shopping Cart Requirement:**
```
**User Story:** As a customer, I want to add cards to my shopping cart and see real-time inventory updates, so that I can secure items before they sell out.

#### Acceptance Criteria
1. WHEN a user clicks "Add to Cart" THEN the system SHALL add the item to their cart
2. WHEN inventory changes THEN the system SHALL update cart availability in real-time
3. WHEN an item becomes unavailable THEN the system SHALL notify the user immediately
4. WHEN cart is updated THEN the system SHALL recalculate totals including tax and shipping
```

## Phase 4: Solution Architecture

### Step 12: Switch to Solution Architect Agent

```bash
@docu /agent set solution-architect
```

**Expected Response:**
```
✅ Switched to Solution Architect agent
🏗️ I focus on technical architecture and design decisions.
I'll help you design a scalable, secure system architecture for CardCraft.
```

### Step 13: Create Architecture Document

```bash
@docu /new "CardCraft System Architecture" --template basic --path docs/03-architecture/
```

**Expected Success Response:**
```
✅ **Document Created Successfully**

📄 **File:** docs/03-architecture/cardcraft-system-architecture.md
📁 **Directory:** Created docs/03-architecture/
🚀 **Status:** Document opened in editor

**Next Steps:**
• Work with the Solution Architect agent
• Design scalable system architecture
• Plan technical implementation approach
```

### Step 14: Design Technical Solution

**Your Input:**
```
@docu /chat Help me design the system architecture for CardCraft. We need to support high traffic during product releases, real-time inventory management, AI recommendations, and mobile apps. What architecture patterns and technologies would you recommend?
```

**Agent Response (Example):**
```
Excellent! Let's design a robust architecture for CardCraft. Given your requirements for high traffic, real-time features, and AI capabilities, I recommend a microservices architecture:

## Recommended Architecture

### **Frontend Layer**
- **Web Application**: React.js with Next.js for SEO and performance
- **Mobile Apps**: React Native for cross-platform development
- **Admin Dashboard**: Separate React application for inventory management

### **API Gateway Layer**
- **Kong or AWS API Gateway**: Request routing, rate limiting, authentication
- **Load Balancer**: Distribute traffic across service instances

### **Microservices Layer**
1. **User Service**: Authentication, profiles, preferences
2. **Product Service**: Catalog management, search, filtering
3. **Inventory Service**: Real-time stock tracking, reservations
4. **Order Service**: Cart, checkout, order processing
5. **Payment Service**: Payment processing, refunds
6. **Recommendation Service**: AI-powered suggestions
7. **Notification Service**: Email, push notifications

### **Data Layer**
- **PostgreSQL**: Transactional data (users, orders, products)
- **Redis**: Caching, session storage, real-time inventory
- **Elasticsearch**: Product search and filtering
- **MongoDB**: User behavior data for AI recommendations

### **Infrastructure**
- **Container Orchestration**: Kubernetes for scalability
- **Message Queue**: Apache Kafka for event-driven communication
- **CDN**: CloudFlare for static assets and global performance

Would you like me to detail the specific technology choices and integration patterns?
```

Continue working with the agent to define:
- **Database Schema Design**
- **API Design Patterns**
- **Security Architecture**
- **Scalability Considerations**
- **Third-party Integrations**
- **Deployment Strategy**

## Phase 5: Implementation Planning

### Step 15: Switch to Specification Writer Agent

```bash
@docu /agent set specification-writer
```

**Expected Response:**
```
✅ Switched to Specification Writer agent
📝 I specialize in implementation planning and task breakdown.
I'll help you create detailed development tasks and technical specifications.
```

### Step 16: Create Implementation Plan

```bash
@docu /new "CardCraft Implementation Plan" --template basic --path docs/04-implementation/
```

**Expected Success Response:**
```
✅ **Document Created Successfully**

📄 **File:** docs/04-implementation/cardcraft-implementation-plan.md
📁 **Directory:** Created docs/04-implementation/
🚀 **Status:** Document opened in editor

**Next Steps:**
• Work with the Specification Writer agent
• Break down development into manageable tasks
• Create detailed implementation roadmap
```

### Step 17: Break Down Implementation Tasks

**Your Input:**
```
@docu /chat Based on our CardCraft architecture, help me create a detailed implementation plan with specific development tasks, priorities, and estimated timelines. We have a team of 6 developers and want to launch an MVP in 4 months.
```

**Agent Response (Example):**
```
Perfect! Let's create a comprehensive implementation plan for your 4-month MVP timeline with 6 developers.

## Implementation Plan Overview

### **Team Structure Recommendation**
- 2 Frontend Developers (Web + Mobile)
- 2 Backend Developers (Core Services)
- 1 DevOps Engineer (Infrastructure)
- 1 Full-Stack Developer (Integration + AI)

### **Phase 1: Foundation (Weeks 1-4)**

#### Backend Infrastructure
- [ ] **Task 1.1**: Set up development environment and CI/CD pipeline
  - Configure Docker containers for all services
  - Set up Kubernetes cluster (local + staging)
  - Implement automated testing pipeline
  - **Assigned to**: DevOps Engineer
  - **Estimate**: 1 week
  - **Requirements**: REQ-SEC-001, REQ-PERF-001

- [ ] **Task 1.2**: Implement User Service
  - User registration and authentication
  - JWT token management
  - Password reset functionality
  - User profile management
  - **Assigned to**: Backend Developer 1
  - **Estimate**: 2 weeks
  - **Requirements**: REQ-USER-001 through REQ-USER-005

#### Frontend Foundation
- [ ] **Task 1.3**: Set up React application structure
  - Configure Next.js with TypeScript
  - Implement routing and navigation
  - Set up state management (Redux Toolkit)
  - Create design system components
  - **Assigned to**: Frontend Developer 1
  - **Estimate**: 1.5 weeks
  - **Requirements**: REQ-UI-001, REQ-UI-002

Would you like me to continue with the detailed breakdown for all phases?
```

### Step 18: Complete Implementation Phases

Continue working with the agent to define:

**Phase 2: Core E-commerce (Weeks 5-8)**
- Product catalog implementation
- Shopping cart functionality
- Basic checkout process
- Payment integration

**Phase 3: Advanced Features (Weeks 9-12)**
- AI recommendation engine
- Real-time inventory management
- Community features
- Mobile app development

**Phase 4: Launch Preparation (Weeks 13-16)**
- Performance optimization
- Security hardening
- User acceptance testing
- Production deployment

## Phase 6: Quality Review and Validation

### Step 18: Switch to Quality Reviewer Agent

```bash
@docu /agent set quality-reviewer
```

**Expected Response:**
```
✅ Switched to Quality Reviewer agent
🔍 I specialize in document validation and quality assurance.
I'll help ensure your documentation meets high standards and is ready for implementation.
```

### Step 19: Review All Documents

Review each document systematically with the Quality Reviewer agent:

**Start a Review Conversation:**
```
@docu /chat Please review my CardCraft PRD document at docs/01-prd/cardcraft-online-store-prd.md and provide feedback on completeness, clarity, and professional quality.
```

**Expected Agent Response:**
```
I'll review your CardCraft PRD for completeness, clarity, and professional quality. Let me analyze the document structure and content...

## Review Results: CardCraft PRD

### Overall Assessment: Good Foundation ✅
Your PRD has a solid structure and covers the essential elements. Here are my findings:

### Strengths:
• Clear problem statement and market opportunity
• Well-defined target audience
• Comprehensive feature list
• Realistic success metrics

### Areas for Improvement:
• **Competitive Analysis**: Add more detailed competitor comparison
• **Technical Requirements**: Include more specific technical constraints
• **Risk Assessment**: Add potential risks and mitigation strategies
• **Timeline**: Include more detailed milestone planning

### Specific Recommendations:
1. Expand the competitive analysis section with feature comparisons
2. Add technical architecture requirements
3. Include user personas with more demographic detail
4. Define clear success metrics with measurement methods

Would you like me to help you address any of these areas?
```

**Alternative Review Commands (if available):**
```bash
# Basic document review
@docu /review --file "docs/01-prd/cardcraft-online-store-prd.md"

# Detailed review with specific focus
@docu /review --file "docs/02-requirements/cardcraft-requirements-specification.md" --level strict
```

### Step 20: Address Review Feedback

**Example Review Output:**
```
## Review Results: CardCraft Requirements Specification

✅ **Document Quality Score: 92/100**

### Summary
- Errors: 0
- Warnings: 3
- Info: 2
- Total Issues: 5

### Issues Found

⚠️ **WARNING**: Missing performance requirements for AI recommendation service
   **Location**: Section "AI Recommendation Requirements"
   **Suggestion**: Add specific response time and accuracy requirements

⚠️ **WARNING**: Incomplete error handling scenarios
   **Location**: Multiple user stories
   **Suggestion**: Add acceptance criteria for error conditions and edge cases

⚠️ **WARNING**: Missing accessibility requirements
   **Location**: UI Requirements section
   **Suggestion**: Add WCAG 2.1 compliance requirements

ℹ️ **INFO**: Consider adding more detailed security requirements
   **Suggestion**: Specify encryption standards and data protection measures

ℹ️ **INFO**: Traceability could be improved
   **Suggestion**: Add requirement IDs and cross-references to PRD objectives

### Recommendations for Improvement
1. Add specific performance metrics for all services
2. Include comprehensive error handling scenarios
3. Define accessibility standards and compliance requirements
4. Enhance security specifications with technical details
5. Improve requirement traceability with unique identifiers
```

### Step 21: Update Documents Based on Feedback

```bash
# Add missing performance requirements
@docu /update --file "docs/02-requirements/cardcraft-requirements-specification.md" --section "Performance Requirements" --mode append "

### AI Recommendation Service Performance
- **Response Time**: Recommendations SHALL be generated within 200ms for 95% of requests
- **Accuracy**: Recommendation relevance SHALL achieve minimum 75% user satisfaction rating
- **Throughput**: System SHALL handle 1000+ concurrent recommendation requests
- **Availability**: Service SHALL maintain 99.9% uptime during business hours

### Error Handling Requirements
- **Graceful Degradation**: When AI service is unavailable, system SHALL display popular items
- **Timeout Handling**: All API calls SHALL timeout after 5 seconds with appropriate user messaging
- **Data Validation**: Invalid user inputs SHALL be rejected with specific error messages
"

# Add accessibility requirements
@docu /update --file "docs/02-requirements/cardcraft-requirements-specification.md" --section "Accessibility Requirements" --mode replace "

## Accessibility Requirements

**User Story**: As a user with disabilities, I want the CardCraft website to be fully accessible, so that I can browse and purchase products independently.

#### Acceptance Criteria
1. WHEN the website is tested THEN it SHALL meet WCAG 2.1 AA compliance standards
2. WHEN using screen readers THEN all content SHALL be properly announced
3. WHEN navigating by keyboard THEN all interactive elements SHALL be accessible
4. WHEN viewing content THEN color contrast SHALL meet minimum 4.5:1 ratio
5. WHEN images are displayed THEN they SHALL include descriptive alt text
"
```

### Step 22: Final Quality Review

```bash
@docu /review --file "docs/02-requirements/cardcraft-requirements-specification.md" --level strict
```

## Phase 7: Documentation Organization and Maintenance

### Step 23: Create Document Catalog

**Using Agent Conversation:**
```
@docu /chat Please help me create a comprehensive index of all the CardCraft documentation we've created, including the PRD, requirements, architecture, and implementation plan.
```

**Expected Agent Response:**
```
I'll create a comprehensive documentation index for your CardCraft project. Here's what I found:

# CardCraft Documentation Index

## Project Overview
**CardCraft** - Online card game marketplace serving enthusiasts with competitive pricing, authentic products, and community features.

## Documentation Structure

### 📋 Phase 1: Product Requirements
- **File:** `docs/01-prd/cardcraft-online-store-prd.md`
- **Status:** Complete
- **Content:** Executive summary, market analysis, user personas, success criteria

### 📝 Phase 2: Requirements Specification  
- **File:** `docs/02-requirements/cardcraft-requirements-specification.md`
- **Status:** Complete
- **Content:** User stories, acceptance criteria, functional/non-functional requirements

### 🏗️ Phase 3: System Architecture
- **File:** `docs/03-architecture/cardcraft-system-architecture.md`
- **Status:** Complete
- **Content:** Technical architecture, component design, data models

### 🚀 Phase 4: Implementation Plan
- **File:** `docs/04-implementation/cardcraft-implementation-plan.md`
- **Status:** Complete
- **Content:** Development tasks, timeline, resource allocation

Would you like me to create a summary document as well?
```

### Step 24: Create Project Summary

**Using Agent Conversation:**
```
@docu /chat Please create a comprehensive project summary that captures the key points from all our CardCraft documentation.
```

## Complete Project Structure

After following this tutorial, you'll have created:

```
workspace/
├── docs/
│   ├── 01-prd/
│   │   └── cardcraft-online-store-prd.md
│   ├── 02-requirements/
│   │   └── cardcraft-requirements-specification.md
│   ├── 03-architecture/
│   │   └── cardcraft-system-architecture.md
│   └── 04-implementation/
│       └── cardcraft-implementation-plan.md
├── CardCraft-Documentation-Index.md
├── CardCraft-Project-Summary.md
└── TUTORIAL_EXAMPLE.md
```

## Summary of Commands Used

### Agent Management Commands
```bash
@docu /agent list                    # List all available agents
@docu /agent set prd-creator        # Switch to PRD Creator
@docu /agent set brainstormer       # Switch to Brainstormer
@docu /agent set requirements-gatherer  # Switch to Requirements Gatherer
@docu /agent set solution-architect # Switch to Solution Architect
@docu /agent set specification-writer   # Switch to Specification Writer
@docu /agent set quality-reviewer   # Switch to Quality Reviewer
@docu /agent current                # Check current agent
```

### Document Creation Commands
```bash
@docu /new "Document Title" --template prd --path docs/01-prd/
@docu /new "Document Title" --template requirements --path docs/02-requirements/
@docu /new "Document Title" --template basic --path docs/03-architecture/

# Check template details if needed
@docu /templates show prd
@docu /templates show requirements
```

### Document Management Commands
```bash
# Document creation
@docu /new "Document Title" --template basic --path docs/folder/

# Agent-based document review (recommended)
# Use /chat commands with Quality Reviewer agent

# Template management
@docu /templates list
@docu /templates show basic
```

**Note:** Many advanced commands like `/update`, `/review`, `/catalog`, and `/summarize` may not be fully implemented yet. The recommended approach is to use `/chat` commands with the appropriate agents to achieve these goals.

### Template and Help Commands
```bash
@docu /templates list               # List available templates
@docu /templates show prd          # Show template details
@docu /help                        # General help
@docu /help new                    # Command-specific help
@docu /diagnostics                 # System diagnostics
```

## Key Learning Outcomes

By completing this tutorial, you've learned:

1. **Complete Workflow Mastery** - How to use all six Docu agents in proper sequence
2. **Strategic Documentation** - Creating comprehensive PRDs with market analysis
3. **Creative Ideation** - Using the Brainstormer for innovative feature exploration
4. **Systematic Requirements** - Writing EARS format requirements with clear acceptance criteria
5. **Technical Architecture** - Designing scalable system architectures
6. **Implementation Planning** - Breaking down complex projects into manageable tasks
7. **Quality Assurance** - Using automated review processes to improve documentation quality
8. **Document Management** - Organizing and maintaining comprehensive project documentation

## Best Practices Demonstrated

1. **Sequential Agent Usage** - Following the logical progression from concept to implementation
2. **Template Utilization** - Leveraging built-in templates for consistency and structure
3. **Iterative Refinement** - Using quality review feedback to improve documentation
4. **Comprehensive Coverage** - Addressing all aspects from business requirements to technical implementation
5. **Traceability Maintenance** - Linking requirements back to business objectives
6. **Quality Gates** - Regular review and validation throughout the process

## Next Steps

### For Your Own Projects
1. **Adapt the Structure** - Use this workflow as a template for your own projects
2. **Customize Templates** - Create project-specific templates based on your needs
3. **Team Adoption** - Train your team on this systematic approach
4. **Process Integration** - Integrate Docu workflows into your development process

### Advanced Features to Explore
1. **Custom Agent Configurations** - Tailor agents for your specific domain
2. **Advanced Template Variables** - Create dynamic, context-aware templates
3. **Automated Quality Gates** - Set up automated review processes
4. **Integration Workflows** - Connect Docu with your existing tools

## Troubleshooting Guide

### Common Issues and Solutions

#### 1. Offline Mode Problems

**Issue: Extension shows "offline mode" even with GitHub Copilot working**

**Symptoms:**
- Docu reports being offline
- Agents provide basic templates instead of AI-powered responses
- Limited functionality available

**Solutions:**
```bash
# Check current status
@docu /diagnostics

# Try switching agents to refresh connection
@docu /agent set prd-creator

# Restart VS Code if the issue persists
```

**Root Causes:**
- GitHub Copilot authentication interference
- Network connectivity issues
- Extension initialization problems

**Prevention:**
- Ensure GitHub Copilot is properly authenticated before using Docu
- Avoid running multiple AI extensions simultaneously during initial setup
- Keep VS Code and extensions updated

#### 2. GitHub Copilot Authentication Issues

**Issue: Docu causes GitHub Copilot to prompt for re-authentication**

**Symptoms:**
- GitHub Copilot stops working after using Docu
- Authentication prompts appear unexpectedly
- Both extensions show authentication errors

**Solutions:**
1. **Restart VS Code** - This often resolves authentication conflicts
2. **Re-authenticate GitHub Copilot:**
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run "GitHub Copilot: Sign Out"
   - Run "GitHub Copilot: Sign In"
3. **Check extension compatibility:**
   - Ensure both extensions are updated to latest versions
   - Disable other AI extensions temporarily

**Prevention:**
- Authenticate GitHub Copilot before installing Docu
- Avoid rapid switching between AI features
- Use one AI extension at a time when possible

#### 3. Template and Command Issues

**Issue: Template variable errors when creating documents**

**Error Message:**
```
❌ Error creating document: Missing required variables
```

**Solutions:**
```bash
# Use basic template instead
@docu /new "Document Title" --template basic

# Check template requirements
@docu /templates show prd

# Use placeholders if supported
@docu /new "Document Title" --template prd --with-placeholders
```

**Issue: Commands not recognized or not working**

**Symptoms:**
- Commands return "not implemented" messages
- Unexpected error responses
- Features described in tutorial don't work

**Solutions:**
1. **Check available commands:**
   ```bash
   @docu /help
   ```
2. **Use `/chat` command instead:**
   - Instead of `/review --file document.md`
   - Use: `@docu /chat Please review my document at document.md`
3. **Verify agent capabilities:**
   ```bash
   @docu /agent list
   @docu /agent current
   ```

#### 4. Agent and Conversation Issues

**Issue: Agents not responding or providing generic responses**

**Symptoms:**
- Agents give the same response regardless of input
- No personalized or contextual responses
- Conversations don't progress naturally

**Solutions:**
1. **Check online status:**
   - Verify GitHub Copilot is working in other contexts
   - Try switching agents: `@docu /agent set prd-creator`
2. **Restart conversation:**
   - Switch to a different agent and back
   - Restart VS Code if needed
3. **Use specific prompts:**
   - Be detailed in your requests
   - Provide context about your project
   - Ask specific questions rather than general ones

**Issue: Agent switching doesn't work**

**Error Message:**
```
❌ Failed to switch to agent: [agent-name]
```

**Solutions:**
```bash
# Check available agents
@docu /agent list

# Verify correct agent name
@docu /agent set prd-creator
@docu /agent set requirements-gatherer
@docu /agent set solution-architect
```

#### 5. File and Workspace Issues

**Issue: Documents not created in expected locations**

**Symptoms:**
- Files created in wrong directories
- Path errors when specifying locations
- Permission denied errors

**Solutions:**
1. **Ensure workspace is open:**
   - Open a folder in VS Code before using Docu
   - Use File → Open Folder to select project directory
2. **Use relative paths:**
   ```bash
   @docu /new "Document" --path docs/
   @docu /new "Document" --path ./docs/requirements/
   ```
3. **Check workspace permissions:**
   - Ensure you have write permissions to the workspace
   - Avoid system directories or protected folders

#### 6. Performance and Responsiveness Issues

**Issue: Slow responses or timeouts**

**Symptoms:**
- Long delays before agent responses
- Timeout errors
- VS Code becomes unresponsive

**Solutions:**
1. **Check network connection:**
   - Ensure stable internet connectivity
   - Test GitHub Copilot in other contexts
2. **Reduce complexity:**
   - Break large requests into smaller parts
   - Focus on one section at a time
3. **Restart if needed:**
   - Reload VS Code window: `Ctrl+Shift+P` → "Developer: Reload Window"
   - Close and reopen VS Code completely

### Debugging Steps

#### Step 1: Basic Diagnostics
```bash
# Check system status
@docu /help
@docu /agent list
@docu /templates list

# Verify workspace
# Ensure a folder is open in VS Code
```

#### Step 2: Test Core Functionality
```bash
# Test document creation
@docu /new "Test Document" --template basic

# Test agent switching
@docu /agent set prd-creator
@docu /agent current
```

#### Step 3: Check GitHub Copilot Integration
1. Test GitHub Copilot independently:
   - Open a code file
   - Try getting code suggestions
   - Verify Copilot chat works
2. If Copilot has issues, resolve those first before using Docu

#### Step 4: Advanced Troubleshooting
1. **Check VS Code logs:**
   - Open Command Palette (`Ctrl+Shift+P`)
   - Run "Developer: Toggle Developer Tools"
   - Check Console for errors
2. **Extension conflicts:**
   - Disable other AI extensions temporarily
   - Test Docu functionality
   - Re-enable extensions one by one

### Getting Help

#### When to Seek Support
- Persistent authentication issues
- Consistent offline mode problems
- Features that should work but don't
- Error messages not covered in this guide

#### Information to Provide
When reporting issues, include:
- VS Code version
- Docu extension version
- GitHub Copilot status
- Exact error messages
- Steps to reproduce the issue
- Operating system details

#### Workarounds
While waiting for fixes:
- Use basic templates instead of complex ones
- Rely on conversational interactions rather than specific commands
- Work with one agent at a time
- Create documents manually and use agents for content development

---

# 🚀 **Fast Commands-Only Tutorial**

For experienced users who want just the commands without explanations:

## Setup & Verification
```bash
@docu /help
@docu /agent list
@docu /templates list
```

## Phase 1: PRD Creation
```bash
@docu /agent set prd-creator
@docu /new "CardCraft Online Store PRD" --template basic --path docs/01-prd/
@docu /chat Help me develop a comprehensive PRD for CardCraft, an online card game shop with competitive pricing, authentic products, and community features.
@docu /chat CardCraft will differentiate by offering AI-powered deck building, virtual card condition verification, community features, subscription boxes, and trade-in programs. We'll start nationally in the US.
```

## Phase 2: Ideation & Features
```bash
@docu /agent set brainstormer
@docu /chat Based on the CardCraft PRD, what innovative features could we add to make our card game shop stand out from competitors?
@docu /chat I love the AI-powered features and AR scanner idea. How could we implement a comprehensive AI recommendation system for both new and experienced players?
```

## Phase 3: Requirements Gathering
```bash
@docu /agent set requirements-gatherer
@docu /new "CardCraft Requirements Specification" --template basic --path docs/02-requirements/
@docu /chat Based on our CardCraft PRD and brainstorming session, help me create comprehensive requirements for core e-commerce functionality, user management, and AI recommendation features.
@docu /chat Yes, let's continue with product catalog requirements. I want to ensure we cover product search, filtering, and inventory management.
```

## Phase 4: Solution Architecture
```bash
@docu /agent set solution-architect
@docu /new "CardCraft System Architecture" --template basic --path docs/03-architecture/
@docu /chat Help me design the system architecture for CardCraft. We need to support high traffic during product releases, real-time inventory management, AI recommendations, and mobile apps. What architecture patterns and technologies would you recommend?
```

## Phase 5: Implementation Planning
```bash
@docu /agent set specification-writer
@docu /new "CardCraft Implementation Plan" --template basic --path docs/04-implementation/
@docu /chat Based on our CardCraft architecture, help me create a detailed implementation plan with specific development tasks, priorities, and estimated timelines. We have a team of 6 developers and want to launch an MVP in 4 months.
```

## Phase 6: Quality Review
```bash
@docu /agent set quality-reviewer
@docu /chat Please review my CardCraft PRD document at docs/01-prd/cardcraft-online-store-prd.md and provide feedback on completeness, clarity, and professional quality.
@docu /review --file "docs/02-requirements/cardcraft-requirements-specification.md" --level strict
```

## Phase 7: Documentation Organization
```bash
@docu /chat Please help me create a comprehensive index of all the CardCraft documentation we've created, including the PRD, requirements, architecture, and implementation plan.
@docu /catalog --glob "docs/**/*.md" --output project-index.md
@docu /summarize --glob "docs/**/*.md" --output project-summary.md
```

## Utility Commands
```bash
# Update document sections
@docu /update --file "docs/requirements.md" --section "Performance Requirements" --mode append "New requirements here"

# Template management
@docu /templates show basic
@docu /templates list --verbose

# Agent management
@docu /agent current
@docu /agent list
```

---

**Congratulations!** You've successfully completed the comprehensive CardCraft tutorial and learned how to use all Docu agents to create professional documentation from concept to implementation. This systematic approach will help you create better documentation for any project.

**Happy documenting with Docu!** 🚀