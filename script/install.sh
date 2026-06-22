#!/bin/sh

set -eu

APP_NAME="kulin"
IMAGE="${KULIN_IMAGE:-ghcr.io/shuijiao1/kulin:latest}"
INSTALL_DIR="${KULIN_INSTALL_DIR:-/opt/kulin}"
DATA_DIR="$INSTALL_DIR/data"
COMPOSE_FILE="$INSTALL_DIR/docker-compose.yml"
DEFAULT_PORT="${KULIN_PORT:-8008}"

RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m'

info() { printf "%b\n" "${GREEN}$*${NC}"; }
warn() { printf "%b\n" "${YELLOW}$*${NC}"; }
error() { printf "%b\n" "${RED}$*${NC}" >&2; }

need_root() {
    if [ "$(id -u)" != "0" ]; then
        error "请使用 root 用户运行此脚本"
        exit 1
    fi
}

compose_cmd() {
    if docker compose version >/dev/null 2>&1; then
        echo "docker compose"
    elif command -v docker-compose >/dev/null 2>&1; then
        echo "docker-compose"
    else
        echo ""
    fi
}

install_docker() {
    if command -v docker >/dev/null 2>&1; then
        return 0
    fi

    warn "未检测到 Docker，开始安装 Docker..."
    if command -v curl >/dev/null 2>&1; then
        curl -fsSL https://get.docker.com | sh
    elif command -v wget >/dev/null 2>&1; then
        wget -qO- https://get.docker.com | sh
    else
        error "未找到 curl 或 wget，无法自动安装 Docker"
        exit 1
    fi

    systemctl enable --now docker >/dev/null 2>&1 || true
}

container_running() {
    docker ps --format '{{.Names}}' 2>/dev/null | grep -qx "$APP_NAME"
}

container_exists() {
    docker ps -a --format '{{.Names}}' 2>/dev/null | grep -qx "$APP_NAME"
}

current_port() {
    if [ -f "$COMPOSE_FILE" ]; then
        sed -n 's/.*- "\([0-9][0-9]*\):8008".*/\1/p' "$COMPOSE_FILE" | head -n 1
    fi
}

show_header() {
    clear 2>/dev/null || true
    printf "%b\n" "${CYAN}============================================${NC}"
    printf "%b\n" "${CYAN} Kulin 轻量服务器探针面板${NC}"
    printf "%b\n" "${CYAN} 仓库: https://github.com/shuijiao1/Kulin${NC}"
    printf "%b\n" "${CYAN} 作者: shuijiao1${NC}"
    printf "%b\n" "${CYAN}============================================${NC}"
    if container_exists; then
        printf "安装状态: %b已安装%b\n" "$GREEN" "$NC"
    else
        printf "安装状态: %b未安装%b\n" "$RED" "$NC"
    fi
    if container_running; then
        printf "运行状态: %b运行中%b\n" "$GREEN" "$NC"
    else
        printf "运行状态: %b未运行%b\n" "$RED" "$NC"
    fi
    port="$(current_port || true)"
    [ -n "${port:-}" ] && printf "访问地址: http://服务器IP:%s/\n" "$port"
    printf "\n"
}

write_compose() {
    port="$1"
    mkdir -p "$DATA_DIR"

    if [ -f "$COMPOSE_FILE" ]; then
        backup="$COMPOSE_FILE.bak.$(date +%Y%m%d-%H%M%S)"
        cp -a "$COMPOSE_FILE" "$backup"
        warn "已备份旧配置: $backup"
    fi

    cat > "$COMPOSE_FILE" <<EOF
services:
  kulin:
    image: $IMAGE
    container_name: $APP_NAME
    restart: unless-stopped
    ports:
      - "$port:8008"
    volumes:
      - ./data:/dashboard/data
    environment:
      - TZ=Asia/Shanghai
EOF
}

