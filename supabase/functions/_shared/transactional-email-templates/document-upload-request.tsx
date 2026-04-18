import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface DocumentUploadRequestProps {
  studentName?: string
  agentName?: string
  uploadUrl?: string
  docTypes?: string[]
  message?: string
}

const DocumentUploadRequestEmail = ({
  studentName, agentName, uploadUrl, docTypes, message,
}: DocumentUploadRequestProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Please upload your documents — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>📎 Documents Required</Text>
        </Section>

        <Text style={text}>
          Dear <strong>{studentName || 'Student'}</strong>,
        </Text>

        <Text style={text}>
          Your agent <strong>{agentName || SITE_NAME}</strong> has requested the following documents to proceed with your university application:
        </Text>

        {docTypes && docTypes.length > 0 && (
          <Section style={listBox}>
            {docTypes.map((d) => (
              <Text key={d} style={listItem}>• {d}</Text>
            ))}
          </Section>
        )}

        {message && (
          <Section style={messageBox}>
            <Text style={messageLabel}>Message from your agent:</Text>
            <Text style={messageText}>{message}</Text>
          </Section>
        )}

        <Text style={text}>
          Click the button below to securely upload your documents directly into our platform. The link will expire in 14 days.
        </Text>

        <Hr style={hr} />

        {uploadUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={button} href={uploadUrl}>
              Upload Documents
            </Button>
          </Section>
        )}

        <Text style={meta}>
          If the button doesn't work, copy and paste this link into your browser:
        </Text>
        {uploadUrl && (
          <Text style={linkText}>{uploadUrl}</Text>
        )}

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated email from {SITE_NAME}. If you did not expect this email, please contact your agent directly.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: DocumentUploadRequestEmail,
  subject: '📎 Please upload your documents — EduForYou UK',
  displayName: 'Document upload request',
  previewData: {
    studentName: 'John Smith',
    agentName: 'Jane Agent',
    uploadUrl: 'https://agents-eduforyou.co.uk/upload-documents/example-token',
    docTypes: ['Passport', 'Transcript', 'Proof of Address'],
    message: 'Please make sure your passport scan is in colour and clearly readable.',
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
const listBox = { backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }
const listItem = { fontSize: '14px', color: '#0a1628', margin: '4px 0' }
const messageBox = { backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '12px 16px', margin: '0 0 16px' }
const messageLabel = { fontSize: '12px', fontWeight: '600' as const, color: '#92400e', margin: '0 0 4px' }
const messageText = { fontSize: '13px', color: '#451a03', margin: '0', lineHeight: '1.5' }
const meta = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }
const linkText = { fontSize: '12px', color: '#2563eb', wordBreak: 'break-all' as const, margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const button = {
  backgroundColor: '#0a1628',
  color: '#ffffff',
  fontSize: '16px',
  fontWeight: '600' as const,
  borderRadius: '8px',
  padding: '14px 32px',
  textDecoration: 'none',
  textAlign: 'center' as const,
  display: 'inline-block',
}
const footer = { fontSize: '12px', color: '#9ca3af', margin: '24px 0 0', lineHeight: '1.5' }
