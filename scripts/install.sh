#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
PLAIN='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/kulin}"
KULIN_PORT="${KULIN_PORT:-8008}"
KULIN_IMAGE="${KULIN_IMAGE:-ghcr.io/shuijiao1/kulin-dashboard:latest}"
KULIN_SITE_NAME="${KULIN_SITE_NAME:-哪吒探针}"
KULIN_LANGUAGE="${KULIN_LANGUAGE:-zh_CN}"
KULIN_LOCATION="${KULIN_LOCATION:-Asia/Shanghai}"
KULIN_INSTALL_HOST="${KULIN_INSTALL_HOST:-}"
KULIN_DOMAIN="${KULIN_DOMAIN:-}"
KULIN_AGENT_SECRET="${KULIN_AGENT_SECRET:-}"

log() { echo -e "${GREEN}$*${PLAIN}"; }
warn() { echo -e "${YELLOW}$*${PLAIN}"; }
err() { echo -e "${RED}$*${PLAIN}"; }
info() { echo -e "${BLUE}$*${PLAIN}"; }

banner() {
  echo -e "${CYAN}============================================${PLAIN}"
  echo -e "${CYAN} Kulin 管理脚本${PLAIN}"
  echo -e "${CYAN} GitHub: https://github.com/shuijiao1/Kulin${PLAIN}"
  echo -e "${CYAN}============================================${PLAIN}"
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "请使用 root 用户运行，或使用 sudo。"
    exit 1
  fi
}

command_exists() { command -v "$1" >/dev/null 2>&1; }

ask() {
  local prompt="$1" default="${2:-}" answer=""
  if [[ -n "${default}" ]]; then
    read -r -p "${prompt} [${default}]: " answer || true
    echo "${answer:-$default}"
  else
    read -r -p "${prompt}: " answer || true
    echo "${answer}"
  fi
}

random_secret() {
  if command_exists openssl; then
    openssl rand -hex 16
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

get_public_ip() {
  curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || true
}

install_docker() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    log "Docker / Docker Compose 已安装"
    return
  fi

  warn "未检测到 Docker Compose，开始安装 Docker..."

  if command_exists apt-get; then
    apt-get update
    apt-get install -y ca-certificates curl gnupg lsb-release
    install -m 0755 -d /etc/apt/keyrings
    # shellcheck source=/dev/null
    . /etc/os-release
    curl -fsSL "https://download.docker.com/linux/${ID}/gpg" | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    chmod a+r /etc/apt/keyrings/docker.gpg
    echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/${ID} ${VERSION_CODENAME} stable" > /etc/apt/sources.list.d/docker.list
    apt-get update
    apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif command_exists dnf; then
    dnf install -y dnf-plugins-core curl
    dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    dnf install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif command_exists yum; then
    yum install -y yum-utils curl
    yum-config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
    yum install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  elif command_exists apk; then
    apk add --no-cache docker docker-cli-compose curl openssl
  else
    err "暂不支持当前系统自动安装 Docker，请先手动安装 Docker 和 Docker Compose。"
    exit 1
  fi

  systemctl enable --now docker >/dev/null 2>&1 || service docker start >/dev/null 2>&1 || true

  if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose 安装失败，请手动检查。"
    exit 1
  fi

  log "Docker / Docker Compose 安装完成"
}

resolve_install_host() {
  if [[ -n "${KULIN_INSTALL_HOST}" ]]; then
    echo "${KULIN_INSTALL_HOST}"
  elif [[ -n "${KULIN_DOMAIN}" ]]; then
    echo "${KULIN_DOMAIN}"
  else
    local ip
    ip=$(get_public_ip)
    [[ -n "${ip}" ]] && echo "${ip}:${KULIN_PORT}" || echo "example.com:${KULIN_PORT}"
  fi
}

collect_install_options() {
  if [[ -t 0 ]]; then
    INSTALL_DIR=$(ask "请输入安装目录" "${INSTALL_DIR}")
    KULIN_PORT=$(ask "请输入面板监听端口" "${KULIN_PORT}")
    local default_host="${KULIN_DOMAIN:-${KULIN_INSTALL_HOST:-}}"
    KULIN_DOMAIN=$(ask "请输入反代域名或 Agent 连接地址（留空则自动使用公网 IP:${KULIN_PORT}）" "${default_host}")
  fi
}

write_compose() {
  mkdir -p "${INSTALL_DIR}"
  cat > "${INSTALL_DIR}/docker-compose.yml" <<YAML
name: kulin-dashboard

services:
  dashboard:
    image: ${KULIN_IMAGE}
    container_name: kulin-dashboard
    restart: unless-stopped
    ports:
      - "${KULIN_PORT}:8008"
    volumes:
      - ./data:/dashboard/data
YAML
}

