# PowerGuardian — Getting Started

## 1. Vereisten

- Linux server (Debian/Ubuntu aanbevolen)
- NUT (Network UPS Tools) geïnstalleerd en geconfigureerd
- Docker of systemd beschikbaar

## 2. Controller installeren

**Via Docker:**
```bash
docker run -d --name powerguardian \
  -p 8080:8080 \
  -v /data/powerguardian:/data \
  -e PG_VAULT_KEY=$(openssl rand -hex 32) \
  ghcr.io/powerguardianos/powerguardian-controller:latest
```

**Via systemd:** download de binary en plaats het meegeleverde `powerguardian.service` bestand in `/etc/systemd/system/`.

## 3. Eerste setup wizard

1. Open `http://<controller-host>:8080` in je browser.
2. Maak een administrator-account aan (gebruikersnaam + wachtwoord).
3. Klik op **Next** — de wizard scant direct naar connectors in het netwerk.

## 4. Connector installeren

**Automatisch (aanbevolen):**
```bash
curl -sSL https://powerguardian.cloud/install-remote.sh | bash
```

**Handmatig:**
1. Download `pg-agent` van de releases pagina.
2. Kopieer naar `/usr/local/bin/pg-agent` en maak het uitvoerbaar.
3. Stel de controller URL in: `pg-agent set-inform wss://<controller-host>/agent`
4. Start via systemd: `systemctl enable --now powerguardian-agent`

## 5. Connector adopteren

1. Ga naar **Connectors** in het dashboard.
2. De connector verschijnt onder **Pending** zodra hij verbinding maakt.
3. Klik op **Adopt** — de connector is nu actief.

## 6. UPS koppelen

1. Klik op de connector → **Settings**.
2. Vul **NUT host**, **NUT port** en **UPS name** in (standaard: `localhost`, `3493`, `ups`).
3. Sla op — de connector begint direct met het uitlezen van de UPS.

Dashboard toont nu live battery%, load%, runtime en status.
