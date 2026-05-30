# Kulin

**中文** | [English](README.en.md)

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin-dashboard-blue?style=flat-square)
![License](https://img.shields.io/github/license/shuijiao1/Kulin?style=flat-square)

> **Kulin** 是基于 [Nezha](https://github.com/nezhahq/nezha) fork 的精简服务器探针面板，面向轻量自部署场景：保留常用监控、延迟监控、告警和 Telegram 通知，同时移除复杂运维入口，并加入更适合个人面板的主题与品牌设置。

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

## ➕ 新增

Kulin 在精简 Nezha 的同时，补充并保留了更适合自用面板的设置：

- 后台设置页可单独修改站点名称
- Logo / 头像链接可在后台设置
- 背景图、移动端背景图可在后台单独设置
- 新增前台主题效果选项：默认主题 / 高斯模糊主题
---

## 🧹 精简

Kulin 从后台源码、路由和构建产物中移除了这些复杂或不常用的入口，让面板更轻：

- Web Terminal / 文件管理
- 计划任务 / Cron
- DDNS / NAT / 服务器配置面板
- 服务器分组 / 通知分组
- OAuth / 在线用户管理
- 复杂多通知渠道
- 主题市场和不必要的外部主题入口

---

## 🚀 Docker Compose 部署

> 推荐使用 Docker Compose。首次安装默认管理员为 `admin / admin`，上线后请立刻修改密码。

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

反向代理时，请保留 `/proto.NezhaService/*` 的 h2c 转发给 Dashboard 端口，否则 Agent 无法稳定回连。

---

## ⚙️ 设置说明

- **站点名称**：后台设置页可修改；配置为空或新安装时默认显示 `哪吒探针`
- **头像 / Logo 链接**：可留空；留空时前台显示内置官方默认头像
- **背景链接**：桌面端背景图，可留空
- **移动端背景链接**：移动端背景图，可留空
- **前台主题效果**：可选择默认主题或高斯模糊主题
- **自定义代码**：可分别配置前台和后台自定义代码

> 更新镜像或重建容器不会自动改写这些配置；请确保 `./data:/dashboard/data` 挂载保持不变。

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
CGO_ENABLED=1 go build -trimpath -ldflags='-s -w' -o dist/kulin-dashboard-linux-amd64 ./cmd/dashboard
docker compose build dashboard
```

---

## 🔐 隐私说明

Kulin 不内置公开服务配置，也不会包含你的运行数据库。请不要把 `data/config.yaml`、`data/sqlite.db`、TSDB 数据或 Agent secret 提交到公开仓库。

---

## 📄 License

沿用上游 Nezha 的开源许可证。详见 [LICENSE](LICENSE)。
