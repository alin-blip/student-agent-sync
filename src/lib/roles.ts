// B2B role hierarchy: Owner → Company Admin → Branch Manager → Consultant
export const APP_ROLES = {
  SUPER_ADMIN: "owner",
  COMPANY_ADMIN: "company_admin",
  BRANCH_MANAGER: "branch_manager",
  CONSULTANT: "consultant",
} as const;

export type AppRole =
  | "owner"
  | "company_admin"
  | "branch_manager"
  | "consultant";

export const ROLE_PREFIXES: Record<AppRole, string> = {
  owner: "owner",
  company_admin: "company",
  branch_manager: "branch",
  consultant: "consultant",
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
    default:
      return role;
  }
};
