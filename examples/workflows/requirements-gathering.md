# Requirements Gathering Workflow

This example demonstrates systematic requirements gathering using Docu's Requirements Gatherer agent and EARS (Easy Approach to Requirements Syntax) format.

## Scenario

We're gathering requirements for an **E-commerce Checkout System** that needs to handle payments, inventory, and order processing.

## Prerequisites

- Docu extension installed and configured
- GitHub Copilot active
- Basic understanding of the business domain

## Phase 1: Initial Requirements Discovery

### Step 1: Set Requirements Gatherer Agent

```bash
@docu /agent set requirements-gatherer
```

### Step 2: Create Requirements Document

```bash
@docu /new "E-commerce Checkout Requirements" --template requirements
```

### Step 3: Start Requirements Conversation

**Initial Prompt:**
```
User: "I need to gather requirements for an e-commerce checkout system that handles payments, inventory management, and order processing."

Agent: "Excellent! Let's systematically gather requirements for your e-commerce checkout system. I'll help you create comprehensive requirements using the EARS format.

Let's start with understanding the core user journeys:

1. **Primary Users**: Who will be using this checkout system?
   - End customers making purchases?
   - Customer service representatives?
   - System administrators?

2. **Core Scenarios**: What are the main checkout scenarios?
   - Standard product purchase?
   - Digital product downloads?
   - Subscription services?
   - Guest checkout vs registered users?

3. **Business Context**: What are the key business requirements?
   - Payment methods to support?
   - Geographic regions?
   - Integration requirements?

Can you provide more details about these aspects?"
```

## Phase 2: Functional Requirements

### Step 4: Define User Stories and Acceptance Criteria

**User Story 1: Guest Checkout**

```markdown
**User Story:** As a guest customer, I want to complete a purchase without creating an account, so that I can quickly buy products without additional steps.

#### Acceptance Criteria
1. WHEN a guest user adds items to cart THEN the system SHALL allow checkout without account creation
2. WHEN guest provides email address THEN the system SHALL validate email format before proceeding
3. WHEN guest completes purchase THEN the system SHALL send order confirmation to provided email
4. WHEN guest wants to track order THEN the system SHALL provide order tracking via email link
5. IF guest email already exists in system THEN the system SHALL offer account creation option
```

**User Story 2: Payment Processing**

```markdown
**User Story:** As a customer, I want to pay using my preferred payment method, so that I can complete my purchase conveniently.

#### Acceptance Criteria
1. WHEN customer reaches payment step THEN the system SHALL display available payment methods
2. WHEN customer selects credit card THEN the system SHALL validate card details in real-time
3. WHEN payment is processed THEN the system SHALL display confirmation within 5 seconds
4. IF payment fails THEN the system SHALL display specific error message and retry options
5. WHEN payment succeeds THEN the system SHALL immediately reserve inventory
6. WHEN using saved payment method THEN the system SHALL require CVV verification
```

**User Story 3: Inventory Management**

```markdown
**User Story:** As a customer, I want to be notified if items become unavailable during checkout, so that I can adjust my order accordingly.

#### Acceptance Criteria
1. WHEN customer adds item to cart THEN the system SHALL check real-time inventory availability
2. WHEN item becomes unavailable during checkout THEN the system SHALL notify customer immediately
3. WHEN customer proceeds to payment THEN the system SHALL reserve inventory for 10 minutes
4. IF inventory reservation expires THEN the system SHALL release items and notify customer
5. WHEN order is confirmed THEN the system SHALL permanently allocate inventory
```

### Step 5: Continue with Additional User Stories

**User Story 4: Order Processing**

```markdown
**User Story:** As a customer, I want to receive immediate confirmation of my order, so that I know my purchase was successful.

#### Acceptance Criteria
1. WHEN payment is confirmed THEN the system SHALL generate unique order number
2. WHEN order is created THEN the system SHALL send confirmation email within 1 minute
3. WHEN order confirmation is sent THEN the system SHALL include order details and tracking information
4. WHEN order is processed THEN the system SHALL update order status in real-time
5. IF order processing fails THEN the system SHALL notify customer and initiate refund
```

