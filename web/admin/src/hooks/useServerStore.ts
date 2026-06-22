import { ServerStore } from "@/types"
import { create } from "zustand"
import { createJSONStorage, persist } from "zustand/middleware"

export const useServerStore = create<ServerStore, [["zustand/persist", ServerStore]]>(
    persist(
        (set, get) => ({
            server: get()?.server,
            setServer: (server) => set({ server }),
        }),
        {
            name: "serverStore",
            storage: createJSONStorage(() => localStorage),
        },
    ),
)
