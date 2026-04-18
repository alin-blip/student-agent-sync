import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface AdminDeleteCodeProps {
  ownerName?: string
  adminName?: string
  entityType?: string
  code?: string
}

const AdminDeleteCodeEmail = ({
  ownerName, adminName, entityType, code,
}: AdminDeleteCodeProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Delete confirmation code — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🔐 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>⚠️ Delete Confirmation Required</Text>
        </Section>

        <Text style={text}>
          Dear <strong>{ownerName || 'Owner'}</strong>,
        </Text>

        <Text style={text}>
          Admin <strong>{adminName || 'An admin'}</strong> is requesting permission to delete a <strong>{entityType || 'document'}</strong>.
        </Text>

        <Text style={text}>
          If you approve this deletion, please share the following code with the admin:
        </Text>

        <Section style={codeBox}>
          <Text style={codeText}>{code || '------'}</Text>
        </Section>

        <Text style={meta}>
          This code expires in 15 minutes. Do not share it if you do not approve the deletion.
        </Text>

        <Hr style={hr} />

        <Text style={footer}>
          This is an automated security notification from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: AdminDeleteCodeEmail,
  subject: '🔐 Delete confirmation code — EduForYou UK',
  displayName: 'Admin delete confirmation code',
  previewData: {
    ownerName: 'John Owner',
    adminName: 'Jane Admin',
    entityType: 'document',
    code: 'A1B2C3',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0' }
const badge = {
  backgroundColor: '#fef2f2',
  border: '1px solid #fecaca',
  borderRadius: '8px',
  padding: '8px 16px',
  marginBottom: '20px',
  textAlign: 'center' as const,
}
const badgeText = { fontSize: '14px', fontWeight: '600' as const, color: '#dc2626', margin: '0' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
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
