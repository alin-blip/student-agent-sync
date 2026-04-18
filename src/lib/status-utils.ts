// Role-based status visibility & permissions

export const ALL_STATUSES = [
  "new_application", "processing", "assessment_booked", "pass", "fail",
  "additional_requirements", "final_offer", "enrolled",
  "commission_25_ready", "commission_paid", "withdrawn", "cancelled",
];

const COMMISSION_STATUSES = ["commission_25_ready", "commission_paid"];

/** Statuses visible in dropdowns/filters by role */
export function getVisibleStatuses(role: string): string[] {
  if (role === "owner") return ALL_STATUSES;
  return ALL_STATUSES.filter(s => !COMMISSION_STATUSES.includes(s));
}

/** Map commission statuses to "enrolled" for non-owner display */
export function getDisplayStatus(status: string, role: string): string {
  if (role !== "owner" && COMMISSION_STATUSES.includes(status)) return "enrolled";
  return status;
}

/** Statuses an admin can set (everything except commission statuses) */
export function getAdminEditableStatuses(): string[] {
  return ALL_STATUSES.filter(s => !COMMISSION_STATUSES.includes(s));
}

/** Check if an agent can book assessment for this enrollment */
export function canAgentBookAssessment(currentStatus: string): boolean {
  const BEFORE_ASSESSMENT = ["new_application", "processing"];
  return BEFORE_ASSESSMENT.includes(currentStatus);
}

/** Check if an agent can request cancellation */
export function canAgentRequestCancel(currentStatus: string): boolean {
  const TERMINAL = ["cancelled", "withdrawn", "fail", "commission_25_ready", "commission_paid", "transferred"];
  return !TERMINAL.includes(currentStatus);
}
