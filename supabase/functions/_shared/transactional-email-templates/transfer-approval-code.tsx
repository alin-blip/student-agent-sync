import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface TransferApprovalCodeProps {
  approverName?: string
  requesterName?: string
  studentName?: string
  fromUniversity?: string
  fromCourse?: string
  toUniversity?: string
  toCourse?: string
  code?: string
}

const TransferApprovalCodeEmail = ({
  approverName, requesterName, studentName,
  fromUniversity, fromCourse, toUniversity, toCourse, code,
}: TransferApprovalCodeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Transfer approval code — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🔄 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>Transfer Approval Required</Text>
        </Section>

        <Text style={text}>
          Dear <strong>{approverName || 'Approver'}</strong>,
        </Text>

        <Text style={text}>
          <strong>{requesterName || 'A team member'}</strong> is requesting to transfer student <strong>{studentName || 'Unknown'}</strong>:
        </Text>

        <Section style={detailBox}>
          <Text style={detailText}>
            <strong>From:</strong> {fromUniversity || 'Unknown'} — {fromCourse || 'Unknown'}
          </Text>
          <Text style={detailText}>
            <strong>To:</strong> {toUniversity || 'Unknown'} — {toCourse || 'Unknown'}
          </Text>
        </Section>

        <Text style={text}>
          If you approve this transfer, please share the following code:
        </Text>

        <Section style={codeBox}>
          <Text style={codeText}>{code || '------'}</Text>
        </Section>

        <Text style={meta}>
          Do not share this code if you do not approve the transfer.
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: TransferApprovalCodeEmail,
  subject: '🔄 Transfer approval code — EduForYou UK',
  displayName: 'Transfer approval code',
  previewData: {
    approverName: 'John Owner',
    requesterName: 'Jane Agent',
    studentName: 'Alex Student',
    fromUniversity: 'Regent University',
    fromCourse: 'Business Management',
    toUniversity: 'GBS University',
    toCourse: 'Accounting & Finance',
    code: 'T3R5F9',
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
const detailBox = {
  backgroundColor: '#f9fafb',
  border: '1px solid #e5e7eb',
  borderRadius: '8px',
  padding: '12px 16px',
  marginBottom: '16px',
}
const detailText = { fontSize: '13px', color: '#374151', margin: '0 0 4px' }
const meta = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px', textAlign: 'center' as const }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const codeBox = {
  backgroundColor: '#f3f4f6',
  border: '2px dashed #d1d5db',
  borderRadius: '12px',
  padding: '20px',
  textAlign: 'center' as const,
  margin: '16px 0',
}
const codeText = {
  fontSize: '32px',
  fontWeight: 'bold' as const,
  letterSpacing: '6px',
  color: '#111827',
  margin: '0',
  fontFamily: 'monospace',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', lineHeight: '1.5' }
