import { useEffect, useState } from "react";

declare global {
	interface Window {
		CustomBackgroundImage: string;
		CustomMobileBackgroundImage: string;
		ForceShowServices: boolean;
		ForceShowMap: boolean;
		ForcePeakCutEnabled: boolean;
		ForceSortType?: string;
		ForceSortOrder?: string;
	}
}

const BACKGROUND_CHANGE_EVENT = "backgroundChange";
const SAVED_BACKGROUND_IMAGE_KEY = "savedBackgroundImage";
const BACKGROUND_DISABLED_KEY = "backgroundDisabled";

export function isBackgroundDisabled() {
	return localStorage.getItem(BACKGROUND_DISABLED_KEY) === "1";
}

export function disableBackground() {
	localStorage.setItem(BACKGROUND_DISABLED_KEY, "1");
}

export function enableBackground() {
	localStorage.removeItem(BACKGROUND_DISABLED_KEY);
}

export function getSavedBackgroundImage() {
	return localStorage.getItem(SAVED_BACKGROUND_IMAGE_KEY);
}

export function saveBackgroundImage(backgroundImage: string) {
	localStorage.setItem(SAVED_BACKGROUND_IMAGE_KEY, backgroundImage);
}

export function useBackground(defaultBackgroundImage?: string) {
	const [backgroundImage, setBackgroundImage] = useState<string | undefined>(
		defaultBackgroundImage || undefined,
	);

	useEffect(() => {
		// 监听背景变化
		const handleBackgroundChange = () => {
			setBackgroundImage(window.CustomBackgroundImage || undefined);
		};

		// 初始化检查
		const checkInitialBackground = () => {
			if (isBackgroundDisabled()) {
				window.CustomBackgroundImage = "";
				setBackgroundImage(undefined);
			} else if (window.CustomBackgroundImage) {
				setBackgroundImage(window.CustomBackgroundImage);
			} else if (defaultBackgroundImage) {
				window.CustomBackgroundImage = defaultBackgroundImage;
				setBackgroundImage(defaultBackgroundImage);
			} else {
				const savedImage = getSavedBackgroundImage();
				if (savedImage) {
					window.CustomBackgroundImage = savedImage;
					setBackgroundImage(savedImage);
				}
			}
		};

		// 设置一个轮询来检查初始背景
		const intervalId = setInterval(() => {
			if (
				isBackgroundDisabled() ||
				window.CustomBackgroundImage ||
				defaultBackgroundImage ||
				getSavedBackgroundImage()
			) {
				checkInitialBackground();
				clearInterval(intervalId);
			}
		}, 100);

		window.addEventListener(BACKGROUND_CHANGE_EVENT, handleBackgroundChange);

		return () => {
			window.removeEventListener(
				BACKGROUND_CHANGE_EVENT,
				handleBackgroundChange,
			);
			clearInterval(intervalId);
		};
	}, [defaultBackgroundImage]);

	const updateBackground = (newBackground: string | undefined) => {
		window.CustomBackgroundImage = newBackground || "";
		if (newBackground) {
			saveBackgroundImage(newBackground);
		}
		window.dispatchEvent(new Event(BACKGROUND_CHANGE_EVENT));
	};

	return { backgroundImage, updateBackground };
}
