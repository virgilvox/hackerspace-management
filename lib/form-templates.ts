// Code-defined starter templates for the form builder. No table: choosing a
// template just prefills builder state. Keep field keys valid
// (/^[a-z0-9_]+$/) and shapes aligned with formFieldSchema.
import type { FormField } from './forms-schema'

export interface FormTemplate {
  id: string
  name: string
  blurb: string
  kind: 'form' | 'waiver'
  legal_text: string
  schema: FormField[]
}

export const FORM_TEMPLATES: FormTemplate[] = [
  {
    id: 'blank',
    name: 'Blank',
    blurb: 'Start from scratch.',
    kind: 'form',
    legal_text: '',
    schema: [],
  },
  {
    id: 'liability_waiver',
    name: 'Liability waiver',
    blurb: 'Signed acknowledgement of risk for tools/space use.',
    kind: 'waiver',
    legal_text:
      'I acknowledge that use of the space, its tools, and equipment carries inherent risks. I agree to follow all posted rules and training requirements, and I release the space, its operators, and its volunteers from liability for injury or loss to the fullest extent permitted by law.',
    schema: [
      { key: 'full_name', type: 'short_text', label: 'Full legal name', required: true },
      { key: 'email', type: 'email', label: 'Email', required: true },
      { key: 'emergency_contact', type: 'short_text', label: 'Emergency contact (name & phone)', required: true },
      { key: 'date', type: 'date', label: 'Date', required: true },
    ],
  },
  {
    id: 'membership_application',
    name: 'Membership application',
    blurb: 'Collect applicant details for a new member.',
    kind: 'form',
    legal_text: '',
    schema: [
      { key: 'full_name', type: 'short_text', label: 'Full name', required: true },
      { key: 'email', type: 'email', label: 'Email', required: true },
      { key: 'phone', type: 'short_text', label: 'Phone', required: false },
      { key: 'interests', type: 'long_text', label: 'What do you want to work on?', required: false },
      {
        key: 'tier',
        type: 'select',
        label: 'Membership tier',
        required: true,
        options: ['Plus', 'Basic', 'Associate'],
      },
      { key: 'agree_coc', type: 'checkbox', label: 'I agree to the code of conduct', required: true },
    ],
  },
  {
    id: 'event_rsvp',
    name: 'Event RSVP',
    blurb: 'Headcount and details for an event.',
    kind: 'form',
    legal_text: '',
    schema: [
      { key: 'name', type: 'short_text', label: 'Name', required: true },
      { key: 'email', type: 'email', label: 'Email', required: true },
      { key: 'guests', type: 'number', label: 'Number of guests', required: false },
      {
        key: 'attending',
        type: 'radio',
        label: 'Will you attend?',
        required: true,
        options: ['Yes', 'No', 'Maybe'],
      },
    ],
  },
  {
    id: 'photo_release',
    name: 'Photo / media release',
    blurb: 'Consent to use photos taken at the space.',
    kind: 'waiver',
    legal_text:
      'I grant permission for photographs and recordings taken of me at the space to be used by the organization for documentation and promotional purposes. I understand I may withdraw this consent in writing at any time for future use.',
    schema: [
      { key: 'full_name', type: 'short_text', label: 'Full name', required: true },
      { key: 'email', type: 'email', label: 'Email', required: true },
      { key: 'consent_scope', type: 'radio', label: 'Permitted use', required: true, options: ['All uses', 'Internal only'] },
      { key: 'date', type: 'date', label: 'Date', required: true },
    ],
  },
]
