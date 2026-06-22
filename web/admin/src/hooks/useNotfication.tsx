import { getNotification } from "@/api/notification"
import { NotificationContextProps } from "@/types"
import { createContext, useContext, useEffect, useMemo } from "react"
import { useLocation } from "react-router-dom"
import { toast } from "sonner"

import { useNotificationStore } from "./useNotificationStore"

const NotificationContext = createContext<NotificationContextProps>({})

interface NotificationProviderProps {
    children: React.ReactNode
    withNotifier?: boolean
}

export const NotificationProvider: React.FC<NotificationProviderProps> = ({
    children,
    withNotifier
}) => {
    const notifiers = useNotificationStore((store) => store.notifiers)
    const setNotifier = useNotificationStore((store) => store.setNotifier)

    const location = useLocation()

    useEffect(() => {
        if (withNotifier)
            (async () => {
                try {
                    const n = (await getNotification()) || []
                    const nData = n.map(({ id, name }) => ({ id, name }))
                    setNotifier(nData)
                } catch (error: any) {
                    toast("NotificationProvider Error", {
                        description: error.message,
                    })
                    setNotifier(undefined)
                }
            })()
    }, [location.pathname, setNotifier, withNotifier])

    const value: NotificationContextProps = useMemo(
        () => ({
            notifiers: notifiers,
        }),
        [notifiers],
    )
    return <NotificationContext.Provider value={value}>{children}</NotificationContext.Provider>
}

export const useNotification = () => {
    return useContext(NotificationContext)
}
