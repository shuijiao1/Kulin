import { updateSettings } from "@/api/settings"
import { SettingsTab } from "@/components/settings-tab"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select"
import { Textarea } from "@/components/ui/textarea"
import { useAuth } from "@/hooks/useAuth"
import useSetting from "@/hooks/useSetting"
import { t } from "@/lib/labels"
import { asOptionalField } from "@/lib/utils"
import { zodResolver } from "@hookform/resolvers/zod"
import { useEffect } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { z } from "zod"

const DEFAULT_AGENT_HOST = "shuijiao.li:443"

const settingFormSchema = z.object({
    site_name: z.string().min(1),
    user_template: z.string().min(1),
    install_host: asOptionalField(z.string()),
    custom_code: asOptionalField(z.string()),
    avatar_url: z.string().optional(),
    theme_mode: z.enum(["default", "glass"]).optional(),
    background_image: z.string().optional(),
    mobile_background_image: z.string().optional(),

    tls: asOptionalField(z.boolean()),
    enable_plain_ip_in_notification: asOptionalField(z.boolean()),
})

export default function SettingsPage() {
    const { data: config, mutate } = useSetting()
    const { profile, loading: authLoading } = useAuth()

    const isAdmin = profile?.role === 0

    // 所有 hooks 必须在条件 return 之前调用，否则违反 rules-of-hooks。
    const form = useForm({
        resolver: zodResolver(settingFormSchema) as any,
        defaultValues: config
            ? {
                  ...config.config,
                  user_template:
                      config.config?.user_template ||
                      Object.keys(config.frontend_templates?.filter((t) => !t.is_admin) || {})[0] ||
                      "user-dist",
                  install_host: config.config?.install_host || DEFAULT_AGENT_HOST,
                  tls: config.config?.tls !== false,
                  avatar_url: config.config?.avatar_url || "",
                  theme_mode: config.config?.theme_mode === "glass" ? "glass" : "default",
                  background_image: config.config?.background_image || "",
                  mobile_background_image: config.config?.mobile_background_image || "",
              }
            : {
                  site_name: "",
                  user_template: "user-dist",
                  install_host: DEFAULT_AGENT_HOST,
                  tls: true,
                  avatar_url: "",
                  theme_mode: "default",
                  background_image: "",
                  mobile_background_image: "",
              },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    useEffect(() => {
        if (config?.config) {
            form.reset({
                ...config?.config,
                user_template:
                    config.config?.user_template ||
                    Object.keys(config.frontend_templates?.filter((t) => !t.is_admin) || {})[0] ||
                    "user-dist",
                install_host: config.config?.install_host || DEFAULT_AGENT_HOST,
                tls: config.config?.tls !== false,
                avatar_url: config.config?.avatar_url || "",
                theme_mode: config.config?.theme_mode === "glass" ? "glass" : "default",
                background_image: config.config?.background_image || "",
                mobile_background_image: config.config?.mobile_background_image || "",
            })
        }
    }, [config?.config, form])

    if (authLoading) {
        return null
    }
    if (!isAdmin) {
        return null
    }

    const onSubmit = async (values: any) => {
        try {
            const settingsValues = {
                ...values,
                install_host: values.install_host || DEFAULT_AGENT_HOST,
                tls: values.tls !== false,
                avatar_url: values.avatar_url || "",
                theme_mode: values.theme_mode || "default",
                background_image: values.background_image || "",
                mobile_background_image: values.mobile_background_image || "",
            }
            await updateSettings({
                ...settingsValues,
                user_template:
                    settingsValues.user_template ||
                    config?.config?.user_template ||
                    Object.keys(config?.frontend_templates?.filter((t) => !t.is_admin) || {})[0] ||
                    "user-dist",
            })
            form.reset()
            await mutate()
        } catch (e) {
            toast(t("Error"), {
                description: t("Results.ErrorFetchingResource", {
                    error: e?.toString(),
                }),
            })
            return
        }
        toast(t("Success"))
    }

    return (
        <div className="px-3">
            <SettingsTab className="mt-6 mb-4 w-full" />
            <div>
                <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                        <FormField
                            control={form.control}
                            name="site_name"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("SiteName")}</FormLabel>
                                    <FormControl>
                                        <Input {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="install_host"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("DashboardOriginalHost")}</FormLabel>
                                    <FormControl>
                                        <Input placeholder={DEFAULT_AGENT_HOST} {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="avatar_url"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>头像链接</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="https://example.com/avatar.png"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="theme_mode"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>首页主题</FormLabel>
                                    <Select
                                        onValueChange={field.onChange}
                                        value={field.value || "default"}
                                    >
                                        <FormControl>
                                            <SelectTrigger>
                                                <SelectValue placeholder="选择首页主题" />
                                            </SelectTrigger>
                                        </FormControl>
                                        <SelectContent>
                                            <SelectItem value="default">默认主题</SelectItem>
                                            <SelectItem value="glass">高斯模糊主题</SelectItem>
                                        </SelectContent>
                                    </Select>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="background_image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>电脑端背景图链接</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="https://example.com/desktop-bg.jpg"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="mobile_background_image"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>手机端背景图链接</FormLabel>
                                    <FormControl>
                                        <Input
                                            placeholder="https://example.com/mobile-bg.jpg"
                                            {...field}
                                        />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="custom_code"
                            render={({ field }) => (
                                <FormItem>
                                    <FormLabel>{t("CustomCodes")}</FormLabel>
                                    <FormControl>
                                        <Textarea className="font-mono" {...field} />
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="tls"
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                            <Label className="text-sm">{t("ConfigTLS")}</Label>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <FormField
                            control={form.control}
                            name="enable_plain_ip_in_notification"
                            render={({ field }) => (
                                <FormItem className="flex items-center space-x-2">
                                    <FormControl>
                                        <div className="flex items-center gap-2">
                                            <Checkbox
                                                checked={field.value}
                                                onCheckedChange={field.onChange}
                                            />
                                            <Label className="text-sm">
                                                {t("FullIPNotification")}
                                            </Label>
                                        </div>
                                    </FormControl>
                                    <FormMessage />
                                </FormItem>
                            )}
                        />
                        <Button type="submit">{t("Confirm")}</Button>
                    </form>
                </Form>
            </div>
        </div>
    )
}
