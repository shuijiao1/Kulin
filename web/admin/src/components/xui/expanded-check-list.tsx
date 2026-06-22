import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { cn } from "@/lib/utils"
import { ChevronDown } from "lucide-react"
import { useState } from "react"

export interface ExpandedCheckListOption {
    value: string
    label: string
}

interface ExpandedCheckListProps {
    options: ExpandedCheckListOption[]
    value: string[]
    onChange: (value: string[]) => void
    title?: string
    emptyText?: string
    className?: string
    renderRight?: (option: ExpandedCheckListOption, checked: boolean) => React.ReactNode
}

export const ExpandedCheckList: React.FC<ExpandedCheckListProps> = ({
    options,
    value,
    onChange,
    title = "已选",
    emptyText = "暂无可选项",
    className,
    renderRight,
}) => {
    const [expanded, setExpanded] = useState(false)
    const selectedSet = new Set(value)

    const toggleValue = (optionValue: string, checked: boolean) => {
        if (checked) {
            onChange(Array.from(new Set([...value, optionValue])))
            return
        }
        onChange(value.filter((item) => item !== optionValue))
    }

    return (
        <div className={cn("space-y-2", className)}>
            <Button
                type="button"
                variant="outline"
                className="flex w-full justify-between gap-2"
                onClick={() => setExpanded((current) => !current)}
            >
                <span>
                    {title} {value.length}/{options.length}
                </span>
                <ChevronDown
                    className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        expanded && "rotate-180",
                    )}
                />
            </Button>
            {expanded && (
                <div className="max-h-64 overflow-y-auto rounded-md border bg-background">
                    {options.length > 0 ? (
                        options.map((option) => {
                            const checked = selectedSet.has(option.value)
                            return (
                                <div
                                    key={option.value}
                                    className="flex items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50"
                                >
                                    <Checkbox
                                        checked={checked}
                                        onCheckedChange={(next) =>
                                            toggleValue(option.value, next === true)
                                        }
                                    />
                                    <button
                                        type="button"
                                        className="min-w-0 flex-1 truncate text-left text-sm"
                                        onClick={() => toggleValue(option.value, !checked)}
                                        title={option.label}
                                    >
                                        {option.label}
                                    </button>
                                    {renderRight?.(option, checked)}
                                </div>
                            )
                        })
                    ) : (
                        <div className="px-3 py-6 text-center text-sm text-muted-foreground">
                            {emptyText}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
