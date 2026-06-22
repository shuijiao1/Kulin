import ServerUsageBar from "@/components/ServerUsageBar";
import { formatBytesCompact } from "@/lib/format";
import type { NezhaServer } from "@/types/nezha-api";

type Props = { serverInfo: NezhaServer };

function clampBillingDay(day?: number) {
	return Math.max(1, Math.min(31, Math.floor(day || 1)));
}

function daysInMonth(year: number, monthIndex: number) {
	return new Date(year, monthIndex + 1, 0).getDate();
}

function periodStart(day?: number) {
	const now = new Date();
	const billingDay = clampBillingDay(day);
	let year = now.getFullYear();
	let month = now.getMonth();
	let startDay = Math.min(billingDay, daysInMonth(year, month));
	let start = new Date(year, month, startDay);
	if (now < start) {
		month -= 1;
		if (month < 0) {
			month = 11;
			year -= 1;
		}
		startDay = Math.min(billingDay, daysInMonth(year, month));
		start = new Date(year, month, startDay);
	}
	return {
		key: `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`,
		seconds: Math.floor(start.getTime() / 1000),
	};
}

function monthlyUsed(serverInfo: NezhaServer, mode: string, current: number) {
	if (typeof window === "undefined") return current;
	const start = periodStart(serverInfo.traffic_progress_start_day);
	const key = `kulin:traffic:${serverInfo.id}:${start.key}:${mode}`;
	const stored = window.localStorage.getItem(key);
	let baseline = stored === null ? Number.NaN : Number(stored);
	if (!Number.isFinite(baseline)) {
		baseline = (serverInfo.host?.boot_time ?? 0) >= start.seconds ? 0 : current;
		window.localStorage.setItem(key, String(baseline));
	}
	if (current < baseline) {
		baseline = 0;
		window.localStorage.setItem(key, "0");
	}
	return Math.max(0, current - baseline);
}

function pct(used: number, limit: number) {
	if (!limit || limit <= 0) return 0;
	return Math.max(0, Math.min(100, (used / limit) * 100));
}

function Row({
	label,
	used,
	limit,
}: {
	label: string;
	used: number;
	limit: number;
}) {
	const value = pct(used, limit);
	return (
		<div className="flex w-full flex-col gap-1.5">
			<div className="flex items-center justify-between text-[12px] leading-none">
				<span className="font-medium text-foreground/90">{label}</span>
				<span className="font-medium tabular-nums text-foreground/90">
					{formatBytesCompact(used)} / {formatBytesCompact(limit)}
				</span>
			</div>
			<ServerUsageBar value={value} />
		</div>
	);
}

export default function ServerTrafficProgress({ serverInfo }: Props) {
	const limit = serverInfo.traffic_progress_limit ?? 0;
	if (!serverInfo.traffic_progress_enabled || limit <= 0) return null;
	const mode = serverInfo.traffic_progress_mode ?? "out";
	const input = serverInfo.state?.net_in_transfer ?? 0;
	const output = serverInfo.state?.net_out_transfer ?? 0;
	const used =
		mode === "in" ? input : mode === "max" ? Math.max(input, output) : output;
	return (
		<Row
			label="流量"
			used={monthlyUsed(serverInfo, mode, used)}
			limit={limit}
		/>
	);
}
