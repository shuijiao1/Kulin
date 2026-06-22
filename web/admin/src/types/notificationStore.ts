export interface NotificationIdentifierType {
    id: number
    name: string
}

export interface NotificationStore {
    notifiers?: NotificationIdentifierType[]
    setNotifier: (notifiers?: NotificationIdentifierType[]) => void
}
