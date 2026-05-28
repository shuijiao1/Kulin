# Kulin

[中文](README.md) | **English**

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin-blue?style=flat-square)
![License](https://img.shields.io/github/license/shuijiao1/Kulin?style=flat-square)

> **Kulin** is a slim server probe dashboard forked from [Nezha](https://github.com/nezhahq/nezha). It keeps common monitoring, service checks, alerts, and Telegram notifications while removing complex ops features.

---

## 🎯 Features

- Server status: online state, CPU, memory, disk, load, uptime, OS, arch, virtualization, IP/region
- Network speed, total traffic, and cycle transfer display
- Ping / TCPing service monitoring
- Offline, resource, and traffic alerts
- Telegram notifications
- Login, user management, server sorting, hiding, notes, and Agent config
- Based on Nezha Agent/data model, suitable for migration or self-hosting

---

## 🧹 Removed / Disabled

Kulin disables and removes these complex features from the UI:

- Web Terminal / file manager
- Scheduled tasks / Cron
- DDNS / NAT / server transfer
- Server groups / notification groups
- OAuth / WAF / online user management
- Complex notification channels and theme marketplace

---

## 🚀 Docker Compose

> Docker Compose is recommended. Fresh installs create `admin / admin`; change the password immediately after deployment.

```bash
mkdir -p /opt/kulin/data && cd /opt/kulin

cat > docker-compose.yml <<'YAML'
name: kulin

services:
  dashboard:
    image: ghcr.io/shuijiao1/kulin:latest
    container_name: kulin-dashboard
    restart: unless-stopped
    ports:
      - "8008:8008"
    volumes:
      - ./data:/dashboard/data
YAML

cat > data/config.yaml <<'YAML'
site_name: Kulin
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

## ⚙️ Agent

Copy the Agent installation command from the panel, or make sure the Agent config includes:

```yaml
server: example.com:443
tls: true
disable_command_execute: true
```

When migrating from Nezha, keep the original server UUID to avoid duplicate server records.

---

## 🛠 Local Build

```bash
go test ./model ./service/singleton ./service/rpc
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o dist/dashboard-linux-amd64 ./cmd/dashboard
docker compose build dashboard
```

---

## 🔐 Privacy

Kulin does not ship your runtime database or private config. Do not commit `data/config.yaml`, `data/sqlite.db`, TSDB files, or Agent secrets to public repositories.

---

## 📄 License

Kulin follows the upstream Nezha license. See [LICENSE](LICENSE).
