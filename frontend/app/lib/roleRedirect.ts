import { Role } from "../types/auth";

export function redirectPathForRole(role: Role): string {
  switch (role) {
    case "PLATFORM_ADMIN":
      return "/platform/dashboard";
    case "COMPANY_OWNER":
      return "/company/live-map";
    case "ADMIN":
      return "/admin/live-map";
    case "DRIVER":
      return "/driver/dashboard";
    default:
      return "/";
  }
}