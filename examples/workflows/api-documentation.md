# API Documentation Workflow

This example demonstrates how to create comprehensive API documentation using Docu's specialized agents.

## Scenario

We're documenting a **Task Management API** with full CRUD operations, authentication, and real-time updates.

## Prerequisites

- Docu extension installed and configured
- GitHub Copilot active
- Existing API implementation or specification

## Phase 1: API Overview and Planning

### Step 1: Set PRD Creator Agent

```bash
@docu /agent set prd-creator
```

### Step 2: Create API PRD

```bash
@docu /new "Task Management API PRD" --template prd
```

**Sample PRD Content:**
- API purpose and business objectives
- Target developers and use cases
- Integration requirements
- Success metrics

## Phase 2: API Requirements

### Step 3: Switch to Requirements Gatherer

```bash
@docu /agent set requirements-gatherer
```

### Step 4: Create API Requirements

```bash
@docu /new "Task Management API Requirements" --template requirements
```

**Key Requirements Sections:**
- Functional requirements for each endpoint
- Authentication and authorization requirements
- Data validation requirements
- Error handling requirements
- Performance requirements

**Example User Story:**
```
**User Story:** As a client application, I want to create a new task via API, so that users can add tasks to their task list.

#### Acceptance Criteria
1. WHEN a POST request is sent to /api/tasks with valid task data THEN the system SHALL create a new task and return 201 status
2. WHEN task data is invalid THEN the system SHALL return 400 status with validation errors
3. WHEN authentication is missing THEN the system SHALL return 401 status
4. WHEN task is created THEN the system SHALL return the complete task object with generated ID
```

## Phase 3: API Design and Architecture

### Step 5: Switch to Solution Architect

```bash
@docu /agent set solution-architect
```

### Step 6: Create API Architecture Document

```bash
@docu /new "Task Management API Architecture" --template basic
```

**Architecture Sections:**
- API design principles (RESTful, GraphQL, etc.)
- Authentication strategy (JWT, OAuth, API keys)
- Data models and relationships
- Error handling patterns
- Rate limiting and security measures

## Phase 4: Detailed API Specification

### Step 7: Switch to Specification Writer

```bash
@docu /agent set specification-writer
```

### Step 8: Create API Specification

```bash
@docu /new "Task Management API Specification" --template basic
```

**Specification Content:**

### Authentication

```http
POST /api/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "securepassword"
}

Response:
{
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 3600,
  "user": {
    "id": "123",
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### Task Operations

#### Create Task

```http
POST /api/tasks
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Complete API documentation",
  "description": "Write comprehensive API docs using Docu",
  "priority": "high",
  "due_date": "2024-12-31T23:59:59Z",
  "tags": ["documentation", "api"]
}

Response (201 Created):
{
  "id": "task_123",
  "title": "Complete API documentation",
  "description": "Write comprehensive API docs using Docu",
  "priority": "high",
  "status": "pending",
  "due_date": "2024-12-31T23:59:59Z",
  "tags": ["documentation", "api"],
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-01-15T10:30:00Z",
  "user_id": "123"
}
```

#### Get Tasks

```http
GET /api/tasks?status=pending&limit=10&offset=0
Authorization: Bearer {token}

Response (200 OK):
{
  "tasks": [
    {
      "id": "task_123",
      "title": "Complete API documentation",
      "status": "pending",
      "priority": "high",
      "due_date": "2024-12-31T23:59:59Z",
      "created_at": "2024-01-15T10:30:00Z"
    }
  ],
  "pagination": {
    "total": 25,
    "limit": 10,
    "offset": 0,
    "has_more": true
  }
}
```

#### Update Task

```http
PUT /api/tasks/{task_id}
Authorization: Bearer {token}
Content-Type: application/json

{
  "title": "Complete API documentation - Updated",
  "status": "in_progress",
  "priority": "medium"
}

Response (200 OK):
{
  "id": "task_123",
  "title": "Complete API documentation - Updated",
  "status": "in_progress",
  "priority": "medium",
  "updated_at": "2024-01-15T14:30:00Z"
}
```

#### Delete Task

```http
DELETE /api/tasks/{task_id}
Authorization: Bearer {token}

