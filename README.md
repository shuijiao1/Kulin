# Kulin

**中文** | [English](README.en.md)

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin-blue?style=flat-square)
![License](https://img.shields.io/github/license/shuijiao1/Kulin?style=flat-square)

> **Kulin** 是基于 [Nezha](https://github.com/nezhahq/nezha) fork 的精简服务器探针面板，保留常用服务器监控、延迟监控、告警和 Telegram 通知，并从后台源码与构建产物中移除复杂运维入口。

---

## 🎯 核心特性

- 服务器状态监控：在线状态、CPU、内存、硬盘、负载、运行时间、系统、架构、虚拟化、IP/地区
- 网络速率、总流量和周期流量展示
- ICMP Ping / TCPing 延迟监控
- 离线、资源、流量告警
- Telegram 通知
- 登录、用户管理、服务器排序、隐藏、账单备注和 Agent 安装命令
- 基于 Nezha Agent / 数据模型，适合从 Nezha 迁移或自部署

---

## 🧹 精简内容

Kulin 从后台源码、路由和构建产物中移除这些复杂功能入口：

- Web Terminal / 文件管理
- 计划任务 / Cron
- DDNS / NAT / 服务器配置面板
- 服务器分组 / 通知分组
- OAuth / 在线用户管理
- 复杂多通知渠道和主题市场

---

## 🚀 Docker Compose 部署

> 推荐使用 Docker Compose。首次安装默认管理员为 `admin / admin`，上线后请立刻修改密码。

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

反向代理时，请保留 `/proto.NezhaService/*` 的 h2c 转发给 Dashboard 端口，否则 Agent 无法稳定回连。

---

## ⚙️ Agent 接入

在面板中复制 Agent 安装命令。Agent 侧建议保持远程命令执行关闭：

```yaml
server: example.com:443
tls: true
disable_command_execute: true
```

如果从 Nezha 迁移，请保留原服务器 UUID，避免生成重复机器记录。

---

## 🛠 本地构建

```bash
go test ./model ./service/singleton ./service/rpc
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o dist/dashboard-linux-amd64 ./cmd/dashboard
docker compose build dashboard
```

---

## 🔐 隐私说明

Kulin 不内置公开服务配置，也不会包含你的运行数据库。请不要把 `data/config.yaml`、`data/sqlite.db`、TSDB 数据或 Agent secret 提交到公开仓库。

---

## 📄 License

沿用上游 Nezha 的开源许可证。详见 [LICENSE](LICENSE)。
