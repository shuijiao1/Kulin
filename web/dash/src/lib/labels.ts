const labels = {
	"nezha": "Kulin",
	"dashboard": "管理后台",
	"login": "登录",
	"online": "在线",
	"offline": "离线",
	"refreshing": "刷新中",
	"info": {
		"websocketConnecting": "WebSocket 连接中",
		"websocketConnected": "WebSocket 连接成功",
		"websocketDisconnected": "WebSocket 连接断开",
		"processing": "处理中..."
	},
	"serverOverview": {
		"totalServers": "服务器总数",
		"onlineServers": "在线服务器",
		"offlineServers": "离线服务器",
		"totalBandwidth": "总流量",
		"speed": "速率",
		"network": "网络"
	},
	"map": {
		"Distributions": "服务器分布在",
		"Regions": "个区域",
		"Servers": "个服务器"
	},
	"serverCard": {
		"mem": "内存",
		"stg": "存储",
		"days": "天",
		"hours": "小时",
		"upload": "上传",
		"download": "下载",
		"system": "系统",
		"uptime": "运行时间",
		"totalUpload": "总上传",
		"totalDownload": "总下载"
	},
	"serverDetail": {
		"status": "状态",
		"online": "在线",
		"days": "天",
		"hours": "小时",
		"offline": "离线",
		"unknown": "未知",
		"uptime": "运行时间",
		"version": "版本",
		"arch": "架构",
		"mem": "内存",
		"disk": "磁盘",
		"region": "区域",
		"system": "系统",
		"upload": "上传",
		"download": "下载",
		"lastActive": "最后上报时间",
		"temperature": "温度",
		"bootTime": "启动时间"
	},
	"serverDetailChart": {
		"process": "进程数",
		"disk": "磁盘",
		"mem": "内存",
		"swap": "虚拟内存",
		"upload": "上传",
		"download": "下载",
		"realtime": "实时",
		"period1d": "1 天",
		"period7d": "7 天",
		"period30d": "30 天",
		"tsdbRequired": "需要开启 TSDB 才能启用历史记录功能",
		"loginRequired": "请登录后查看"
	},
	"footer": {
		"themeBy": "前台-"
	},
	"theme": {
		"light": "亮色",
		"dark": "暗色",
		"system": "跟随系统"
	},
	"error": {
		"pageNotFound": "页面不存在",
		"backToHome": "回到主页"
	},
	"tabSwitch": {
		"Detail": "详情",
		"Network": "网络"
	},
	"monitor": {
		"noData": "没有服务监控数据，请在管理后台服务页添加监控任务",
		"avgDelay": "延迟",
		"monitorCount": "个监控服务",
		"packetLoss": "丢包率",
		"clearSelections": "清除",
		"peakCut": "削峰",
		"loginRequired": "请登录后查看",
		"period1d": "1 天",
		"period7d": "7 天",
		"period30d": "30 天"
	},
	"pwa": {
		"offlineReady": "应用可以离线使用了",
		"newContent": "发现新版本",
		"reload": "更新"
	},
	"billingInfo": {
		"remaining": "剩余天数",
		"error": "计算错误",
		"indefinite": "永久",
		"expired": "已过期",
		"days": "天",
		"price": "价格",
		"free": "免费",
		"usage-baseed": "按量计费"
	},
	"Servers": "服务器",
	"Home": "首页",
	"group": {
		"all": "全部"
	}
};

export function t(key: string, fallback?: unknown): string {
	const value = key.split(".").reduce<unknown>((acc, part) => {
		if (acc && typeof acc === "object" && part in acc) {
			return (acc as Record<string, unknown>)[part];
		}
		return undefined;
	}, labels);
	return typeof value === "string" ? value : typeof fallback === "string" ? fallback : key;
}
