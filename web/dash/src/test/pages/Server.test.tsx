import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { WebSocketContextType } from "@/context/websocket-context";
import { WebSocketContext } from "@/context/websocket-context";
import Servers from "@/pages/Server";
import { createServer } from "@/test/fixtures";
import { renderWithProviders } from "@/test/utils";
import type { NezhaServer } from "@/types/nezha-api";

const apiMocks = vi.hoisted(() => ({
	fetchServerGroup: vi.fn(),
	fetchService: vi.fn(),
}));

vi.mock("@/lib/nezha-api", () => apiMocks);

vi.mock("@/components/GlobalMap", () => ({
	default: ({ serverList }: { serverList: NezhaServer[] }) => (
		<div data-testid="global-map">{serverList.length}</div>
	),
}));

vi.mock("@/components/GroupSwitch", () => ({
	default: ({
		tabs,
		setCurrentTab,
	}: {
		tabs: string[];
		setCurrentTab: (tab: string) => void;
	}) => (
		<div>
			{tabs.map((tab) => (
				<button
					key={tab}
					type="button"
					data-testid={`group-${tab}`}
					onClick={() => setCurrentTab(tab)}
				>
					{tab}
				</button>
			))}
		</div>
	),
}));

vi.mock("@/components/ServerOverview", () => ({
	default: ({
		offline,
		online,
		total,
	}: {
		offline: number;
		online: number;
		total: number;
	}) => (
		<div data-testid="server-overview">{`${total}:${online}:${offline}`}</div>
	),
}));

vi.mock("@/components/ServerCard", () => ({
	default: ({ serverInfo }: { serverInfo: NezhaServer }) => (
		<article data-testid="server-card">{serverInfo.name}</article>
	),
}));

function renderServerPage(websocketValue: Partial<WebSocketContextType>) {
	const defaultWebsocketValue: WebSocketContextType = {
		lastData: null,
		connected: false,
		messageHistory: [],
		reconnect: vi.fn(),
		needReconnect: false,
		setNeedReconnect: vi.fn(),
	};

	return renderWithProviders(
		<WebSocketContext.Provider
			value={{ ...defaultWebsocketValue, ...websocketValue }}
		>
			<Servers />
		</WebSocketContext.Provider>,
	);
}

function websocketPayload(servers: NezhaServer[]) {
	return {
		now: Date.parse("2025-01-01T00:00:20.000Z"),
		servers,
	};
}

describe("Servers page", () => {
	beforeEach(() => {
		apiMocks.fetchServerGroup.mockResolvedValue({
			success: true,
			data: [
				{
					group: {
						id: 1,
						created_at: "",
						updated_at: "",
						name: "Edge",
					},
					servers: [2],
				},
			],
		});
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {},
				cycle_transfer_stats: {},
			},
		});
	});

	it("renders websocket loading and processing states", () => {
		const { rerender } = renderServerPage({
			connected: false,
			lastData: null,
		});

		expect(screen.getByText("info.websocketConnecting")).toBeInTheDocument();

		rerender(
			<WebSocketContext.Provider
				value={{
					lastData: null,
					connected: true,
					messageHistory: [],
					reconnect: vi.fn(),
					needReconnect: false,
					setNeedReconnect: vi.fn(),
				}}
			>
				<Servers />
			</WebSocketContext.Provider>,
		);

		expect(screen.getByText("info.processing")).toBeInTheDocument();
	});

	it("summarizes online and offline servers from websocket data", async () => {
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});

		renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		expect(screen.getByTestId("server-overview")).toHaveTextContent("2:1:1");
		expect(screen.getAllByTestId("server-card")).toHaveLength(2);
		expect(screen.getByText("alpha")).toBeInTheDocument();
		expect(screen.getByText("beta")).toBeInTheDocument();

		await waitFor(() => {
			expect(apiMocks.fetchServerGroup).toHaveBeenCalled();
			expect(apiMocks.fetchService).toHaveBeenCalled();
		});
	});

	it("filters servers by selected group", async () => {
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});
		const user = userEvent.setup();

		renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		await user.click(await screen.findByTestId("group-Edge"));

		expect(screen.queryByText("alpha")).not.toBeInTheDocument();
		expect(screen.getByText("beta")).toBeInTheDocument();
		expect(sessionStorage.getItem("selectedGroup")).toBe("Edge");
	});

	it("restores the saved main page scroll position after data is ready", async () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("scrollTo", scrollTo);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
		sessionStorage.setItem("fromMainPage", "true");
		sessionStorage.setItem("scrollPosition", "345");

		renderServerPage({
			connected: true,
			lastData: websocketPayload([createServer({ id: 1, name: "alpha" })]),
		});

		await waitFor(() => {
			expect(scrollTo).toHaveBeenCalledWith({
				top: 345,
				left: 0,
				behavior: "auto",
			});
		});
	});

	it("does not restore stale scroll positions without a main page origin", () => {
		const scrollTo = vi.fn();
		vi.stubGlobal("scrollTo", scrollTo);
		vi.spyOn(window, "requestAnimationFrame").mockImplementation((callback) => {
			callback(0);
			return 0;
		});
		sessionStorage.setItem("scrollPosition", "345");

		renderServerPage({
			connected: true,
			lastData: websocketPayload([createServer({ id: 1, name: "alpha" })]),
		});

		expect(scrollTo).not.toHaveBeenCalled();
	});

	it("toggles the map control", async () => {
		apiMocks.fetchService.mockResolvedValue({
			success: true,
			data: {
				services: {
					http: {
						service_name: "HTTP",
						current_up: 1,
						current_down: 0,
						total_up: 1,
						total_down: 0,
						delay: [10],
						up: [1],
						down: [0],
					},
				},
				cycle_transfer_stats: {},
			},
		});
		const user = userEvent.setup();
		const online = createServer({ id: 1, name: "alpha" });
		const offline = createServer({
			id: 2,
			name: "beta",
			last_active: "2024-12-31T23:00:00.000Z",
		});

		const { container } = renderServerPage({
			connected: true,
			lastData: websocketPayload([online, offline]),
		});

		await waitFor(() => {
			expect(apiMocks.fetchService).toHaveBeenCalled();
			expect(
				container.querySelectorAll(
					".server-overview-controls section > button",
				),
			).toHaveLength(1);
		});

		const controls = container.querySelectorAll(
			".server-overview-controls section > button",
		);
		await user.click(controls[0]);
		expect(screen.getByTestId("global-map")).toHaveTextContent("2");
		expect(localStorage.getItem("showMap")).toBe("1");
	});
});
