import { ModelIP } from "@/types"
import { type ClassValue, clsx } from "clsx"
import copy from "copy-to-clipboard"
import { twMerge } from "tailwind-merge"
import { z } from "zod"

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs))
}

const emptyStringToUndefined = z.literal("").transform(() => undefined)

export function asOptionalField<T extends z.ZodTypeAny>(schema: T) {
    return schema.optional().or(emptyStringToUndefined)
}

export const conv = {
    recordToStr: <T>(rec: Record<string, T>) => {
        const arr: string[] = []
        for (const key in rec) {
            arr.push(key)
        }

        return arr.join(",")
    },
    strToRecord: (str: string) => {
        const arr = str.split(",")
        return arr.reduce(
            (acc, num) => {
                acc[num] = true
                return acc
            },
            {} as Record<string, boolean>,
        )
    },
    arrToStr: <T>(arr: T[]) => {
        return arr.join(",")
    },
    strToArr: (str: string) => {
        return str.split(",").filter(Boolean) || []
    },
    recordToArr: <T>(rec: Record<string, T>) => {
        const arr: T[] = []
        for (const val of Object.values(rec)) {
            arr.push(val)
        }
        return arr
    },
    recordToStrArr: <T>(rec: Record<string, T>) => {
        const arr: string[] = []
        for (const val of Object.keys(rec)) {
            arr.push(val)
        }
        return arr
    },
    arrToRecord: (arr: string[]) => {
        const rec: Record<string, boolean> = {}
        for (const val of arr) {
            rec[val] = true
        }
        return rec
    },
}

export const sleep = (ms: number) => {
    return new Promise((resolve) => setTimeout(resolve, ms))
}

export function formatPath(path: string) {
    return path.replace(/\/{2,}/g, "/")
}

// Returns the URL only if it uses an http(s) scheme, else undefined. Guards
// against rendering attacker-controlled template metadata as a clickable
// javascript:/data: href.
export function safeExternalHref(url?: string): string | undefined {
    if (!url) return undefined
    try {
        const parsed = new URL(url, window.location.origin)
        return parsed.protocol === "https:" || parsed.protocol === "http:" ? parsed.href : undefined
    } catch {
        return undefined
    }
}

export function joinIP(p?: ModelIP) {
    if (p) {
        if (p.ipv4_addr && p.ipv6_addr) {
            return `${p.ipv4_addr}/${p.ipv6_addr}`
        } else if (p.ipv4_addr) {
            return p.ipv4_addr
        }
        return p.ipv6_addr
    }
    return ""
}

export async function copyToClipboard(text: string) {
    try {
        return await navigator.clipboard.writeText(text)
    } catch (error) {
        console.error("navigator", error)
    }
    try {
        return copy(text)
    } catch (error) {
        console.error("copy", error)
    }
    throw new Error("Failed to copy text to clipboard")
}
