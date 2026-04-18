import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface EnrollmentStatusChangeProps {
  studentName?: string
  universityName?: string
  courseName?: string
  oldStatus?: string
  newStatus?: string
  changedBy?: string
  studentUrl?: string
}

const formatStatus = (s?: string) =>
  s ? s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Unknown'

const EnrollmentStatusChangeEmail = ({
  studentName, universityName, courseName, oldStatus, newStatus, changedBy, studentUrl,
}: EnrollmentStatusChangeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Status Update: {studentName || 'Student'} → {formatStatus(newStatus)}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>🔄 Enrollment Status Changed</Text>
        </Section>

        <Text style={text}>
          Hi, the enrollment status for <strong>{studentName || 'a student'}</strong> has been updated.
        </Text>

        <Section style={detailsBox}>
          {universityName && (
            <Text style={detailRow}>
              <strong>University:</strong> {universityName}
            </Text>
          )}
          {courseName && (
            <Text style={detailRow}>
              <strong>Course:</strong> {courseName}
            </Text>
          )}
          <Text style={detailRow}>
            <strong>Previous Status:</strong> {formatStatus(oldStatus)}
          </Text>
          <Text style={statusRow}>
            <strong>New Status:</strong> <span style={statusHighlight}>{formatStatus(newStatus)}</span>
          </Text>
        </Section>

        {changedBy && (
          <Text style={meta}>Changed by: <strong>{changedBy}</strong></Text>
        )}

        <Hr style={hr} />

        {studentUrl && (
          <Button style={button} href={studentUrl}>
            View Student Details
          </Button>
        )}

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}. Please log in to your dashboard to review the update.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: EnrollmentStatusChangeEmail,
  subject: (data: Record<string, any>) =>
    `🔄 Status Update: ${data.studentName || 'Student'} → ${formatStatus(data.newStatus)} — EduForYou UK`,
  displayName: 'Enrollment status change notification',
  previewData: {
    studentName: 'John Smith',
    universityName: 'University of London',
    courseName: 'BSc Computer Science',
    oldStatus: 'processing',
    newStatus: 'final_offer',
    changedBy: 'Admin User',
    studentUrl: 'https://agentseduforyou.lovable.app/agent/students/example-id',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0' }
const badge = {
  backgroundColor: '#eff6ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  padding: '8px 16px',
  marginBottom: '20px',
  textAlign: 'center' as const,
}
const badgeText = { fontSize: '14px', fontWeight: '600' as const, color: '#2563eb', margin: '0' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const detailsBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderLeft: '4px solid #f97316',
  borderRadius: '6px',
  padding: '12px 16px',
  marginBottom: '16px',
}
const detailRow = { fontSize: '14px', color: '#1f2937', lineHeight: '1.5', margin: '0 0 6px' }
const statusRow = { fontSize: '14px', color: '#1f2937', lineHeight: '1.5', margin: '0' }
const statusHighlight = { color: '#f97316', fontWeight: '700' as const }
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
