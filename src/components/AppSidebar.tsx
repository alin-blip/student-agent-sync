import {
  LayoutDashboard,
  Users,
  ClipboardList,
  UserCog,
  Settings,
  LogOut,
  GraduationCap,
  UserPlus,
  PoundSterling,
  UserCircle,
  FolderOpen,
  Brain,
  MessageSquare,
  Image as ImageIcon,
  Share2,
  Mail,
  MessageSquareHeart,
  CreditCard,
  ContactRound,
  ListTodo,
  School,
  Shield,
  Receipt,
  Rocket,
  Building2,
} from "lucide-react";
import { FeedbackDialog } from "@/components/FeedbackDialog";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarFooter,
  useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { SidebarXPWidget } from "@/components/SidebarXPWidget";
import { APP_ROLES, getRolePrefix } from "@/lib/roles";

type NavItem = { title: string; url: string; icon: React.ElementType; badge?: number; badgeText?: string };

function SidebarNavGroup({ label, items, collapsed }: { label: string; items: NavItem[]; collapsed: boolean }) {
  if (items.length === 0) return null;
  return (
    <SidebarGroup>
      <SidebarGroupLabel className="text-sidebar-foreground/40 uppercase text-[10px] tracking-widest px-4 pt-4 pb-1">
        {!collapsed && label}
      </SidebarGroupLabel>
      <SidebarGroupContent>
        <SidebarMenu>
          {items.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink
                  to={item.url}
                  end={item.url.endsWith("dashboard")}
                  className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                  activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
                >
                  <item.icon className="mr-2 h-4 w-4 shrink-0" />
                  {!collapsed && <span className="flex-1">{item.title}</span>}
                  {!collapsed && item.badgeText && (
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[9px] font-bold px-1.5 h-[16px] uppercase tracking-wider">
                      {item.badgeText}
                    </span>
                  )}
                  {item.badge && item.badge > 0 && (
                    <span className="ml-auto inline-flex items-center justify-center rounded-full bg-accent text-accent-foreground text-[10px] font-bold min-w-[18px] h-[18px] px-1">
                      {item.badge > 99 ? "99+" : item.badge}
                    </span>
                  )}
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu>
      </SidebarGroupContent>
    </SidebarGroup>
  );
}

export function AppSidebar() {
  const { user, role, profile, signOut } = useAuth();
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const prefix = getRolePrefix(role || APP_ROLES.CONSULTANT);

  // Unread messages count
  const { data: unreadCount = 0 } = useQuery({
    queryKey: ["unread-messages-count", user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data: convos } = await supabase
        .from("direct_conversations")
        .select("id")
        .or(`participant_1.eq.${user.id},participant_2.eq.${user.id}`);
      if (!convos || convos.length === 0) return 0;
      const convoIds = convos.map((c: any) => c.id);
      const { count, error } = await supabase
        .from("direct_messages")
        .select("id", { count: "exact", head: true })
        .in("conversation_id", convoIds)
        .neq("sender_id", user.id)
        .is("read_at", null);
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  // Pending tasks count (not done)
  const { data: pendingTasksCount = 0 } = useQuery({
    queryKey: ["pending-tasks-count", user?.id, role],
    queryFn: async () => {
      if (!user) return 0;
      let query = supabase
        .from("tasks")
        .select("id", { count: "exact", head: true })
        .neq("status", "done");
      // Agents only see their own tasks
      if (role === APP_ROLES.CONSULTANT) {
        query = query.or(`assigned_to.eq.${user.id},created_by.eq.${user.id}`);
      }
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 60000,
  });

  // New leads count
  const { data: newLeadsCount = 0 } = useQuery({
    queryKey: ["new-leads-count", user?.id, role],
    queryFn: async () => {
      if (!user) return 0;
      let query = supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .eq("status", "new");
      if (role === APP_ROLES.CONSULTANT) {
        query = query.eq("agent_id", user.id);
      }
      const { count, error } = await query;
      if (error) return 0;
      return count || 0;
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const mainItems: NavItem[] = [
    { title: "Start Here", url: `${prefix}/learn`, icon: Rocket, badgeText: "NEW" },
    { title: "Dashboard", url: `${prefix}/dashboard`, icon: LayoutDashboard },
    { title: "Students", url: `${prefix}/students`, icon: Users },
    { title: "Leads", url: `${prefix}/leads`, icon: ContactRound, badge: newLeadsCount },
    { title: "Enrollments", url: `${prefix}/enrollments`, icon: ClipboardList },
    { title: "Invoices", url: `${prefix}/invoices`, icon: Receipt },
    { title: "Messages", url: `${prefix}/messages`, icon: Mail, badge: unreadCount },
    { title: "Tasks", url: `${prefix}/tasks`, icon: ListTodo, badge: pendingTasksCount },
    { title: "Universities", url: `${prefix}/universities`, icon: School },
  ];

  const actionItems: NavItem[] = [
    { title: "Enroll Student", url: `${prefix}/enroll`, icon: UserPlus },
    { title: "Social Posts", url: `${prefix}/social-posts`, icon: Share2 },
    { title: "Digital Card", url: `${prefix}/digital-card`, icon: CreditCard },
    { title: "Create Image", url: `${prefix}/create-image`, icon: ImageIcon },
    { title: "Resources", url: `${prefix}/resources`, icon: FolderOpen },
  ];

  const managementItems: NavItem[] = [];

  if (role === APP_ROLES.SUPER_ADMIN) {
    managementItems.push(
      { title: "Companies", url: `/owner/companies`, icon: Building2 },
      { title: "Users", url: `/owner/agents`, icon: UserCog },
      { title: "Commissions", url: `/owner/commissions`, icon: PoundSterling },
      { title: "Knowledge Base", url: `/owner/knowledge-base`, icon: Brain },
      { title: "AI Monitoring", url: `/owner/ai-monitoring`, icon: MessageSquare },
      { title: "Feedback", url: `/owner/feedback`, icon: MessageSquareHeart },
      { title: "Audit Log", url: `/owner/audit-log`, icon: Shield },
      { title: "Settings", url: `/owner/settings`, icon: Settings },
    );
  } else if (role === APP_ROLES.BRANCH_MANAGER) {
    managementItems.push(
      { title: "My Consultants", url: `/admin/agents`, icon: UserCog },
    );
  } else if (role === APP_ROLES.COMPANY_ADMIN) {
    // Company Admin specific items
    managementItems.push(
      { title: "My Company", url: `/company/dashboard`, icon: Building2 },
      { title: "Branches", url: `/company/branches`, icon: FolderOpen },
      { title: "Users", url: `/company/users`, icon: UserCog },
      { title: "Payments", url: `/company/payments`, icon: PoundSterling },
      { title: "Email Generator", url: `/company/email-generator`, icon: Mail },
    );
  }

  return (
    <Sidebar collapsible="icon" className="border-r-0" data-onboarding="step-sidebar">
      <SidebarContent className="bg-sidebar text-sidebar-foreground">
        {/* Brand header */}
        <SidebarGroup>
          <SidebarGroupLabel className="text-sidebar-foreground/60 px-4 pt-5 pb-3">
            <div className="flex items-center gap-2">
              <GraduationCap className="w-5 h-5 text-sidebar-primary" />
              {!collapsed && <span className="font-bold text-sm tracking-tight text-sidebar-foreground">EduForYou UK</span>}
            </div>
          </SidebarGroupLabel>
        </SidebarGroup>

        <SidebarNavGroup label="Main" items={mainItems} collapsed={collapsed} />
        <SidebarNavGroup label="Actions" items={actionItems} collapsed={collapsed} />
        <SidebarNavGroup label="Management" items={managementItems} collapsed={collapsed} />
        {/* XP Widget */}
        <SidebarGroup>
          <SidebarGroupContent>
            <div className="px-3 py-2">
              <SidebarXPWidget collapsed={collapsed} />
            </div>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="bg-sidebar text-sidebar-foreground border-t border-sidebar-border p-3">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink
                to={`${prefix}/profile`}
                className="text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
                activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
              >
                <UserCircle className="mr-2 h-4 w-4 shrink-0" />
                {!collapsed && <span>Profile</span>}
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {!collapsed && profile && (
          <div className="mb-1 mt-1 px-1">
            <p className="text-xs font-medium truncate">{profile.full_name}</p>
            <p className="text-[10px] text-sidebar-foreground/50 truncate">{profile.email}</p>
          </div>
        )}
        <FeedbackDialog />
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
          onClick={signOut}
        >
          <LogOut className="h-4 w-4 mr-2" />
          {!collapsed && "Sign Out"}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
