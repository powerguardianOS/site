// Where people reach us (Business questions, support, roadmap ideas). One address for now, until hello@ exists.
export const CONTACT_EMAIL = 'royrijpma@gmail.com';
export const mailto = (subject?: string) => `mailto:${CONTACT_EMAIL}${subject ? `?subject=${encodeURIComponent(subject)}` : ''}`;
