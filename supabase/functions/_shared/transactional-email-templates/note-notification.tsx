import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface NoteNotificationProps {
  studentName?: string
  noteType?: string
  content?: string
  authorName?: string
  studentUrl?: string
}

const noteTypeLabel = (type?: string) => {
  switch (type) {
    case 'action_required': return '⚠️ Action Required'
    case 'info_request': return '📋 Information Requested'
    case 'document_request': return '📄 Document Requested'
    case 'funding_update': return '💰 Funding Update'
    case 'status_update': return '🔄 Status Update'
    default: return '🔔 Urgent Note'
  }
}

const NoteNotificationEmail = ({
  studentName, noteType, content, authorName, studentUrl,
}: NoteNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>{noteTypeLabel(noteType)} — {studentName || 'a student'}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>{noteTypeLabel(noteType)}</Text>
        </Section>

        <Text style={text}>
          Hi, you have a new notification regarding <strong>{studentName || 'a student'}</strong>.
        </Text>

        {content && (
          <Section style={noteBox}>
            <Text style={noteContent}>{content}</Text>
          </Section>
        )}

        {authorName && (
          <Text style={meta}>Posted by: <strong>{authorName}</strong></Text>
        )}

        <Hr style={hr} />

        {studentUrl && (
          <Button style={button} href={studentUrl}>
            View Student Details
          </Button>
        )}

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}. Please log in to your dashboard to take action.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NoteNotificationEmail,
  subject: (data: Record<string, any>) =>
    `${data.noteType === 'action_required' ? '⚠️ Action Required' : '🔔 Urgent'}: ${data.studentName || 'Student'} — EduForYou UK`,
  displayName: 'Note notification to agent',
  previewData: {
    studentName: 'John Smith',
    noteType: 'action_required',
    content: 'Please upload the missing ID documents for this student as soon as possible.',
    authorName: 'Admin User',
    studentUrl: 'https://agentseduforyou.lovable.app/agent/students/example-id',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0' }
const badge = {
  backgroundColor: '#fff7ed',
  border: '1px solid #fed7aa',
  borderRadius: '8px',
  padding: '8px 16px',
  marginBottom: '20px',
  textAlign: 'center' as const,
}
const badgeText = { fontSize: '14px', fontWeight: '600' as const, color: '#ea580c', margin: '0' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const noteBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderLeft: '4px solid #f97316',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '16px',
}
const noteContent = { fontSize: '14px', color: '#1f2937', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap' as const }
const meta = { fontSize: '12px', color: '#6b7280', margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const button = {
  backgroundColor: '#f97316',
  color: '#ffffff',
  fontSize: '14px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '12px 24px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', lineHeight: '1.5' }
