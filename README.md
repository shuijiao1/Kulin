# Kulin

**中文** | [English](README.en.md)

![GitHub Release](https://img.shields.io/github/v/release/shuijiao1/Kulin?style=flat-square)
![Docker](https://img.shields.io/badge/docker-ghcr.io%2Fshuijiao1%2Fkulin--dashboard-blue?style=flat-square)
![License](https://img.shields.io/badge/license-Apache--2.0-green?style=flat-square)

> **Kulin** 是基于 [Nezha](https://github.com/nezhahq/nezha) 的轻量化服务器探针面板。它保留服务器监控、延迟监控、告警和 Telegram 通知，把原版里偏重运维平台的功能删掉，适合只想快速搭一个干净探针面板的自部署用户。

---

## 🎯 核心特性

- 服务器在线状态、CPU、内存、硬盘、负载、系统、架构、虚拟化、IP / 地区展示
- 实时网速、总流量、周期流量展示
- **内置流量进度条**，可在编辑服务器时设置流量周期、流量限额和重置日期
- ICMP Ping / TCPing 延迟监控
- 离线、资源、流量告警
- Telegram 通知
- 服务器排序、隐藏、账单备注和 Agent 安装命令
- 前台主题、Logo、背景图、移动端背景图和自定义代码配置
- 基于 Nezha Agent / 数据模型，方便从 Nezha 迁移

---

## ✨ Kulin 相比原版 Nezha 做了什么

### 更轻的面板

Kulin 把 Nezha 精简成更偏“探针展示 + 基础告警”的形态，后台入口更少，部署后不需要面对一堆用不到的运维功能。

### 更适合个人探针展示

- 首页布局更清爽，重点展示服务器状态、流量、延迟和服务监控
- 支持前台主题效果，内置高斯模糊风格
- 支持自定义 Logo、桌面背景、移动端背景
- 保留前台和后台自定义代码，方便自行微调样式

### 流量进度条内置到服务器设置

原版 Nezha 的周期流量更多依赖告警规则组合。Kulin 把周期流量展示做成服务器自己的配置：

- 在编辑服务器里直接设置周期起始日、流量额度等参数
- 前台服务器卡片直接展示流量进度条
- 从旧规则迁移时会尽量保留已有周期流量配置

### 更简单的通知和运维模型

Kulin 主要保留 Telegram 通知和常用告警场景，减少复杂通知渠道、分组和权限相关配置，更适合单人或小规模自用。

### 独立发布与部署

- 提供 `ghcr.io/shuijiao1/kulin-dashboard` Docker 镜像
- 提供 amd64 / arm64 Release 构建产物
- 提供 Docker Compose 示例，适合直接部署

---

## 🧹 相比原版 Nezha 精简了什么

Kulin 移除了这些对轻量探针面板来说偏重的功能：

- Web Terminal / 在线终端
- 文件管理
- 计划任务 / Cron
- DDNS
- NAT 管理
- 服务器配置面板里的复杂运维入口
- 服务器分组
- 通知分组
- OAuth 登录 / 绑定 / 配置
- 在线用户管理
- 服务器转移相关后台入口
- 复杂通知渠道
- 主题市场和多余外部主题入口
- 多余的同步工作流和精简后不再使用的代码

---

## 🔁 从 Nezha 迁移

Kulin 提供迁移工具，目标是尽量保留 Kulin 仍支持的核心数据：服务器、用户、服务监控、告警、通知、流量历史和 TSDB 数据。

迁移工具还会自动处理常见旧配置：

- 如果你之前在 Nezha 的告警规则里配置了周期流量，会转换成 Kulin 的服务器流量进度条配置，之后可在“编辑服务器”里继续调整周期和额度。
- 如果你之前在自定义代码里写了站点标题、Logo、背景图或移动端背景图，会尽量识别并填入 Kulin 的设置项。

```bash
# 先预览将要迁移的内容
docker run --rm --entrypoint /dashboard/kulin-migrate \
  -v /opt/nezha/data:/data ghcr.io/shuijiao1/kulin-dashboard:latest \
  -db /data/sqlite.db -dry-run

# 确认无误后执行，工具会自动备份数据库
docker run --rm --entrypoint /dashboard/kulin-migrate \
  -v /opt/nezha/data:/data ghcr.io/shuijiao1/kulin-dashboard:latest \
  -db /data/sqlite.db
```

> Web Terminal、文件管理、Cron、DDNS、NAT、OAuth、分组和复杂通知渠道等已精简功能不会在 Kulin 中继续使用；相关旧表会留在数据库中作为历史数据。

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

## ⚙️ 常用设置

- **站点名称**：后台设置页可修改
- **Logo / 头像**：可留空，也可填自己的图片链接
- **背景图**：支持桌面端和移动端分别设置
- **前台主题效果**：可选择默认主题或高斯模糊主题
- **流量进度条**：在编辑服务器里设置周期和额度
- **自定义代码**：可分别配置前台和后台自定义代码

---

## ⚙️ Agent 接入

在面板中复制 Agent 安装命令即可。

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
