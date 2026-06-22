import { ButtonProps } from "@/components/ui/button"
import { copyToClipboard } from "@/lib/utils"
import { forwardRef } from "react"
import { useState } from "react"
import { toast } from "sonner"
import { t } from "@/lib/labels"

import { IconButton } from "./xui/icon-button"

interface CopyButtonProps extends ButtonProps {
    text?: string
}

export const CopyButton = forwardRef<HTMLButtonElement, CopyButtonProps>((props, ref) => {
    const [copy, setCopy] = useState(false)

    const switchState = async (text?: string) => {
        if (!text) {
            toast("Warning", {
                description: t("EmptyText"),
            })
            return
        }

        if (!copy) {
            setCopy(true)
            await copyToClipboard(text)
            setTimeout(() => {
                setCopy(false)
            }, 2 * 1000)
        }
    }

    return (
        <IconButton
            {...props}
            ref={ref}
            variant="outline"
            size="icon"
            icon={copy ? "check" : "clipboard"}
            onClick={() => switchState(props.text)}
        />
    )
})
