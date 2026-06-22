import { useQuery } from "@tanstack/react-query";
import { ImageMinus, MapIcon } from "lucide-react";
import { useEffect, useRef } from "react";
import { t } from "@/lib/labels";
import { useNavigate } from "react-router-dom";
import { ModeToggle } from "@/components/ThemeSwitcher";
import { useBackground } from "@/hooks/use-background";
import { useWebSocketContext } from "@/hooks/use-websocket-context";
import { fetchLoginUser, fetchSetting } from "@/lib/nezha-api";
import { cn } from "@/lib/utils";

import { LoadingSpinner } from "./loading/Loader";
import { Button } from "./ui/button";

function Header() {
	const navigate = useNavigate();
	const { backgroundImage, updateBackground } = useBackground();

	const { data: settingData } = useQuery({
		queryKey: ["setting"],
		queryFn: () => fetchSetting(),
		refetchOnMount: true,
		refetchOnWindowFocus: true,
	});

	const siteName = settingData?.data?.config?.site_name;
	const avatarURL = settingData?.data?.config?.avatar_url;

	// @ts-expect-error CustomLogo is a global variable
	const customLogo = avatarURL || window.CustomLogo || "/apple-touch-icon.png";

	const customMobileBackgroundImage =
		window.CustomMobileBackgroundImage !== ""
			? window.CustomMobileBackgroundImage
			: undefined;

	useEffect(() => {
		const link =
			document.querySelector("link[rel*='icon']") ||
			document.createElement("link");
		// @ts-expect-error set link.type
		link.type = "image/x-icon";
		// @ts-expect-error set link.rel
		link.rel = "shortcut icon";
		// @ts-expect-error set link.href
		link.href = customLogo;
		document.getElementsByTagName("head")[0].appendChild(link);
	}, [customLogo]);

	useEffect(() => {
		document.title = siteName || "Kulin";
	}, [siteName]);

	const handleBackgroundToggle = () => {
		if (window.CustomBackgroundImage) {
			// Store the current background image before removing it
			sessionStorage.setItem(
				"savedBackgroundImage",
				window.CustomBackgroundImage,
			);
			updateBackground(undefined);
		} else {
			// Restore the saved background image
			const savedImage = sessionStorage.getItem("savedBackgroundImage");
			if (savedImage) {
				updateBackground(savedImage);
			}
		}
	};

	const customBackgroundImage = backgroundImage;

	const handleMapToggle = () => {
		const next = localStorage.getItem("showMap") === "1" ? "0" : "1";
		localStorage.setItem("showMap", next);
		window.dispatchEvent(new CustomEvent("kulin-toggle-map", { detail: next }));
	};

	return (
		<div className="mx-auto w-full max-w-5xl">
			<section className="flex items-center justify-between header-top">
				<section
					onClick={() => {
						sessionStorage.removeItem("selectedGroup");
						navigate("/");
					}}
					className="cursor-pointer flex items-center sm:text-base text-sm font-medium"
				>
					<div className="mr-1 flex flex-row items-center justify-start header-logo">
						<img
							width={40}
							height={40}
							alt="apple-touch-icon"
							src={customLogo}
							className="relative m-0! border-2 border-transparent h-6 w-6 object-cover object-top p-0!"
						/>
					</div>
					<span className="text-sm font-semibold">{siteName || "Kulin"}</span>
				</section>
				<section className="flex items-center gap-2 header-handles">
					<div className="hidden sm:flex items-center gap-2">
						<Links />
						<DashboardLink />
					</div>
					<Button
						variant="outline"
						size="sm"
						onClick={handleMapToggle}
						className="rounded-full bg-white px-[9px] text-black hover:bg-neutral-100 dark:bg-black dark:text-white dark:hover:bg-neutral-900"
					>
						<MapIcon className="h-4 w-4" />
					</Button>
					<ModeToggle />
					{(customBackgroundImage ||
						sessionStorage.getItem("savedBackgroundImage")) && (
						<Button
							variant="outline"
							size="sm"
							onClick={handleBackgroundToggle}
							className={cn("rounded-full px-[9px] bg-white dark:bg-black", {
								"bg-white/70 dark:bg-black/70": customBackgroundImage,
								"hidden sm:block": customMobileBackgroundImage,
							})}
						>
							<ImageMinus className="w-4 h-4" />
						</Button>
					)}
				</section>
			</section>
			<div className="w-full flex justify-between sm:hidden mt-1">
				<DashboardLink />
				<Links />
			</div>
		</div>
	);
}

