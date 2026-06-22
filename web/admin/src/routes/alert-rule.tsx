import { deleteAlertRules } from "@/api/alert-rule"
import { swrFetcher } from "@/api/api"
import { ActionButtonGroup } from "@/components/action-button-group"
import { AlertRuleCard } from "@/components/alert-rule"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { NotificationTab } from "@/components/notification-tab"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { t } from "@/lib/labels"
import { ModelAlertRule, triggerModes } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import useSWR from "swr"

const alertRuleTypeLabels: Record<string, string> = {
    offline: "离线通知",
    cpu: "CPU",
    gpu: "GPU",
    memory: "内存",
    swap: "交换分区",
    disk: "硬盘",
    load1: "1 分钟负载",
    load5: "5 分钟负载",
    load15: "15 分钟负载",
    process_count: "进程数",
    tcp_conn_count: "TCP 连接数",
    udp_conn_count: "UDP 连接数",
    net_in_speed: "入站网速",
    net_out_speed: "出站网速",
    net_all_speed: "双向网速",
    transfer_in: "入站流量",
    transfer_out: "出站流量",
    transfer_all: "双向流量",
    transfer_in_cycle: "周期入站流量",
    transfer_out_cycle: "周期出站流量",
    transfer_all_cycle: "周期双向流量",
    temperature_max: "最高温度",
}

const formatAlertRules = (rules?: ModelAlertRule["rules"]) => {
    if (!rules?.length) return "-"
    return rules
        .map((rule) => {
            const label = alertRuleTypeLabels[rule.type] || rule.type
            const range = [
                rule.min !== undefined ? `≥${rule.min}` : "",
                rule.max !== undefined ? `≤${rule.max}` : "",
            ]
                .filter(Boolean)
                .join(" ")
            const duration = rule.duration ? `持续 ${rule.duration} 秒` : ""
            return [label, range, duration].filter(Boolean).join(" · ")
        })
        .join("；")
}

export default function AlertRulePage() {
    const { data, mutate, error, isLoading } = useSWR<ModelAlertRule[]>(
        "/api/v1/alert-rule",
        swrFetcher,
    )

    useEffect(() => {
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", { error: error.message }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<ModelAlertRule>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="Select all"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="Select row"
                />
            ),
            enableSorting: false,
            enableHiding: false,
        },
        {
            header: t("Name"),
            accessorKey: "name",
            accessorFn: (row) => row.name,
            cell: ({ row }) => {
                const s = row.original
                return <div className="max-w-32 whitespace-normal break-words">{s.name}</div>
            },
        },
        {
            header: t("NotifierGroup"),
            accessorKey: "ngroup",
            accessorFn: (row) => row.notification_group_id,
        },
        {
            header: t("TriggerMode"),
            accessorKey: "trigger Mode",
            accessorFn: (row) => triggerModes[row.trigger_mode ?? 0] || "",
        },
        {
            header: t("Rules"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="max-w-80 whitespace-normal break-words text-sm">
                        {formatAlertRules(s.rules)}
                    </div>
                )
            },
        },
        {
            header: t("Enable"),
            accessorKey: "enable",
            accessorFn: (row) => row.enable,
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{
                            fn: deleteAlertRules,
                            id: s.id,
                            mutate: mutate,
                        }}
                    >
                        <AlertRuleCard mutate={mutate} data={s} />
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const dataCache = useMemo(() => {
        return data ?? []
    }, [data])

    const table = useReactTable({
        data: dataCache,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    const selectedRows = table.getSelectedRowModel().rows

    return (
        <div className="px-3">
            <div className="flex mt-6 mb-4">
                <NotificationTab className="flex-1 mr-4 sm:max-w-[40%]" />
                <HeaderButtonGroup
                    className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteAlertRules,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    <AlertRuleCard mutate={mutate} />
                </HeaderButtonGroup>
            </div>

            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => {
                                return (
                                    <TableHead key={header.id} className="text-sm">
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                  header.column.columnDef.header,
                                                  header.getContext(),
                                              )}
                                    </TableHead>
                                )
                            })}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {isLoading ? (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                {t("Loading")}...
                            </TableCell>
                        </TableRow>
                    ) : table.getRowModel().rows?.length ? (
                        table.getRowModel().rows.map((row) => (
                            <TableRow key={row.id} data-state={row.getIsSelected() && "selected"}>
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell key={cell.id} className="text-xsm">
                                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={columns.length} className="h-24 text-center">
                                {t("NoResults")}
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
        </div>
    )
}
