import { getServerServiceBinding, updateServer, updateServerServiceBinding } from "@/api/server"
import { getServices } from "@/api/service"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Switch } from "@/components/ui/switch"
import { IconButton } from "@/components/xui/icon-button"
import { t } from "@/lib/labels"
import {
    type PublicNote,
    applyPublicNoteDate,
    applyPublicNotePatch,
    normalizeISO,
    parsePublicNote,
    toggleEndNoExpiry,
    validatePublicNote,
} from "@/lib/public-note"
import { asOptionalField } from "@/lib/utils"
import { ModelServer, ModelService } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { ExpandedCheckList } from "./xui/expanded-check-list"

interface ServerCardProps {
    data: ModelServer
    mutate: KeyedMutator<ModelServer[]>
}

const formatTrafficLimitForForm = (limit?: number) => {
    if (!limit) {
        return {
            traffic_progress_limit_input: undefined,
            traffic_progress_limit_unit: "GB" as const,
        }
    }

    const isTB = limit >= 1024 ** 4
    return {
        traffic_progress_limit_input: limit / (isTB ? 1024 ** 4 : 1024 ** 3),
        traffic_progress_limit_unit: isTB ? ("TB" as const) : ("GB" as const),
    }
}

const serverFormSchema = z.object({
    name: z.string().min(1),
    traffic_progress_enabled: asOptionalField(z.boolean()),
    traffic_progress_mode: asOptionalField(z.enum(["out", "in", "max", "dual"])),
    traffic_progress_limit_input: z.coerce.number().min(0).optional(),
    traffic_progress_limit_unit: asOptionalField(z.enum(["GB", "TB"])),
    traffic_progress_start_day: asOptionalField(z.coerce.number().int().min(1).max(31)),
    home_monitor_id: asOptionalField(z.coerce.number().int().min(0)),
})