**User Story 5: Tax and Shipping Calculation**

```markdown
**User Story:** As a customer, I want to see accurate tax and shipping costs before completing my purchase, so that I know the total amount I'll be charged.

#### Acceptance Criteria
1. WHEN customer enters shipping address THEN the system SHALL calculate applicable taxes
2. WHEN shipping method is selected THEN the system SHALL display shipping cost immediately
3. WHEN order total changes THEN the system SHALL recalculate taxes and shipping automatically
4. WHEN customer changes address THEN the system SHALL update tax calculation within 2 seconds
5. IF tax service is unavailable THEN the system SHALL use fallback tax rates
```

## Phase 3: Non-Functional Requirements

### Step 6: Performance Requirements

```markdown
### Performance Requirements

**User Story:** As a customer, I want the checkout process to be fast and responsive, so that I can complete my purchase quickly.

#### Acceptance Criteria
1. WHEN customer loads checkout page THEN the system SHALL display page within 2 seconds
2. WHEN customer submits payment THEN the system SHALL process payment within 5 seconds
3. WHEN system experiences high load THEN the system SHALL maintain response times under 10 seconds
4. WHEN concurrent users exceed 1000 THEN the system SHALL scale automatically
5. IF response time exceeds 10 seconds THEN the system SHALL display progress indicator
```

### Step 7: Security Requirements

```markdown
### Security Requirements

**User Story:** As a customer, I want my payment information to be secure, so that I can trust the checkout process with my sensitive data.

#### Acceptance Criteria
1. WHEN customer enters payment details THEN the system SHALL encrypt data using TLS 1.3
2. WHEN payment data is stored THEN the system SHALL comply with PCI DSS standards
3. WHEN customer session is idle for 15 minutes THEN the system SHALL require re-authentication
4. WHEN suspicious activity is detected THEN the system SHALL trigger fraud prevention measures
5. IF security breach is detected THEN the system SHALL immediately lock affected accounts
```

### Step 8: Availability Requirements

```markdown
### Availability Requirements

**User Story:** As a business owner, I want the checkout system to be available 24/7, so that customers can make purchases at any time.

#### Acceptance Criteria
1. WHEN system is operational THEN the system SHALL maintain 99.9% uptime
2. WHEN planned maintenance occurs THEN the system SHALL provide 24-hour advance notice
3. WHEN system failure occurs THEN the system SHALL recover within 5 minutes
4. WHEN backup systems activate THEN the system SHALL maintain full functionality
5. IF primary payment processor fails THEN the system SHALL failover to backup processor
```

## Phase 4: Integration Requirements

### Step 9: External System Integration

```markdown
### Payment Gateway Integration

**User Story:** As a system administrator, I want the checkout system to integrate with multiple payment gateways, so that we can provide redundancy and competitive rates.

#### Acceptance Criteria
1. WHEN payment is processed THEN the system SHALL support Stripe, PayPal, and Square
2. WHEN primary gateway fails THEN the system SHALL automatically failover to backup
3. WHEN gateway response is received THEN the system SHALL log transaction details
4. WHEN refund is requested THEN the system SHALL process through original payment method
5. IF gateway is down THEN the system SHALL queue transactions for retry
```

### Step 10: Inventory System Integration

```markdown
### Inventory Management Integration

**User Story:** As an inventory manager, I want the checkout system to sync with our inventory management system, so that stock levels are always accurate.

#### Acceptance Criteria
1. WHEN item is added to cart THEN the system SHALL check inventory via API call
2. WHEN order is confirmed THEN the system SHALL update inventory immediately
3. WHEN inventory sync fails THEN the system SHALL retry every 30 seconds for 5 minutes
4. WHEN stock level is low THEN the system SHALL notify inventory management system
5. IF inventory API is unavailable THEN the system SHALL use cached inventory data
```

## Phase 5: Error Handling Requirements

### Step 11: Error Scenarios

