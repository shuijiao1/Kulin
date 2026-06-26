import { createAlertRule, updateAlertRule } from "@/api/alert-rule"
import { Button } from "@/components/ui/button"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { IconButton } from "@/components/xui/icon-button"
import { useNotification } from "@/hooks/useNotfication"
import { useServer } from "@/hooks/useServer"
import { t } from "@/lib/labels"
import { conv } from "@/lib/utils"
import { ModelAlertRule } from "@/types"
import { triggerModes } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { Combobox } from "./ui/combobox"
import { ExpandedCheckList } from "./xui/expanded-check-list"

interface AlertRuleCardProps {
    data?: ModelAlertRule
    mutate: KeyedMutator<ModelAlertRule[]>
}

const cycleUnitSchema = z.enum(["hour", "day", "week", "month", "year"])

const ruleSchema = z.object({
    type: z.string(),
    min: z.number().optional(),
    max: z.number().optional(),
    cycle_start: z.string().optional(),
    cycle_interval: z.number().optional(),
    cycle_unit: cycleUnitSchema.optional(),
    duration: z.number().optional(),
    cover: z.number().int().min(0).default(0),
    ignore: z.record(z.string(), z.boolean()).optional(),
    next_transfer_at: z.record(z.string(), z.string()).optional(),
    last_cycle_status: z.boolean().optional(),
})

const ALERT_RULE_TYPES = [
    { value: "offline", label: "离线通知", unit: "" },
    { value: "cpu", label: "CPU 使用率", unit: "%" },
    { value: "memory", label: "内存使用率", unit: "%" },
    { value: "swap", label: "交换分区使用率", unit: "%" },
    { value: "disk", label: "硬盘使用率", unit: "%" },
    { value: "load1", label: "1 分钟负载", unit: "" },
    { value: "load5", label: "5 分钟负载", unit: "" },
    { value: "load15", label: "15 分钟负载", unit: "" },
    { value: "process_count", label: "进程数", unit: "" },
    { value: "tcp_conn_count", label: "TCP 连接数", unit: "" },
    { value: "udp_conn_count", label: "UDP 连接数", unit: "" },
    { value: "net_in_speed", label: "入站网速", unit: "B/s" },
    { value: "net_out_speed", label: "出站网速", unit: "B/s" },
    { value: "net_all_speed", label: "双向网速", unit: "B/s" },
    { value: "transfer_in", label: "入站流量", unit: "B" },
    { value: "transfer_out", label: "出站流量", unit: "B" },
    { value: "transfer_all", label: "双向流量", unit: "B" },
    { value: "temperature_max", label: "最高温度", unit: "°C" },
    { value: "transfer_in_cycle", label: "周期入站流量", unit: "B" },
    { value: "transfer_out_cycle", label: "周期出站流量", unit: "B" },
    { value: "transfer_all_cycle", label: "周期双向流量", unit: "B" },
]

const alertRuleLabel = (type?: string) => {
    return ALERT_RULE_TYPES.find((item) => item.value === type)?.label || type || "规则"
}

const alertRuleUnit = (type?: string) => {
    return ALERT_RULE_TYPES.find((item) => item.value === type)?.unit || ""
}

const parseRuleNumber = (value: string) => (value === "" ? undefined : Number(value))

const alertRuleFormSchema = z.object({
    name: z.string().min(1),
    rules: z.array(ruleSchema),
    fail_trigger_tasks: z.array(z.number()).default([]),
    recover_trigger_tasks: z.array(z.number()).default([]),
    notification_group_id: z.coerce.number().int(),
    trigger_mode: z.coerce.number().int().min(0),
    enable: z.boolean().optional(),
})

