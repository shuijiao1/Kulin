import { swrFetcher } from "@/api/api"
import { deleteService } from "@/api/service"
import { ActionButtonGroup } from "@/components/action-button-group"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { ServiceCard } from "@/components/service"
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
import { ModelService as Service } from "@/types"
import { serviceTypes } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { useEffect, useMemo } from "react"
import { toast } from "sonner"
import useSWR from "swr"

export default function ServicePage() {
    const { data, mutate, error, isLoading } = useSWR<Service[]>("/api/v1/service/list", swrFetcher)

    useEffect(() => {
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: error.message,
                }),
            })
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [error])

    const columns: ColumnDef<Service>[] = [
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
            accessorFn: (row) => row.name,
            accessorKey: "name",
            cell: ({ row }) => {
                const s = row.original
                return <div className="max-w-40 whitespace-normal break-words">{s.name}</div>
            },
        },
        {
            header: t("Target"),
            accessorFn: (row) => row.target,
            accessorKey: "target",
            cell: ({ row }) => {
                const s = row.original
                return <div className="max-w-40 whitespace-normal break-words">{s.target}</div>
            },
        },
        {
            header: t("Type"),
            accessorKey: "type",
            accessorFn: (row) => row.type,
            cell: ({ row }) => serviceTypes[row.original.type] || "",
        },
        {
            header: t("Interval"),
            accessorKey: "duration",
            accessorFn: (row) => row.duration,
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{ fn: deleteService, id: s.id, mutate: mutate }}
                    >
                        <ServiceCard mutate={mutate} data={s} />
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

    const MobileServiceList = () => (
        <div className="space-y-3 sm:hidden">
            {isLoading ? (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    {t("Loading")}...
                </div>
            ) : dataCache.length ? (
                dataCache.map((service) => (
                    <div key={service.id} className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold">
                                    {service.name}
                                </div>
                                <div className="mt-1 break-all text-xs text-muted-foreground">
                                    {service.target}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {serviceTypes[service.type] || ""} · {service.duration}s
                                </div>
                            </div>
                            <Checkbox
                                checked={table
                                    .getRowModel()
                                    .rows.find((row) => row.original.id === service.id)
                                    ?.getIsSelected()}
                                onCheckedChange={(value) => {
                                    table
                                        .getRowModel()
                                        .rows.find((row) => row.original.id === service.id)
                                        ?.toggleSelected(!!value)
                                }}
                                aria-label="选择行"
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <ActionButtonGroup
                                className="flex flex-wrap gap-2"
                                delete={{ fn: deleteService, id: service.id, mutate: mutate }}
                            >
                                <ServiceCard mutate={mutate} data={service} />
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
            <div className="flex flex-col sm:flex-row sm:items-center justify-between w-full gap-3 mt-6 mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("Service")}</h1>
                <HeaderButtonGroup
                    className="flex gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteService,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    <ServiceCard mutate={mutate} />
                </HeaderButtonGroup>
            </div>

            <MobileServiceList />
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
