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

## ➕ 相比原版 Nezha 新增 / 改动

Kulin 不是简单换皮，而是在原版 Nezha 基础上做了面向轻量自部署的整体调整：

- 项目更名为 **Kulin**，提供独立 Docker 镜像 `ghcr.io/shuijiao1/kulin-dashboard` 和 Release 构建流程
- 内置前台与后台构建产物，默认使用 `user-dist` / `admin-dist` 模板，开箱即可运行
- 提供独立的 `docker-compose.yml` 和最小 `data/config.example.yaml` 示例
- 默认站点名改为 **哪吒探针**，后台设置页可单独修改站点名称
- Logo / 头像链接可在后台设置；配置为空时，前台使用内置官方默认头像
- 背景图、移动端背景图可在后台单独设置
- 新增前台主题效果选项：默认主题 / 高斯模糊主题
- 保留自定义前台代码和后台自定义代码，便于轻量定制展示效果
- 首页做了简化展示：保留核心概览、服务器卡片、地图、服务监控等常用信息，减少额外区块占位
- 周期流量条从告警规则迁移为服务器自己的配置，更适合单台服务器单独设置流量周期和额度
- 提供旧周期流量规则迁移逻辑，尽量保留从旧配置升级来的流量配额数据
- Agent 安装命令调整为 Kulin 自己的安装脚本，并默认带 `NZ_DISABLE_COMMAND_EXECUTE=true`，减少误开远程命令执行风险
- 修复并内置 GeoIP 数据，避免精简后地区/IP 展示异常
- 更新设置时会保留已有的主题、Logo、背景图等用户配置；只有在后台明确清空时才会清除
- Docker 镜像更新不会覆盖挂载目录中的 `data/config.yaml`、数据库和历史数据
- 补充 Apache-2.0 上游归属说明和独立 README / README.en.md 文档

---

## 🧹 相比原版 Nezha 删除 / 精简

Kulin 从源码、后台路由、前端入口和构建产物中移除了大量复杂运维功能，让面板更轻：

- Web Terminal / 在线终端
- 文件管理 / File Manager
- 计划任务 / Cron 管理页面与相关 API
- DDNS 功能、模型、服务和 webhook provider
- NAT 管理页面与相关 API
- 服务器配置面板中偏复杂的运维入口
- 服务器分组管理页面与相关 API
- 通知分组管理页面与相关 API
- OAuth 登录 / OAuth 绑定 / OAuth 配置
- 在线用户管理相关逻辑
- 服务器转移 / transfer 相关后台入口
- 后台中不再使用的权限矩阵、可见性和流式连接测试代码
- 多余的 upstream 同步 Actions，例如 AtomGit / Gitee 同步工作流
- 主题市场和不必要的外部主题入口
- 默认水饺头像、默认“水饺的探针”等个人化展示内容
- 未使用的工具代码和精简后不再引用的死代码

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
