import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface RegentApplicationLinkProps {
  studentName?: string
  agentName?: string
  applicationUrl?: string
}

const RegentApplicationLinkEmail = ({
  studentName, agentName, applicationUrl,
}: RegentApplicationLinkProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Complete your Regent University application — {SITE_NAME}</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>📋 Regent University — Application Form</Text>
        </Section>

        <Text style={text}>
          Dear <strong>{studentName || 'Student'}</strong>,
        </Text>

        <Text style={text}>
          Your agent <strong>{agentName || SITE_NAME}</strong> has sent you the application form for Regent University. Please complete this form as soon as possible to proceed with your enrolment.
        </Text>

        <Text style={text}>
          Click the button below to open and complete the application form.
        </Text>

        <Hr style={hr} />

        {applicationUrl && (
          <Section style={{ textAlign: 'center' as const, margin: '24px 0' }}>
            <Button style={button} href={applicationUrl}>
              Complete Application Form
            </Button>
          </Section>
        )}

        <Text style={meta}>
          If the button doesn't work, copy and paste this link into your browser:
        </Text>
        {applicationUrl && (
          <Text style={linkText}>{applicationUrl}</Text>
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
  component: RegentApplicationLinkEmail,
  subject: '📋 Complete your Regent University application — EduForYou UK',
  displayName: 'Regent application link',
  previewData: {
    studentName: 'John Smith',
    agentName: 'Jane Agent',
    applicationUrl: 'https://forms.office.com/Pages/ResponsePage.aspx?id=example',
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
const meta = { fontSize: '12px', color: '#6b7280', margin: '0 0 8px' }
const linkText = { fontSize: '12px', color: '#2563eb', wordBreak: 'break-all' as const, margin: '0 0 16px' }
const hr = { borderColor: '#e5e7eb', margin: '20px 0' }
const button = {
  backgroundColor: '#2563eb',
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
