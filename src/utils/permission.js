export const hasPermission = (
  permissionData,
  role,
  moduleName,
  permissionType
) => {
  const rolePermission = permissionData?.find(
    (item) =>
      item.role?.toLowerCase() === role?.toLowerCase()
  );

  if (!rolePermission) {
    return false;
  }

  const modulePermission = rolePermission.module?.find(
    (item) =>
      item.name?.toLowerCase() === moduleName?.toLowerCase()
  );

  if (!modulePermission) {
    return false;
  }

  return modulePermission[permissionType] === true;
};