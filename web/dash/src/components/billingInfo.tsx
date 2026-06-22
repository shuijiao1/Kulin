import { t } from "@/lib/labels";
import { cn, type PublicNoteData } from "@/lib/utils";

export default function BillingInfo({
	parsedData,
}: {
	parsedData: PublicNoteData;
}) {
	if (!parsedData?.billingDataMod) {
		return null;
	}

	return (
		<>
			{parsedData.billingDataMod.amount &&
			parsedData.billingDataMod.amount !== "0" &&
			parsedData.billingDataMod.amount !== "-1" ? (
				<p className={cn("text-[9px] text-muted-foreground ")}>
					{t("billingInfo.price")}: {parsedData.billingDataMod.amount}/
					{parsedData.billingDataMod.cycle}
				</p>
			) : parsedData.billingDataMod.amount === "0" ? (
				<p className={cn("text-[9px] text-green-600 ")}>
					{t("billingInfo.free")}
				</p>
			) : parsedData.billingDataMod.amount === "-1" ? (
				<p className={cn("text-[9px] text-pink-600 ")}>
					{t("billingInfo.usage-baseed")}
				</p>
			) : null}
		</>
	);
}
