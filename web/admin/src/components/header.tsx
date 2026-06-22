import { ModeToggle } from "@/components/mode-toggle"
import {
    Drawer,
    DrawerClose,
    DrawerContent,
    DrawerDescription,
    DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger,
} from "@/components/ui/drawer"
import {
    NavigationMenu,
    NavigationMenuItem,
    NavigationMenuLink,
    navigationMenuTriggerStyle,
} from "@/components/ui/navigation-menu"
import { useAuth } from "@/hooks/useAuth"
import { useMainStore } from "@/hooks/useMainStore"
import { useMediaQuery } from "@/hooks/useMediaQuery"
import useSetting from "@/hooks/useSetting"
import { t } from "@/lib/labels"
import { useState } from "react"
import { Link, useLocation } from "react-router-dom"

import { Button } from "./ui/button"
import { IconButton } from "./xui/icon-button"
import { NzNavigationMenuLink } from "./xui/navigation-menu"

const pages = [
    { href: "/dashboard", label: t("Server") },
    { href: "/dashboard/service", label: t("Service") },
    { href: "/dashboard/notification", label: t("Notification") },
    { href: "/dashboard/profile", label: t("Profile") },
]

export default function Header() {
    const { logout } = useAuth()
    const profile = useMainStore((store) => store.profile)
    const isAdmin = profile?.role === 0
    const { data: settingData } = useSetting()
    const siteName = settingData?.config?.site_name || t("nezha")
    const avatarURL = settingData?.config?.avatar_url

    const location = useLocation()
    const isDesktop = useMediaQuery("(min-width: 890px)")

    const [open, setOpen] = useState(false)

    return isDesktop ? (
        <header className="flex pt-8 px-4 dark:bg-black/40 bg-muted border-b-[1px] overflow-visible">
            <NavigationMenu className="flex flex-col items-start relative max-w-5xl mx-auto">
                <section className="w-full flex items-center  justify-between">
                    <div className="flex justify-between items-center w-full">
                        <NavigationMenuLink
                            asChild
                            className={
                                navigationMenuTriggerStyle() +
                                " !text-foreground hover:opacity-60 transition-opacity"
                            }
                        >
                            <Link to={profile ? "/dashboard" : "#"}>
                                <img
                                    className="h-7 w-7 mr-1 rounded-full object-cover"
                                    src={avatarURL || "/dashboard/logo.svg"}
                                    alt={siteName}
                                />
                                {siteName}
                            </Link>
                        </NavigationMenuLink>

                        <div className="flex items-center gap-1">
                            <a
                                href={"/"}
                                rel="noopener noreferrer"
                                className="flex items-center text-nowrap gap-1 text-sm font-medium opacity-50 transition-opacity hover:opacity-100"
                            >
                                {t("BackToHome")}
                            </a>
                            <ModeToggle />
                            {profile && (
                                <Button
                                    variant="ghost"
                                    onClick={logout}
                                    className="px-3 text-sm font-medium opacity-50 transition-opacity hover:bg-transparent hover:opacity-100"
                                >
                                    {t("Logout")}
                                </Button>
                            )}
                        </div>
                    </div>
                </section>
                <div className="mt-4 flex w-full list-none items-center gap-1">
                    {profile && (
                        <>
                            <NavigationMenuItem>
                                <NzNavigationMenuLink
                                    asChild
                                    active={location.pathname === "/dashboard"}
                                    className={navigationMenuTriggerStyle()}
                                >
                                    <Link to="/dashboard">{t("Server")}</Link>
                                </NzNavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NzNavigationMenuLink
                                    asChild
                                    active={location.pathname === "/dashboard/service"}
                                    className={navigationMenuTriggerStyle()}
                                >
                                    <Link to="/dashboard/service">{t("Service")}</Link>
                                </NzNavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NzNavigationMenuLink
                                    asChild
                                    active={
                                        location.pathname === "/dashboard/notification" ||
                                        location.pathname === "/dashboard/alert-rule"
                                    }
                                    className={navigationMenuTriggerStyle()}
                                >
                                    <Link to="/dashboard/notification">{t("Notification")}</Link>
                                </NzNavigationMenuLink>
                            </NavigationMenuItem>
                            <NavigationMenuItem>
                                <NzNavigationMenuLink
                                    asChild
                                    active={location.pathname === "/dashboard/profile"}
                                    className={navigationMenuTriggerStyle()}
                                >
                                    <Link to="/dashboard/profile">{t("Profile")}</Link>
                                </NzNavigationMenuLink>
                            </NavigationMenuItem>
                            {isAdmin && (
                                <NavigationMenuItem>
                                    <NzNavigationMenuLink
                                        asChild
                                        active={location.pathname === "/dashboard/settings"}
                                        className={navigationMenuTriggerStyle()}
                                    >
                                        <Link to="/dashboard/settings">{t("Settings")}</Link>
                                    </NzNavigationMenuLink>
                                </NavigationMenuItem>
                            )}
                        </>
                    )}
                </div>
            </NavigationMenu>
        </header>
    ) : (
        <header className="flex h-16 items-center gap-2 overflow-hidden border-b-[1px] bg-muted px-3 dark:bg-black/40">
            <div className="flex shrink-0 items-center justify-center">
                {profile && (
                    <Drawer open={open} onOpenChange={setOpen}>
                        <DrawerTrigger aria-label="Toggle Menu" asChild>
                            <IconButton icon="menu" variant="ghost" />
                        </DrawerTrigger>
                        <DrawerContent>
                            <DrawerHeader className="text-left">
                                <DrawerTitle>{t("NavigateTo")}</DrawerTitle>
                                <DrawerDescription>
                                    {t("SelectAPageToNavigateTo")}
                                </DrawerDescription>
                            </DrawerHeader>
                            <div className="grid gap-2 px-4">
                                {pages.map((item) => (
                                    <Link
                                        key={item.href}
                                        to={item.href}
                                        className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                                        onClick={() => setOpen(false)}
                                    >
                                        {item.label}
                                    </Link>
                                ))}
                                {isAdmin && (
                                    <Link
                                        to="/dashboard/settings"
                                        className="rounded-lg px-3 py-2 text-sm hover:bg-muted"
                                        onClick={() => setOpen(false)}
                                    >
                                        {t("Settings")}
                                    </Link>
                                )}
                            </div>
                            <DrawerFooter>
                                <DrawerClose asChild>
                                    <Button variant="outline">{t("Close")}</Button>
                                </DrawerClose>
                            </DrawerFooter>
                        </DrawerContent>
                    </Drawer>
                )}
            </div>
            <Link
                className="flex min-w-0 flex-1 items-center gap-2"
                to={profile ? "/dashboard" : "#"}
            >
                <img
                    className="h-7 w-7 shrink-0 rounded-full object-cover"
                    src={avatarURL || "/dashboard/logo.svg"}
                    alt={siteName}
                />
                <span className="truncate font-medium">{siteName}</span>
            </Link>
            <div className="ml-auto flex shrink-0 items-center gap-1">
                <a
                    href="/"
                    className="hidden text-nowrap text-xs font-medium opacity-60 transition-opacity hover:opacity-100 min-[380px]:inline-flex"
                >
                    {t("BackToHome")}
                </a>
                <ModeToggle />
                {profile && (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={logout}
                        className="px-2 text-xs text-destructive"
                    >
                        {t("Logout")}
                    </Button>
                )}
            </div>
        </header>
    )
}
