import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  new_application: { label: "New Application", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  processing: { label: "Processing", className: "bg-orange-500/10 text-orange-700 border-orange-200" },
  assessment_booked: { label: "Assessment Booked", className: "bg-amber-500/10 text-amber-700 border-amber-200" },
  pass: { label: "Pass", className: "bg-lime-500/10 text-lime-700 border-lime-200" },
  fail: { label: "Fail", className: "bg-red-500/10 text-red-700 border-red-200" },
  additional_requirements: { label: "Additional Requirements", className: "bg-yellow-500/10 text-yellow-700 border-yellow-200" },
  final_offer: { label: "Final Offer", className: "bg-cyan-500/10 text-cyan-700 border-cyan-200" },
  enrolled: { label: "Enrolled", className: "bg-green-500/10 text-green-700 border-green-200" },
  commission_25_ready: { label: "Commission 25% Ready", className: "bg-teal-600/10 text-teal-800 border-teal-300" },
  commission_paid: { label: "Commission Paid", className: "bg-emerald-600/10 text-emerald-800 border-emerald-300" },
  withdrawn: { label: "Withdrawn", className: "bg-gray-500/10 text-gray-700 border-gray-200" },
  cancelled: { label: "Cancelled", className: "bg-gray-400/10 text-gray-600 border-gray-200" },
  transferred: { label: "Transferred", className: "bg-indigo-500/10 text-indigo-700 border-indigo-200" },
  // Funding statuses (kept for funding tab)
  not_started: { label: "Not Started", className: "bg-gray-500/10 text-gray-600 border-gray-200" },
  application_submitted: { label: "Submitted", className: "bg-blue-500/10 text-blue-700 border-blue-200" },
  approved: { label: "Approved", className: "bg-green-500/10 text-green-700 border-green-200" },
  disbursed: { label: "Disbursed", className: "bg-emerald-500/10 text-emerald-700 border-emerald-200" },
};

export function StatusBadge({ status }: { status: string }) {
  const config = statusConfig[status] || { label: status, className: "" };
  return (
    <Badge variant="outline" className={cn("font-medium text-xs", config.className)}>
      {config.label}
    </Badge>
  );
}
