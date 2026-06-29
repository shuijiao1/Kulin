export interface ModelIP {
    ipv4_addr?: string
    ipv6_addr?: string
}

export interface ModelUser {
    id: number
    username: string
    role?: number
    avatar_url?: string
}

export interface ModelProfile extends ModelUser {
    login_ip?: string
}

export interface ModelAgentSecretResponse {
    agent_secret?: string
}

export interface ModelProfileForm {
    original_password?: string
    new_username?: string
    new_password?: string
    avatar_url?: string
}

export interface ModelServerHost {
    platform?: string
    platform_version?: string
    version?: string
    cpu?: string[]
    gpu?: string[]
    mem_total?: number
    disk_total?: number
    swap_total?: number
    arch?: string
    virtualization?: string
    boot_time?: number
    ip?: ModelIP
    country_code?: string
}

export interface ModelServerState {
    cpu?: number
    mem_used?: number
    swap_used?: number
    disk_used?: number
    net_in_transfer?: number
    net_out_transfer?: number
    net_in_speed?: number
    net_out_speed?: number
    uptime?: number
    load_1?: number
    load_5?: number
    load_15?: number
    tcp_conn_count?: number
    udp_conn_count?: number
    process_count?: number
    temperatures?: number[]
    gpu?: unknown[]
}

export interface ModelServer {
    id: number
    name: string
    uuid?: string
    note?: string
    public_note?: string
    display_index?: number
    host?: ModelServerHost
    state?: ModelServerState
    last_active?: string
    geoip?: { ip?: ModelIP }
    version?: string
    traffic_progress_enabled?: boolean
    traffic_progress_mode?: "out" | "in" | "max" | "dual"
    traffic_progress_limit?: number
    traffic_progress_limit_unit?: "GB" | "TB"
    traffic_progress_start_day?: number
    home_monitor_id?: number
}

export type ModelServerForm = Partial<ModelServer>

export interface ModelService {
    id: number
    name: string
    type: number
    target?: string
    duration?: number
    cover?: number
    skip_servers?: Record<string, boolean>
    skip_servers_raw?: string[]
    notification_group_id?: number
    fail_trigger_tasks?: number[]
    fail_trigger_tasks_raw?: string
    recover_trigger_tasks?: number[]
    recover_trigger_tasks_raw?: string
    min_latency?: number
    max_latency?: number
    enable_trigger_task?: boolean
    notify?: boolean
    latency_notify?: boolean
    display_index?: number
}

export type ModelServiceForm = Partial<ModelService>

export interface ModelNotification {
    id: number
    name: string
    url?: string
    telegram_bot_token?: string
    telegram_user_id?: string
    request_type?: number
    request_method?: number
    request_header?: string
    request_body?: string
    verify_tls?: boolean
    skip_check?: boolean
    format_metric_units?: boolean
}

export type ModelNotificationForm = Partial<ModelNotification>

export interface ModelAlertRuleEntry {
    type: string
    min?: number
    max?: number
    cycle_start?: string
    cycle_interval?: number
    cycle_unit?: "hour" | "day" | "week" | "month" | "year"
    duration?: number
    cover: number
    ignore?: Record<string, boolean>
    next_transfer_at?: Record<string, string>
    last_cycle_status?: boolean
}

export interface ModelAlertRule {
    id: number
    name: string
    rules?: ModelAlertRuleEntry[]
    fail_trigger_tasks?: number[]
    recover_trigger_tasks?: number[]
    notification_group_id?: number
    trigger_mode?: number
    enable?: boolean
}

export type ModelAlertRuleForm = Partial<ModelAlertRule>

export interface FrontendTemplate {
    path?: string
    name?: string
    author?: string
    repository?: string
    is_admin?: boolean
    is_official?: boolean
}

export interface ModelSetting {
    site_name?: string
    avatar_url?: string
    theme_mode?: "default" | "glass" | string
    background_image?: string
    mobile_background_image?: string
    user_template?: string
    install_host?: string
    dashboard_host?: string
    reserved_hosts?: string
    custom_code?: string
    custom_code_dashboard?: string
    tls?: boolean
    web_real_ip_header?: string
    agent_real_ip_header?: string
    enable_plain_ip_in_notification?: boolean
    version?: string
}

export type ModelSettingForm = Partial<ModelSetting>

export interface ModelSettingResponse {
    config?: ModelSetting
    version?: string
    frontend_templates?: FrontendTemplate[]
}
