import * as React from 'npm:react@18.3.1'
import {
  Body, Container, Head, Heading, Html, Preview, Text, Button, Section, Hr,
} from 'npm:@react-email/components@0.0.22'
import type { TemplateEntry } from './registry.ts'

const SITE_NAME = 'EduForYou UK'
const LOGIN_URL = 'https://agents-eduforyou.co.uk/login'

interface WelcomeAgentProps {
  agentName?: string
  adminName?: string
}

const WelcomeAgentEmail = ({ agentName, adminName }: WelcomeAgentProps) => (
  <Html lang="en" dir="ltr">
    <Head />
    <Preview>Welcome to {SITE_NAME} — your agent account is ready!</Preview>
    <Body style={main}>
      <Container style={container}>
        <Section style={header}>
          <Heading style={h1}>🎓 {SITE_NAME}</Heading>
        </Section>

        <Heading style={h2}>
          Welcome{agentName ? `, ${agentName}` : ''}! 🎉
        </Heading>

        <Text style={text}>
          Your agent account has been created{adminName ? ` by ${adminName}` : ''} and is ready to use.
          You can now log in to the platform to start managing students, enrollments, and more.
        </Text>

        <Section style={stepsBox}>
          <Text style={stepsTitle}>Getting started:</Text>
          <Text style={stepItem}>1️⃣ Log in with your email and the password provided</Text>
          <Text style={stepItem}>2️⃣ Complete your profile and upload a profile picture</Text>
          <Text style={stepItem}>3️⃣ Add your first student and begin enrollments</Text>
        </Section>

        <Hr style={hr} />

        <Button style={button} href={LOGIN_URL}>
          Log In to Your Dashboard
        </Button>

        <Text style={footer}>
          If you have any questions, please contact your administrator.
          This is an automated message from {SITE_NAME}.
        </Text>
      </Container>
    </Body>
  </Html>
)

export const template = {
  component: WelcomeAgentEmail,
  subject: 'Welcome to EduForYou UK — Your Agent Account is Ready!',
  displayName: 'Welcome email for new agents',
  previewData: {
    agentName: 'Sarah Johnson',
    adminName: 'Admin User',
  },
} satisfies TemplateEntry

const main = { backgroundColor: '#ffffff', fontFamily: 'Inter, Arial, sans-serif' }
const container = { padding: '20px 25px', maxWidth: '560px', margin: '0 auto' }
const header = { textAlign: 'center' as const, marginBottom: '20px' }
const h1 = { fontSize: '20px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0' }
const h2 = { fontSize: '22px', fontWeight: 'bold' as const, color: '#0a1628', margin: '0 0 16px' }
const text = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 16px' }
const stepsBox = {
  backgroundColor: '#f0f7ff',
  border: '1px solid #bfdbfe',
  borderRadius: '8px',
  padding: '16px 20px',
  marginBottom: '16px',
}
const stepsTitle = { fontSize: '14px', fontWeight: '600' as const, color: '#0a1628', margin: '0 0 8px' }
const stepItem = { fontSize: '14px', color: '#374151', lineHeight: '1.6', margin: '0 0 4px' }
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
