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

If you see responses to these commands, you're ready to proceed!

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

First, let's create the directory structure for our project:

```bash
# Create the main docs directory and subdirectories
mkdir -p docs/01-prd docs/02-requirements docs/03-architecture docs/04-implementation
```

Alternatively, you can create directories one at a time as needed, or let Docu create them automatically by omitting the path parameter.

### Step 2: Create the PRD Document

```bash
@docu /new "CardCraft Online Store PRD" --template prd --path docs/01-prd/
```

**What Happens:**
- Creates `docs/01-prd/cardcraft-online-store-prd.md`
- Automatically creates the directory structure if it doesn't exist
- Opens the document in VS Code
- Applies PRD template structure
- Shows clickable file link in chat

**If Template Variables Are Missing:**
If you see an error about missing required variables, Docu will provide helpful suggestions:
- Use the basic template instead: `--template basic`
- Check what variables are needed: `/templates show prd`
- The error message will show exactly which variables are missing and how to fix it

### Step 4: Engage with PRD Creator Agent

Now interact with the agent to develop your product concept:

**Your Input:**
```
I want to create an online card game shop called CardCraft. It should sell trading cards like Pokemon and Magic: The Gathering, board games, and gaming accessories. The target audience is card game enthusiasts aged 13-35.
```

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
CardCraft will differentiate by offering:
1. AI-powered deck building recommendations
2. Virtual card condition verification using photos
3. Community features like deck sharing and tournaments
4. Subscription boxes with personalized card selections
5. Trade-in program for unwanted cards

We'll start nationally in the US, focusing on competitive players and collectors.
```

### Step 5: Complete PRD Sections

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

### Step 6: Switch to Brainstormer Agent

```bash
@docu /agent set brainstormer
```

**Expected Response:**
```
✅ Switched to Brainstormer agent
💡 I'm here to help explore creative possibilities and expand on your concepts.
Let's think outside the box and discover innovative features for CardCraft!
```

### Step 7: Brainstorm Innovative Features

**Your Input:**
```
Based on the CardCraft PRD, what innovative features could we add to make our card game shop stand out from competitors?
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
I love the AI-powered features and the AR card scanner idea. How could we implement a comprehensive AI recommendation system that helps both new and experienced players?
```

Continue this creative exploration to generate innovative feature ideas.

## Phase 3: Requirements Gathering

### Step 8: Switch to Requirements Gatherer Agent

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
@docu /new "CardCraft Requirements Specification" --template requirements --path docs/02-requirements/
```

**What Happens:**
- Creates `docs/02-requirements/cardcraft-requirements-specification.md`
- Automatically creates the directory structure
- Applies requirements template structure
- Opens the document in VS Code

**Note:** If the template has required variables, Docu will show you exactly what's needed and suggest alternatives like using the basic template.

### Step 9: Define User Stories and Acceptance Criteria

**Your Input:**
```
Based on our CardCraft PRD and brainstorming session, help me create comprehensive requirements for the core e-commerce functionality, user management, and AI recommendation features.
```

**Agent Response (Example):**
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

**Alternative if directory doesn't exist:**
```bash
@docu /new "CardCraft System Architecture" --template basic
```

### Step 14: Design Technical Solution

**Your Input:**
```
Help me design the system architecture for CardCraft. We need to support high traffic during product releases, real-time inventory management, AI recommendations, and mobile apps. What architecture patterns and technologies would you recommend?
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

**Alternative if directory doesn't exist:**
```bash
@docu /new "CardCraft Implementation Plan" --template basic
```

### Step 17: Break Down Implementation Tasks

**Your Input:**
```
Based on our CardCraft architecture, help me create a detailed implementation plan with specific development tasks, priorities, and estimated timelines. We have a team of 6 developers and want to launch an MVP in 4 months.
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

Review each document systematically:

```bash
# Review PRD with normal level
@docu /review --file "docs/01-prd/cardcraft-online-store-prd.md" --level normal

# Review Requirements with strict level
@docu /review --file "docs/02-requirements/cardcraft-requirements-specification.md" --level strict

# Review Architecture with normal level
@docu /review --file "docs/03-architecture/cardcraft-system-architecture.md" --level normal

# Review Implementation Plan with strict level and auto-fix
@docu /review --file "docs/04-implementation/cardcraft-implementation-plan.md" --level strict --fix
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

```bash
@docu /catalog --pattern "docs/**/*.md" --output "CardCraft-Documentation-Index.md"
```

### Step 24: Create Project Summary

```bash
@docu /summarize --pattern "docs/**/*.md" --output "CardCraft-Project-Summary.md"
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
@docu /update --file "path/to/file.md" --section "Section Name" --mode append "Content"
@docu /review --file "path/to/file.md" --level strict --fix
@docu /catalog --pattern "docs/**/*.md" --output "index.md"
@docu /summarize --pattern "docs/**/*.md" --output "summary.md"
```

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

---

**Congratulations!** You've successfully completed the comprehensive CardCraft tutorial and learned how to use all Docu agents to create professional documentation from concept to implementation. This systematic approach will help you create better documentation for any project.

**Happy documenting with Docu!** 🚀