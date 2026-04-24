import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Flexible pricing plans for PowerGuardian. Home €5/mo, Pro €15/mo, Enterprise custom, Lifetime one-time. Self-hosted with no vendor lock-in.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
