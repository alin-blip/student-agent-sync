import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'

interface NewLeadNotificationProps {
  leadName?: string
  leadEmail?: string
  leadPhone?: string
  nationality?: string
  courseInterest?: string
  leadsUrl?: string
}

const NewLeadNotificationEmail = ({
  leadName, leadEmail, leadPhone, nationality, courseInterest, leadsUrl,
}: NewLeadNotificationProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>New lead: {leadName || 'Someone'} has submitted an application</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Section style={badge}>
          <Text style={badgeText}>🆕 New Lead Submitted</Text>
        </Section>

        <Text style={text}>
          A new student lead has been submitted through your application form.
        </Text>

        <Section style={detailsBox}>
          <Text style={detailRow}><strong>Name:</strong> {leadName || 'N/A'}</Text>
          <Text style={detailRow}><strong>Email:</strong> {leadEmail || 'N/A'}</Text>
          {leadPhone && <Text style={detailRow}><strong>Phone:</strong> {leadPhone}</Text>}
          {nationality && <Text style={detailRow}><strong>Nationality:</strong> {nationality}</Text>}
          {courseInterest && <Text style={detailRow}><strong>Course Interest:</strong> {courseInterest}</Text>}
        </Section>

        <Hr style={hr} />

        {leadsUrl && (
          <Button style={button} href={leadsUrl}>
            View Leads
          </Button>
        )}

        <Text style={footer}>
          This is an automated notification from {SITE_NAME}. Log in to your dashboard to follow up with this lead.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: NewLeadNotificationEmail,
  subject: (data: Record<string, any>) =>
    `🆕 New Lead: ${data.leadName || 'New Application'} — EduForYou UK`,
  displayName: 'New lead notification',
  previewData: {
    leadName: 'Jane Doe',
    leadEmail: 'jane@example.com',
    leadPhone: '+44 7700 900000',
    nationality: 'Nigerian',
    courseInterest: 'University of London — BSc Computer Science',
    leadsUrl: 'https://agentseduforyou.lovable.app/agent/leads',
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
