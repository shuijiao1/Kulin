import { useQuery } from "@tanstack/react-query";
import {
	Activity,
	Cpu,
	Download,
	HardDrive,
	MemoryStick,
	TriangleAlert,
	Upload,
} from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import ServerBillingStatus from "@/components/ServerBillingStatus";
import ServerFlag from "@/components/ServerFlag";
import ServerTrafficProgress from "@/components/ServerTrafficProgress";
import ServerUsageBar from "@/components/ServerUsageBar";
import { formatBytes } from "@/lib/format";
import { t } from "@/lib/labels";
import { saveMainPageScrollPosition } from "@/lib/navigation";
import { fetchMonitor } from "@/lib/nezha-api";
import { getOSImage } from "@/lib/os-image";
import {
	cn,
	formatCpuCores,
	formatNezhaInfo,
	getCpuCoreCount,
	parsePublicNote,
} from "@/lib/utils";
import type { NezhaServer } from "@/types/nezha-api";
import BillingInfo from "./billingInfo";
import PlanInfo from "./PlanInfo";
import { Card } from "./ui/card";

type MetricRowProps = {
	label: string;
	value: number;
};

type PillProps = {
	label: string;
	value: string;
	icon: ReactNode;
	accent?: "blue" | "green" | "purple" | "orange" | "neutral";
};

function formatSpeed(mib: number) {
	if (mib >= 1024) return `${(mib / 1024).toFixed(2)} GB/s`;
	if (mib >= 1) return `${mib.toFixed(2)} MB/s`;
	return `${(mib * 1024).toFixed(2)} KB/s`;
}

function formatDelay(value?: number) {
	if (value === undefined || value === null || Number.isNaN(value))
		return "-- ms";
	return `${value.toFixed(value >= 100 ? 0 : 1)} ms`;
}

function formatLoss(value?: number) {
	if (value === undefined || value === null || Number.isNaN(value))
		return "--%";
	return `${value.toFixed(2)}%`;
}

const calculatePacketLoss = (delays?: number[]): number[] => {
	if (!delays || delays.length === 0) return [];

	const packetLossRates: number[] = [];
	const windowSize = Math.min(10, Math.max(3, Math.floor(delays.length / 10)));
	const timeoutThreshold = 3000;
	const extremeDelayThreshold = 10000;

	for (let i = 0; i < delays.length; i++) {
		const currentDelay = delays[i];
		let lossRate = 0;

		if (
			currentDelay === 0 ||
			currentDelay === null ||
			currentDelay === undefined
		) {
			lossRate = 100;
		} else if (currentDelay >= extremeDelayThreshold) {
			lossRate = Math.min(
				95,
				60 + (currentDelay - extremeDelayThreshold) / 1000,
			);
		} else if (currentDelay >= timeoutThreshold) {
			lossRate = Math.min(50, (currentDelay - timeoutThreshold) / 200);
		} else {
			const start = Math.max(0, i - Math.floor(windowSize / 2));
			const end = Math.min(delays.length, i + Math.ceil(windowSize / 2));
			const windowDelays = delays.slice(start, end).filter((d) => d > 0);

			if (windowDelays.length > 2) {
				const mean =
					windowDelays.reduce((sum, d) => sum + d, 0) / windowDelays.length;
				const variance =
					windowDelays.reduce((sum, d) => sum + (d - mean) ** 2, 0) /
					windowDelays.length;
				const standardDeviation = Math.sqrt(variance);
				const coefficientOfVariation = standardDeviation / mean;

				if (coefficientOfVariation > 0.8) {
					lossRate = Math.min(25, coefficientOfVariation * 15);
				} else if (coefficientOfVariation > 0.5) {
					lossRate = Math.min(10, coefficientOfVariation * 8);
				} else if (coefficientOfVariation > 0.3) {
					lossRate = Math.min(5, coefficientOfVariation * 5);
				}

				if (currentDelay > mean * 2.5) {
					lossRate += Math.min(15, (currentDelay / mean - 2.5) * 10);
				}
			}
		}

		if (i > 0) {
			const alpha = 0.3;
			lossRate = alpha * lossRate + (1 - alpha) * packetLossRates[i - 1];
		}

		packetLossRates.push(Math.max(0, Math.min(100, lossRate)));
	}

	return packetLossRates.map((rate) => Number(rate.toFixed(2)));
};

function latestMonitorValue(values?: number[]) {
	if (!values || values.length === 0) return undefined;
	return values[values.length - 1];
}

function averageMonitorValue(values?: number[]) {
	if (!values || values.length === 0) return undefined;
	return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function MetricRow({ label, value }: MetricRowProps) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex items-center justify-between text-[12px] leading-none">
				<span className="font-medium text-foreground/90">{label}</span>
				<span className="font-medium tabular-nums text-foreground/90">
					{value.toFixed(2)}%
				</span>
			</div>
			<ServerUsageBar value={value} />
		</div>
	);
}

