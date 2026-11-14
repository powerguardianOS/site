import type { Metadata } from "next";
import { priceLine, VAT_NOTE } from "@/app/lib/pricing";

export const metadata: Metadata = {
  title: "Pricing",
  description: `PowerGuardian plans: ${priceLine("home")}, ${priceLine("pro")}. ${VAT_NOTE} Your data stays on your own Controller, with no vendor lock-in.`,
};

export default function PricingLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
