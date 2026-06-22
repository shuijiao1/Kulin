import { t } from "@/lib/labels"

export const serviceTypes: Record<number, string> = {
    1: "HTTP GET",
    2: "ICMP Ping",
    3: "TCPing",
}

export const serviceCoverageTypes: Record<number, string> = {
    0: t("Coverages.Excludes"),
    1: t("Coverages.Only"),
}
