// Shared by the new-license form and the add-on form: how long a license runs.
export const TERMS = [
  { key: 'm1', label: '1 month (default)' },
  { key: 'm3', label: '3 months' },
  { key: 'y1', label: '1 year' },
  { key: 'never', label: 'Never expires' },
  { key: 'custom', label: 'Pick a date…' },
] as const;

export function termEnd(key: string): string | null {
  const d = new Date();
  if (key === 'm1') d.setMonth(d.getMonth() + 1);
  else if (key === 'm3') d.setMonth(d.getMonth() + 3);
  else if (key === 'y1') d.setFullYear(d.getFullYear() + 1);
  else return null;
  return d.toISOString();
}