```markdown
### Error Handling Requirements

**User Story:** As a customer, I want clear error messages when something goes wrong, so that I know how to resolve the issue.

#### Acceptance Criteria
1. WHEN validation error occurs THEN the system SHALL display specific field-level error messages
2. WHEN payment fails THEN the system SHALL provide actionable error message and retry options
3. WHEN system error occurs THEN the system SHALL log error details for debugging
4. WHEN timeout occurs THEN the system SHALL allow customer to retry operation
5. IF critical error occurs THEN the system SHALL gracefully degrade to basic functionality
```

### Step 12: Data Validation Requirements

```markdown
### Data Validation Requirements

**User Story:** As a system administrator, I want all customer input to be validated, so that we maintain data quality and security.

#### Acceptance Criteria
1. WHEN customer enters email THEN the system SHALL validate email format and domain
2. WHEN customer enters phone number THEN the system SHALL validate format for selected country
3. WHEN customer enters address THEN the system SHALL validate against postal service API
4. WHEN customer enters payment details THEN the system SHALL validate card number format
5. IF validation fails THEN the system SHALL prevent form submission and highlight errors
```

## Phase 6: Compliance Requirements

### Step 13: Regulatory Compliance

```markdown
### GDPR Compliance Requirements

**User Story:** As a data protection officer, I want the checkout system to comply with GDPR, so that we meet regulatory requirements.

#### Acceptance Criteria
1. WHEN customer data is collected THEN the system SHALL obtain explicit consent
2. WHEN customer requests data deletion THEN the system SHALL remove all personal data within 30 days
3. WHEN customer requests data export THEN the system SHALL provide data in machine-readable format
4. WHEN data breach occurs THEN the system SHALL notify authorities within 72 hours
5. IF customer withdraws consent THEN the system SHALL stop processing their data immediately
```

### Step 14: Accessibility Requirements

```markdown
### Accessibility Requirements

**User Story:** As a customer with disabilities, I want the checkout process to be accessible, so that I can complete purchases independently.

#### Acceptance Criteria
1. WHEN using screen reader THEN the system SHALL provide proper ARIA labels for all form fields
2. WHEN navigating with keyboard THEN the system SHALL support tab navigation through all elements
3. WHEN viewing with high contrast THEN the system SHALL maintain readability
4. WHEN using voice commands THEN the system SHALL support voice navigation
5. IF accessibility features are needed THEN the system SHALL comply with WCAG 2.1 AA standards
```

## Phase 7: Requirements Review and Validation

### Step 15: Switch to Quality Reviewer

```bash
@docu /agent set quality-reviewer
```

### Step 16: Review Requirements Document

```bash
@docu /review --file "e-commerce-checkout-requirements.md" --level strict
```

**Sample Review Output:**

```
## Review Results: E-commerce Checkout Requirements

✅ **Document is valid!**

**Summary:**
- Requirements: 45
- User Stories: 12
- Acceptance Criteria: 67
- Coverage Score: 92%

**Strengths:**
✅ Comprehensive EARS format usage
✅ Clear traceability between user stories and acceptance criteria
✅ Good coverage of functional and non-functional requirements
✅ Proper error handling scenarios included

**Recommendations:**
💡 Consider adding requirements for:
   - Multi-language support
   - Mobile-specific checkout flows
   - A/B testing capabilities
   - Analytics and reporting requirements

**Potential Gaps:**
⚠️ Missing requirements for:
   - Abandoned cart recovery
   - Promotional codes and discounts
   - Gift card processing
   - Return and refund workflows
```

### Step 17: Address Review Feedback

```bash
# Add missing requirements based on review
@docu /update --file "e-commerce-checkout-requirements.md" --section "Additional Requirements" --mode append "

### Promotional Code Requirements

**User Story:** As a customer, I want to apply promotional codes during checkout, so that I can receive discounts on my purchase.

#### Acceptance Criteria
1. WHEN customer enters promo code THEN the system SHALL validate code in real-time
2. WHEN valid promo code is applied THEN the system SHALL update order total immediately
3. WHEN promo code has restrictions THEN the system SHALL validate eligibility before applying
4. IF promo code is expired THEN the system SHALL display appropriate error message
5. WHEN multiple promos are applicable THEN the system SHALL apply the best discount for customer

### Abandoned Cart Recovery Requirements

**User Story:** As a marketing manager, I want to track abandoned carts, so that we can follow up with customers to complete their purchases.

#### Acceptance Criteria
1. WHEN customer adds items to cart THEN the system SHALL track cart session
2. WHEN customer leaves without purchasing THEN the system SHALL mark cart as abandoned after 30 minutes
3. WHEN cart is abandoned THEN the system SHALL trigger email sequence after 1 hour
4. WHEN customer returns via email link THEN the system SHALL restore their cart contents
5. IF cart items are no longer available THEN the system SHALL notify customer of changes
"
```

