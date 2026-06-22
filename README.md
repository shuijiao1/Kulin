# Kulin

Kulin 是一个基于 [Nezha](https://github.com/nezhahq/nezha) 的轻量服务器探针面板。它保留服务器状态、延迟监控、Telegram 通知和基础后台管理，去掉多用户、复杂权限、WebSSH、文件管理、任务编排等偏运维平台化功能，更适合个人和小规模服务器状态展示。

## 特性

- 服务器实时状态：在线状态、CPU、内存、硬盘、负载、网络上下行、进程数、连接数
- 首页服务器卡片：三列窄卡布局、账单周期、流量进度条、系统/核心数/内存/硬盘摘要
- 服务器详情页：资源、网络、连接、温度、延迟监控图表
- 延迟监控：HTTP / TCP / ICMP Ping，详情页延迟和丢包率保持原版哪吒逻辑
- Telegram 通知：保留常用告警通知链路
- 后台管理：服务器、延迟监控、通知、个人信息、系统设置
- 移动端适配：后台手机端使用抽屉导航和卡片列表，避免宽表格挤压
- Kulin Agent：配套轻量 Agent 安装命令

## 安装

### Docker Compose（推荐）

创建目录和配置：

```bash
mkdir -p /opt/kulin/data
cd /opt/kulin
```

写入 `docker-compose.yml`：

```yaml
services:
  kulin:
    image: ghcr.io/shuijiao1/kulin:latest
    container_name: kulin
    restart: unless-stopped
    ports:
      - "8008:8008"
    volumes:
      - ./data:/dashboard/data
    environment:
      - TZ=Asia/Shanghai
```

启动：

```bash
docker compose up -d
```

访问：

- 前台：`http://服务器IP:8008/`
- 后台：`http://服务器IP:8008/dashboard/`
- 初始账号：`admin`
- 初始密码：`admin`

首次登录后请立刻修改密码。

### 二进制安装

从 Release 下载对应架构的 `dashboard-*.zip`，解压后运行：

```bash
mkdir -p /opt/kulin/data
unzip dashboard-linux-amd64.zip -d /opt/kulin
chmod +x /opt/kulin/dashboard-linux-amd64
/opt/kulin/dashboard-linux-amd64 -c /opt/kulin/data/config.yaml -db /opt/kulin/data/sqlite.db
```

如需 systemd 管理，可自行创建服务文件，`ExecStart` 指向上面的二进制命令。

## 安装 Agent

在后台添加服务器后复制 Agent 安装命令，或使用脚本手动安装 Kulin Agent：

```bash
curl -fsSL https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.sh | bash -s -- -c /opt/kulin-agent/config.yaml
```

Windows 可使用：

```powershell
iwr -useb https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.ps1 | iex
```

实际部署建议优先使用后台生成的安装命令，以确保 UUID、服务端地址和密钥正确。

## 升级

Docker Compose：

```bash
cd /opt/kulin
docker compose pull
docker compose up -d
```

二进制部署：下载新版 Release，替换旧二进制后重启服务。升级前建议备份 `data/` 目录。

## 本次版本更新重点

- 重做首页服务器卡片布局和交互，保留顶部四个概览卡片并支持筛选
- 增加服务器卡片三列摘要、hover 效果、账单周期和流量进度展示
- 修复 CPU 核心数解析，支持 Agent 返回的尾部核心数格式；`1 Core` / `N Cores` 单复数正确显示
- 首页卡片延迟/丢包率与详情页网络图使用同一接口和同一逻辑
- 延迟监控、通知、服务器后台表单和列表进一步精简
- 后台移动端适配：手机端抽屉导航、服务器/延迟监控/通知卡片列表
- 后台导航恢复个人信息和系统设置入口，并与服务器、延迟监控、通知并列
- 删除多语言切换、搜索、排序控件、卡片格式切换等不需要的入口
- 前台和后台统一使用 Kulin 品牌与头像配置

## 从 Nezha 裁剪的能力

Kulin 目标是轻量化，不计划保留以下复杂功能：

- 多用户 / OAuth2 / 复杂角色权限
- WebSSH / 网页终端
- 在线文件管理
- 批量执行任务 / 计划任务编排
- DDNS / NAT / 端口映射
- WAF / 封禁地址管理
- 多主题模板和多语言切换
- 非 Telegram 的复杂通知渠道

## 开发

主仓库：

```bash
git clone https://github.com/shuijiao1/Kulin.git
cd Kulin
go test ./...
go build ./cmd/dashboard
```

前台和后台分别在：

- <https://github.com/shuijiao1/Kulin-Dash>
- <https://github.com/shuijiao1/Kulin-Admin-Frontend>

Release 构建会自动拉取前后台 dist 并嵌入到 Dashboard。

## 上游

Kulin fork 自 [nezhahq/nezha](https://github.com/nezhahq/nezha)。感谢上游项目和贡献者。