function Pill({ label, value, icon, accent = "neutral" }: PillProps) {
	return (
		<div className="flex min-h-10 items-center justify-center gap-1.5 rounded-xl border bg-background/75 px-2.5 text-[11px] shadow-sm shadow-neutral-200/40 dark:shadow-none">
			<span
				className={cn(
					"flex size-5 shrink-0 items-center justify-center leading-none",
					{
						"text-blue-600": accent === "blue",
						"text-green-600": accent === "green",
						"text-purple-600": accent === "purple",
						"text-orange-500": accent === "orange",
						"text-foreground/80": accent === "neutral",
					},
				)}
			>
				{icon}
			</span>
			<span className="font-medium text-foreground/85">{label}</span>
			<span
				className={cn("ml-auto font-medium tabular-nums", {
					"text-blue-600": accent === "blue",
					"text-green-600": accent === "green",
					"text-purple-600": accent === "purple",
					"text-orange-500": accent === "orange",
					"text-foreground/90": accent === "neutral",
				})}
			>
				{value}
			</span>
		</div>
	);
}

export default function ServerCard({
	now,
	serverInfo,
}: {
	now: number;
	serverInfo: NezhaServer;
}) {
	const navigate = useNavigate();
	const {
		name,
		country_code,
		online,
		cpu,
		up,
		down,
		mem,
		stg,
		public_note,
		platform,
		mem_total,
		disk_total,
		cpu_info,
	} = formatNezhaInfo(now, serverInfo);

	const cardClick = () => {
		saveMainPageScrollPosition();
		navigate(`/server/${serverInfo.id}`);
	};

	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const parsedData = parsePublicNote(public_note);
	const coreCount = getCpuCoreCount(cpu_info);
	const homeMonitorID = serverInfo.home_monitor_id ?? 0;
	const { data: monitorData } = useQuery({
		queryKey: ["home-monitor", serverInfo.id, homeMonitorID],
		queryFn: () => fetchMonitor(serverInfo.id, "1d"),
		enabled: online && homeMonitorID > 0,
		refetchInterval: 30_000,
		refetchOnWindowFocus: true,
	});
	const homeMonitor = monitorData?.data?.find(
		(item) => Number(item.monitor_id) === Number(homeMonitorID),
	);
	const latestDelay = latestMonitorValue(homeMonitor?.avg_delay);
	const latestLoss = averageMonitorValue(
		calculatePacketLoss(homeMonitor?.avg_delay),
	);
	const shouldShowMonitorSlots = homeMonitorID > 0;

	return (
		<Card
			className={cn(
				"mx-auto flex h-full w-full max-w-[360px] cursor-pointer flex-col rounded-2xl border bg-card p-4 shadow-sm transition-all hover:-translate-y-1 hover:shadow-lg",
				{
					"bg-card/70 backdrop-blur": customBackgroundImage,
				},
			)}
			onClick={cardClick}
		>
			<section className="relative flex min-h-8 items-start justify-center px-12 text-center">
				<img
					src={getOSImage(platform)}
					alt={platform || "Linux"}
					className="absolute left-0 top-0 size-6 object-contain"
					loading="lazy"
				/>
				<div className="flex min-w-0 items-center justify-center gap-2">
					<span
						className={cn("h-2 w-2 shrink-0 rounded-full", {
							"bg-green-500": online,
							"bg-red-500": !online,
						})}
					/>
					<ServerFlag
						country_code={country_code}
						className="-mt-px shrink-0 text-[14px]"
					/>
					<div className="min-w-0">
						<p className="truncate text-[13px] font-semibold tracking-tight">
							{name}
						</p>
					</div>
				</div>
				<div className="absolute right-0 top-0 text-[11px]">
					{online ? (
						<ServerBillingStatus parsedData={parsedData} />
					) : (
						<span className="font-medium text-red-500">离线</span>
					)}
				</div>
			</section>

			{parsedData?.billingDataMod && <BillingInfo parsedData={parsedData} />}

			{online && (
				<>
					<section className="mt-3 grid grid-cols-[auto_auto_auto] justify-center gap-3 px-1 text-center text-[11px]">
						<div className="flex items-center justify-center gap-1">
							<Cpu className="size-4 text-sky-500" />
							<span>{formatCpuCores(coreCount)}</span>
						</div>
						<div className="flex items-center justify-center gap-1">
							<MemoryStick className="size-4 text-emerald-500" />
							<span>{formatBytes(mem_total)}</span>
						</div>
						<div className="flex items-center justify-center gap-1">
							<HardDrive className="size-4 text-violet-500" />
							<span>{formatBytes(disk_total)}</span>
						</div>
					</section>

					<section className="mt-5">
						<MetricRow label="CPU" value={cpu} />
					</section>

					<div className="flex flex-1 flex-col justify-evenly gap-5 pt-4">
						<MetricRow label={t("serverCard.mem")} value={mem} />
						<MetricRow label={t("serverCard.stg")} value={stg} />
						<ServerTrafficProgress serverInfo={serverInfo} />

						<section className="grid grid-cols-2 gap-3">
							<Pill
								label={t("serverCard.upload")}
								value={formatSpeed(up)}
								icon={<Upload className="size-4" />}
								accent="blue"
							/>
							<Pill
								label={t("serverCard.download")}
								value={formatSpeed(down)}
								icon={<Download className="size-4" />}
								accent="purple"
							/>
							{shouldShowMonitorSlots && (
								<>
									<Pill
										label="延迟"
										value={formatDelay(latestDelay)}
										icon={<Activity className="size-4" />}
										accent="green"
									/>
									<Pill
										label="丢包率"
										value={formatLoss(latestLoss)}
										icon={<TriangleAlert className="size-4" />}
										accent="orange"
									/>
								</>
							)}
						</section>
					</div>
				</>
			)}

			{parsedData?.planDataMod && <PlanInfo parsedData={parsedData} />}
		</Card>
	);
}
