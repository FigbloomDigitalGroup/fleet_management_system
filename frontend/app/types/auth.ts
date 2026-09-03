export type Role = "PLATFORM_ADMIN" | "COMPANY_OWNER" | "ADMIN" | "DRIVER";

export interface User {
  id: string;
  email: string;
  fullName?: string;
  role: Role;
  companyId: string | null;
}

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export interface CompanyRecord {
  _id: string;
  name: string;
  slug: string;
  status: "active" | "suspended" | "pending";
  subscriptionPlan: string;
  createdAt: string;
  userCount?: number;
}

export interface AdminRecord {
  _id: string;
  email: string;
  fullName: string;
  role: string;
  status: string;
  createdAt: string;
}


