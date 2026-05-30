# Kulin

[中文](README.md) | **English**

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin-dashboard-blue?style=flat-square)
![License](https://img.shields.io/github/license/shuijiao1/Kulin?style=flat-square)

> **Kulin** is a slim server probe dashboard forked from [Nezha](https://github.com/nezhahq/nezha). It targets lightweight self-hosting: common server monitoring, latency checks, alerts, and Telegram notifications are kept, complex ops entries are removed, and practical branding/theme options are added for personal dashboards.

---

## 🎯 Features

- Server status: online state, CPU, memory, disk, load, uptime, OS, arch, virtualization, IP/region
- Network speed, total traffic, and cycle transfer display
- ICMP Ping / TCPing latency monitoring
- Offline, resource, and traffic alerts
- Telegram notifications
- Login, user management, server sorting, hiding, billing notes, and Agent install commands
- Based on Nezha Agent/data model, suitable for migration or self-hosting

---

## ➕ Added / Kept

Kulin keeps the dashboard lightweight while adding practical self-hosting settings:

- Default site name is **哪吒探针**; the admin settings page provides a dedicated site-name field
- Logo/avatar URL can be configured in the admin panel; when empty, the frontend uses the bundled official default icon
- Desktop background and mobile background URLs can be configured separately
- Frontend custom code and dashboard custom code are kept
- Frontend theme effect selector: default theme / Gaussian blur theme
- Settings updates preserve existing theme, logo, and background values; they are cleared only when explicitly emptied in the admin panel
- Docker image updates do not overwrite `data/config.yaml`, the database, or history files stored in the mounted data directory

---

## 🧹 Removed / Slimmed Down

Kulin removes these complex or less commonly used entries from the admin source, routes, and build output:

- Web Terminal / file manager
- Scheduled tasks / Cron
- DDNS / NAT / server config panel
- Server groups / notification groups
- OAuth / online user management
- Complex notification channels
- Theme marketplace and unnecessary external theme entries
- Personal default branding such as the Shuijiao avatar and “水饺的探针” default name

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

## ⚙️ Settings

- **Site name**: editable in the admin settings page; fresh or empty configs default to `哪吒探针`
- **Avatar / Logo URL**: optional; when empty, the frontend displays the bundled official default icon
- **Background URL**: desktop background image, optional
- **Mobile background URL**: mobile background image, optional
- **Frontend theme effect**: default theme or Gaussian blur theme
- **Custom code**: separate fields for frontend and dashboard custom code

> Updating the image or recreating the container will not rewrite these settings as long as the `./data:/dashboard/data` mount is preserved.

---

## ⚙️ Agent

Copy the Agent installation command from the panel. Keeping remote command execution disabled on the Agent side is recommended:

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
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o dist/kulin-dashboard-linux-amd64 ./cmd/dashboard
docker compose build dashboard
```

---

## 🔐 Privacy

Kulin does not ship your runtime database or private config. Do not commit `data/config.yaml`, `data/sqlite.db`, TSDB files, or Agent secrets to public repositories.

---

## 📄 License

Kulin follows the upstream Nezha license. See [LICENSE](LICENSE).
