import { createService, updateService } from "@/api/service"
import { Button } from "@/components/ui/button"
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
import { ScrollArea } from "@/components/ui/scroll-area"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { IconButton } from "@/components/xui/icon-button"
import { useServer } from "@/hooks/useServer"
import { t } from "@/lib/labels"
import { conv } from "@/lib/utils"
import { asOptionalField } from "@/lib/utils"
import { ModelService } from "@/types"
import { serviceTypes } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

import { ExpandedCheckList } from "./xui/expanded-check-list"

interface ServiceCardProps {
    data?: ModelService
    mutate: KeyedMutator<ModelService[]>
}

const serviceFormSchema = z.object({
    duration: z.coerce.number().int().min(30),
    enable_trigger_task: asOptionalField(z.boolean()),
    fail_trigger_tasks: z.array(z.number()),
    fail_trigger_tasks_raw: z.string(),
    latency_notify: asOptionalField(z.boolean()),
    max_latency: z.coerce.number().int().min(0),
    min_latency: z.coerce.number().int().min(0),
    name: z.string().min(1),
    notification_group_id: z.coerce.number().int(),
    notify: asOptionalField(z.boolean()),
    recover_trigger_tasks: z.array(z.number()),
    recover_trigger_tasks_raw: z.string(),
    skip_servers: z.record(z.string(), z.boolean()),
    skip_servers_raw: z.array(z.string()),
    target: z.string(),
    type: z.coerce.number().int().min(0),
})

type ServerOption = {
    value: string
    label: string
}

const enabledServerKeys = (servers?: Record<string, boolean>) => {
    return Object.entries(servers ?? {})
        .filter(([, enabled]) => enabled)
        .map(([id]) => id)
}

const selectedServerValues = (data: ModelService | undefined, serverList: ServerOption[]) => {
    if (!data) return []

    const validServerIds = new Set(serverList.map((server) => server.value))
    if (data.cover === 0) {
        return serverList
            .filter((server) => !data.skip_servers?.[server.value])
            .map((server) => server.value)
    }

    return enabledServerKeys(data.skip_servers).filter((serverId) => validServerIds.has(serverId))
}

const serviceFormDefaults = (data: ModelService | undefined, serverList: ServerOption[]) => {
    if (data) {
        return {
            ...data,
            fail_trigger_tasks_raw: conv.arrToStr(data.fail_trigger_tasks || []),
            recover_trigger_tasks_raw: conv.arrToStr(data.recover_trigger_tasks || []),
            skip_servers_raw: selectedServerValues(data, serverList),
        }
    }

    return {
        type: 1,
        cover: 1,
        name: "",
        target: "",
        max_latency: 0.0,
        min_latency: 0.0,
        duration: 30,
        notification_group_id: 0,
        fail_trigger_tasks: [],
        fail_trigger_tasks_raw: "",
        recover_trigger_tasks: [],
        recover_trigger_tasks_raw: "",
        skip_servers: {},
        skip_servers_raw: [],
    }
}

export const ServiceCard: React.FC<ServiceCardProps> = ({ data, mutate }) => {
    const { servers } = useServer()
    const serverList = useMemo(
        () =>
            servers?.map((s) => ({
                value: `${s.id}`,
                label: s.name,
            })) || [],
        [servers],
    )

    const form = useForm({
        resolver: zodResolver(serviceFormSchema) as any,
        defaultValues: serviceFormDefaults(data, serverList),
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)

    useEffect(() => {
        if (open) {
            form.reset(serviceFormDefaults(data, serverList))
        }
    }, [data, form, open, serverList])

    const onSubmit = async (values: any) => {
        const validServerIds = new Set(serverList.map((server) => server.value))
        values.skip_servers_raw = (values.skip_servers_raw ?? []).filter(
            (serverId: string) => serverList.length === 0 || validServerIds.has(serverId),
        )
        values.cover = 1
        values.skip_servers = conv.arrToRecord(values.skip_servers_raw)
        values.fail_trigger_tasks = conv.strToArr(values.fail_trigger_tasks_raw).map(Number)
        values.recover_trigger_tasks = conv.strToArr(values.recover_trigger_tasks_raw).map(Number)
        const requiredFields = { ...values }
        delete (requiredFields as Record<string, unknown>).skip_servers_raw
        try {
            if (data?.id) {
                await updateService(data.id, requiredFields)
            } else {
                await createService(requiredFields)
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

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditService") : t("CreateService")}
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
                                                <Input placeholder="我的延迟监控" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="target"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Target")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="HTTP (https://t.tt)｜Ping (t.tt)｜TCP (t.tt:80)"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="type"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Type")}</FormLabel>
                                            <Select
                                                onValueChange={field.onChange}
                                                defaultValue={`${field.value}`}
                                            >
                                                <FormControl>
                                                    <SelectTrigger>
                                                        <SelectValue placeholder="选择监控类型" />
                                                    </SelectTrigger>
                                                </FormControl>
                                                <SelectContent>
                                                    {Object.entries(serviceTypes).map(([k, v]) => (
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
                                <FormField
                                    control={form.control}
                                    name="duration"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Interval")} (s)</FormLabel>
                                            <FormControl>
                                                <Input type="number" placeholder="30" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="skip_servers_raw"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("SpecificServers")}</FormLabel>
                                            <FormControl>
                                                <ExpandedCheckList
                                                    title="已选特定服务器"
                                                    options={serverList}
                                                    value={field.value ?? []}
                                                    onChange={field.onChange}
                                                    emptyText="暂无服务器"
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="notify"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <Label className="text-sm">
                                                        {t("EnableFailureNotification")}
                                                    </Label>
                                                </div>
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="max_latency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("MaximumLatency")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="100.88"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="min_latency"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("MinimumLatency")}</FormLabel>
                                            <FormControl>
                                                <Input
                                                    type="number"
                                                    placeholder="100.88"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="latency_notify"
                                    render={({ field }) => (
                                        <FormItem className="flex items-center space-x-2">
                                            <FormControl>
                                                <div className="flex items-center gap-2">
                                                    <Checkbox
                                                        checked={field.value}
                                                        onCheckedChange={field.onChange}
                                                    />
                                                    <Label className="text-sm">
                                                        {t("EnableLatencyNotification")}
                                                    </Label>
                                                </div>
                                            </FormControl>
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
