import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import AgentCardPage from "./pages/public/AgentCardPage";
import PublicApplicationPage from "./pages/public/PublicApplicationPage";
import SignConsentPage from "./pages/public/SignConsentPage";
import UploadDocumentsPage from "./pages/public/UploadDocumentsPage";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/contexts/AuthContext";
import Login from "./pages/Login";
import ResetPassword from "./pages/ResetPassword";
import OwnerDashboard from "./pages/owner/OwnerDashboard";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AgentDashboard from "./pages/agent/AgentDashboard";
import AdminAgentsPage from "./pages/admin/AdminAgentsPage";
import AgentsPage from "./pages/owner/AgentsPage";
import SettingsPage from "./pages/owner/SettingsPage";
import KnowledgeBasePage from "./pages/owner/KnowledgeBasePage";
import AIMonitoringPage from "./pages/owner/AIMonitoringPage";
import CommissionsPage from "./pages/owner/CommissionsPage";
import StudentsPage from "./pages/shared/StudentsPage";
import EnrollmentsPage from "./pages/shared/EnrollmentsPage";
import EnrollStudent from "./pages/agent/EnrollStudent";
import StudentDetailPage from "./pages/shared/StudentDetailPage";
import ProfilePage from "./pages/shared/ProfilePage";
import InvoicesPage from "./pages/shared/InvoicesPage";
import OwnerInvoicesPage from "./pages/owner/OwnerInvoicesPage";
import ResourcesPage from "./pages/shared/ResourcesPage";
import CreateImagePage from "./pages/shared/CreateImagePage";
import UnsubscribePage from "./pages/shared/UnsubscribePage";
import MessagesPage from "./pages/shared/MessagesPage";
import DigitalCardPage from "./pages/shared/DigitalCardPage";
import SocialPostsPage from "./pages/shared/SocialPostsPage";
import AgentSocialFeedPage from "./pages/shared/AgentSocialFeedPage";
import UniversitiesCoursesPage from "./pages/shared/UniversitiesCoursesPage";

import FeedbackPage from "./pages/owner/FeedbackPage";
import AuditLogPage from "./pages/owner/AuditLogPage";
import LeadsPage from "./pages/shared/LeadsPage";
import TasksPage from "./pages/shared/TasksPage";
import LeaderboardPage from "./pages/shared/LeaderboardPage";
import LearnPage from "./pages/shared/LearnPage";
import NotFound from "./pages/NotFound";
import { IdleTimeoutDialog } from "./components/IdleTimeoutDialog";

// Phase 1 B2B Imports
import CompaniesPage from "./pages/owner/CompaniesPage";
import CompanyDetailPage from "./pages/owner/CompanyDetailPage";
import BranchDetailPage from "./pages/owner/BranchDetailPage";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
         <AuthProvider>
          <IdleTimeoutDialog />
          <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={<Login />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/card/:slug" element={<AgentCardPage />} />
            <Route path="/apply/:slug" element={<PublicApplicationPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/sign-consent/:token" element={<SignConsentPage />} />
            <Route path="/upload-documents/:token" element={<UploadDocumentsPage />} />
            
            {/* Owner routes */}
            <Route path="/owner/dashboard" element={<OwnerDashboard />} />
            <Route path="/owner/learn" element={<LearnPage />} />
            <Route path="/owner/students" element={<StudentsPage />} />
            <Route path="/owner/students/:id" element={<StudentDetailPage />} />
            <Route path="/owner/enrollments" element={<EnrollmentsPage />} />
            <Route path="/owner/messages" element={<MessagesPage />} />
            <Route path="/owner/agents" element={<AgentsPage />} />
            <Route path="/owner/settings" element={<SettingsPage />} />
            <Route path="/owner/commissions" element={<CommissionsPage />} />
            <Route path="/owner/knowledge-base" element={<KnowledgeBasePage />} />
            <Route path="/owner/ai-monitoring" element={<AIMonitoringPage />} />
            <Route path="/owner/leads" element={<LeadsPage />} />
            <Route path="/owner/tasks" element={<TasksPage />} />
            
            <Route path="/owner/invoices" element={<OwnerInvoicesPage />} />
            <Route path="/owner/profile" element={<ProfilePage />} />
            <Route path="/owner/resources" element={<ResourcesPage />} />
            <Route path="/owner/create-image" element={<CreateImagePage />} />
            <Route path="/owner/enroll" element={<EnrollStudent />} />
            <Route path="/owner/digital-card" element={<DigitalCardPage />} />
            <Route path="/owner/social-posts" element={<SocialPostsPage />} />
            <Route path="/owner/universities" element={<UniversitiesCoursesPage />} />
            <Route path="/owner/leaderboard" element={<LeaderboardPage />} />
            
            {/* Phase 1 B2B Routes */}
            <Route path="/owner/companies" element={<CompaniesPage />} />
            <Route path="/owner/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/owner/branches/:id" element={<BranchDetailPage />} />

            <Route path="/owner/feedback" element={<FeedbackPage />} />
            <Route path="/owner/audit-log" element={<AuditLogPage />} />
            
            {/* Admin routes */}
            <Route path="/admin/dashboard" element={<AdminDashboard />} />
            <Route path="/admin/learn" element={<LearnPage />} />
            <Route path="/admin/students" element={<StudentsPage />} />
            <Route path="/admin/students/:id" element={<StudentDetailPage />} />
            <Route path="/admin/enrollments" element={<EnrollmentsPage />} />
            <Route path="/admin/messages" element={<MessagesPage />} />
            <Route path="/admin/agents" element={<AdminAgentsPage />} />
            
            <Route path="/admin/invoices" element={<InvoicesPage />} />
            <Route path="/admin/profile" element={<ProfilePage />} />
            <Route path="/admin/resources" element={<ResourcesPage />} />
            <Route path="/admin/create-image" element={<CreateImagePage />} />
            <Route path="/admin/enroll" element={<EnrollStudent />} />
            <Route path="/admin/digital-card" element={<DigitalCardPage />} />
            <Route path="/admin/social-posts" element={<SocialPostsPage />} />
            <Route path="/admin/universities" element={<UniversitiesCoursesPage />} />
            <Route path="/admin/leads" element={<LeadsPage />} />
            <Route path="/admin/tasks" element={<TasksPage />} />
            <Route path="/admin/leaderboard" element={<LeaderboardPage />} />
            
            {/* Agent routes */}
            <Route path="/agent/dashboard" element={<AgentDashboard />} />
            <Route path="/agent/learn" element={<LearnPage />} />
            <Route path="/agent/students" element={<StudentsPage />} />
            <Route path="/agent/students/:id" element={<StudentDetailPage />} />
            <Route path="/agent/enrollments" element={<EnrollmentsPage />} />
            <Route path="/agent/messages" element={<MessagesPage />} />
            
            <Route path="/agent/invoices" element={<InvoicesPage />} />
            <Route path="/agent/profile" element={<ProfilePage />} />
            <Route path="/agent/resources" element={<ResourcesPage />} />
            <Route path="/agent/create-image" element={<CreateImagePage />} />
            <Route path="/agent/enroll" element={<EnrollStudent />} />
            <Route path="/agent/digital-card" element={<DigitalCardPage />} />
            <Route path="/agent/social-posts" element={<AgentSocialFeedPage />} />
            <Route path="/agent/universities" element={<UniversitiesCoursesPage />} />
            <Route path="/agent/leads" element={<LeadsPage />} />
            <Route path="/agent/tasks" element={<TasksPage />} />
            <Route path="/agent/leaderboard" element={<LeaderboardPage />} />
            
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
