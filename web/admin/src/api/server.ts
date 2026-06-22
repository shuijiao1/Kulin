import { ModelServer, ModelServerForm } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const updateServer = async (id: number, data: ModelServerForm): Promise<void> => {
    return fetcher<void>(FetcherMethod.PATCH, `/api/v1/server/${id}`, data)
}

export const deleteServer = async (id: number[]): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/batch-delete/server", id)
}

export const getServers = async (): Promise<ModelServer[]> => {
    return fetcher<ModelServer[]>(FetcherMethod.GET, "/api/v1/server", null)
}

export const getServerServiceBinding = async (id: number): Promise<Record<string, boolean>> => {
    return fetcher<Record<string, boolean>>(
        FetcherMethod.GET,
        `/api/v1/server/${id}/service-binding`,
        null,
    )
}

export const updateServerServiceBinding = async (
    id: number,
    data: Record<string, boolean>,
): Promise<void> => {
    return fetcher<void>(FetcherMethod.PATCH, `/api/v1/server/${id}/service-binding`, data)
}
