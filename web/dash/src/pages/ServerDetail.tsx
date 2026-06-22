import { lazy, Suspense, useEffect } from "react";
import { Navigate, useParams } from "react-router-dom";
import NetworkChartLoading from "@/components/NetworkChartLoading";
import ServerDetailChart from "@/components/ServerDetailChart";
import ServerDetailOverview from "@/components/ServerDetailOverview";

const NetworkChart = lazy(() =>
	import("@/components/NetworkChart").then((module) => ({
		default: module.NetworkChart,
	})),
);

export default function ServerDetail() {
	useEffect(() => {
		window.scrollTo({ top: 0, left: 0, behavior: "instant" });
	}, []);

	const { id: server_id } = useParams();

	if (!server_id) {
		return <Navigate to="/404" replace />;
	}

	return (
		<div className="mx-auto w-full max-w-5xl px-0 flex flex-col gap-8 server-info">
			<ServerDetailOverview server_id={server_id} />
			<Suspense fallback={<NetworkChartLoading />}>
				<NetworkChart server_id={Number(server_id)} show={true} />
			</Suspense>
			<ServerDetailChart server_id={server_id} />
		</div>
	);
}