install_panel() {
    need_root
    install_docker
    compose="$(compose_cmd)"
    if [ -z "$compose" ]; then
        error "Docker Compose 不可用，请确认 Docker 已正确安装"
        exit 1
    fi

    old_port="$(current_port || true)"
    printf "请输入面板端口 [%s]: " "${old_port:-$DEFAULT_PORT}"
    read -r port
    port="${port:-${old_port:-$DEFAULT_PORT}}"

    case "$port" in
        ''|*[!0-9]*) error "端口必须是数字"; exit 1 ;;
    esac

    write_compose "$port"
    cd "$INSTALL_DIR"
    $compose pull
    $compose up -d

    info "Kulin 安装完成"
    info "前台: http://服务器IP:$port/"
    info "后台: http://服务器IP:$port/dashboard/"
    warn "初始账号/密码: admin / admin，首次登录后请立即修改密码"
}

update_panel() {
    need_root
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "未找到 $COMPOSE_FILE，请先安装"
        exit 1
    fi
    install_docker
    compose="$(compose_cmd)"
    cd "$INSTALL_DIR"
    $compose pull
    $compose up -d
    info "Kulin 更新完成"
}

restart_panel() {
    need_root
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "未找到 $COMPOSE_FILE，请先安装"
        exit 1
    fi
    compose="$(compose_cmd)"
    cd "$INSTALL_DIR"
    $compose restart
    info "Kulin 已重启"
}

show_logs() {
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "未找到 $COMPOSE_FILE，请先安装"
        exit 1
    fi
    compose="$(compose_cmd)"
    cd "$INSTALL_DIR"
    $compose logs -f --tail=100
}

uninstall_panel() {
    need_root
    if [ ! -f "$COMPOSE_FILE" ]; then
        error "未找到 $COMPOSE_FILE，无需卸载"
        exit 1
    fi
    warn "这会停止并删除 Kulin 容器，但保留数据目录: $DATA_DIR"
    printf "确认卸载? [y/N]: "
    read -r confirm
    case "$confirm" in
        y|Y)
            compose="$(compose_cmd)"
            cd "$INSTALL_DIR"
            $compose down
            info "已卸载容器，数据仍保留在 $DATA_DIR"
            ;;
        *)
            info "已取消卸载"
            ;;
    esac
}

show_status() {
    show_header
    if command -v docker >/dev/null 2>&1 && container_exists; then
        docker ps -a --filter "name=^/${APP_NAME}$" --format '容器: {{.Names}}  状态: {{.Status}}  镜像: {{.Image}}'
    fi
}

show_menu() {
    show_header
    printf "%b\n" "${BLUE}=== 基础功能 ===${NC}"
    echo "1. 安装 Kulin"
    echo "2. 更新 Kulin"
    echo "3. 查看状态"
    printf "%b\n" "${BLUE}=== 服务管理 ===${NC}"
    echo "4. 重启服务"
    echo "5. 查看日志"
    echo "6. 卸载 Kulin"
    printf "%b\n" "${BLUE}=== 系统功能 ===${NC}"
    echo "0. 退出"
    printf "\n请选择操作 [0-6]: "
}

case "${1:-}" in
    install) install_panel ;;
    update) update_panel ;;
    restart) restart_panel ;;
    logs) show_logs ;;
    uninstall) uninstall_panel ;;
    status) show_status ;;
    "")
        while true; do
            show_menu
            read -r choice
            case "$choice" in
                1) install_panel; break ;;
                2) update_panel; break ;;
                3) show_status; printf "\n按回车返回菜单..."; read -r _ ;;
                4) restart_panel; break ;;
                5) show_logs; break ;;
                6) uninstall_panel; break ;;
                0) exit 0 ;;
                *) warn "无效选择"; sleep 1 ;;
            esac
        done
        ;;
    *)
        echo "用法: $0 [install|update|restart|logs|uninstall|status]"
        exit 1
        ;;
esac
