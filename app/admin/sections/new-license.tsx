import NewLicenseForm from './NewLicenseForm';

export default function NewLicensePage({ searchParams }: { searchParams: { email?: string } }) {
  const { email = '' } = searchParams;
  return <NewLicenseForm initialEmail={email.trim().toLowerCase()} />;
}