write_config_if_missing() {
  mkdir -p "${INSTALL_DIR}/data"
  local config="${INSTALL_DIR}/data/config.yaml"

  if [[ -f "${config}" ]]; then
    warn "检测到已有配置：${config}，已保留不覆盖。"
    return
  fi

  local install_host agent_secret
  install_host=$(resolve_install_host)
  agent_secret="${KULIN_AGENT_SECRET:-$(random_secret)}"

  cat > "${config}" <<YAML
site_name: ${KULIN_SITE_NAME}
language: ${KULIN_LANGUAGE}
install_host: ${install_host}
force_auth: false
listen_host: 0.0.0.0
listen_port: 8008
jwt_timeout: 168
agent_secret_key: ${agent_secret}
location: ${KULIN_LOCATION}
user_template: user-dist
admin_template: admin-dist
logo_url: ""
background_url: ""
mobile_background_url: ""
tsdb:
  data_path: data/tsdb
  retention_days: 7
YAML
  chmod 600 "${config}"
  log "已生成配置：${config}"
}

install_dashboard() {
  need_root
  banner
  collect_install_options
  install_docker
  write_compose
  write_config_if_missing

  cd "${INSTALL_DIR}"
  docker compose pull
  docker compose up -d

  show_info
}

modify_config() {
  need_root
  local config="${INSTALL_DIR}/data/config.yaml"
  if [[ ! -f "${config}" ]]; then
    err "未找到配置文件：${config}"
    exit 1
  fi

  local current_host current_name
  current_host=$(grep -E '^install_host:' "${config}" | sed 's/^install_host:[[:space:]]*//' || true)
  current_name=$(grep -E '^site_name:' "${config}" | sed 's/^site_name:[[:space:]]*//' || true)

  local new_host new_name
  new_host=$(ask "请输入反代域名或 Agent 连接地址" "${current_host}")
  new_name=$(ask "请输入站点名称" "${current_name:-哪吒探针}")

  cp "${config}" "${config}.bak.$(date +%Y%m%d%H%M%S)"
  sed -i "s|^install_host:.*|install_host: ${new_host}|" "${config}"
  sed -i "s|^site_name:.*|site_name: ${new_name}|" "${config}"

  restart_dashboard
  log "配置已更新。"
}

restart_dashboard() {
  need_root
  cd "${INSTALL_DIR}"
  docker compose pull
  docker compose up -d
}

show_log() {
  need_root
  cd "${INSTALL_DIR}"
  docker compose logs -f
}

uninstall_dashboard() {
  need_root
  warn "即将卸载 Kulin。默认会保留 ${INSTALL_DIR}/data 数据目录。"
  local confirm
  confirm=$(ask "确认卸载？输入 y 继续" "n")
  [[ "${confirm}" == "y" || "${confirm}" == "Y" ]] || exit 0

  if [[ -f "${INSTALL_DIR}/docker-compose.yml" ]]; then
    cd "${INSTALL_DIR}"
    docker compose down || true
  fi
  rm -f "${INSTALL_DIR}/docker-compose.yml"
  log "已卸载容器，数据保留在：${INSTALL_DIR}/data"
}

show_info() {
  local config="${INSTALL_DIR}/data/config.yaml"
  local install_host=""
  [[ -f "${config}" ]] && install_host=$(grep -E '^install_host:' "${config}" | sed 's/^install_host:[[:space:]]*//' || true)

  echo
  echo -e "${CYAN}============================================${PLAIN}"
  log "Kulin 当前信息"
  echo "安装目录：${INSTALL_DIR}"
  echo "面板端口：http://127.0.0.1:${KULIN_PORT}"
  if [[ -n "${install_host}" ]]; then
    echo "Agent 连接地址 / 反代域名：${install_host}"
    if [[ "${install_host}" != *":"* ]]; then
      echo "访问地址：https://${install_host}"
      warn "请自行把域名反代到 127.0.0.1:${KULIN_PORT}。"
    else
      echo "访问地址：http://${install_host}"
    fi
  fi
  echo "默认账号：admin"
  echo "默认密码：admin"
  warn "首次登录后请立刻修改默认密码。"
  echo -e "${CYAN}============================================${PLAIN}"
}

show_menu() {
  banner
  echo -e "${GREEN}1.${PLAIN} 安装 / 更新面板"
  echo -e "${GREEN}2.${PLAIN} 修改面板配置"
  echo -e "${GREEN}3.${PLAIN} 重启并更新"
  echo -e "${GREEN}4.${PLAIN} 查看日志"
  echo -e "${GREEN}5.${PLAIN} 查看当前信息"
  echo -e "${GREEN}6.${PLAIN} 卸载面板"
  echo
  local num
  read -r -p "请选择 [1-6]: " num || true
  case "${num}" in
    1) install_dashboard ;;
    2) modify_config ;;
    3) restart_dashboard ;;
    4) show_log ;;
    5) show_info ;;
    6) uninstall_dashboard ;;
    *) warn "已取消。" ;;
  esac
}

case "${1:-}" in
  install) install_dashboard ;;
  modify_config|config) modify_config ;;
  restart|update|restart_and_update) restart_dashboard ;;
  log|show_log) show_log ;;
  info|status) show_info ;;
  uninstall) uninstall_dashboard ;;
  help|-h|--help)
    echo "用法: $0 [install|config|restart|log|info|uninstall]"
    ;;
  *) show_menu ;;
esac
