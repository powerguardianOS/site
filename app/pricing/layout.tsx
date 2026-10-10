import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description: "Flexible pricing plans for PowerGuardian. Home €2.99/mo, Pro €9.99/mo. Your data stays on your own Controller, with no vendor lock-in.",
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
