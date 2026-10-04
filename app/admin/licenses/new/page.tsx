import NewLicenseForm from './NewLicenseForm';

export const runtime = 'edge';

export default async function NewLicensePage({ searchParams }: { searchParams: Promise<{ email?: string }> }) {
  const { email = '' } = await searchParams;
  return <NewLicenseForm initialEmail={email.trim().toLowerCase()} />;
}
