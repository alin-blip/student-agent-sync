EduForYou UK Agent Management Platform - design system and architecture decisions

## Design System
- Primary (navy): hsl(220 60% 10%) — sidebar, headers
- Accent (orange): hsl(24 95% 53%) — CTAs, highlights, active states
- Background: hsl(220 20% 97%), Cards: white
- Font: Inter (Google Fonts import in index.css)
- Border radius: 0.5rem (--radius)

## Architecture
- Roles stored in separate `user_roles` table (NOT on profiles)
- `has_role()` and `get_user_role()` security definer functions
- RLS: Owner=all, Admin=team agents' data, Agent=own data only
- No public signup — Owner creates users via Agents page
- Auto-profile creation via auth trigger on signup

## Route Structure
- /owner/dashboard, /admin/dashboard, /agent/dashboard
- Shared: /[role]/students, /[role]/enrollments, /[role]/create-image, /[role]/profile
- Owner only: /owner/agents, /owner/settings
- Public: /card/:slug (agent digital card, no auth)

## Key Tables
profiles (with avatar_url, slug), user_roles, universities, campuses, courses, intakes, students, enrollments (with funding_status/type/reference/notes), commission_tiers, brand_settings, generated_images, ai_conversations, ai_messages, agent_card_settings, student_documents, student_notes

## Storage Buckets
student-documents (private), resource-files (public), brand-assets (public), generated-images (public), avatars (public)

## Student Detail Page
- Tabbed interface: Overview, Documents, Enrollments, Funding, Notes
- Components split into src/components/student-detail/ folder
- Role permissions: Agent=read-only status, Owner/Admin=can change status & funding

## Enrollment Flow
- 5-step wizard: Institution → Applicant → Next of Kin → Document Upload → Review & Submit
- After submit navigates to student detail page
- Both full-page (EnrollStudent.tsx) and dialog (EnrollStudentDialog.tsx) versions

## Enrollment Statuses
applied, documents_pending, documents_submitted, processing, offer_received, accepted, funding, enrolled, active, rejected, withdrawn

## Funding Statuses
not_started, application_submitted, approved, rejected, disbursed

## AI Features
- AI Chat: edge function ai-chat, persisted in ai_conversations + ai_messages
- AI Image Generator: Two-step pipeline (prompt-agent.ts → image generation)
  - Step 1: Gemini Flash text model refines user input into structured JSON (headline, subheadline, bullets, visual_description)
  - Step 2: Gemini Flash Image generates based on simplified prompt
  - Client-side Canvas compositing for logo + profile photo (pixel-perfect)
  - When includePhoto=true: skip logo overlay (already in branded avatar), no AI-generated people
  - Chat-style UI for iterative refinements (edit mode sends previousImageUrl + editInstruction)
  - 5 images/user/day limit, brand settings auto-injected

## Agent Digital Card
- Public page at /card/:slug (no auth required)
- Settings managed in Profile page via CardSettingsSection component
- agent_card_settings table: job_title, whatsapp, booking_url, apply_url, bio, company info, social links, is_public
