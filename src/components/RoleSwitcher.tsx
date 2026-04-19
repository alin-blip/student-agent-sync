import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { getHomeRoute, getRoleLabel, type AppRole } from "@/lib/roles";
import { ArrowLeftRight } from "lucide-react";

export function RoleSwitcher() {
  const { role, roles, setActiveRole } = useAuth();
  const navigate = useNavigate();

  // Only show switcher if user has multiple roles
  if (!role || roles.length < 2) return null;

  const handleChange = (next: string) => {
    setActiveRole(next as AppRole);
    navigate(getHomeRoute(next), { replace: true });
  };

  return (
    <Select value={role} onValueChange={handleChange}>
      <SelectTrigger className="h-8 w-[180px] text-xs gap-1.5">
        <ArrowLeftRight className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {roles.map((r) => (
          <SelectItem key={r} value={r} className="text-xs">
            {getRoleLabel(r)}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
