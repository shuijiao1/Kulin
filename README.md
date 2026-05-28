# Kulin

> Kulin 是基于哪吒监控 fork 的精简服务器探针，目标是保留服务器状态、Ping/TCPing、Telegram 告警和用户登录管理，去掉复杂运维功能。

当前分支：`kulin-slim`。

## 保留功能

- 服务器状态监控：在线状态、CPU、内存、硬盘、网络、流量、负载、运行时间、系统信息、架构、虚拟化、IP/地区
- 用户登录管理
- 服务器排序、隐藏、备注、Agent 配置
- Ping 监控
- TCPing 监控
- 离线告警
- CPU / 内存 / 硬盘资源告警
- 流量告警
- Telegram 通知

## 移除 / 禁用功能

- Web Terminal
- 文件管理
- 计划任务 / Cron
- DDNS
- NAT
- 服务器转移
- 服务器分组
- 通知分组
- OAuth
- WAF / 在线用户管理
- 复杂多通知渠道
- 多主题 / 主题市场

这些功能的 API 路由会返回 `disabled in Kulin slim`，不会继续执行原哪吒逻辑。

## 开发状态

这是 fork 精简版的起步分支，目前先完成后端路由收敛和默认管理员初始化。下一步会替换前端，做 Kulin 自己的简洁界面，不照搬哪吒 UI。

默认管理员：

```text
admin / admin
```