## Phase 8: Requirements Traceability

### Step 18: Create Requirements Traceability Matrix

```bash
@docu /new "E-commerce Checkout Traceability Matrix" --template basic
```

**Traceability Matrix:**

```markdown
# Requirements Traceability Matrix

## Business Objectives to Requirements Mapping

| Business Objective | Requirements | Priority | Status |
|-------------------|--------------|----------|---------|
| Increase conversion rate | REQ-001, REQ-002, REQ-005 | High | Draft |
| Reduce cart abandonment | REQ-003, REQ-015, REQ-016 | High | Draft |
| Ensure payment security | REQ-007, REQ-008, REQ-009 | Critical | Draft |
| Support multiple payment methods | REQ-004, REQ-010 | Medium | Draft |
| Maintain system availability | REQ-011, REQ-012 | High | Draft |

## Requirements to Test Cases Mapping

| Requirement ID | Test Cases | Verification Method |
|---------------|------------|-------------------|
| REQ-001 | TC-001, TC-002, TC-003 | Automated Testing |
| REQ-002 | TC-004, TC-005 | Manual Testing |
| REQ-003 | TC-006, TC-007, TC-008 | Integration Testing |
| REQ-004 | TC-009, TC-010 | End-to-End Testing |

## Requirements Dependencies

| Requirement | Depends On | Impact |
|-------------|------------|---------|
| REQ-004 (Payment Processing) | REQ-007 (Security) | High |
| REQ-003 (Inventory) | REQ-012 (External APIs) | Medium |
| REQ-015 (Abandoned Cart) | REQ-001 (Guest Checkout) | Low |
```

## Workflow Summary

### Requirements Categories Covered

1. **Functional Requirements**
   - User checkout flows
   - Payment processing
   - Inventory management
   - Order processing

2. **Non-Functional Requirements**
   - Performance requirements
   - Security requirements
   - Availability requirements
   - Scalability requirements

3. **Integration Requirements**
   - Payment gateway integration
   - Inventory system integration
   - External service dependencies

4. **Compliance Requirements**
   - GDPR compliance
   - PCI DSS compliance
   - Accessibility standards

5. **Error Handling Requirements**
   - Validation requirements
   - Error recovery scenarios
   - Graceful degradation

### Key Benefits of This Approach

1. **Systematic Coverage** - Ensures all aspects are considered
2. **EARS Format** - Provides clear, testable requirements
3. **Traceability** - Links requirements to business objectives
4. **Quality Assurance** - Built-in review and validation
5. **Stakeholder Alignment** - Clear communication of expectations

### Best Practices Applied

1. **User-Centric Approach** - All requirements written as user stories
2. **Specific and Measurable** - Quantifiable acceptance criteria
3. **Testable Requirements** - Each requirement can be verified
4. **Priority Classification** - Requirements prioritized by business value
5. **Risk Consideration** - Error scenarios and edge cases included

## Next Steps

### Requirements Validation
1. **Stakeholder Review** - Present requirements to business stakeholders
2. **Technical Review** - Validate feasibility with development team
3. **User Validation** - Confirm requirements meet user needs
4. **Compliance Review** - Ensure regulatory requirements are met

### Design Phase Preparation
1. **Requirements Baseline** - Lock approved requirements
2. **Design Constraints** - Identify technical constraints
3. **Architecture Planning** - Plan system architecture
4. **Implementation Planning** - Break down into development tasks

---

**This workflow demonstrates how Docu's Requirements Gatherer agent can help create comprehensive, well-structured requirements that serve as a solid foundation for system design and development.**
</content>