import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import Index from "./pages/Index";
import AgentCardPage from "./pages/public/AgentCardPage";
import BranchCardPage from "./pages/public/BranchCardPage";
import WidgetPage from "./pages/public/WidgetPage";
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
import BranchDashboard from "./pages/branch/BranchDashboard";
import BranchConsultantsPage from "./pages/branch/BranchConsultantsPage";
import CompanyDashboard from "./pages/company/CompanyDashboard";
import CompanyBranchDetailPage from "./pages/company/CompanyBranchDetailPage";
import CompanyBranchCreatePage from "./pages/company/CompanyBranchCreatePage";
import AgentsPage from "./pages/owner/AgentsPage";
import SettingsPage from "./pages/owner/SettingsPage";
import KnowledgeBasePage from "./pages/owner/KnowledgeBasePage";
import AIMonitoringPage from "./pages/owner/AIMonitoringPage";
import CommissionsPage from "./pages/owner/CommissionsPage";
import StudentsPage from "./pages/shared/StudentsPage";
import EnrollmentsPage from "./pages/shared/EnrollmentsPage";
import EnrollStudent from "./pages/consultant/EnrollStudent";
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
import EmbedManagerPage from "./pages/shared/EmbedManagerPage";
import AIEmailGeneratorPage from "./pages/shared/AIEmailGeneratorPage";
import ForBusinessPage from "./pages/public/ForBusinessPage";
import ApplyPartnerPage from "./pages/public/ApplyPartnerPage";
import ThankYouPage from "./pages/public/ThankYouPage";

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
import CompanyApplicationsPage from "./pages/owner/CompanyApplicationsPage";

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
            <Route path="/branch-card/:slug" element={<BranchCardPage />} />
            <Route path="/widget/:branchSlug" element={<WidgetPage />} />
            <Route path="/apply/:slug" element={<PublicApplicationPage />} />
            <Route path="/unsubscribe" element={<UnsubscribePage />} />
            <Route path="/sign-consent/:token" element={<SignConsentPage />} />
            <Route path="/upload-documents/:token" element={<UploadDocumentsPage />} />
            <Route path="/for-business" element={<ForBusinessPage />} />
            <Route path="/apply-partner" element={<ApplyPartnerPage />} />
            <Route path="/apply-partner/thank-you" element={<ThankYouPage />} />

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
            <Route path="/owner/embed-manager" element={<EmbedManagerPage />} />
            <Route path="/owner/companies" element={<CompaniesPage />} />
            <Route path="/owner/companies/:id" element={<CompanyDetailPage />} />
            <Route path="/owner/branches/:id" element={<BranchDetailPage />} />
            <Route path="/owner/feedback" element={<FeedbackPage />} />
            <Route path="/owner/audit-log" element={<AuditLogPage />} />
            <Route path="/owner/company-applications" element={<CompanyApplicationsPage />} />

            {/* Company Admin routes */}
            <Route path="/company/dashboard" element={<CompanyDashboard />} />
            <Route path="/company/branches/:branchId" element={<CompanyBranchDetailPage />} />
            <Route path="/company/branches/new" element={<CompanyBranchCreatePage />} />
            <Route path="/company/embed-manager" element={<EmbedManagerPage />} />
            <Route path="/company/email-generator" element={<AIEmailGeneratorPage />} />

            {/* Branch Manager routes */}
            <Route path="/branch/dashboard" element={<BranchDashboard />} />
            <Route path="/branch/learn" element={<LearnPage />} />
            <Route path="/branch/students" element={<StudentsPage />} />
            <Route path="/branch/students/:id" element={<StudentDetailPage />} />
            <Route path="/branch/enrollments" element={<EnrollmentsPage />} />
            <Route path="/branch/messages" element={<MessagesPage />} />
            <Route path="/branch/consultants" element={<BranchConsultantsPage />} />
            <Route path="/branch/email-generator" element={<AIEmailGeneratorPage />} />
            <Route path="/branch/invoices" element={<InvoicesPage />} />
            <Route path="/branch/profile" element={<ProfilePage />} />
            <Route path="/branch/resources" element={<ResourcesPage />} />
            <Route path="/branch/create-image" element={<CreateImagePage />} />
            <Route path="/branch/enroll" element={<EnrollStudent />} />
            <Route path="/branch/digital-card" element={<DigitalCardPage />} />
            <Route path="/branch/social-posts" element={<SocialPostsPage />} />
            <Route path="/branch/universities" element={<UniversitiesCoursesPage />} />
            <Route path="/branch/leads" element={<LeadsPage />} />
            <Route path="/branch/tasks" element={<TasksPage />} />
            <Route path="/branch/leaderboard" element={<LeaderboardPage />} />

            {/* Consultant routes */}
            <Route path="/consultant/dashboard" element={<BranchDashboard />} />
            <Route path="/consultant/learn" element={<LearnPage />} />
            <Route path="/consultant/students" element={<StudentsPage />} />
            <Route path="/consultant/students/:id" element={<StudentDetailPage />} />
            <Route path="/consultant/enrollments" element={<EnrollmentsPage />} />
            <Route path="/consultant/messages" element={<MessagesPage />} />
            <Route path="/consultant/invoices" element={<InvoicesPage />} />
            <Route path="/consultant/profile" element={<ProfilePage />} />
            <Route path="/consultant/resources" element={<ResourcesPage />} />
            <Route path="/consultant/create-image" element={<CreateImagePage />} />
            <Route path="/consultant/enroll" element={<EnrollStudent />} />
            <Route path="/consultant/digital-card" element={<DigitalCardPage />} />
            <Route path="/consultant/social-posts" element={<AgentSocialFeedPage />} />
            <Route path="/consultant/universities" element={<UniversitiesCoursesPage />} />
            <Route path="/consultant/leads" element={<LeadsPage />} />
            <Route path="/consultant/tasks" element={<TasksPage />} />
            <Route path="/consultant/leaderboard" element={<LeaderboardPage />} />

            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
