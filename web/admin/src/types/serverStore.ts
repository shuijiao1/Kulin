export interface ServerIdentifierType {
    id: number
    name: string
}

export interface ServerStore {
    server?: ServerIdentifierType[]
    setServer: (server?: ServerIdentifierType[]) => void
}
