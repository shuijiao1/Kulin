# Kulin

[中文](README.md) | **English**

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin-dashboard-blue?style=flat-square)
![License](https://img.shields.io/github/license/shuijiao1/Kulin?style=flat-square)

> **Kulin** is a lightweight server probe dashboard based on [Nezha](https://github.com/nezhahq/nezha). It keeps server monitoring, latency checks, alerts, and Telegram notifications, while removing heavier ops-platform features. It is designed for users who want a clean self-hosted monitoring panel.

---

## 🎯 Features

- Server status: online state, CPU, memory, disk, load, OS, arch, virtualization, IP / region
- Real-time network speed, total traffic, and cycle traffic display
- **Built-in traffic progress bars**, configurable from the server edit page
- ICMP Ping / TCPing latency monitoring
- Offline, resource, and traffic alerts
- Telegram notifications
- Server sorting, hiding, billing notes, and Agent install commands
- Frontend theme, logo, background, mobile background, and custom code settings
- Based on Nezha Agent / data model, making migration from Nezha straightforward

---

## ✨ What Kulin Changes Compared with Nezha

### A lighter dashboard

Kulin turns Nezha into a cleaner “probe display + basic alerts” dashboard. The admin panel has fewer entries and avoids features that are unnecessary for a small personal monitoring panel.

### Better for personal status pages

- Cleaner homepage focused on server status, traffic, latency, and service monitors
- Frontend theme effects, including a Gaussian blur style
- Custom logo, desktop background, and mobile background
- Frontend and dashboard custom code for small visual tweaks

### Traffic progress bars built into server settings

In upstream Nezha, cycle traffic display usually depends on alert-rule combinations. Kulin makes it a per-server setting:

- Configure cycle start day, traffic quota, and related options directly from the server edit page
- Show traffic progress bars directly on frontend server cards
- Keep legacy cycle-traffic settings where possible during migration

### Simpler notification and ops model

Kulin mainly keeps Telegram notifications and common alert scenarios, while reducing complex notification channels, groups, and permission-related configuration. It is easier to run for single-user or small-scale self-hosted setups.

### Independent releases and deployment

- Docker image: `ghcr.io/shuijiao1/kulin-dashboard`
- amd64 / arm64 release artifacts
- Docker Compose example for quick deployment

---

## 🧹 What Kulin Removes Compared with Nezha

Kulin removes features that are too heavy for a lightweight probe dashboard:

- Web Terminal / online terminal
- File manager
- Scheduled tasks / Cron
- DDNS
- NAT management
- Complex ops entries from the server settings panel
- Server groups
- Notification groups
- OAuth login / binding / config
- Online user management
- Server transfer admin entries
- Complex notification channels
- Theme marketplace and unnecessary external theme entries
- Extra sync workflows and dead code no longer used by the slimmed dashboard

---

## 🚀 Docker Compose

> Docker Compose is recommended. Fresh installs create `admin / admin`; change the password immediately after deployment.

```bash
mkdir -p /opt/kulin/data && cd /opt/kulin

cat > docker-compose.yml <<'YAML'
name: kulin-dashboard

services:
  dashboard:
    image: ghcr.io/shuijiao1/kulin-dashboard:latest
    container_name: kulin-dashboard
    restart: unless-stopped
    ports:
      - "8008:8008"
    volumes:
      - ./data:/dashboard/data
YAML

cat > data/config.yaml <<'YAML'
site_name: 哪吒探针
language: zh_CN
install_host: example.com:443
force_auth: false
listen_host: 0.0.0.0
listen_port: 8008
jwt_timeout: 168
agent_secret_key: change-me
location: Asia/Shanghai
user_template: user-dist
admin_template: admin-dist
logo_url: ""
background_url: ""
mobile_background_url: ""
tsdb:
  data_path: data/tsdb
  retention_days: 7
YAML

docker compose pull
docker compose up -d
docker compose logs -f
```

When using a reverse proxy, keep `/proto.NezhaService/*` proxied to the dashboard port via h2c, otherwise Agents may fail to connect reliably.

---

## ⚙️ Common Settings

- **Site name**: editable in the admin settings page
- **Logo / avatar**: optional image URL
- **Background**: separate desktop and mobile background URLs
- **Frontend theme effect**: default theme or Gaussian blur theme
- **Traffic progress bars**: configure cycle and quota from the server edit page
- **Custom code**: separate fields for frontend and dashboard custom code

---

## ⚙️ Agent

Copy the Agent installation command from the panel.

When migrating from Nezha, keep the original server UUID to avoid duplicate server records.

---

## 🛠 Local Build

```bash
go test ./model ./service/singleton ./service/rpc
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o dist/kulin-dashboard-linux-amd64 ./cmd/dashboard
docker compose build dashboard
```

---

## 🔐 Privacy

Kulin does not ship your runtime database or private config. Do not commit `data/config.yaml`, `data/sqlite.db`, TSDB files, or Agent secrets to public repositories.

---

## 📄 License

Kulin follows the upstream Nezha license. See [LICENSE](LICENSE).
