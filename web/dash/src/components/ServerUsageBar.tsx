import { Progress } from "@/components/ui/progress";

type ServerUsageBarProps = {
	value: number;
	threshold?: "usage" | "remaining";
};

export function getProgressColorClass(
	value: number,
	threshold: "usage" | "remaining" = "usage",
) {
	if (threshold === "remaining") {
		return value < 10
			? "bg-red-500"
			: value < 40
				? "bg-orange-400"
				: "bg-green-500";
	}
	return value > 90
		? "bg-red-500"
		: value > 60
			? "bg-orange-400"
			: "bg-green-500";
}

export function getProgressTextColorClass(
	value: number,
	threshold: "usage" | "remaining" = "usage",
) {
	if (threshold === "remaining") {
		return value < 10
			? "text-red-500"
			: value < 40
				? "text-orange-500"
				: "text-green-600";
	}
	return value > 90
		? "text-red-500"
		: value > 60
			? "text-orange-500"
			: "text-green-600";
}

export default function ServerUsageBar({
	value,
	threshold = "usage",
}: ServerUsageBarProps) {
	return (
		<Progress
			aria-label={"Server Usage Bar"}
			aria-labelledby={"Server Usage Bar"}
			value={value}
			indicatorClassName={getProgressColorClass(value, threshold)}
			className={"h-2.5 rounded-sm"}
		/>
	);
}
