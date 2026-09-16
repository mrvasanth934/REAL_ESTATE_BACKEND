# User Management Module API

## Overview
Users module for managing tenant team members with role-based access control and tenant isolation.

---

## Data Model

```javascript
{
  _id: ObjectId,
  tenant_id: ObjectId,           // FK to Tenant (always scoped)
  name: String,                   // Full name
  username: String,               // Unique across all users
  email: String,                  // Unique across all users
  phone: String,                  // Mobile number
  password: String (hashed),      // Bcrypt hashed
  role: Enum,                     // agency_owner, manager, agent, accountant, viewer
  isActive: Boolean,              // Soft delete flag
  lastLoginAt: Date,              // Last login timestamp
  createdAt: Date,
  updatedAt: Date
}
```

### Role Definitions

| Role | Permissions | Notes |
|---|---|---|
| **agency_owner** | Create users, manage team, view all data, update settings | Tenant owner, cannot be deleted |
| **manager** | Create/edit users (agents/accountant), view reports | Team lead |
| **agent** | Create/update leads, bookings, site visits | Sales person |
| **accountant** | View payments, EMI, invoices, create payments | Finance role |
| **viewer** | Read-only access to all modules | Client/stakeholder |

---

## API Endpoints

### 1. List All Users (Tenant-Scoped)

```http
GET /api/users
```

**Authentication**: Required (Bearer token)
**Authorization**: All authenticated users
**Tenant Scoping**: Automatic (sees only own tenant's users)

**Response** (200 OK):
```json
{
  "success": true,
  "users": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "tenant_id": "507f1f77bcf86cd799439010",
      "name": "John Manager",
      "username": "johnmgr",
      "email": "john@agency.com",
      "phone": "9876543210",
      "role": "manager",
      "isActive": true,
      "lastLoginAt": "2026-06-29T10:30:00Z",
      "createdAt": "2026-06-29T08:00:00Z"
    }
  ]
}
```

**Error Responses**:
- 401: Unauthorized (no token)
- 500: Server error

---

### 2. Get Single User

```http
GET /api/users/:id
```

**Authentication**: Required
**Authorization**: All authenticated users (tenant-scoped)
**Tenant Scoping**: User must belong to same tenant

**Path Parameters**:
- `id`: User ID (MongoDB ObjectId)

**Response** (200 OK):
```json
{
  "success": true,
  "user": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "John Manager",
    "email": "john@agency.com",
    "role": "manager",
    "isActive": true
  }
}
```

**Error Responses**:
- 401: Unauthorized
- 404: User not found or access denied
- 500: Server error

---

### 3. Create New User

```http
POST /api/users
```

**Authentication**: Required
**Authorization**: agency_owner, manager only
**Tenant Scoping**: Automatic (user added to same tenant)

**Request Body**:
```json
{
  "name": "Rajesh Agent",
  "username": "rajeshagent",
  "email": "rajesh@agency.com",
  "phone": "9876543210",
  "password": "SecurePass@123",
  "role": "agent"
}
```

**Validation**:
- name: Required, string
- username: Required, unique across platform, alphanumeric + underscore
- email: Required, unique across platform, valid email format
- phone: Optional, 10 digits
- password: Required, minimum 6 characters
- role: Required, one of `[agency_owner, manager, agent, accountant, viewer]`

**Response** (201 Created):
```json
{
  "success": true,
  "message": "User created successfully.",
  "user": {
    "_id": "507f1f77bcf86cd799439012",
    "tenant_id": "507f1f77bcf86cd799439010",
    "name": "Rajesh Agent",
    "username": "rajeshagent",
    "email": "rajesh@agency.com",
    "phone": "9876543210",
    "role": "agent",
    "isActive": true,
    "createdAt": "2026-06-29T10:00:00Z"
  }
}
```

**Error Responses**:
- 400: Validation failed, username/email already taken
- 401: Unauthorized or insufficient role
- 403: Access denied (not agency_owner or manager)
- 500: Server error

---

### 4. Update User

```http
PATCH /api/users/:id
```

**Authentication**: Required
**Authorization**: agency_owner, manager only
**Tenant Scoping**: User must belong to same tenant

**Path Parameters**:
- `id`: User ID

**Request Body** (all optional):
```json
{
  "name": "Rajesh Sharma",
  "phone": "9876543211",
  "role": "manager",
  "isActive": false
}
```

**Allowed Fields**:
- name: String
- phone: String (10 digits)
- role: String (one of valid roles)
- isActive: Boolean

**Restrictions**:
- Cannot update: password, username, email, tenant_id
- Cannot change tenant_id
- Username and email are immutable after creation

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User updated successfully.",
  "user": {
    "_id": "507f1f77bcf86cd799439012",
    "name": "Rajesh Sharma",
    "phone": "9876543211",
    "role": "manager",
    "isActive": false
  }
}
```

**Error Responses**:
- 400: Invalid role value
- 401: Unauthorized
- 403: Insufficient permissions
- 404: User not found or access denied
- 500: Server error

---

### 5. Delete User (Deactivate)

```http
DELETE /api/users/:id
```

**Authentication**: Required
**Authorization**: agency_owner only
**Tenant Scoping**: User must belong to same tenant

**Implementation**: Soft delete (sets `isActive = false`)

**Response** (200 OK):
```json
{
  "success": true,
  "message": "User deactivated successfully."
}
```

**Error Responses**:
- 400: Cannot delete agency_owner
- 401: Unauthorized
- 403: Only agency_owner can delete users
- 404: User not found or access denied
- 500: Server error

---

### 6. Update Password

```http
PATCH /api/users/:id/password
```

**Authentication**: Required
**Authorization**: User can change own password; manager/agency_owner can change others
**Tenant Scoping**: User must belong to same tenant

**Request Body**:
```json
{
  "currentPassword": "OldPass@123",
  "newPassword": "NewPass@456"
}
```

**Validation**:
- currentPassword: Required, must match user's current password
- newPassword: Required, minimum 6 characters

**Response** (200 OK):
```json
{
  "success": true,
  "message": "Password updated successfully."
}
```

**Error Responses**:
- 400: Missing fields or new password too short
- 401: Current password incorrect or unauthorized
- 404: User not found or access denied
- 500: Server error

---

## Usage Examples

### Example 1: Agency Owner Creates Manager

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Priya Manager",
    "username": "priyamgr",
    "email": "priya@agency.com",
    "phone": "9876543210",
    "password": "SecurePass@123",
    "role": "manager"
  }'
```

