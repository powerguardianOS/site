export type FaqItem = { q: string; a: string };
export type FaqSection = { title: string; items: FaqItem[] };

export const FAQ: FaqSection[] = [
  {
    title: "Controller",
    items: [
      { q: "What hardware is required?", a: "The Controller runs on NanoPi R3S or Neo3 — compact ARM boards around €30. Any Linux ARM device with 512 MB RAM works." },
      { q: "How does the Controller discover devices?", a: "It uses LLDP (Link Layer Discovery Protocol) to automatically detect PowerGuardian Connectors and other network devices on your subnet — no manual IP configuration needed." },
      { q: "How are credentials stored?", a: "All secrets are stored in an encrypted vault using PBKDF2-SHA256 with 600,000 iterations (OWASP/NIST compliant). SNMP community strings and NUT passwords are encrypted at rest." },
      { q: "How do updates work?", a: "The Controller is the master of updates, like the controller in a UniFi network. It fetches signed releases from PowerGuardian's update channel (stable or beta), verifies them, and hands them to its Connectors. A Connector checks the signature again before it installs anything and never downloads updates by itself, so it also updates on a network without internet. A new Connector is brought up to date when you adopt it. A release that does not start properly is rolled back automatically." },
      { q: "Can I manage multiple locations?", a: "Yes. The Controller supports multi-site configurations — group Connectors by physical location and apply site-specific alert rules and thresholds." },
    ],
  },
  {
    title: "Connector",
    items: [
      { q: "What is a Connector and where does it run?", a: "The PowerGuardian Connector: a lightweight agent on the Connector hardware (NanoPi Neo3) or an x86 Linux machine, placed next to your UPS. It bridges your physical UPS to the Controller." },
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
      { q: "What happens if my license ends?", a: "Your Controller keeps running locally and keeps protecting your equipment: the shutdown protection never stops. The license status changes to expired and cloud features (remote access, cloud sync) pause until you renew. Online purchase is not open yet; contact us to renew." },
    ],
  },
];
