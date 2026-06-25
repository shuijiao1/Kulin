import { ModelProfile, ModelProfileForm } from "@/types"

import { FetcherMethod, fetcher } from "./api"

export const getProfile = async (): Promise<ModelProfile> => {
    return fetcher<ModelProfile>(FetcherMethod.GET, "/api/v1/profile", null)
}

export const login = async (username: string, password: string): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/login", { username, password })
}

export const updateProfile = async (data: ModelProfileForm): Promise<void> => {
    return fetcher<void>(FetcherMethod.POST, "/api/v1/profile", data)
}
