import { swrFetcher } from "@/api/api"
import { deleteNotification } from "@/api/notification"
import { ActionButtonGroup } from "@/components/action-button-group"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { NotificationTab } from "@/components/notification-tab"
import { NotifierCard } from "@/components/notifier"
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
import { ModelNotification } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import useSWR from "swr"

export default function NotificationPage() {
    const { data, mutate, error, isLoading } = useSWR<ModelNotification[]>(
        "/api/v1/notification",
        swrFetcher,
    )
    useEffect(() => {
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<ModelNotification>[] = [
        {
            id: "select",
            header: ({ table }) => (
                <Checkbox
                    checked={
                        table.getIsAllPageRowsSelected() ||
                        (table.getIsSomePageRowsSelected() && "indeterminate")
                    }
                    onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
                    aria-label="全选"
                />
            ),
            cell: ({ row }) => (
                <Checkbox
                    checked={row.getIsSelected()}
                    onCheckedChange={(value) => row.toggleSelected(!!value)}
                    aria-label="选择行"
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
            header: "类型",
            cell: () => <span>Telegram</span>,
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
                            fn: deleteNotification,
                            id: s.id,
                            mutate: mutate,
                        }}
                    >
                        <NotifierCard mutate={mutate} data={s} />
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

    const MobileNotificationList = () => (
        <div className="space-y-3 sm:hidden">
            {isLoading ? (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    {t("Loading")}...
                </div>
            ) : dataCache.length ? (
                dataCache.map((notification) => (
                    <div key={notification.id} className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold">
                                    {notification.name}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">Telegram</div>
                            </div>
                            <Checkbox
                                checked={table
                                    .getRowModel()
                                    .rows.find((row) => row.original.id === notification.id)
                                    ?.getIsSelected()}
                                onCheckedChange={(value) => {
                                    table
                                        .getRowModel()
                                        .rows.find((row) => row.original.id === notification.id)
                                        ?.toggleSelected(!!value)
                                }}
                                aria-label="选择行"
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <ActionButtonGroup
                                className="flex flex-wrap gap-2"
                                delete={{
                                    fn: deleteNotification,
                                    id: notification.id,
                                    mutate: mutate,
                                }}
                            >
                                <NotifierCard mutate={mutate} data={notification} />
                            </ActionButtonGroup>
                        </div>
                    </div>
                ))
            ) : (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    {t("NoResults")}
                </div>
            )}
        </div>
    )

    return (
        <div className="px-3 max-w-7xl mx-auto">
            <div className="flex flex-col gap-3 mt-6 mb-4 sm:flex-row">
                <NotificationTab className="w-full sm:mr-4 sm:max-w-[40%]" />
                <HeaderButtonGroup
                    className="flex ml-auto self-end sm:self-auto gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteNotification,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    <NotifierCard mutate={mutate} />
                </HeaderButtonGroup>
            </div>

            <MobileNotificationList />
            <div className="hidden overflow-x-auto rounded-md border sm:block">
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
                                <TableRow
                                    key={row.id}
                                    data-state={row.getIsSelected() && "selected"}
                                >
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id} className="text-xsm">
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
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
        </div>
    )
}
