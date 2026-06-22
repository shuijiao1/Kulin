import { swrFetcher } from "@/api/api"
import { deleteServer, updateServer } from "@/api/server"
import { ActionButtonGroup } from "@/components/action-button-group"
import { CopyButton } from "@/components/copy-button"
import { HeaderButtonGroup } from "@/components/header-button-group"
import { InstallCommandsMenu } from "@/components/install-commands"
import { ServerCard } from "@/components/server"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@/components/ui/table"
import { t } from "@/lib/labels"
import { joinIP } from "@/lib/utils"
import { ModelServer as Server } from "@/types"
import { ColumnDef, flexRender, getCoreRowModel, useReactTable } from "@tanstack/react-table"
import { DragEvent, useEffect, useMemo, useState } from "react"
import { toast } from "sonner"
import useSWR from "swr"

export default function ServerPage() {
    const { data, mutate, error, isLoading } = useSWR<Server[]>("/api/v1/server", swrFetcher, {
        revalidateOnFocus: false,
        revalidateOnReconnect: false,
    })
    useEffect(() => {
        if (error)
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", { error: error.message }),
            })
    }, [error])

    const [orderedServers, setOrderedServers] = useState<Server[]>([])
    const [sortOpen, setSortOpen] = useState(false)

    useEffect(() => {
        setOrderedServers(
            [...(data ?? [])].sort((a, b) => (b.display_index ?? 0) - (a.display_index ?? 0)),
        )
    }, [data])

    const persistServerOrder = async (servers: Server[]) => {
        try {
            const base = servers.length
            await Promise.all(
                servers.map((server, index) =>
                    updateServer(server.id, { display_index: base - index }),
                ),
            )
            await mutate()
            toast(t("Done"), { description: "服务器排序已保存" })
        } catch (e) {
            console.error(e)
            toast(t("Error"), { description: t("Results.UnExpectedError") })
            await mutate()
        }
    }

    const [draggingServerId, setDraggingServerId] = useState<number | null>(null)
    const [dragOverServerId, setDragOverServerId] = useState<number | null>(null)

    const moveDraggedServer = (targetId: number) => {
        setOrderedServers((servers) => {
            const from = servers.findIndex((server) => server.id === draggingServerId)
            const to = servers.findIndex((server) => server.id === targetId)
            if (from < 0 || to < 0 || from === to) return servers
            const next = [...servers]
            const [moved] = next.splice(from, 1)
            next.splice(to, 0, moved)
            return next
        })
    }

    const handleDragStart = (event: DragEvent<HTMLDivElement>, serverId: number) => {
        setDraggingServerId(serverId)
        event.dataTransfer.effectAllowed = "move"
        event.dataTransfer.setData("text/plain", String(serverId))
    }

    const handleDragEnd = () => {
        setDraggingServerId(null)
        setDragOverServerId(null)
    }

    const handleDragOver = (event: DragEvent<HTMLDivElement>) => {
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
    }

    const handleDragEnter = (serverId: number) => {
        if (
            draggingServerId === null ||
            draggingServerId === serverId ||
            dragOverServerId === serverId
        )
            return
        setDragOverServerId(serverId)
        moveDraggedServer(serverId)
    }

    const saveServerSort = async () => {
        await persistServerOrder(orderedServers)
        setSortOpen(false)
    }

    const serverSortDialog = (
        <Dialog open={sortOpen} onOpenChange={setSortOpen}>
            <DialogTrigger asChild>
                <Button variant="outline">服务器排序</Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle>服务器排序</DialogTitle>
                    <DialogDescription>
                        这里调整前台首页服务器显示顺序。按住任意服务器卡片拖动排序，保存后生效。
                    </DialogDescription>
                </DialogHeader>
                <div className="max-h-[65vh] space-y-2 overflow-y-auto pr-1">
                    {orderedServers.map((server, index) => {
                        const isDragging = draggingServerId === server.id
                        return (
                            <div
                                key={server.id}
                                draggable
                                onDragStart={(event) => handleDragStart(event, server.id)}
                                onDragEnd={handleDragEnd}
                                onDragOver={handleDragOver}
                                onDragEnter={() => handleDragEnter(server.id)}
                                onDrop={handleDragEnd}
                                className={`flex cursor-grab select-none items-center gap-3 rounded-xl border bg-background px-3 py-3 shadow-sm active:cursor-grabbing ${
                                    isDragging ? "shadow-lg" : ""
                                }`}
                            >
                                <span className="flex size-8 shrink-0 items-center justify-center rounded-lg border bg-muted/50 text-base text-muted-foreground">
                                    ☰
                                </span>
                                <span className="w-7 text-center text-sm font-medium text-muted-foreground">
                                    {index + 1}
                                </span>
                                <span className="min-w-0 flex-1 truncate font-medium">
                                    {server.name}
                                </span>
                                <span className="rounded-full bg-muted px-2 py-1 text-xs text-muted-foreground">
                                    拖动排序
                                </span>
                            </div>
                        )
                    })}
                </div>
                <DialogFooter>
                    <Button type="button" variant="outline" onClick={() => setSortOpen(false)}>
                        取消
                    </Button>
                    <Button type="button" onClick={saveServerSort}>
                        保存排序
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    )

    const columns: ColumnDef<Server>[] = [
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
                return <div className="max-w-40 whitespace-normal break-words">{s.name}</div>
            },
        },
        {
            id: "owner",
            header: t("Owner"),
            // Backend Server.MarshalJSON always emits owner.id; username is
            // omitted for uid=0 (legacy global agent secret) and for users
            // that no longer exist. Render uid=0 as "Global Agent" and a
            // missing username as "Unknown user (#id)" so deleted-user rows
            // stay debuggable instead of silently appearing ownerless.
            accessorFn: (row) => {
                if (!row.owner) return ""
                if (row.owner.id === 0) return t("GlobalAgent")
                return row.owner.username || t("UnknownUser", { id: row.owner.id })
            },
            cell: ({ row }) => {
                const owner = row.original.owner
                if (!owner) {
                    return <span className="text-muted-foreground">-</span>
                }
                if (owner.id === 0) {
                    return <span>{t("GlobalAgent")}</span>
                }
                const label = owner.username || t("UnknownUser", { id: owner.id })
                return (
                    <div
                        className="max-w-48 whitespace-normal break-words"
                        title={`uid=${owner.id}`}
                    >
                        {label}
                    </div>
                )
            },
        },
        {
            id: "ip",
            header: "IP",
            cell: ({ row }) => {
                const s = row.original
                return (
                    <div className="max-w-40 whitespace-normal break-words">
                        {joinIP(s.geoip?.ip)}
                    </div>
                )
            },
        },
        {
            header: t("Version"),
            accessorKey: "host.version",
            accessorFn: (row) => row.host?.version || t("Unknown"),
        },
        {
            id: "uuid",
            header: "UUID",
            cell: ({ row }) => {
                const s = row.original
                return <CopyButton text={s.uuid} />
            },
        },
        {
            id: "actions",
            header: t("Actions"),
            cell: ({ row }) => {
                const s = row.original
                return (
                    <ActionButtonGroup
                        className="flex gap-2"
                        delete={{ fn: deleteServer, id: s.id, mutate: mutate }}
                    >
                        <>
                            <ServerCard mutate={mutate} data={s} />
                            <InstallCommandsMenu uuid={s.uuid} variant="outline" />
                        </>
                    </ActionButtonGroup>
                )
            },
        },
    ]

    const dataCache = useMemo(() => {
        return orderedServers
    }, [orderedServers])

    const table = useReactTable({
        data: dataCache,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    const selectedRows = table.getSelectedRowModel().rows

    const MobileServerList = () => (
        <div className="space-y-3 sm:hidden">
            {isLoading ? (
                <div className="rounded-lg border p-6 text-center text-muted-foreground">
                    {t("Loading")}...
                </div>
            ) : dataCache.length ? (
                dataCache.map((server) => (
                    <div key={server.id} className="rounded-xl border bg-card p-3 shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                                <div className="truncate text-base font-semibold">
                                    {server.name}
                                </div>
                                <div className="mt-1 break-all text-xs text-muted-foreground">
                                    {joinIP(server.geoip?.ip) || "-"}
                                </div>
                                <div className="mt-1 text-xs text-muted-foreground">
                                    {server.host?.version || t("Unknown")}
                                </div>
                            </div>
                            <Checkbox
                                checked={table
                                    .getRowModel()
                                    .rows.find((row) => row.original.id === server.id)
                                    ?.getIsSelected()}
                                onCheckedChange={(value) => {
                                    table
                                        .getRowModel()
                                        .rows.find((row) => row.original.id === server.id)
                                        ?.toggleSelected(!!value)
                                }}
                                aria-label="Select row"
                            />
                        </div>
                        <div className="mt-3 flex flex-wrap gap-2">
                            <ActionButtonGroup
                                className="flex flex-wrap gap-2"
                                delete={{ fn: deleteServer, id: server.id, mutate: mutate }}
                            >
                                <>
                                    <ServerCard mutate={mutate} data={server} />
                                    <InstallCommandsMenu uuid={server.uuid} variant="outline" />
                                </>
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
                <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t("Server")}</h1>
                <HeaderButtonGroup
                    className="flex gap-2 flex-wrap shrink-0"
                    delete={{
                        fn: deleteServer,
                        id: selectedRows.map((r) => r.original.id),
                        mutate: mutate,
                    }}
                >
                    {serverSortDialog}
                    <InstallCommandsMenu className="shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] bg-blue-700 text-white hover:bg-blue-600 dark:hover:bg-blue-800 rounded-lg" />
                </HeaderButtonGroup>
            </div>
            <MobileServerList />
            <div className="hidden rounded-md border overflow-x-auto sm:block">
                <Table className="min-w-[960px]">
                    <TableHeader className="sticky top-0 bg-background z-10">
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
                                    key={row.original.id}
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
