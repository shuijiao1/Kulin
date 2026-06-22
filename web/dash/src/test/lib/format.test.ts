import { describe, expect, it } from "vitest";

import { formatBytes } from "@/lib/format";

describe("formatBytes", () => {
	it("formats empty byte values as zero KB", () => {
		expect(formatBytes(0)).toBe("0 KB");
		expect(formatBytes(Number.NaN)).toBe("0 KB");
	});

	it("keeps byte values in binary units", () => {
		expect(formatBytes(512)).toBe("0.50 KB");
		expect(formatBytes(1024)).toBe("1.00 KB");
		expect(formatBytes(1024 ** 2)).toBe("1.00 MB");
		expect(formatBytes(1024 ** 3 * 2.5, 1)).toBe("2.5 GB");
	});

	it("clamps negative decimal precision to an integer", () => {
		expect(formatBytes(1536, -1)).toBe("2 KB");
	});
});