type links = {
	link: string;
	name: string;
};

function parseCustomLinks(customLinks: string | undefined): links[] | null {
	if (!customLinks) return null;

	try {
		const parsedLinks = JSON.parse(customLinks);

		if (!Array.isArray(parsedLinks)) {
			return null;
		}

		return parsedLinks.filter(
			(link): link is links =>
				typeof link?.link === "string" && typeof link?.name === "string",
		);
	} catch {
		return null;
	}
}

function Links() {
	// @ts-expect-error CustomLinks is a global variable
	const customLinks = window.CustomLinks as string;

	const links = parseCustomLinks(customLinks);

	if (!links) return null;

	return (
		<div className="flex items-center gap-2 w-fit">
			{links.map((link, index) => {
				return (
					<a
						key={index}
						href={link.link}
						target="_blank"
						rel="noopener noreferrer"
						className="flex items-center gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
					>
						{link.name}
					</a>
				);
			})}
		</div>
	);
}

export function RefreshToast() {
	const navigate = useNavigate();

	const { needReconnect } = useWebSocketContext();

	if (!needReconnect) {
		return null;
	}

	if (needReconnect) {
		sessionStorage.removeItem("needRefresh");
		setTimeout(() => {
			navigate(0);
		}, 1000);
	}

	return (
		<div className="refresh-toast-animate fixed left-1/2 -translate-x-1/2 top-8 z-999 flex items-center justify-between gap-4 rounded-[50px] border border-solid bg-white px-2 py-1.5 shadow-xl shadow-black/5 dark:border-stone-700 dark:bg-stone-800 dark:shadow-none">
			<section className="flex items-center gap-1.5">
				<LoadingSpinner />
				<p className="text-[12.5px] font-medium">{t("refreshing")}...</p>
			</section>
		</div>
	);
}

function DashboardLink() {
	const { setNeedReconnect } = useWebSocketContext();
	const previousLoginState = useRef<boolean | null>(null);
	const {
		data: userData,
		isFetched,
		isLoadingError,
		isError,
		refetch,
	} = useQuery({
		queryKey: ["login-user"],
		queryFn: () => fetchLoginUser(),
		refetchOnMount: false,
		refetchOnWindowFocus: true,
		refetchIntervalInBackground: true,
		refetchInterval: 1000 * 30,
		retry: 0,
	});

	const isLogin = isError
		? false
		: userData
			? !!userData?.data?.id && !!document.cookie
			: false;

	if (isLoadingError) {
		previousLoginState.current = isLogin;
	}

	useEffect(() => {
		refetch();
	}, [refetch]);

	useEffect(() => {
		if (isFetched || isError) {
			// 只有当登录状态发生变化时才设置needReconnect
			if (
				previousLoginState.current !== null &&
				previousLoginState.current !== isLogin
			) {
				setNeedReconnect(true);
			}
			previousLoginState.current = isLogin;
		}
	}, [isLogin, isError, isFetched, setNeedReconnect]);

	return (
		<div className="flex items-center gap-2">
			<a
				href={"/dashboard"}
				rel="noopener noreferrer"
				className="flex items-center text-nowrap gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
			>
				{!isLogin && t("login")}
				{isLogin && t("dashboard")}
			</a>
		</div>
	);
}

export default Header;
