# Multi-Tenant Data Isolation Pattern
## Real Estate SaaS — Vyoobam Tech

**Foundation Layer**: Every future module MUST follow this pattern to ensure tenant data never leaks.

---

## Core Principles

1. **Tenant Scoping**: Every entity (property, lead, booking, lease, etc.) has a `tenant_id` field
2. **Request-Level Enforcement**: `tenantScope` middleware automatically injects `req.tenantId`
3. **Query Filtering**: All queries must include `{ tenant_id: req.tenantId }`
4. **Authorization Check**: Non-super-admin users only see/modify their own tenant data
5. **No Cross-Tenant Access**: Any attempt to access another tenant's data returns 403 Forbidden

---

## Database Schema Pattern

Every collection/table must include:

```javascript
// Example: properties collection
const propertySchema = new Schema({
  tenant_id: {
    type: ObjectId,
    ref: "Tenant",
    required: true,
    index: true, // CRITICAL: Index for fast tenant-scoped queries
  },
  property_id: { type: String, required: true },
  // ... other fields
  
  // Composite unique index (tenant_id + unique identifier within tenant)
  // Example: same property_id can exist for different tenants
});

// Compound index for efficient queries
propertySchema.index({ tenant_id: 1, property_id: 1 }, { unique: true });
```

---

## Controller Pattern (Example: Properties Module)

```javascript
// ✅ CORRECT: Tenant-scoped query
const getProperties = async (req, res) => {
  try {
    // req.tenantId is set by tenantScope middleware
    const properties = await Property.find({
      tenant_id: req.tenantId, // ← MANDATORY
    });
    return res.status(200).json({ success: true, properties });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ✅ CORRECT: Create with automatic tenant_id
const createProperty = async (req, res) => {
  try {
    const property = await Property.create({
      ...req.body,
      tenant_id: req.tenantId, // ← ALWAYS add automatically
    });
    return res.status(201).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ✅ CORRECT: Update with tenant verification
const updateProperty = async (req, res) => {
  try {
    // 1. Verify ownership (property belongs to this tenant)
    const property = await Property.findOne({
      _id: req.params.id,
      tenant_id: req.tenantId, // ← Tenant check
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or access denied.",
      });
    }

    // 2. Prevent tenant_id manipulation
    delete req.body.tenant_id;

    // 3. Update
    Object.assign(property, req.body);
    await property.save();

    return res.status(200).json({ success: true, property });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};

// ❌ WRONG: No tenant check (MAJOR SECURITY HOLE)
const getPropertyBad = async (req, res) => {
  const property = await Property.findById(req.params.id); // ← Missing tenant_id check!
  return res.status(200).json({ success: true, property });
};

// ❌ WRONG: Query runs without tenant filtering (data leak)
const getAllPropertiesBad = async (req, res) => {
  const properties = await Property.find({}); // ← Will return ALL tenants' data!
  return res.status(200).json({ success: true, properties });
};
```

---

## Route Protection Pattern

```javascript
// ✅ CORRECT
const router = express.Router();

// Apply protect → tenantScope middleware to ALL routes
router.use(protect);      // Authentication
router.use(tenantScope);  // Tenant isolation

// GET all properties (tenant-scoped by middleware)
router.get("/", getProperties);

// POST new property (tenant_id added automatically)
router.post("/", authorize("agency_owner", "manager"), createProperty);

// PATCH update (ownership verified)
router.patch("/:id", authorize("agency_owner", "manager"), updateProperty);

// DELETE (verify ownership + soft-delete pattern recommended)
router.delete(
  "/:id",
  authorize("agency_owner"),
  deleteProperty
);

module.exports = router;
```

---

## Authorization Middleware Usage

```javascript
const authorize = (...allowedRoles) => {
  return (req, res, next) => {
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        message: "Access denied. Insufficient permissions.",
      });
    }
    next();
  };
};

// Usage in routes:
// Only agency_owner and manager can create properties
router.post("/", authorize("agency_owner", "manager"), createProperty);

// Only agency_owner can delete
router.delete("/:id", authorize("agency_owner"), deleteProperty);

// Anyone (agent, viewer, etc.) can read
router.get("/:id", getProperty);
```

---

## Handling Relationships Across Modules

**Example**: Lead linked to Property linked to Tenant

```javascript
const createLead = async (req, res) => {
  try {
    const { property_id, ...leadData } = req.body;

    // 1. Verify property belongs to this tenant
    const property = await Property.findOne({
      _id: property_id,
      tenant_id: req.tenantId, // ← Verify ownership first
    });

    if (!property) {
      return res.status(404).json({
        success: false,
        message: "Property not found or access denied.",
      });
    }

    // 2. Create lead with tenant_id
    const lead = await Lead.create({
      ...leadData,
      property_id,
      tenant_id: req.tenantId, // ← Auto-scope to tenant
    });

    return res.status(201).json({ success: true, lead });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
```

