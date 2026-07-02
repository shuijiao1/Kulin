import { createNotification, updateNotification } from "@/api/notification"
import { Button } from "@/components/ui/button"
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from "@/components/ui/dialog"
import {
    Form,
    FormControl,
    FormField,
    FormItem,
    FormLabel,
    FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { ScrollArea } from "@/components/ui/scroll-area"
import { IconButton } from "@/components/xui/icon-button"
import { t } from "@/lib/labels"
import { ModelNotification } from "@/types"
import { zodResolver } from "@hookform/resolvers/zod"
import { useState } from "react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { KeyedMutator } from "swr"
import { z } from "zod"

interface NotifierCardProps {
    data?: ModelNotification
    mutate: KeyedMutator<ModelNotification[]>
}

const notificationFormSchema = z.object({
    name: z.string().min(1),
    bot_token: z.string().optional(),
    user_id: z.string().min(1),
})

export const NotifierCard: React.FC<NotifierCardProps> = ({ data, mutate }) => {
    type NotificationFormInput = z.input<typeof notificationFormSchema>
    type NotificationFormData = z.output<typeof notificationFormSchema>
    const parseTelegramConfig = (url?: string) => {
        if (!url) return { bot_token: "", user_id: "" }
        try {
            const u = new URL(url)
            const pathToken = decodeURIComponent(u.pathname.replace(/^\/bot/, "").split("/")[0])
            return {
                bot_token: pathToken.includes("*") ? "" : pathToken,
                user_id: u.searchParams.get("chat_id") || "",
            }
        } catch {
            return { bot_token: "", user_id: "" }
        }
    }
    const telegramConfig = parseTelegramConfig(data?.url)

    const form = useForm<NotificationFormInput, unknown, NotificationFormData>({
        resolver: zodResolver(notificationFormSchema),
        defaultValues: data
            ? {
                  name: data.name ?? "",
                  bot_token: telegramConfig.bot_token,
                  user_id: telegramConfig.user_id,
              }
            : {
                  name: "",
                  bot_token: "",
                  user_id: "",
              },
        resetOptions: {
            keepDefaultValues: false,
        },
    })

    const [open, setOpen] = useState(false)

    const onSubmit = async (values: NotificationFormData) => {
        try {
            const payload = {
                name: values.name,
                telegram_bot_token: values.bot_token || "",
                telegram_user_id: values.user_id,
                request_method: 1,
                request_type: 1,
                request_header: "",
                request_body: "",
                verify_tls: true,
                skip_check: false,
                format_metric_units: true,
            }
            if (data?.id) {
                await updateNotification(data.id, payload)
            } else {
                await createNotification(payload)
            }
        } catch (e) {
            console.error(e)
            toast(t("Error"), {
                description: t("Results.UnExpectedError"),
            })
            return
        }
        setOpen(false)
        await mutate()
        form.reset()
    }

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
                {data ? <IconButton variant="outline" icon="edit" /> : <IconButton icon="plus" />}
            </DialogTrigger>
            <DialogContent className="sm:max-w-xl">
                <ScrollArea className="max-h-[calc(100dvh-5rem)] p-3">
                    <div className="items-center mx-1">
                        <DialogHeader>
                            <DialogTitle>
                                {data ? t("EditNotifier") : t("CreateNotifier")}
                            </DialogTitle>
                            <DialogDescription />
                        </DialogHeader>
                        <Form {...form}>
                            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-2 my-2">
                                <FormField
                                    control={form.control}
                                    name="name"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>{t("Name")}</FormLabel>
                                            <FormControl>
                                                <Input placeholder="我的通知渠道" {...field} />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="bot_token"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Telegram Bot Token</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder={
                                                        data
                                                            ? "留空则保留原 Token"
                                                            : "123456:ABC-DEF..."
                                                    }
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <FormField
                                    control={form.control}
                                    name="user_id"
                                    render={({ field }) => (
                                        <FormItem>
                                            <FormLabel>Telegram 用户 ID</FormLabel>
                                            <FormControl>
                                                <Input
                                                    placeholder="填写接收通知的用户 ID"
                                                    {...field}
                                                />
                                            </FormControl>
                                            <FormMessage />
                                        </FormItem>
                                    )}
                                />
                                <DialogFooter className="justify-end">
                                    <DialogClose asChild>
                                        <Button type="button" className="my-2" variant="secondary">
                                            {t("Close")}
                                        </Button>
                                    </DialogClose>
                                    <Button type="submit" className="my-2">
                                        {t("Confirm")}
                                    </Button>
                                </DialogFooter>
                            </form>
                        </Form>
                    </div>
                </ScrollArea>
            </DialogContent>
        </Dialog>
    )
}
