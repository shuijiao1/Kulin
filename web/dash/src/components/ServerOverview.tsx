import {
	ArrowDownCircleIcon,
	ArrowUpCircleIcon,
} from "@heroicons/react/20/solid";
import NumericText from "@numeric-text/react";
import { t } from "@/lib/labels";
import { Card, CardContent } from "@/components/ui/card";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";

export type ServerOverviewFilter = "all" | "online" | "offline" | "network";

type ServerOverviewProps = {
	selected: ServerOverviewFilter | null;
	onSelect: (value: ServerOverviewFilter) => void;
	online: number;
	offline: number;
	total: number;
	up: number;
	down: number;
	upSpeed: number;
	downSpeed: number;
};

export default function ServerOverview({
	selected,
	onSelect,
	online,
	offline,
	total,
	up,
	down,
	upSpeed,
	downSpeed,
}: ServerOverviewProps) {
	const customBackgroundImage =
		(window.CustomBackgroundImage as string) !== ""
			? window.CustomBackgroundImage
			: undefined;

	const cardClass = (
		value: ServerOverviewFilter,
		color: "blue" | "green" | "red" | "purple",
	) =>
		cn(
			"cursor-pointer ring-1 transition-all hover:-translate-y-0.5 hover:shadow-lg",
			{
				"hover:ring-blue-500 dark:hover:ring-blue-600": color === "blue",
				"hover:ring-green-500 dark:hover:ring-green-600": color === "green",
				"hover:ring-red-500 dark:hover:ring-red-600": color === "red",
				"hover:ring-purple-500 dark:hover:ring-purple-600": color === "purple",
				"border-transparent ring-2 ring-blue-500 dark:ring-blue-600":
					selected === value && color === "blue",
				"border-transparent ring-2 ring-green-500 dark:ring-green-600":
					selected === value && color === "green",
				"border-transparent ring-2 ring-red-500 dark:ring-red-600":
					selected === value && color === "red",
				"border-transparent ring-2 ring-purple-500 dark:ring-purple-600":
					selected === value && color === "purple",
				"bg-card/70": customBackgroundImage,
			},
		);

	return (
		<section className="grid grid-cols-2 gap-4 lg:grid-cols-4 server-overview">
			<Card
				className={cardClass("all", "blue")}
				onClick={() => onSelect("all")}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.totalServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="relative inline-flex h-2 w-2 rounded-full bg-blue-500"></span>
							</span>
							<NumericText value={total} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				className={cardClass("online", "green")}
				onClick={() => onSelect("online")}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.onlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
							</span>
							<NumericText value={online} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				className={cardClass("offline", "red")}
				onClick={() => onSelect("offline")}
			>
				<CardContent className="flex h-full items-center px-6 py-3">
					<section className="flex flex-col gap-1">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.offlineServers")}
						</p>
						<div className="flex items-center gap-2">
							<span className="relative flex h-2 w-2">
								<span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-500 opacity-75"></span>
								<span className="relative inline-flex h-2 w-2 rounded-full bg-red-500"></span>
							</span>
							<NumericText value={offline} className="text-lg font-semibold" />
						</div>
					</section>
				</CardContent>
			</Card>
			<Card
				className={cardClass("network", "purple")}
				onClick={() => onSelect("network")}
			>
				<CardContent className="flex h-full items-center relative px-6 py-3">
					<section className="flex flex-col gap-1 w-full">
						<p className="text-sm font-medium md:text-base">
							{t("serverOverview.network")}
						</p>
						<section className="flex items-start flex-row z-10 pr-0 gap-1">
							<NumericText
								value={`↑${formatBytes(up)}`}
								className="sm:text-[12px] text-[10px] text-blue-800 dark:text-blue-400 text-nowrap font-medium"
							/>
							<NumericText
								value={`↓${formatBytes(down)}`}
								className="sm:text-[12px] text-[10px] text-purple-800 dark:text-purple-400 text-nowrap font-medium"
							/>
						</section>
						<section className="flex flex-col sm:flex-row -mr-1 sm:items-center items-start gap-1">
							<p className="text-[11px] flex items-center text-nowrap font-semibold">
								<ArrowUpCircleIcon className="size-3 mr-0.5 sm:mb-px" />
								{formatBytes(upSpeed)}/s
							</p>
							<p className="text-[11px] flex items-center text-nowrap font-semibold">
								<ArrowDownCircleIcon className="size-3 mr-0.5" />
								{formatBytes(downSpeed)}/s
							</p>
						</section>
					</section>
				</CardContent>
			</Card>
		</section>
	);
}