Response (204 No Content)
```

### Error Responses

```json
// 400 Bad Request
{
  "error": "validation_failed",
  "message": "Request validation failed",
  "details": [
    {
      "field": "title",
      "message": "Title is required"
    },
    {
      "field": "due_date",
      "message": "Due date must be in the future"
    }
  ]
}

// 401 Unauthorized
{
  "error": "unauthorized",
  "message": "Authentication required"
}

// 403 Forbidden
{
  "error": "forbidden",
  "message": "Insufficient permissions to access this resource"
}

// 404 Not Found
{
  "error": "not_found",
  "message": "Task not found"
}

// 429 Too Many Requests
{
  "error": "rate_limit_exceeded",
  "message": "Too many requests. Please try again later.",
  "retry_after": 60
}

// 500 Internal Server Error
{
  "error": "internal_error",
  "message": "An unexpected error occurred"
}
```

## Phase 5: Code Examples and SDKs

### Step 9: Create Integration Examples

```bash
@docu /new "Task API Integration Examples" --template basic
```

**JavaScript/Node.js Example:**

```javascript
// Task API Client
class TaskAPIClient {
  constructor(baseURL, token) {
    this.baseURL = baseURL;
    this.token = token;
  }

  async createTask(taskData) {
    const response = await fetch(`${this.baseURL}/api/tasks`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(taskData)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    return await response.json();
  }

  async getTasks(filters = {}) {
    const params = new URLSearchParams(filters);
    const response = await fetch(`${this.baseURL}/api/tasks?${params}`, {
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return await response.json();
  }

  async updateTask(taskId, updates) {
    const response = await fetch(`${this.baseURL}/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${this.token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(updates)
    });

    return await response.json();
  }

  async deleteTask(taskId) {
    const response = await fetch(`${this.baseURL}/api/tasks/${taskId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${this.token}`
      }
    });

    return response.ok;
  }
}

// Usage Example
const client = new TaskAPIClient('https://api.example.com', 'your-jwt-token');

// Create a new task
const newTask = await client.createTask({
  title: 'Review API documentation',
  description: 'Review the new API docs for accuracy',
  priority: 'high',
  due_date: '2024-12-31T23:59:59Z'
});

console.log('Created task:', newTask);

// Get all pending tasks
const pendingTasks = await client.getTasks({ status: 'pending' });
console.log('Pending tasks:', pendingTasks);
```

**Python Example:**

```python
import requests
from typing import Dict, List, Optional

class TaskAPIClient:
    def __init__(self, base_url: str, token: str):
        self.base_url = base_url
        self.token = token
        self.headers = {
            'Authorization': f'Bearer {token}',
            'Content-Type': 'application/json'
        }

    def create_task(self, task_data: Dict) -> Dict:
        response = requests.post(
            f'{self.base_url}/api/tasks',
            json=task_data,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def get_tasks(self, filters: Optional[Dict] = None) -> Dict:
        params = filters or {}
        response = requests.get(
            f'{self.base_url}/api/tasks',
            params=params,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def update_task(self, task_id: str, updates: Dict) -> Dict:
        response = requests.put(
            f'{self.base_url}/api/tasks/{task_id}',
            json=updates,
            headers=self.headers
        )
        response.raise_for_status()
        return response.json()

    def delete_task(self, task_id: str) -> bool:
        response = requests.delete(
            f'{self.base_url}/api/tasks/{task_id}',
            headers=self.headers
        )
        return response.status_code == 204

# Usage Example
client = TaskAPIClient('https://api.example.com', 'your-jwt-token')

# Create a new task
new_task = client.create_task({
    'title': 'Review API documentation',
    'description': 'Review the new API docs for accuracy',
    'priority': 'high',
    'due_date': '2024-12-31T23:59:59Z'
})

print(f'Created task: {new_task}')
```

## Phase 6: Testing Documentation

### Step 10: Create API Testing Guide

```bash
@docu /new "Task API Testing Guide" --template basic
```

**Testing Sections:**
- Unit testing examples
- Integration testing scenarios
- Postman collection
- Automated testing with curl

**Postman Collection Example:**

```json
{
  "info": {
    "name": "Task Management API",
    "description": "Complete API testing collection"
  },
  "auth": {
    "type": "bearer",
    "bearer": [
      {
        "key": "token",
        "value": "{{auth_token}}",
        "type": "string"
      }
    ]
  },
  "item": [
    {
      "name": "Authentication",
      "item": [
        {
          "name": "Login",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"email\": \"test@example.com\",\n  \"password\": \"password123\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/api/auth/login",
              "host": ["{{base_url}}"],
              "path": ["api", "auth", "login"]
            }
          }
        }
      ]
    },
    {
      "name": "Tasks",
      "item": [
        {
          "name": "Create Task",
          "request": {
            "method": "POST",
            "header": [
              {
                "key": "Content-Type",
                "value": "application/json"
              }
            ],
            "body": {
              "mode": "raw",
              "raw": "{\n  \"title\": \"Test Task\",\n  \"description\": \"This is a test task\",\n  \"priority\": \"medium\"\n}"
            },
            "url": {
              "raw": "{{base_url}}/api/tasks",
              "host": ["{{base_url}}"],
              "path": ["api", "tasks"]
            }
          }
        }
      ]
    }
  ]
}
```

## Phase 7: Quality Review and Finalization

### Step 11: Review All Documentation

```bash
@docu /agent set quality-reviewer

# Review each document
@docu /review --file "task-management-api-prd.md" --level normal
@docu /review --file "task-management-api-requirements.md" --level strict
@docu /review --file "task-management-api-architecture.md" --level normal
@docu /review --file "task-management-api-specification.md" --level strict
@docu /review --file "task-api-integration-examples.md" --level normal
@docu /review --file "task-api-testing-guide.md" --level normal
```

### Step 12: Create API Documentation Index

```bash
@docu /new "Task Management API Documentation Index" --template basic
```

**Documentation Index:**

```markdown
# Task Management API Documentation

## Overview
Complete documentation for the Task Management API, including specifications, examples, and testing guides.

## Documentation Structure

### 1. Planning Documents
- [API PRD](task-management-api-prd.md) - Product requirements and business objectives
- [API Requirements](task-management-api-requirements.md) - Detailed functional requirements

### 2. Technical Documentation
- [API Architecture](task-management-api-architecture.md) - System design and architecture
- [API Specification](task-management-api-specification.md) - Complete endpoint documentation

### 3. Integration Resources
- [Integration Examples](task-api-integration-examples.md) - Code examples and SDKs
- [Testing Guide](task-api-testing-guide.md) - Testing scenarios and tools

### 4. Reference Materials
- [Error Codes Reference](api-error-codes.md) - Complete error code documentation
- [Rate Limiting Guide](api-rate-limiting.md) - Rate limiting policies and best practices
- [Changelog](api-changelog.md) - Version history and breaking changes

## Quick Start

1. **Authentication**: Start with the [authentication section](task-management-api-specification.md#authentication)
2. **Basic Operations**: Try the [task CRUD operations](task-management-api-specification.md#task-operations)
3. **Integration**: Use the [code examples](task-api-integration-examples.md) for your language
4. **Testing**: Import the [Postman collection](task-api-testing-guide.md#postman-collection)

## Support

- **Issues**: Report API issues on [GitHub Issues](https://github.com/example/task-api/issues)
- **Questions**: Ask questions on [Stack Overflow](https://stackoverflow.com/questions/tagged/task-api)
- **Updates**: Follow [@TaskAPI](https://twitter.com/taskapi) for announcements
```

## Workflow Summary

### Documents Created
1. **API PRD** - Business objectives and requirements
2. **API Requirements** - Detailed functional specifications
3. **API Architecture** - Technical design and patterns
4. **API Specification** - Complete endpoint documentation
5. **Integration Examples** - Code samples and SDKs
6. **Testing Guide** - Testing scenarios and tools
7. **Documentation Index** - Navigation and overview

### Key Benefits
- **Comprehensive Coverage** - All aspects of API documentation
- **Developer-Friendly** - Practical examples and code samples
- **Maintainable** - Structured approach for easy updates
- **Quality Assured** - Built-in review and validation

## Best Practices for API Documentation

1. **Start with Requirements** - Understand the business needs first
2. **Design Before Implementation** - Plan the API structure carefully
3. **Provide Examples** - Include working code samples
4. **Test Everything** - Verify all examples and endpoints
5. **Keep It Current** - Update documentation with API changes
6. **Make It Searchable** - Use clear headings and structure
7. **Include Error Handling** - Document all error scenarios

---

**This workflow demonstrates how Docu can help create comprehensive, professional API documentation that serves both internal teams and external developers.**
</content>
</invoke>