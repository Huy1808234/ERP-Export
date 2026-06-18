import { getAccessRoleName, isStaffRole } from "@/lib/access-control";

/**
 * List of roles that are allowed to access the administrative dashboard.
 */
/**
 * Checks if a user has staff/admin permissions based on their role.
 * 
 * @param user The user object from the session
 * @returns boolean
 */
export function isStaff(user: Parameters<typeof getAccessRoleName>[0]): boolean {
  if (!user) return false;

  const roleName = getAccessRoleName(user);

  return isStaffRole(roleName);
}
