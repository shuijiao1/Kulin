import { cn } from "@/lib/utils";

import { getProgressColorClass } from "./ServerUsageBar";
import { Progress } from "./ui/progress";

export default function RemainPercentBar({
	value,
	className,
}: {
	value: number;
	className?: string;
}) {
	return (
		<Progress
			aria-label={"Server Usage Bar"}
			aria-labelledby={"Server Usage Bar"}
			value={value}
			indicatorClassName={getProgressColorClass(100 - value)}
			className={cn("h-[3px] rounded-sm w-[70px]", className)}
		/>
	);
}
