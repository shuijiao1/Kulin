import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { t } from "@/lib/labels";
import GlobalMap from "@/components/GlobalMap";
import GroupSwitch from "@/components/GroupSwitch";
import { Loader } from "@/components/loading/Loader";
import ServerCard from "@/components/ServerCard";
import ServerOverview, {
	type ServerOverviewFilter,
} from "@/components/ServerOverview";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchServerGroup } from "@/lib/nezha-api";
import { formatNezhaInfo } from "@/lib/utils";
import type { ServerGroup } from "@/types/nezha-api";

export default function Servers() {
	const { data: groupData } = useQuery({
		queryKey: ["server-group"],
		queryFn: () => fetchServerGroup(),
	});
	const { lastData, connected } = useWebSocketContext();
	const [showMap, setShowMap] = useState<string>("0");
	const hasRestoredScroll = useRef(false);
	const [currentGroup, setCurrentGroup] = useState<string>("All");
	const [overviewFilter, setOverviewFilter] =
		useState<ServerOverviewFilter | null>(null);
	const nezhaWsData = lastData;

	const restoreScrollPosition = useCallback(() => {
		const isFromMainPage = sessionStorage.getItem("fromMainPage") === "true";
		const savedPosition = sessionStorage.getItem("scrollPosition");
		const scrollTop = savedPosition ? Number(savedPosition) : Number.NaN;

		if (
			hasRestoredScroll.current ||
			!isFromMainPage ||
			!Number.isFinite(scrollTop)
		) {
			return;
		}

		hasRestoredScroll.current = true;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				window.scrollTo({ top: scrollTop, left: 0, behavior: "auto" });
			});
		});
	}, []);

	const handleTagChange = (newGroup: string) => {
		setCurrentGroup(newGroup);
		sessionStorage.setItem("selectedGroup", newGroup);
		sessionStorage.setItem("scrollPosition", String(window.scrollY || 0));
	};

	useEffect(() => {
		const showMapState = localStorage.getItem("showMap");
		if (window.ForceShowMap) {
			setShowMap("1");
		} else if (showMapState !== null) {
			setShowMap(showMapState);
		}
	}, []);

	useEffect(() => {
		const onToggleMap = (event: Event) => {
			const next =
				(event as CustomEvent<string>).detail ||
				localStorage.getItem("showMap") ||
				"0";
			setShowMap(next);
		};
		window.addEventListener("kulin-toggle-map", onToggleMap);
		return () => window.removeEventListener("kulin-toggle-map", onToggleMap);
	}, []);

	useEffect(() => {
		const savedGroup = sessionStorage.getItem("selectedGroup") || "All";
		setCurrentGroup(savedGroup);
	}, []);

	useEffect(() => {
		if (nezhaWsData) {
			restoreScrollPosition();
		}
	}, [nezhaWsData, restoreScrollPosition]);

	const groupTabs = [
		"All",
		...(groupData?.data
			?.filter((item: ServerGroup) => {
				return (
					Array.isArray(item.servers) &&
					item.servers.some((serverId) =>
						nezhaWsData?.servers?.some((server) => server.id === serverId),
					)
				);
			})
			?.map((item: ServerGroup) => item.group.name) || []),
	];

	if (!connected && !lastData) {
		return (
			<div className="flex flex-col items-center min-h-96 justify-center ">
				<div className="font-semibold flex items-center gap-2 text-sm">
					<Loader visible={true} />
					{t("info.websocketConnecting")}
				</div>
			</div>
		);
	}

	if (!nezhaWsData) {
		return (
			<div className="flex flex-col items-center justify-center ">
				<p className="font-semibold text-sm">{t("info.processing")}</p>
			</div>
		);
	}

	let filteredServers =
		nezhaWsData?.servers?.filter((server) => {
			if (currentGroup === "All") return true;
			const group = groupData?.data?.find(
				(g: ServerGroup) =>
					g.group.name === currentGroup &&
					Array.isArray(g.servers) &&
					g.servers.includes(server.id),
			);
			return !!group;
		}) || [];

	const overviewServers = filteredServers;
	const totalServers = overviewServers.length || 0;
	const onlineServers =
		overviewServers.filter(
			(server) => formatNezhaInfo(nezhaWsData.now, server).online,
		)?.length || 0;
	const offlineServers = totalServers - onlineServers;
	const up =
		overviewServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_out_transfer ?? 0)
					: total,
			0,
		) || 0;
	const down =
		overviewServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_in_transfer ?? 0)
					: total,
			0,
		) || 0;
	const upSpeed =
		overviewServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_out_speed ?? 0)
					: total,
			0,
		) || 0;
	const downSpeed =
		overviewServers.reduce(
			(total, server) =>
				formatNezhaInfo(nezhaWsData.now, server).online
					? total + (server.state?.net_in_speed ?? 0)
					: total,
			0,
		) || 0;

	if (overviewFilter === "online") {
		filteredServers = filteredServers.filter(
			(server) => formatNezhaInfo(nezhaWsData.now, server).online,
		);
	} else if (overviewFilter === "offline") {
		filteredServers = filteredServers.filter(
			(server) => !formatNezhaInfo(nezhaWsData.now, server).online,
		);
	}

	filteredServers = filteredServers.sort((a, b) => {
		const order = (b.display_index ?? 0) - (a.display_index ?? 0);
		return order !== 0 ? order : a.name.localeCompare(b.name);
	});

	return (
		<div className="mx-auto w-full max-w-5xl px-0">
			<ServerOverview
				selected={overviewFilter}
				onSelect={setOverviewFilter}
				total={totalServers}
				online={onlineServers}
				offline={offlineServers}
				up={up}
				down={down}
				upSpeed={upSpeed}
				downSpeed={downSpeed}
			/>
			<div className="mt-6 server-controls">
				<section className="min-w-0 overflow-hidden">
					<GroupSwitch
						tabs={groupTabs}
						currentTab={currentGroup}
						setCurrentTab={handleTagChange}
					/>
				</section>
			</div>
			{showMap === "1" && (
				<GlobalMap
					now={nezhaWsData.now}
					serverList={nezhaWsData?.servers || []}
				/>
			)}
			<section className="grid auto-rows-fr grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 mt-8 server-card-list">
				{filteredServers.map((serverInfo) => (
					<ServerCard
						now={nezhaWsData.now}
						key={serverInfo.id}
						serverInfo={serverInfo}
					/>
				))}
			</section>
		</div>
	);
}
