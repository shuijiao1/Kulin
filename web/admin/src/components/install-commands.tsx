import { Button, ButtonProps } from "@/components/ui/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { useAuth } from "@/hooks/useAuth"
import useSettings from "@/hooks/useSetting"
import { copyToClipboard } from "@/lib/utils"
import { ModelProfile, ModelSetting } from "@/types"
import { t } from "@/lib/labels"
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
        const { profile } = useAuth()


        const switchState = async (type: number) => {
            if (!copy) {
                try {
                    setCopy(true)
                    if (!profile) throw new Error("Profile is not found.")
                    if (!settings?.config) throw new Error("Settings is not found.")
                    await copyToClipboard(
                        generateCommand(type, settings!.config, profile, uuid) || "",
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
                        <Button
                            ref={ref}
                            title={t("InstallCommands")}
                            size="icon"
                            {...props}
                        >
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

const generateCommand = (
    type: number,
    { install_host, tls }: ModelSetting,
    { agent_secret }: ModelProfile,
    uuid?: string,
) => {
    if (!install_host) throw new Error(t("Results.InstallHostRequired"))

    if (!agent_secret) throw new Error(t("Results.AgentSecretRequired"))

    const envParts = [
        `KULIN_SERVER=${install_host}`,
        `KULIN_TLS=${tls || false}`,
        `KULIN_CLIENT_SECRET=${agent_secret}`,
        `KULIN_AGENT_VERSION=v0.1.1`,
    ]
    if (uuid) envParts.push(`KULIN_UUID=${uuid}`)
    const env = envParts.join(" ")

    const envWinParts = [
        `$env:KULIN_SERVER="${install_host}";`,
        `$env:KULIN_TLS="${tls || false}";`,
        `$env:KULIN_CLIENT_SECRET="${agent_secret}";`,
        `$env:KULIN_AGENT_VERSION="v0.1.1";`,
    ]
    if (uuid) envWinParts.push(`$env:KULIN_UUID="${uuid}";`)
    const env_win = envWinParts.join("")

    switch (type) {
    case OSTypes.Linux:
    case OSTypes.macOS: {
        return `curl -fsSL https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.sh -o kulin-agent.sh && chmod +x kulin-agent.sh && env ${env} ./kulin-agent.sh`
    }
    case OSTypes.Windows: {
        return `${env_win} [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12;Invoke-WebRequest https://raw.githubusercontent.com/shuijiao1/Kulin/master/script/agent-install.ps1 -OutFile C:\\kulin-agent.ps1;powershell.exe -ExecutionPolicy Bypass -File C:\\kulin-agent.ps1`
    }
    default: {
        throw new Error(`Unknown OS: ${type}`)
    }
    }
}
