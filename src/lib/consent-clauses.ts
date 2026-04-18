export interface ConsentClause {
  id: string;
  title: string;
  text: string;
  bullets?: string[];
  isMarketing?: boolean;
}

export interface MarketingOption {
  id: string;
  label: string;
  exclusive?: string; // id of the option this is mutually exclusive with
  required?: boolean; // pre-selected and locked
}

export const CONSENT_CLAUSES: ConsentClause[] = [
  {
    id: "role_purpose",
    title: "1. Role and Purpose",
    text: "The Student seeks guidance regarding higher education opportunities and Student Finance in the UK. EduForYou acts as an independent education consultancy providing guidance, application support, and administrative assistance.",
  },
  {
    id: "student_responsibilities",
    title: "2. Student Responsibilities",
    text: "The Student agrees to:",
    bullets: [
      "Provide accurate, complete, and truthful information",
      "Submit genuine and authentic documents only",
      "Attend interviews, tests, and required appointments",
      "Review and confirm all application details before submission",
      "Accept full responsibility for any incorrect or misleading information",
    ],
  },
  {
    id: "eduforyou_responsibilities",
    title: "3. EduForYou Responsibilities",
    text: "EduForYou agrees to:",
    bullets: [
      "Provide accurate and up-to-date information",
      "Assist with university and Student Finance applications",
      "Maintain confidentiality in accordance with UK GDPR",
      "Act in a professional and ethical manner",
    ],
  },
  {
    id: "authorisation",
    title: "4. Authorisation",
    text: "The Student authorises EduForYou to submit applications on their behalf and communicate with universities, colleges, and Student Finance England.",
  },
  {
    id: "data_protection",
    title: "5. Data Protection (UK GDPR)",
    text: "All personal data will be processed in accordance with UK GDPR. Data will only be shared with relevant institutions involved in the application process.",
  },
  {
    id: "no_guarantee",
    title: "6. No Guarantee Clause",
    text: "EduForYou does not guarantee university admission, visa approval, or Student Finance approval. Outcomes depend on eligibility and third-party decisions.",
  },
  {
    id: "commission_disclosure",
    title: "7. Commission Disclosure",
    text: "EduForYou may receive a commission or referral fee from partner institutions. This does not affect the impartiality of the advice provided to the Student.",
  },
  {
    id: "limitation_liability",
    title: "8. Limitation of Liability",
    text: "EduForYou is not liable for decisions made by universities or Student Finance, delays outside its control, or consequences of incorrect information provided by the student.",
  },
  {
    id: "document_authenticity",
    title: "9. Document Authenticity & Liability",
    text: "EduForYou does not verify the authenticity of documents provided. The Student is fully responsible for the legality and accuracy of all documents submitted.",
  },
  {
    id: "withdrawal_termination",
    title: "10. Withdrawal & Termination",
    text: "The Student may withdraw at any time. EduForYou is not responsible for any outcomes resulting from withdrawal or incomplete applications.",
  },
  {
    id: "confidentiality",
    title: "11. Confidentiality",
    text: "All information shared will remain confidential and used solely for application purposes.",
  },
  {
    id: "marketing",
    title: "12. Marketing & Third-Party Consent",
    text: "Please indicate your preferences below:",
    isMarketing: true,
  },
  {
    id: "declaration",
    title: "13. Declaration",
    text: "I confirm that I have read, understood, and agree to the terms outlined in this document.",
  },
];

export const MARKETING_OPTIONS: MarketingOption[] = [
  { id: "contact_consent", label: "I consent to being contacted by EduForYou", required: true },
  { id: "data_sharing_consent", label: "I consent to data sharing with partner institutions", required: true },
  { id: "marketing_yes", label: "I consent to receiving marketing communications", exclusive: "marketing_no", required: true },
  { id: "marketing_no", label: "I do NOT consent to marketing communications", exclusive: "marketing_yes" },
];

export const DEFAULT_MARKETING_CHECKS: Record<string, boolean> = Object.fromEntries(
  MARKETING_OPTIONS.filter((o) => o.required).map((o) => [o.id, true])
);