export const AlertRuleCard: React.FC<AlertRuleCardProps> = ({ data, mutate }) => {
    type AlertRuleEntry = z.output<typeof ruleSchema>
    type AlertRuleFormInput = z.input<typeof alertRuleFormSchema>
    type AlertRuleFormData = z.output<typeof alertRuleFormSchema>

    const form = useForm<AlertRuleFormInput, unknown, AlertRuleFormData>({
        resolver: zodResolver(alertRuleFormSchema),
        defaultValues: data
            ? {
                  ...data,
              }
            : {
                  name: "",
                  rules: [{ type: "offline", cover: 0, duration: 60 }],
                  fail_trigger_tasks: [],
                  recover_trigger_tasks: [],
                  notification_group_id: 0,
                  trigger_mode: 0,
                  enable: true,
              },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)
    const [rulesUI, setRulesUI] = useState<AlertRuleEntry[]>(
        data?.rules?.length ? data.rules : [{ type: "offline", cover: 0, duration: 60 }],
    )
    useEffect(() => {
        form.setValue("rules", rulesUI, { shouldDirty: true })
    }, [form, rulesUI])

    const onSubmit = async (values: AlertRuleFormData) => {
        values.rules = z.array(ruleSchema).parse(rulesUI)
        values.fail_trigger_tasks = []
        values.recover_trigger_tasks = []
        const requiredFields = { ...values, enable: true }
        try {
            if (data?.id) {
                await updateAlertRule(data.id, requiredFields)
            } else {
                await createAlertRule(requiredFields)
            }
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

    const { notifiers } = useNotification()
    const { servers } = useServer()
    const notifierList = notifiers?.map((n) => ({
        value: `${n.id}`,
        label: n.name,
    })) || [{ value: "", label: "" }]
    const serverList = servers?.map((s) => ({
        value: `${s.id}`,
        label: s.name,
    })) || []

    const selectedServerValues = (rule: AlertRuleEntry) => {
        if ((rule.cover ?? 0) === 0) {
            return serverList
                .filter((server) => !rule.ignore?.[server.value])
                .map((server) => server.value)
        }
        return conv.recordToStrArr(rule.ignore || {})
    }

    const updateRuleServers = (ruleIndex: number, selectedServers: string[]) => {
        const next = [...rulesUI]
        const allSelected =
            serverList.length > 0 && selectedServers.length === serverList.length
        next[ruleIndex] = {
            ...next[ruleIndex],
            cover: allSelected ? 0 : 1,
            ignore: allSelected ? undefined : conv.arrToRecord(selectedServers),
        }
        setRulesUI(next)
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-2xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditAlertRule") : t("CreateAlertRule")}
                            </DialogTitle>
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
                                                <Input {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormItem>
                                    <FormLabel>{t("Rules")}</FormLabel>
                                    <div className="space-y-3">
                                        {rulesUI.map((r, idx) => {
                                            const isCycle =
                                                typeof r.type === "string" &&
                                                r.type.endsWith("_cycle")
                                            const isOffline = r.type === "offline"
                                            const unit = alertRuleUnit(r.type)
                                            return (
                                                <div
                                                    key={idx}
                                                    className="rounded-md border bg-muted/20 p-3 space-y-3"
                                                >
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="font-medium">
                                                            {alertRuleLabel(r.type)}
                                                        </div>
                                                        <Button
                                                            type="button"
                                                            variant="secondary"
                                                            size="sm"
                                                            onClick={() => {
                                                                const next = [...rulesUI]
                                                                next.splice(idx, 1)
                                                                setRulesUI(next)
                                                            }}
                                                        >
                                                            {t("Delete")}
                                                        </Button>
                                                    </div>
                                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                        <div>
                                                            <Label className="text-sm">
                                                                通知类型
                                                            </Label>
                                                            <Select
                                                                onValueChange={(val) => {
                                                                    const next = [...rulesUI]
                                                                    const base: AlertRuleEntry = {
                                                                        type: val,
                                                                        cover: r.cover ?? 0,
                                                                        duration: r.duration ?? 60,
                                                                    }
                                                                    if (val !== "offline") {
                                                                        base.min =
                                                                            val.includes(
                                                                                "transfer",
                                                                            ) ||
                                                                            val.includes("speed")
                                                                                ? undefined
                                                                                : 0
                                                                        base.max =
                                                                            val.includes(
                                                                                "transfer",
                                                                            ) ||
                                                                            val.includes("speed")
                                                                                ? undefined
                                                                                : 90
                                                                    }
                                                                    if (val.endsWith("_cycle")) {
                                                                        base.cycle_interval = 1
                                                                        base.cycle_unit = "month"
                                                                    }
                                                                    next[idx] = base
                                                                    setRulesUI(next)
                                                                }}
                                                                value={r.type || "offline"}
                                                            >
                                                                <SelectTrigger>
                                                                    <SelectValue />
                                                                </SelectTrigger>
                                                                <SelectContent>
                                                                    {ALERT_RULE_TYPES.map(
                                                                        (item) => (
                                                                            <SelectItem
                                                                                key={item.value}
                                                                                value={item.value}
                                                                            >
                                                                                {item.label}
                                                                            </SelectItem>
                                                                        ),
                                                                    )}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                        <div>
                                                            <Label className="text-sm">
                                                                持续时间（秒）
                                                            </Label>
                                                            <Input
                                                                type="number"
                                                                min={0}
                                                                value={r.duration ?? ""}
                                                                onChange={(e) => {
                                                                    const next = [...rulesUI]
                                                                    next[idx] = {
                                                                        ...next[idx],
                                                                        duration: parseRuleNumber(
                                                                            e.target.value,
                                                                        ),
                                                                    }
                                                                    setRulesUI(next)
                                                                }}
                                                                placeholder="60"
                                                            />
                                                        </div>
                                                    </div>
                                                    {!isOffline && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                            <div>
                                                                <Label className="text-sm">
                                                                    最小值
                                                                    {unit ? `（${unit}）` : ""}
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={r.min ?? ""}
                                                                    onChange={(e) => {
                                                                        const next = [...rulesUI]
                                                                        next[idx] = {
                                                                            ...next[idx],
                                                                            min: parseRuleNumber(
                                                                                e.target.value,
                                                                            ),
                                                                        }
                                                                        setRulesUI(next)
                                                                    }}
                                                                    placeholder="不填表示不限制"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm">
                                                                    最大值
                                                                    {unit ? `（${unit}）` : ""}
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    value={r.max ?? ""}
                                                                    onChange={(e) => {
                                                                        const next = [...rulesUI]
                                                                        next[idx] = {
                                                                            ...next[idx],
                                                                            max: parseRuleNumber(
                                                                                e.target.value,
                                                                            ),
                                                                        }
                                                                        setRulesUI(next)
                                                                    }}
                                                                    placeholder="不填表示不限制"
                                                                />
                                                            </div>
                                                        </div>
                                                    )}
                                                    {isCycle && (
                                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                                                            <div className="sm:col-span-2">
                                                                <Label className="text-sm">
                                                                    周期开始时间
                                                                </Label>
                                                                <Input
                                                                    value={r.cycle_start ?? ""}
                                                                    onChange={(e) => {
                                                                        const next = [...rulesUI]
                                                                        next[idx] = {
                                                                            ...next[idx],
                                                                            cycle_start:
                                                                                e.target.value ||
                                                                                undefined,
                                                                        }
                                                                        setRulesUI(next)
                                                                    }}
                                                                    placeholder="2026-01-01T00:00:00+08:00"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm">
                                                                    周期数量
                                                                </Label>
                                                                <Input
                                                                    type="number"
                                                                    min={1}
                                                                    value={r.cycle_interval ?? ""}
                                                                    onChange={(e) => {
                                                                        const next = [...rulesUI]
                                                                        next[idx] = {
                                                                            ...next[idx],
                                                                            cycle_interval:
                                                                                parseRuleNumber(
                                                                                    e.target.value,
                                                                                ),
                                                                        }
                                                                        setRulesUI(next)
                                                                    }}
                                                                    placeholder="1"
                                                                />
                                                            </div>
                                                            <div>
                                                                <Label className="text-sm">
                                                                    周期单位
                                                                </Label>
                                                                <Select
                                                                    onValueChange={(val) => {
                                                                        const next = [...rulesUI]
                                                                        next[idx] = {
                                                                            ...next[idx],
                                                                            cycle_unit:
                                                                                cycleUnitSchema.parse(
                                                                                    val,
                                                                                ),
                                                                        }
                                                                        setRulesUI(next)
                                                                    }}
                                                                    value={r.cycle_unit || "month"}
                                                                >
                                                                    <SelectTrigger>
                                                                        <SelectValue />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="hour">
                                                                            小时
                                                                        </SelectItem>
                                                                        <SelectItem value="day">
                                                                            天
                                                                        </SelectItem>
                                                                        <SelectItem value="week">
                                                                            周
                                                                        </SelectItem>
                                                                        <SelectItem value="month">
                                                                            月
                                                                        </SelectItem>
                                                                        <SelectItem value="year">
                                                                            年
                                                                        </SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    )}
                                                    <div className="space-y-2">
                                                        <Label className="text-sm">监控范围</Label>
                                                        <ExpandedCheckList
                                                            title="已选服务器"
                                                            options={serverList}
                                                            value={selectedServerValues(r)}
                                                            onChange={(value) =>
                                                                updateRuleServers(idx, value)
                                                            }
                                                            emptyText="暂无服务器"
                                                        />
                                                    </div>
                                                </div>
                                            )
                                        })}
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() =>
                                                setRulesUI([
                                                    ...rulesUI,
                                                    { type: "offline", cover: 0, duration: 60 },
                                                ])
                                            }
                                        >
                                            添加规则
                                        </Button>
                                    </div>
                                    <FormMessage />
                                </FormItem>
                                <FormField
                                    control={form.control}
                                    name="notification_group_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("NotifierGroup")}</FormLabel>
                                            <FormControl>
                                                <Combobox
                                                    placeholder={t("Search")}
                                                    options={notifierList}
                                                    onValueChange={field.onChange}
                                                    defaultValue={String(field.value ?? "")}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="trigger_mode"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("TriggerMode")}</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={`${field.value}`}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {Object.entries(triggerModes).map(([k, v]) => (
                                                        <SelectItem key={k} value={k}>
                                                            {v}
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2">
                                        {t("Confirm")}
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
