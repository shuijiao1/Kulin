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

### 一键脚本（推荐）

```bash
bash <(curl -Ls https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/install.sh)
```

脚本会自动安装 Docker、写入 Docker Compose 配置并启动 Kulin。默认安装目录为 `/opt/kulin`，默认端口为 `8008`。

也可以直接执行指定操作：

```bash
bash <(curl -Ls https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/install.sh) install
bash <(curl -Ls https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/install.sh) update
```

### Docker Compose

如需手动安装，可使用镜像 `ghcr.io/shuijiao1/kulin:latest`，挂载数据目录到 `/dashboard/data`，并映射容器端口 `8008`。

访问：

- 前台：`http://服务器IP:8008/`
- 后台：`http://服务器IP:8008/dashboard/`
- 初始账号：`admin`
- 初始密码：首次启动时随机生成，请查看容器日志中的 `created initial admin user`；也可以在首次启动前设置环境变量 `KULIN_INITIAL_ADMIN_PASSWORD` 指定。

首次登录后请立刻修改密码，并妥善保存初始密码。

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
KULIN_SERVER="shuijiao.li:443" KULIN_CLIENT_SECRET="你的密钥" KULIN_TLS=true \
  bash <(curl -fsSL https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.sh)
```

Windows 可使用：

```powershell
$env:KULIN_SERVER="shuijiao.li:443"; $env:KULIN_CLIENT_SECRET="你的密钥"; $env:KULIN_TLS="true"; iwr -useb https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.ps1 | iex
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

- 新增默认主题 / 高斯模糊主题切换，支持后台配置电脑端和手机端背景图
- 优化首页服务器卡片：标题、国旗、系统图标、资源摘要、账单周期和 hover 视觉细节
- 修复服务器流量上限编辑时 GB / TB 单位换算错误
- 首次启动不再创建 `admin/admin`，改为环境变量指定或随机生成初始密码
- 登录接口增加失败限速，降低暴力尝试和 bcrypt CPU 消耗风险
- 删除 WebSSH 相关 `@xterm/*` 残留依赖，以及未暴露的 Agent 强制更新 / 配置下发残留代码
- 前台和后台统一使用 Kulin 品牌、头像配置和主题配置

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

前台和后台源码已经合并到主仓库：

- 后台管理前端：`web/admin`
- 公开首页前端：`web/dash`

本地构建前端并嵌入 Dashboard：

```bash
./script/build-frontends.sh
```

Release 构建会自动构建 `web/admin` 和 `web/dash`，再嵌入到 Dashboard。

## 上游

Kulin fork 自 [nezhahq/nezha](https://github.com/nezhahq/nezha)。感谢上游项目和贡献者。
