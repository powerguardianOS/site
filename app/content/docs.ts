export type DocSection = { title: string; body: string };
export type DocPage = { slug: string; title: string; intro: string; sections: DocSection[] };

export const DOCS: DocPage[] = [
  {
    slug: "controller",
    title: "Controller",
    intro: "The Controller is the central hub of your PowerGuardian setup. It runs on a NanoPi R3S or Neo3 and manages all Connectors, UPS monitoring, alerts, and your encrypted vault.",
    sections: [
      {
        title: "Features",
        body: "• LLDP discovery — auto-detects Connectors on your local subnet\n• Encrypted vault — PBKDF2-SHA256 (600k iterations) for all secrets\n• Multi-site support — group Connectors by physical location\n• Alert rules — custom triggers on battery %, load %, or status changes\n• OTA updates — push new Connector binaries from the dashboard\n• TOTP MFA — hardware-grade 2FA for the admin interface\n• Cloudflare Tunnel — secure remote access without port forwarding\n• SNMP RFC 1628 — enterprise UPS protocol support\n• Built-in NUT connector — monitor a local USB UPS without a separate agent",
      },
      {
        title: "Getting Started",
        body: "1. Flash the PowerGuardian controller image to your NanoPi\n2. Open http://nanopi.local:9090 in your browser\n3. Complete the setup wizard — set admin password, configure network\n4. Enable LLDP scanning to discover Connectors automatically\n5. Add your first UPS under Devices → Add New\n6. Set up alert rules under Alerts → New Rule",
      },
      {
        title: "Linking Your License",
        body: "1. Log in at powerguardian.cloud/account\n2. Copy your license token from the Account portal\n3. In the Controller: Settings → License → Link License\n4. Enter your email address\n5. Enter the 6-digit code sent to your email\n6. Your Controller is now license-verified",
      },
    ],
  },
  {
    slug: "connector",
    title: "Connector OS",
    intro: "The Connector is a lightweight Go agent that runs on network-connected devices and bridges your UPS hardware to the Controller via WebSocket.",
    sections: [
      {
        title: "Features",
        body: "• NUT protocol — USB/serial UPS via Network UPS Tools\n• SNMP RFC 1628 — enterprise networked UPS systems\n• WebSocket streaming — real-time telemetry to the Controller\n• Auto-reconnect — exponential backoff on connection loss, no data loss\n• OTA self-update — replaces its own binary on command from the Controller\n• LLDP beacon — announces itself to the Controller automatically\n• Encrypted vault communication — all tokens encrypted in transit",
      },
      {
        title: "Installation",
        body: "1. Flash the Connector OS image to the SD card (or eMMC) and boot the Connector next to your UPS\n2. Log in over SSH with the factory login: pgadmin / powerguardian\n3. Point it at your Controller: set-inform https://your-controller\n4. The Connector appears as pending in the Controller. Click Adopt\n5. The Controller sends the device password and SSH keys you chose in the setup wizard. The factory login stops working, and the Connector brings itself up to date\n\nSettings → Device SSH changes the password, keys and SSH on/off for all Connectors at once. A Connector that was offline gets the change when it reconnects.",
      },
      {
        title: "Supported Hardware",
        body: "• Connector: PowerGuardian Connector hardware (NanoPi Neo3), or an x86_64 Linux machine for evaluation\n• Controller: NanoPi R3S, or an x86_64 machine for evaluation\n\nBoth run PowerGuardian OS images that update themselves through the Controller.",
      },
    ],
  },
  {
    slug: "cloud",
    title: "Cloud & Licensing",
    intro: "The PowerGuardian cloud handles license management, passwordless authentication, and your account portal at powerguardian.cloud.",
    sections: [
      {
        title: "How It Works",
        body: "Online purchase is not open yet: a Home or Pro license is created for your email address by PowerGuardian, and you receive a welcome email with setup instructions. Log in at powerguardian.cloud with your email — no password needed. Your license token is shown in the Account portal and is used to activate your Controller.",
      },
      {
        title: "Magic-Link Login",
        body: "1. Go to powerguardian.cloud/login\n2. Enter your email address\n3. Click the link in the email we send you (valid 15 minutes)\n4. You're logged in — session lasts 24 hours\n\nNo passwords to remember. No OAuth. Just your email.",
      },
      {
        title: "Plans",
        body: "Home — €2.99/month or €25/year\n• 1 Connector included\n• Single site\n• All core features\n\nPro — €9.99/month or €99/year\n• 5 Connectors included\n• Multi-site support\n• All core features\n\nAdd-on Connector — €2.99/month or €25 one-time\n• Add one extra connector to any existing plan",
      },
    ],
  },
];