---

## Filtering & Pagination Pattern

```javascript
// ✅ CORRECT: Tenant-scoped filters
const getLeads = async (req, res) => {
  try {
    const { status, agent_id, page = 1, limit = 20 } = req.query;

    const query = {
      tenant_id: req.tenantId, // ← BASE QUERY (ALWAYS)
    };

    // Add optional filters
    if (status) query.status = status;
    if (agent_id) {
      // Verify agent belongs to same tenant
      const agent = await User.findOne({
        _id: agent_id,
        tenant_id: req.tenantId,
      });
      if (!agent) {
        return res.status(403).json({
          success: false,
          message: "Agent not found or access denied.",
        });
      }
      query.agent_id = agent_id;
    }

    const skip = (page - 1) * limit;
    const leads = await Lead.find(query).skip(skip).limit(limit);
    const total = await Lead.countDocuments(query);

    return res.status(200).json({
      success: true,
      leads,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
```

---

## Super Admin Bypass (Rare Cases)

```javascript
// ✅ CORRECT: Super admin can see all, others see own tenant only
const getLeads = async (req, res) => {
  try {
    let query = {};

    // Super admin: no tenant restriction
    if (req.user.role !== "super_admin" && req.tenantId) {
      query.tenant_id = req.tenantId;
    }

    const leads = await Lead.find(query);
    return res.status(200).json({ success: true, leads });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Server error." });
  }
};
```

---

## Checklist for New Modules

When implementing a new module (properties, leads, bookings, etc.):

- [ ] Add `tenant_id: ObjectId` to schema with `index: true`
- [ ] Add `tenant_id: req.tenantId` in all CREATE operations
- [ ] Add `tenant_id: req.tenantId` check in all READ operations
- [ ] Add `tenant_id: req.tenantId` check in all UPDATE operations
- [ ] Add `tenant_id: req.tenantId` check in all DELETE operations
- [ ] Use `authorize(...)` middleware on routes requiring role checks
- [ ] Verify related entity ownership (e.g., property belongs to tenant before creating lead)
- [ ] Test with 2+ test tenants to ensure no cross-tenant data leak
- [ ] Add unit tests specifically for tenant isolation

---

## Testing Tenant Isolation

```javascript
// Test file: tests/tenantIsolation.test.js

describe("Tenant Isolation", () => {
  let tenant1Id, tenant2Id;
  let user1Token, user2Token;

  beforeAll(async () => {
    // Setup: Create 2 tenants with users
    // tenant1 with user1
    // tenant2 with user2
  });

  test("User from tenant1 cannot see tenant2's properties", async () => {
    // Create property in tenant2
    // Authenticate as user1
    // Query properties
    // Assert: Should return empty or 403
  });

  test("User from tenant1 cannot update tenant2's property", async () => {
    // Authenticate as user1
    // Try to PATCH tenant2's property
    // Assert: Should return 403 or 404
  });

  test("User from tenant1 cannot delete tenant2's property", async () => {
    // Authenticate as user1
    // Try to DELETE tenant2's property
    // Assert: Should return 403 or 404
  });

  test("Super admin can see all tenants' data", async () => {
    // Authenticate as super admin
    // Query properties
    // Assert: Should return properties from both tenants
  });
});
```

---

## Common Pitfalls to Avoid

| ❌ Mistake | ✅ Solution |
|---|---|
| Forgetting `tenant_id` in query | Always: `{ tenant_id: req.tenantId, ...filters }` |
| Allowing `req.body.tenant_id` in updates | Always: `delete req.body.tenant_id` before save |
| No index on `tenant_id` | Add: `propertySchema.index({ tenant_id: 1 })` |
| Hardcoded role checks in controller | Use: `authorize("role1", "role2")` middleware |
| Trusting user input for tenant_id | Always use: `req.tenantId` from middleware |
| Not verifying foreign key ownership | Always query: `{ _id, tenant_id: req.tenantId }` |

---

## Future Modules Ready to Implement

All these modules already follow the pattern once core foundation is set:

1. **Properties** — Add `tenant_id` index, scoped queries
2. **Leads & CRM** — Link to properties with tenant verification
3. **Bookings** — Link to leads + properties with tenant verification
4. **Finance/EMI** — Link to bookings with tenant verification
5. **Rentals/Leases** — Same pattern
6. **Projects** — Builder-specific, same pattern
7. **Documents** — Polymorphic with tenant_id at root
8. **Notifications** — Trigger within tenant scope

---

**Implementation Status**:
- ✅ Multi-tenant isolation foundation: COMPLETE
- ✅ Auth middleware with tenantScope: COMPLETE
- ✅ Tenant controller with proper checks: COMPLETE
- ✅ User model with phone field: COMPLETE
- ⏳ Remaining modules: Use this pattern for all new implementations
