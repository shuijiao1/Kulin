import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { t } from "@/lib/labels"
import { Link } from "react-router-dom"

export const SettingsTab = ({ className }: { className?: string }) => {
    return (
        <Tabs defaultValue={window.location.pathname} className={className}>
            <TabsList className="grid w-full grid-cols-1">
                <TabsTrigger value="/dashboard/settings" asChild>
                    <Link to="/dashboard/settings">{t("Settings")}</Link>
                </TabsTrigger>
            </TabsList>
        </Tabs>
    )
}
