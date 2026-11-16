import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a tester",
  description: "Join the PowerGuardian tester waitlist: Pro free during the beta, and a direct line to the maker. We invite in small groups.",
};

export default function TesterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
