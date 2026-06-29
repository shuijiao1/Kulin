import { getAgentSecret } from "@/api/user"
import { Button, ButtonProps } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import useSettings from "@/hooks/useSetting"
import { t } from "@/lib/labels"
import { copyToClipboard } from "@/lib/utils"
import { ModelSetting } from "@/types"
import { Check, Copy, Download } from "lucide-react"
import { forwardRef, useState } from "react"
import { toast } from "sonner"

enum OSTypes {
    Linux = 1,
    macOS,
    Windows,
}

type InstallCommandsMenuProps = ButtonProps & {
    uuid?: string
    iconOnly?: boolean
    menuItem?: boolean
}

export const InstallCommandsMenu = forwardRef<HTMLButtonElement, InstallCommandsMenuProps>(
    ({ uuid, iconOnly = false, menuItem = false, ...props }, ref) => {
        const [copy, setCopy] = useState(false)
        const { data: settings } = useSettings()

        const switchState = async (type: number) => {
            if (!copy) {
                try {
                    setCopy(true)
                    if (!settings?.config) throw new Error("Settings is not found.")
                    const { agent_secret } = await getAgentSecret()
                    await copyToClipboard(
                        generateCommand(type, settings!.config, agent_secret, uuid) || "",
                    )
                } catch (e: Error | any) {
                    console.error(e)
                    toast(t("Error"), {
                        description: e.message,
                    })
                } finally {
                    setTimeout(() => {
                        setCopy(false)
                    }, 2 * 1000)
                }
            }
        }

        return (
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    {menuItem ? (
                        <button
                            type="button"
                            className="flex w-full items-center text-sm px-2 py-2 hover:bg-accent hover:text-accent-foreground"
                            title={t("InstallCommands")}
                        >
                            {copy ? (
                                <Check className="h-4 w-4 mr-2" />
                            ) : (
                                <Copy className="h-4 w-4 mr-2" />
                            )}
                            <span>{t("InstallCommands")}</span>
                        </button>
                    ) : iconOnly ? (
                        <Button ref={ref} title={t("InstallCommands")} size="icon" {...props}>
                            {copy ? (
                                <Check className="h-4 w-4" />
                            ) : (
                                <Download className="h-4 w-4" />
                            )}
                        </Button>
                    ) : (
                        <Button ref={ref} title={t("InstallCommands")} {...props}>
                            {copy ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                            <span className="ml-2">{t("InstallCommands")}</span>
                        </Button>
                    )}
                </DropdownMenuTrigger>
                <DropdownMenuContent
                    side={menuItem ? "right" : undefined}
                    align={menuItem ? "start" : undefined}
                >
                    <DropdownMenuItem
                        className="nezha-copy"
                        onClick={async () => {
                            switchState(OSTypes.Linux)
                        }}
                    >
                        Linux
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="nezha-copy"
                        onClick={async () => {
                            switchState(OSTypes.macOS)
                        }}
                    >
                        macOS
                    </DropdownMenuItem>
                    <DropdownMenuItem
                        className="nezha-copy"
                        onClick={async () => {
                            switchState(OSTypes.Windows)
                        }}
                    >
                        Windows
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>
        )
    },
)

const normalizeInstallHost = (host?: string) => {
    const trimmed = (host || "").trim()
    if (!trimmed) return "shuijiao.li:443"
    if (/^https?:\/\//i.test(trimmed)) {
        const url = new URL(trimmed)
        return url.port ? url.host : `${url.hostname}:${url.protocol === "https:" ? "443" : "80"}`
    }
    if (trimmed.startsWith("[") && trimmed.includes("]:")) return trimmed
    if (!trimmed.includes(":")) return `${trimmed}:443`
    return trimmed
}

const shellQuote = (value: string | boolean) => `'${String(value).replace(/'/g, `'\\''`)}'`
const powerShellQuote = (value: string | boolean) => `'${String(value).replace(/'/g, `''`)}'`

const generateCommand = (
    type: number,
    { install_host, tls }: ModelSetting,
    agent_secret?: string,
    uuid?: string,
) => {
    const agentHost = normalizeInstallHost(install_host)

    if (!agent_secret) throw new Error(t("Results.AgentSecretRequired"))

    const useTLS = tls !== false
    const envParts = [
        `KULIN_SERVER=${shellQuote(agentHost)}`,
        `KULIN_TLS=${shellQuote(useTLS)}`,
        `KULIN_CLIENT_SECRET=${shellQuote(agent_secret)}`,
    ]
    if (uuid) envParts.push(`KULIN_UUID=${shellQuote(uuid)}`)
    const env = envParts.join(" ")

    const envWinParts = [
        `$env:KULIN_SERVER=${powerShellQuote(agentHost)};`,
        `$env:KULIN_TLS=${powerShellQuote(useTLS)};`,
        `$env:KULIN_CLIENT_SECRET=${powerShellQuote(agent_secret)};`,
    ]
    if (uuid) envWinParts.push(`$env:KULIN_UUID=${powerShellQuote(uuid)};`)
    const env_win = envWinParts.join("")

    if (type === OSTypes.Linux || type === OSTypes.macOS) {
        return `curl -fsSL https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.sh -o kulin-agent.sh && chmod +x kulin-agent.sh && env ${env} ./kulin-agent.sh`
    }
    if (type === OSTypes.Windows) {
        return `Remove-Item C:\\kulin-agent.ps1 -Force -ErrorAction SilentlyContinue;${env_win}[Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12;Invoke-WebRequest "https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install-windows.ps1" -Headers @{"Cache-Control"="no-cache"} -OutFile C:\\kulin-agent.ps1;powershell.exe -ExecutionPolicy Bypass -File C:\\kulin-agent.ps1`
    }
    throw new Error(`Unknown OS: ${type}`)
}
