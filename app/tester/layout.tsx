import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Become a tester",
  description: "Test PowerGuardian on your own hardware: Pro free during the beta, and a direct line to the maker.",
};

export default function TesterLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
