import { Role } from "../types/auth";

export function redirectPathForRole(role: Role): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return "/platform/dashboard";
    case "COMPANY_OWNER":
      return "/company/dashboard";
    case "ADMIN":
      return "/admin/dashboard";
    case "DRIVER":
      return "/driver/dashboard";
    default:
      return "/";
  }
}