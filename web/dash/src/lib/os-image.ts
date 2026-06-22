type OSConfig = {
	name: string;
	image: string;
	keywords: string[];
};

const osConfigs: OSConfig[] = [
	{
		name: "Alibaba",
		image: "/assets/logo/os-alibaba.svg",
		keywords: ["alibaba"],
	},
	{
		name: "AlmaLinux",
		image: "/assets/logo/os-alma.svg",
		keywords: ["alma", "almalinux"],
	},
	{
		name: "Alpine Linux",
		image: "/assets/logo/os-alpine.webp",
		keywords: ["alpine"],
	},
	{
		name: "Arch Linux",
		image: "/assets/logo/os-arch.svg",
		keywords: ["arch", "archlinux"],
	},
	{
		name: "Armbian",
		image: "/assets/logo/os-armbian.svg",
		keywords: ["armbian"],
	},
	{
		name: "Astra Linux",
		image: "/assets/logo/os-astra.png",
		keywords: ["astra"],
	},
	{ name: "CentOS", image: "/assets/logo/os-centos.svg", keywords: ["centos"] },
	{
		name: "Debian",
		image: "/assets/logo/os-debian.svg",
		keywords: ["debian", "deb"],
	},
	{ name: "Fedora", image: "/assets/logo/os-fedora.svg", keywords: ["fedora"] },
	{
		name: "FreeBSD",
		image: "/assets/logo/os-freebsd.svg",
		keywords: ["freebsd", "bsd"],
	},
	{ name: "Gentoo", image: "/assets/logo/os-gentoo.svg", keywords: ["gentoo"] },
	{
		name: "Huawei",
		image: "/assets/logo/os-huawei.svg",
		keywords: ["huawei", "euler"],
	},
	{
		name: "iStoreOS",
		image: "/assets/logo/os-istore.png",
		keywords: ["istore"],
	},
	{
		name: "Kali Linux",
		image: "/assets/logo/os-kail.svg",
		keywords: ["kali", "kail"],
	},
	{ name: "Linux Mint", image: "/assets/logo/os-mint.svg", keywords: ["mint"] },
	{
		name: "macOS",
		image: "/assets/logo/os-macos.svg",
		keywords: ["macos", "darwin", "apple"],
	},
	{
		name: "Manjaro",
		image: "/assets/logo/os-manjaro.svg",
		keywords: ["manjaro"],
	},
	{
		name: "NixOS",
		image: "/assets/logo/os-nix.svg",
		keywords: ["nixos", "nix"],
	},
	{
		name: "OpenCloudOS",
		image: "/assets/logo/os-opencloud.svg",
		keywords: ["opencloud"],
	},
	{
		name: "OpenWrt",
		image: "/assets/logo/os-openwrt.svg",
		keywords: ["openwrt", "immortalwrt", "qwrt"],
	},
	{
		name: "openSUSE",
		image: "/assets/logo/os-openSUSE.svg",
		keywords: ["opensuse", "suse"],
	},
	{
		name: "Orange Pi",
		image: "/assets/logo/os-orange-pi.svg",
		keywords: ["orange pi", "orangepi"],
	},
	{
		name: "Proxmox VE",
		image: "/assets/logo/os-proxmox.ico",
		keywords: ["proxmox"],
	},
	{ name: "QNAP", image: "/assets/logo/os-qnap.svg", keywords: ["qnap"] },
	{
		name: "Red Hat",
		image: "/assets/logo/os-redhat.svg",
		keywords: ["redhat", "rhel", "red hat"],
	},
	{
		name: "Rocky Linux",
		image: "/assets/logo/os-rocky.svg",
		keywords: ["rocky"],
	},
	{
		name: "Synology DSM",
		image: "/assets/logo/os-synology.ico",
		keywords: ["synology", "dsm"],
	},
	{
		name: "Ubuntu",
		image: "/assets/logo/os-ubuntu.svg",
		keywords: ["ubuntu", "elementary"],
	},
	{ name: "Unraid", image: "/assets/logo/os-unraid.svg", keywords: ["unraid"] },
	{
		name: "Windows",
		image: "/assets/logo/os-windows.svg",
		keywords: ["windows", "win", "microsoft"],
	},
];

export function getOSImage(osString: string): string {
	const normalized = osString.toLowerCase().trim();
	const match = osConfigs.find((config) =>
		config.keywords.some((keyword) => normalized.includes(keyword)),
	);
	return match?.image ?? "/assets/logo/linux.svg";
}
