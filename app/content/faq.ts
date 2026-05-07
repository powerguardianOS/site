export type FaqItem = { q: string; a: string };
export type FaqSection = { title: string; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  {
    title: "Controller",
    items: [
      { q: "What hardware is required?", a: "The Controller runs on NanoPi R3S or Neo3 — compact ARM boards around €30. Any Linux ARM device with 512 MB RAM works." },
      { q: "How does the Controller discover devices?", a: "It uses LLDP (Link Layer Discovery Protocol) to automatically detect PowerGuardian Connectors and other network devices on your subnet — no manual IP configuration needed." },
      { q: "How are credentials stored?", a: "All secrets are stored in an encrypted vault using PBKDF2-SHA256 with 600,000 iterations (OWASP/NIST compliant). SNMP community strings and NUT passwords are encrypted at rest." },
      { q: "How do OTA updates work?", a: "Push a new binary from the Controller dashboard to all connected Connectors in one click. The agent downloads it, replaces itself, and restarts automatically." },
      { q: "Can I manage multiple locations?", a: "Yes. The Controller supports multi-site configurations — group Connectors by physical location and apply site-specific alert rules and thresholds." },
    ],
  },
  {
    title: "Connector",
    items: [
      { q: "What is a Connector and where does it run?", a: "A lightweight Go agent that runs on any Linux device — Raspberry Pi Zero, router, or switch. It bridges your physical UPS to the Controller." },
      { q: "Which UPS protocols are supported?", a: "NUT (Network UPS Tools) for USB/serial UPS devices, and SNMP RFC 1628 for enterprise networked UPS systems." },
      { q: "How does it communicate with the Controller?", a: "Via a persistent WebSocket connection for real-time telemetry streaming and instant shutdown command execution." },
      { q: "Does it need a static IP?", a: "No. LLDP discovery and WebSocket heartbeats let the Controller track the Connector even when the IP changes via DHCP." },
      { q: "What happens if the connection drops?", a: "The Connector buffers critical events locally and reconnects using exponential backoff. No data is lost during brief network interruptions." },
    ],
  },
  {
    title: "Cloud & Licensing",
    items: [
      { q: "How do I log in?", a: "Passwordless magic-link login. Enter your email, click the link we send you — no password needed, ever." },
      { q: "How does the cloud connect to my local Controller?", a: "Via Cloudflare Tunnel — a secure outbound-only connection. No open ports or firewall rules required on your side." },
      { q: "How do I link my license to the Controller?", a: "Go to Settings → License in the Controller UI, click Link License, enter your email, and enter the 6-digit code we email you." },
      { q: "What happens if my subscription ends?", a: "Your Controller keeps running locally — nothing breaks immediately. The license status changes to expired and you can renew at any time from the pricing page." },
    ],
  },
];
