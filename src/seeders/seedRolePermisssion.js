const mongoose = require("mongoose");
const RolePremission = require("../models/RolePremission");
require("dotenv").config();

const defaultPermissions = [
  // properties module
  { role: "admin", module: "properties", can_view: true, can_create: true, can_edit: true, can_delete: true },
  { role: "tenant_owner", module: "properties", can_view: true, can_create: true, can_edit: true, can_delete: true },
  { role: "manager", module: "properties", can_view: true, can_create: true, can_edit: true, can_delete: true },
  { role: "agent", module: "properties", can_view: true, can_create: true, can_edit: true, can_delete: false },
  { role: "accountant", module: "properties", can_view: true, can_create: false, can_edit: false, can_delete: false },
];

async function seed() {
  await mongoose.connect(process.env.MONGO_URI);

  for (const perm of defaultPermissions) {
    await RolePremission.findOneAndUpdate(
      { tenant_id: null, role: perm.role, module: perm.module },
      perm,
      { upsert: true, new: true }
    );
  }

  console.log("Role permissions seeded.");
  process.exit(0);
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});