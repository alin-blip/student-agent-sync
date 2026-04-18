import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface NewStudentAssignedProps {
  studentName?: string
  universityName?: string
  courseName?: string
  agentName?: string
  studentUrl?: string
}

const NewStudentAssignedEmail = ({
  studentName, universityName, courseName, agentName, studentUrl,
}: NewStudentAssignedProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New Student Enrolled: {studentName || 'Student'} — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>🆕 New Student Enrolled</Text>
        </Section>

        <Text style={text}>
          {agentName ? `${agentName} has` : 'An agent has'} enrolled a new student: <strong>{studentName || 'Unknown'}</strong>.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}>
            <strong>Student:</strong> {studentName || 'N/A'}
          </Text>
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
          {agentName && (
            <Text style={detailRow}>
              <strong>Enrolled by:</strong> {agentName}
            </Text>
          )}
        </Section>

        <Hr style={hr} />

        {studentUrl && (
          <Button style={button} href={studentUrl}>
            View Student Details
          </Button>
        )}

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}. Please log in to your dashboard to review.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewStudentAssignedEmail,
  subject: (data: Record<string, any>) =>
    `🆕 New Student: ${data.studentName || 'Student'} — EduForYou UK`,
  displayName: 'New student enrolled notification',
  previewData: {
    studentName: 'John Smith',
    universityName: 'University of London',
    courseName: 'BSc Computer Science',
    agentName: 'Agent Sarah',
    studentUrl: 'https://agentseduforyou.lovable.app/owner/students/example-id',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0' }
const badge = {
  backgroundColor: '#ecfdf5',
  border: '1px solid #a7f3d0',
  borderRadius: '8px',
  padding: '8px 16px',
  marginBottom: '20px',
  textAlign: 'center' as const,
}
const badgeText = { fontSize: '14px', fontWeight: '600' as const, color: '#059669', margin: '0' }
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
