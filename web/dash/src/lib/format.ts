export function formatBytes(bytes: number, decimals: number = 2) {
	if (!+bytes) return "0 KB";

	const k = 1024;
	const dm = decimals < 0 ? 0 : decimals;
	const sizes = ["KB", "MB", "GB", "TB", "PB", "EB", "ZB", "YB"];

	const i = Math.max(0, Math.floor(Math.log(bytes) / Math.log(k)) - 1);
	const value = (bytes / k ** (i + 1)).toFixed(dm);

	return `${value} ${sizes[i]}`;
}

export function formatBytesCompact(bytes: number, decimals: number = 2) {
	return formatBytes(bytes, decimals).replace(/\s+/g, "");
}
