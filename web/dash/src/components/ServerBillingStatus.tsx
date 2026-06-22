import {
	cn,
	getDaysBetweenDatesWithAutoRenewal,
	type PublicNoteData,
} from "@/lib/utils";

import { getProgressTextColorClass } from "./ServerUsageBar";

type BillingStatus = {
	label: string;
	colorClass: string;
};

export function getBillingStatus(
	parsedData: PublicNoteData | null,
): BillingStatus | null {
	const billingData = parsedData?.billingDataMod;
	if (!billingData?.endDate) return null;
	if (billingData.endDate.startsWith("0000-00-00")) {
		return { label: "永 久", colorClass: "text-green-600" };
	}

	try {
		const daysLeftObject = getDaysBetweenDatesWithAutoRenewal(billingData);
		if (daysLeftObject.days < 0) {
			return {
				label: `过期 ${Math.abs(daysLeftObject.days)} 天`,
				colorClass: "text-red-500",
			};
		}
		const elapsedPercentage = Math.max(
			0,
			Math.min(100, 100 - daysLeftObject.remainingPercentage * 100),
		);
		return {
			label: `余 ${daysLeftObject.days} 天`,
			colorClass: getProgressTextColorClass(elapsedPercentage),
		};
	} catch (error) {
		console.error(error);
		return null;
	}
}

export default function ServerBillingStatus({
	parsedData,
	className,
}: {
	parsedData: PublicNoteData | null;
	className?: string;
}) {
	const status = getBillingStatus(parsedData);
	if (!status) return null;
	return (
		<span
			className={cn("font-medium tabular-nums", status.colorClass, className)}
		>
			{status.label}
		</span>
	);
}
