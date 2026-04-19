// Maps human-friendly role keys → DB enum values stored in user_roles.role
export const APP_ROLES = {
  SUPER_ADMIN: "owner",
  COMPANY_ADMIN: "company_admin",
  BRANCH_MANAGER: "branch_manager",
  CONSULTANT: "consultant",
  // Legacy aliases — preserved for backward compatibility with existing users
  LEGACY_ADMIN: "admin",
  LEGACY_AGENT: "agent",
} as const;

export type AppRole =
  | "owner"
  | "company_admin"
  | "branch_manager"
  | "consultant"
  | "admin"
  | "agent";

export const ROLE_PREFIXES: Record<AppRole, string> = {
  owner: "owner",
  company_admin: "company",
  branch_manager: "branch",
  consultant: "agent",
  admin: "admin",
  agent: "agent",
};

export const getRolePrefix = (role: string): string =>
  ROLE_PREFIXES[role as AppRole] ?? "";

export const getHomeRoute = (role: string) => {
  const prefix = getRolePrefix(role);
  return `/${prefix}/dashboard`;
};

export const getRoleLabel = (role: string) => {
  switch (role) {
    case "owner":
      return "Super Admin";
    case "company_admin":
      return "Company Admin";
    case "branch_manager":
      return "Branch Manager";
    case "consultant":
      return "Consultant";
    case "admin":
      return "Admin";
    case "agent":
      return "Agent";
    default:
      return role;
  }
};