export const ServerCard: React.FC<ServerCardProps> = ({ data, mutate }) => {
    const form = useForm({
        resolver: zodResolver(serverFormSchema) as any,
        defaultValues: {
            ...data,
            ...formatTrafficLimitForForm(data.traffic_progress_limit),
            traffic_progress_start_day: data.traffic_progress_start_day ?? 1,
            home_monitor_id: data.home_monitor_id ?? 0,
        },
        resetOptions: {
            keepDefaultValues: false,
        },
    })
    const [open, setOpen] = useState(false)
    const [serviceOptions, setServiceOptions] = useState<{ value: string; label: string }[]>([])
    const [selectedServices, setSelectedServices] = useState<string[]>([])

    useEffect(() => {
        if (!open || !data?.id) return
        Promise.all([getServices(), getServerServiceBinding(data.id)])
            .then(([services, binding]: [ModelService[], Record<string, boolean>]) => {
                const filtered = services.filter((svc: ModelService) =>
                    [1, 2, 3].includes(svc.type),
                )
                setServiceOptions(
                    filtered.map((svc: ModelService) => ({ value: `${svc.id}`, label: svc.name })),
                )
                setSelectedServices(
                    Object.entries(binding)
                        .filter(([, enabled]) => enabled)
                        .map(([id]) => id),
                )
            })
            .catch(() => {})
    }, [open, data?.id])

    const [publicNoteObj, setPublicNoteObj] = useState<PublicNote>(
        parsePublicNote(data?.public_note),
    )
    const [publicNoteErrors, setPublicNoteErrors] = useState<
        Partial<
            Record<
                | "billing.startDate"
                | "billing.endDate"
                | "billing.autoRenewal"
                | "billing.cycle"
                | "billing.amount"
                | "billing.renewalNotifyDays",
                string
            >
        >
    >({})

    const patchPublicNote = (path: string, value: string | undefined) => {
        setPublicNoteObj((prev) => applyPublicNotePatch(prev, path, value))
    }
    const patchPublicNoteDate = (
        path: "billingDataMod.startDate" | "billingDataMod.endDate",
        d: Date,
    ) => {
        setPublicNoteObj((prev) => applyPublicNoteDate(prev, path, d))
    }
    const toggleEndNoExpiryLocal = () => {
        setPublicNoteObj((prev) => toggleEndNoExpiry(prev))
    }
    const toggleRenewalNotifyDay = (day: number, checked: boolean) => {
        setPublicNoteObj((prev) => {
            const current = prev.billingDataMod?.renewalNotifyDays ?? []
            const next = checked
                ? Array.from(new Set([...current, day])).sort((a, b) => b - a)
                : current.filter((item) => item !== day)
            return applyPublicNotePatch(
                prev,
                "billingDataMod.renewalNotifyDays",
                next.length > 0 ? (next as any) : undefined,
            )
        })
    }

    const onSubmit = async (values: any) => {
        try {
            const limitValue = Number(values.traffic_progress_limit_input || 0)
            const limitUnit = values.traffic_progress_limit_unit || "GB"
            values.traffic_progress_limit = Math.round(
                limitValue * (limitUnit === "TB" ? 1024 ** 4 : 1024 ** 3),
            )
            delete values.traffic_progress_limit_input
            delete values.traffic_progress_limit_unit

            const { errors, valid } = validatePublicNote(publicNoteObj)
            if (!valid) {
                setPublicNoteErrors(errors)
                toast(t("Error"), { description: t("Validation.InvalidForm") })
                return
            }
            setPublicNoteErrors({})

            const bd = publicNoteObj.billingDataMod
            const pnNormalized: PublicNote = {
                billingDataMod: bd && {
                    ...bd,
                    startDate: normalizeISO(bd.startDate),
                    endDate: normalizeISO(bd.endDate),
                },
            }
            const jsonStr = JSON.stringify(pnNormalized)
            values.public_note = jsonStr.length > 2 ? jsonStr : undefined

            await updateServer(data!.id!, values)
            await updateServerServiceBinding(
                data!.id!,
                Object.fromEntries(
                    serviceOptions.map((svc) => [svc.value, selectedServices.includes(svc.value)]),
                ),
            )
        } catch (e) {
            console.error(e)
            toast(t("Error"), {
                description: t("Results.UnExpectedError"),
            })
            return
        }
        setOpen(false)
        await mutate()
        form.reset()
    }

    const handleOpenChange = (v: boolean) => {
        if (v) {
            form.reset({
                ...data,
                ...formatTrafficLimitForForm(data.traffic_progress_limit),
                traffic_progress_start_day: data.traffic_progress_start_day ?? 1,
                home_monitor_id: data.home_monitor_id ?? 0,
            })
            setPublicNoteObj(parsePublicNote(data?.public_note))
            setPublicNoteErrors({})
        }
        setOpen(v)
    }

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogTrigger asChild>
                <IconButton variant="outline" icon="edit" />
            </DialogTrigger>
            <DialogContent
                className="sm:max-w-xl"
                onInteractOutside={(e) => e.preventDefault()}
                onEscapeKeyDown={(e) => e.preventDefault()}
            >
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>{t("EditServer")}</DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="My Server" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <div className="rounded-md border p-3 space-y-3">
                                    <div className="text-sm font-medium opacity-80">流量条</div>
                                    <FormField
                                        control={form.control}
                                        name="traffic_progress_enabled"
                                        render={({ field }) => (
                                            <FormItem className="flex items-center space-x-2">
                                                <FormControl>
                                                    <div className="flex items-center gap-2">
                                                        <Checkbox
                                                            checked={field.value}
                                                            onCheckedChange={field.onChange}
                                                        />
                                                        <Label className="text-sm">
                                                            启用流量条
                                                        </Label>
                                                    </div>
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <FormField
                                        control={form.control}
                                        name="traffic_progress_mode"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>流量统计方式</FormLabel>
                                                <Select
                                                    onValueChange={field.onChange}
                                                    defaultValue={field.value ?? "out"}
                                                >
                                                    <FormControl>
                                                        <SelectTrigger>
                                                            <SelectValue placeholder="out" />
                                                        </SelectTrigger>
                                                    </FormControl>
                                                    <SelectContent>
                                                        <SelectItem value="out">出向</SelectItem>
                                                        <SelectItem value="in">入向</SelectItem>
                                                        <SelectItem value="max">
                                                            出入取大
                                                        </SelectItem>
                                                        <SelectItem value="dual">双向</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                    <div className="grid grid-cols-[1fr_96px] gap-2">
                                        <FormField
                                            control={form.control}
                                            name="traffic_progress_limit_input"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>流量上限</FormLabel>
                                                    <FormControl>
                                                        <Input
                                                            type="number"
                                                            min="0"
                                                            step="0.01"
                                                            placeholder="1024"
                                                            {...field}
                                                        />
                                                    </FormControl>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                        <FormField
                                            control={form.control}
                                            name="traffic_progress_limit_unit"
                                            render={({ field }) => (
                                                <FormItem>
                                                    <FormLabel>单位</FormLabel>
                                                    <Select
                                                        onValueChange={field.onChange}
                                                        defaultValue={field.value ?? "GB"}
                                                    >
                                                        <FormControl>
                                                            <SelectTrigger>
                                                                <SelectValue placeholder="GB" />
                                                            </SelectTrigger>
                                                        </FormControl>
                                                        <SelectContent>
                                                            <SelectItem value="GB">GB</SelectItem>
                                                            <SelectItem value="TB">TB</SelectItem>
                                                        </SelectContent>
                                                    </Select>
                                                    <FormMessage />
                                                </FormItem>
                                            )}
                                        />
                                    </div>

                                    <FormField
                                        control={form.control}
                                        name="traffic_progress_start_day"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormLabel>流量周期起始日</FormLabel>
                                                <FormControl>
                                                    <Input
                                                        type="number"
                                                        min="1"
                                                        max="31"
                                                        step="1"
                                                        placeholder="1"
                                                        {...field}
                                                    />
                                                </FormControl>
                                                <p className="text-xs text-muted-foreground">
                                                    每月从这一天开始重新计算流量，例如填 15 就按每月
                                                    15 日到下月 14 日统计。
                                                </p>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="rounded-md border p-3 space-y-3">
                                    <div className="text-sm font-medium opacity-80">
                                        关联延迟监控
                                    </div>
                                    <FormField
                                        control={form.control}
                                        name="home_monitor_id"
                                        render={({ field }) => (
                                            <FormItem>
                                                <FormControl>
                                                    <ExpandedCheckList
                                                        title="已选延迟监控"
                                                        options={serviceOptions}
                                                        value={selectedServices}
                                                        onChange={(next) => {
                                                            setSelectedServices(next)
                                                            const currentHomeMonitor = `${
                                                                field.value ?? 0
                                                            }`
                                                            if (
                                                                currentHomeMonitor !== "0" &&
                                                                !next.includes(currentHomeMonitor)
                                                            ) {
                                                                field.onChange(0)
                                                            }
                                                        }}
                                                        emptyText="暂无延迟监控"
                                                        renderRight={(option, checked) => (
                                                            <label
                                                                className={`flex shrink-0 items-center gap-1 text-xs ${
                                                                    checked
                                                                        ? "text-foreground"
                                                                        : "text-muted-foreground"
                                                                }`}
                                                            >
                                                                <input
                                                                    type="radio"
                                                                    name={`home-monitor-${data.id}`}
                                                                    className="h-4 w-4"
                                                                    checked={
                                                                        checked &&
                                                                        `${field.value ?? 0}` ===
                                                                            option.value
                                                                    }
                                                                    disabled={!checked}
                                                                    onChange={() =>
                                                                        field.onChange(
                                                                            checked
                                                                                ? Number(
                                                                                      option.value,
                                                                                  )
                                                                                : 0,
                                                                        )
                                                                    }
                                                                />
                                                                首页展示
                                                            </label>
                                                        )}
                                                    />
                                                </FormControl>
                                                <FormMessage />
                                            </FormItem>
                                        )}
                                    />
                                </div>
                                <div className="rounded-md border p-3 space-y-3">
                                    <div className="text-sm font-medium opacity-80">账单</div>
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <div className="space-y-1">
                                            <Label className="text-xs">
                                                {t("PublicNote.StartDate")}
                                            </Label>
                                            {/* Add 'Clear' button to allow removing the date */}
                                            <Button
                                                type="button"
                                                variant="outline"
                                                className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700 ml-2"
                                                onClick={() =>
                                                    patchPublicNote(
                                                        "billingDataMod.startDate",
                                                        undefined,
                                                    )
                                                }
                                            >
                                                {t("PublicNote.ClearDate") ?? "Clear"}
                                            </Button>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start text-left font-normal"
                                                    >
                                                        {publicNoteObj.billingDataMod?.startDate
                                                            ? new Date(
                                                                  publicNoteObj.billingDataMod!
                                                                      .startDate!,
                                                              ).toLocaleDateString()
                                                            : "YYYY-MM-DD"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="p-0 w-[300px] max-h-[60dvh] overflow-hidden"
                                                    align="start"
                                                >
                                                    <div className="max-h-[500px] overflow-y-auto">
                                                        <Calendar
                                                            className="w-full min-h-[320px]"
                                                            mode="single"
                                                            captionLayout="dropdown"
                                                            startMonth={new Date(2000, 0)}
                                                            endMonth={new Date(2050, 11)}
                                                            selected={
                                                                publicNoteObj.billingDataMod
                                                                    ?.startDate
                                                                    ? new Date(
                                                                          publicNoteObj
                                                                              .billingDataMod!
                                                                              .startDate!,
                                                                      )
                                                                    : undefined
                                                            }
                                                            onSelect={(d) => {
                                                                if (!d) return
                                                                patchPublicNoteDate(
                                                                    "billingDataMod.startDate",
                                                                    d,
                                                                )
                                                            }}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>
                                            {publicNoteErrors["billing.startDate"] && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {publicNoteErrors["billing.startDate"]}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">
                                                    {t("PublicNote.EndDate")}
                                                </Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700"
                                                    onClick={toggleEndNoExpiryLocal}
                                                >
                                                    {publicNoteObj.billingDataMod?.endDate ===
                                                    "0000-00-00T23:59:59+08:00"
                                                        ? t("PublicNote.CancelNoExpiry")
                                                        : t("PublicNote.SetNoExpiry")}
                                                </Button>
                                                {/* Add 'Clear' button to allow removing the date */}
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700"
                                                    onClick={() =>
                                                        patchPublicNote(
                                                            "billingDataMod.endDate",
                                                            undefined,
                                                        )
                                                    }
                                                >
                                                    {t("PublicNote.ClearDate") ?? "Clear"}
                                                </Button>
                                            </div>
                                            <Popover>
                                                <PopoverTrigger asChild>
                                                    <Button
                                                        variant="outline"
                                                        className="w-full justify-start text-left font-normal"
                                                    >
                                                        {publicNoteObj.billingDataMod?.endDate
                                                            ? publicNoteObj.billingDataMod
                                                                  ?.endDate ===
                                                              "0000-00-00T23:59:59+08:00"
                                                                ? t("PublicNote.NoExpiry")
                                                                : new Date(
                                                                      publicNoteObj.billingDataMod
                                                                          ?.endDate as string,
                                                                  ).toLocaleDateString()
                                                            : "YYYY-MM-DD"}
                                                    </Button>
                                                </PopoverTrigger>
                                                <PopoverContent
                                                    className="p-0 w-[300px] max-h-[60dvh] overflow-hidden"
                                                    align="start"
                                                >
                                                    <div className="max-h-[500px] overflow-y-auto">
                                                        <Calendar
                                                            className="w-full min-h-[320px]"
                                                            mode="single"
                                                            captionLayout="dropdown"
                                                            startMonth={new Date(2000, 0)}
                                                            endMonth={new Date(2050, 11)}
                                                            selected={
                                                                publicNoteObj.billingDataMod
                                                                    ?.endDate &&
                                                                publicNoteObj.billingDataMod
                                                                    ?.endDate !==
                                                                    "0000-00-00T23:59:59+08:00"
                                                                    ? new Date(
                                                                          publicNoteObj
                                                                              .billingDataMod
                                                                              ?.endDate as string,
                                                                      )
                                                                    : undefined
                                                            }
                                                            onSelect={(d) => {
                                                                if (!d) return
                                                                patchPublicNoteDate(
                                                                    "billingDataMod.endDate",
                                                                    d,
                                                                )
                                                            }}
                                                            autoFocus
                                                        />
                                                    </div>
                                                </PopoverContent>
                                            </Popover>

                                            {publicNoteErrors["billing.endDate"] && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {publicNoteErrors["billing.endDate"]}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">
                                                    {t("PublicNote.AutoRenewal")}
                                                </Label>
                                            </div>
                                            <div className="flex items-center gap-2 mt-3">
                                                <span className="text-xs">
                                                    {t("PublicNote.Disabled")}
                                                </span>
                                                <Switch
                                                    checked={
                                                        publicNoteObj.billingDataMod
                                                            ?.autoRenewal === "1"
                                                    }
                                                    onCheckedChange={(checked) =>
                                                        patchPublicNote(
                                                            "billingDataMod.autoRenewal",
                                                            checked ? "1" : undefined,
                                                        )
                                                    }
                                                />
                                                <span className="text-xs">
                                                    {t("PublicNote.Enabled")}
                                                </span>
                                            </div>

                                            {publicNoteErrors["billing.autoRenewal"] && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {publicNoteErrors["billing.autoRenewal"]}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">
                                                    {t("PublicNote.Cycle")}
                                                </Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700"
                                                    onClick={() =>
                                                        patchPublicNote(
                                                            "billingDataMod.cycle",
                                                            undefined,
                                                        )
                                                    }
                                                >
                                                    {t("PublicNote.Clear") ?? "Clear"}
                                                </Button>
                                            </div>
                                            <Select
                                                onValueChange={(val) =>
                                                    patchPublicNote("billingDataMod.cycle", val)
                                                }
                                                value={publicNoteObj.billingDataMod?.cycle}
                                            >
                                                <SelectTrigger>
                                                    <SelectValue placeholder="选择周期" />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    <SelectItem value="Day">
                                                        {t("PublicNote.Day")}
                                                    </SelectItem>
                                                    <SelectItem value="Week">
                                                        {t("PublicNote.Week")}
                                                    </SelectItem>
                                                    <SelectItem value="Month">
                                                        {t("PublicNote.Month")}
                                                    </SelectItem>
                                                    <SelectItem value="Quarter">
                                                        {t("PublicNote.Quarter")}
                                                    </SelectItem>
                                                    <SelectItem value="HalfYear">
                                                        {t("PublicNote.HalfYear")}
                                                    </SelectItem>
                                                    <SelectItem value="Year">
                                                        {t("PublicNote.Year")}
                                                    </SelectItem>
                                                    <SelectItem value="TwoYears">
                                                        {t("PublicNote.TwoYears")}
                                                    </SelectItem>
                                                    <SelectItem value="ThreeYears">
                                                        {t("PublicNote.ThreeYears")}
                                                    </SelectItem>
                                                    <SelectItem value="FiveYears">
                                                        {t("PublicNote.FiveYears")}
                                                    </SelectItem>
                                                </SelectContent>
                                            </Select>
                                            {publicNoteErrors["billing.cycle"] && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {publicNoteErrors["billing.cycle"]}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-2 sm:col-span-2">
                                            <Label className="text-xs">
                                                {t("PublicNote.RenewalNotify")}
                                            </Label>
                                            <div className="grid gap-2 sm:grid-cols-4">
                                                {[
                                                    [0, t("PublicNote.RenewalNotifyToday")],
                                                    [1, t("PublicNote.RenewalNotifyOneDay")],
                                                    [3, t("PublicNote.RenewalNotifyThreeDays")],
                                                    [7, t("PublicNote.RenewalNotifySevenDays")],
                                                ].map(([day, label]) => (
                                                    <label
                                                        key={day}
                                                        className="flex items-center gap-2 text-sm"
                                                    >
                                                        <Checkbox
                                                            checked={
                                                                publicNoteObj.billingDataMod?.renewalNotifyDays?.includes(
                                                                    day as number,
                                                                ) ?? false
                                                            }
                                                            onCheckedChange={(checked) =>
                                                                toggleRenewalNotifyDay(
                                                                    day as number,
                                                                    checked === true,
                                                                )
                                                            }
                                                        />
                                                        {label}
                                                    </label>
                                                ))}
                                            </div>
                                            <div className="text-xs text-muted-foreground">
                                                {publicNoteObj.billingDataMod?.renewalNotifyDays
                                                    ?.length
                                                    ? ""
                                                    : t("PublicNote.RenewalNotifyOff")}
                                            </div>
                                            {publicNoteErrors["billing.renewalNotifyDays"] && (
                                                <p className="text-xs text-destructive mt-1">
                                                    {publicNoteErrors["billing.renewalNotifyDays"]}
                                                </p>
                                            )}
                                        </div>
                                        <div className="space-y-1 sm:col-span-2">
                                            <div className="flex items-center gap-2">
                                                <Label className="text-xs">
                                                    {t("PublicNote.Amount")}
                                                </Label>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700"
                                                    onClick={() =>
                                                        patchPublicNote(
                                                            "billingDataMod.amount",
                                                            "0",
                                                        )
                                                    }
                                                >
                                                    {t("PublicNote.Free")}
                                                </Button>
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    className="text-xs px-2 py-0 h-auto bg-gray-200 dark:bg-gray-700"
                                                    onClick={() =>
                                                        patchPublicNote(
                                                            "billingDataMod.amount",
                                                            "-1",
                                                        )
                                                    }
                                                >
                                                    {t("PublicNote.PayAsYouGo")}
                                                </Button>
                                            </div>
                                            <Input
                                                placeholder="200EUR"
                                                value={publicNoteObj.billingDataMod?.amount}
                                                onChange={(e) =>
                                                    patchPublicNote(
                                                        "billingDataMod.amount",
                                                        e.target.value,
                                                    )
                                                }
                                            />
                                        </div>
                                    </div>
                                </div>
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2">
                                        {t("Submit")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
