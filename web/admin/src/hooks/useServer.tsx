import { getServers } from "@/api/server"
import { ServerContextProps } from "@/types"
import { createContext, useContext, useEffect, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"

import { useServerStore } from "./useServerStore"

const ServerContext = createContext<ServerContextProps>({})

interface ServerProviderProps {
    children: React.ReactNode
    withServer?: boolean
}

export const ServerProvider: React.FC<ServerProviderProps> = ({
    children,
    withServer
}) => {
    const server = useServerStore((store) => store.server)
    const setServer = useServerStore((store) => store.setServer)

    const location = useLocation()

    useEffect(() => {
        if (withServer)
            (async () => {
                try {
                    const s = (await getServers()) || []
                    const serverData = s.map(({ id, name }) => ({ id, name }))
                    setServer(serverData)
                } catch (error: any) {
                    toast("ServerProvider Error", {
                        description: error.message,
                    })
                    setServer(undefined)
                }
            })()
    }, [location.pathname, setServer, withServer])

    const value: ServerContextProps = useMemo(
        () => ({
            servers: server,
        }),
        [server],
    )
    return <ServerContext.Provider value={value}>{children}</ServerContext.Provider>
}

export const useServer = () => {
    return useContext(ServerContext)
}
