export const APP_ROLES = {
  SUPER_ADMIN: "owner",
  COMPANY_ADMIN: "company_admin",
  BRANCH_MANAGER: "admin", // Refactored from 'admin'
  CONSULTANT: "agent",     // Refactored from 'agent'
};

export const ROLE_PREFIXES = {
  [APP_ROLES.SUPER_ADMIN]: "owner",
  [APP_ROLES.COMPANY_ADMIN]: "company",
  [APP_ROLES.BRANCH_MANAGER]: "admin",
  [APP_ROLES.CONSULTANT]: "agent",
};

export const getRolePrefix = (role: string) => {
  return ROLE_PREFIXES[role as keyof typeof ROLE_PREFIXES] || "";
};

export const getHomeRoute = (role: string) => {
  const prefix = getRolePrefix(role);
  return `/${prefix}/dashboard`;
};

export const getRoleLabel = (role: string) => {
  switch (role) {
    case APP_ROLES.SUPER_ADMIN:
      return "Super Admin";
    case APP_ROLES.COMPANY_ADMIN:
      return "Company Admin";
    case APP_ROLES.BRANCH_MANAGER:
      return "Branch Manager";
    case APP_ROLES.CONSULTANT:
      return "Consultant";
    default:
      return role;
  }
};
