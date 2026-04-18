/// <reference types="npm:@types/react@18.3.1" />
import * as React from 'npm:react@18.3.1'

export interface TemplateEntry {
  component: React.ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  to?: string
  displayName?: string
  previewData?: Record<string, any>
}

import { template as noteNotification } from './note-notification.tsx'
import { template as newLeadNotification } from './new-lead-notification.tsx'
import { template as enrollmentStatusChange } from './enrollment-status-change.tsx'
import { template as newStudentAssigned } from './new-student-assigned.tsx'
import { template as consentSigningLink } from './consent-signing-link.tsx'
import { template as regentApplicationLink } from './regent-application-link.tsx'
import { template as adminDeleteCode } from './admin-delete-code.tsx'
import { template as welcomeAgent } from './welcome-agent.tsx'
import { template as transferApprovalCode } from './transfer-approval-code.tsx'
import { template as documentUploadRequest } from './document-upload-request.tsx'

export const TEMPLATES: Record<string, TemplateEntry> = {
  'note-notification': noteNotification,
  'new-lead-notification': newLeadNotification,
  'enrollment-status-change': enrollmentStatusChange,
  'new-student-assigned': newStudentAssigned,
  'consent-signing-link': consentSigningLink,
  'regent-application-link': regentApplicationLink,
  'admin-delete-code': adminDeleteCode,
  'welcome-agent': welcomeAgent,
  'transfer-approval-code': transferApprovalCode,
  'document-upload-request': documentUploadRequest,
}