### Example 2: Manager Creates Agent

```bash
curl -X POST http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Arjun Agent",
    "username": "arjunsales",
    "email": "arjun@agency.com",
    "phone": "9876543211",
    "password": "AgentPass@456",
    "role": "agent"
  }'
```

### Example 3: List All Team Members

```bash
curl -X GET http://localhost:5000/api/users \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Example 4: Update User Role

```bash
curl -X PATCH http://localhost:5000/api/users/507f1f77bcf86cd799439012 \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "role": "manager"
  }'
```

---

## Tenant Isolation Guarantees

✅ **All queries automatically filtered to `tenant_id`**
- User from Tenant A cannot see/modify Tenant B's users
- Super admin can see all users (across tenants)
- Each user's tenant_id is immutable after creation

✅ **No Cross-Tenant Access**
- Attempting to access another tenant's user → 404 Not Found
- Attempting to update another tenant's user → 403 Forbidden

---

## Access Control Matrix

| Action | Super Admin | Agency Owner | Manager | Agent | Accountant | Viewer |
|---|---|---|---|---|---|---|
| List users | ✅ All | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant |
| View user | ✅ All | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant | ✅ Own tenant |
| Create user | ❌ | ✅ | ✅ | ❌ | ❌ | ❌ |
| Update user | ✅ Any | ✅ Own tenant | ✅ Own tenant | ❌ | ❌ | ❌ |
| Delete user | ✅ Any | ✅ Own tenant | ❌ | ❌ | ❌ | ❌ |
| Change password | ✅ Any | ✅ Own/own tenant | ✅ Own/own tenant | ✅ Own only | ✅ Own only | ✅ Own only |

---

## Status Codes Reference

| Code | Meaning |
|---|---|
| 200 | Success (GET, PATCH) |
| 201 | Created (POST) |
| 400 | Bad request (validation error) |
| 401 | Unauthorized (no token / invalid token) |
| 403 | Forbidden (insufficient permissions) |
| 404 | Not found or access denied |
| 500 | Server error |

---

## Testing Multi-Tenant Isolation

```javascript
// Test: User A cannot access User B's data
const testTenantIsolation = async () => {
  // Setup: Create 2 tenants with users
  const tenant1User = await createUser(tenant1, "john", "john@t1.com");
  const tenant2User = await createUser(tenant2, "jane", "jane@t2.com");

  // Authenticate as tenant1User
  const token1 = await login("john", "pass");

  // Try to access tenant2User (should fail)
  const response = await fetch(`/api/users/${tenant2User._id}`, {
    headers: { Authorization: `Bearer ${token1}` }
  });

  // Assert: Should return 404 or access denied
  expect(response.status).toBe(404);
};
```

---

## Implementation Notes

- Passwords are never returned in API responses
- `lastLoginAt` updated by auth controller on successful login
- Soft delete pattern used (isActive flag) for audit trails
- Username and email are globally unique (prevent impersonation across tenants)
- All timestamps in ISO 8601 format
- All responses follow standard format: `{ success: boolean, data/message }`
