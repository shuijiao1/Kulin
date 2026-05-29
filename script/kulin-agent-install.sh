#!/bin/sh

NZ_BASE_PATH="${NZ_BASE_PATH:-/opt/kulin}"
NZ_AGENT_PATH="${NZ_BASE_PATH}/agent"
NZ_AGENT_BIN="${NZ_AGENT_PATH}/kulin-agent"

red='\033[0;31m'
green='\033[0;32m'
yellow='\033[0;33m'
plain='\033[0m'

err() { printf "${red}%s${plain}\n" "$*" >&2; }
success() { printf "${green}%s${plain}\n" "$*"; }
info() { printf "${yellow}%s${plain}\n" "$*"; }

sudo() {
    myEUID=$(id -ru)
    if [ "$myEUID" -ne 0 ]; then
        if command -v sudo >/dev/null 2>&1; then command sudo "$@"; else err "ERROR: sudo is not installed."; exit 1; fi
    else
        "$@"
    fi
}

deps_check() {
    missing=""
    for dep in curl unzip grep; do command -v "$dep" >/dev/null 2>&1 || missing="$missing $dep"; done
    [ -z "$missing" ] || { err "Missing dependencies:$missing"; exit 1; }
}

env_check() {
    mach=$(uname -m)
    case "$mach" in
        amd64|x86_64) os_arch="amd64" ;;
        i386|i686) os_arch="386" ;;
        aarch64|arm64) os_arch="arm64" ;;
        *arm*) os_arch="arm" ;;
        s390x) os_arch="s390x" ;;
        riscv64) os_arch="riscv64" ;;
        mips) os_arch="mips" ;;
        mipsel|mipsle) os_arch="mipsle" ;;
        loongarch64) os_arch="loong64" ;;
        *) err "Unknown architecture: $mach"; exit 1 ;;
    esac
    system=$(uname)
    case "$system" in
        *Linux*) os="linux" ;;
        *Darwin*) os="darwin" ;;
        *FreeBSD*) os="freebsd" ;;
        *) err "Unknown system: $system"; exit 1 ;;
    esac
}

stop_old_services() {
    if [ -x /opt/nezha/agent/nezha-agent ]; then
        for cfg in /opt/nezha/agent/*config*.yml; do
            [ -f "$cfg" ] && sudo /opt/nezha/agent/nezha-agent service -c "$cfg" uninstall >/dev/null 2>&1 || true
        done
    fi
    if [ -x "$NZ_AGENT_BIN" ]; then
        for cfg in "$NZ_AGENT_PATH"/*config*.yml; do
            [ -f "$cfg" ] && sudo "$NZ_AGENT_BIN" service -c "$cfg" uninstall >/dev/null 2>&1 || true
        done
    fi
}

install() {
    deps_check
    env_check
    [ -n "$NZ_SERVER" ] || { err "NZ_SERVER should not be empty"; exit 1; }
    [ -n "$NZ_CLIENT_SECRET" ] || { err "NZ_CLIENT_SECRET should not be empty"; exit 1; }

    tmp="/tmp/kulin-agent_${os}_${os_arch}.zip"
    url="https://github.com/nezhahq/agent/releases/latest/download/nezha-agent_${os}_${os_arch}.zip"
    info "Downloading kulin-agent..."
    curl --max-time 60 -fsSL "$url" -o "$tmp" || { err "Download kulin-agent release failed"; exit 1; }

    sudo mkdir -p "$NZ_AGENT_PATH"
    sudo unzip -qo "$tmp" -d "$NZ_AGENT_PATH"
    rm -f "$tmp"
    if [ -f "$NZ_AGENT_PATH/nezha-agent" ]; then
        sudo mv -f "$NZ_AGENT_PATH/nezha-agent" "$NZ_AGENT_BIN"
        sudo chmod +x "$NZ_AGENT_BIN"
    fi
    [ -x "$NZ_AGENT_BIN" ] || { err "kulin-agent binary not found"; exit 1; }

    path="$NZ_AGENT_PATH/config.yml"
    stop_old_services

    NZ_DISABLE_COMMAND_EXECUTE="${NZ_DISABLE_COMMAND_EXECUTE:-true}"
    env="NZ_UUID=$NZ_UUID NZ_SERVER=$NZ_SERVER NZ_CLIENT_SECRET=$NZ_CLIENT_SECRET NZ_TLS=$NZ_TLS NZ_DISABLE_AUTO_UPDATE=$NZ_DISABLE_AUTO_UPDATE NZ_DISABLE_FORCE_UPDATE=$NZ_DISABLE_FORCE_UPDATE NZ_DISABLE_COMMAND_EXECUTE=$NZ_DISABLE_COMMAND_EXECUTE NZ_SKIP_CONNECTION_COUNT=$NZ_SKIP_CONNECTION_COUNT"
    if ! sudo env $env "$NZ_AGENT_BIN" service -c "$path" install; then
        err "Install kulin-agent service failed"
        sudo "$NZ_AGENT_BIN" service -c "$path" uninstall >/dev/null 2>&1 || true
        exit 1
    fi
    success "kulin-agent successfully installed"
}

uninstall() {
    stop_old_services
    for cfg in "$NZ_AGENT_PATH"/*config*.yml; do [ -f "$cfg" ] && sudo rm -f "$cfg"; done
    info "Uninstallation completed."
}

[ "$1" = "uninstall" ] && { uninstall; exit; }
install
