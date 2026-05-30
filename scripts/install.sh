#!/usr/bin/env bash
set -Eeuo pipefail

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

INSTALL_DIR="${INSTALL_DIR:-/opt/kulin}"
KULIN_PORT="${KULIN_PORT:-8008}"
KULIN_IMAGE="${KULIN_IMAGE:-ghcr.io/shuijiao1/kulin-dashboard:latest}"
KULIN_SITE_NAME="${KULIN_SITE_NAME:-哪吒探针}"
KULIN_LANGUAGE="${KULIN_LANGUAGE:-zh_CN}"
KULIN_LOCATION="${KULIN_LOCATION:-Asia/Shanghai}"
KULIN_INSTALL_HOST="${KULIN_INSTALL_HOST:-}"
KULIN_AGENT_SECRET="${KULIN_AGENT_SECRET:-}"

log() { echo -e "${GREEN}$*${NC}"; }
warn() { echo -e "${YELLOW}$*${NC}"; }
err() { echo -e "${RED}$*${NC}"; }
info() { echo -e "${BLUE}$*${NC}"; }

banner() {
  echo -e "${CYAN}============================================${NC}"
  echo -e "${CYAN} Kulin 一键安装脚本${NC}"
  echo -e "${CYAN} GitHub: https://github.com/shuijiao1/Kulin${NC}"
  echo -e "${CYAN}============================================${NC}"
  echo
}

need_root() {
  if [[ "${EUID}" -ne 0 ]]; then
    err "请使用 root 用户运行，或使用 sudo。"
    exit 1
  fi
}

command_exists() {
  command -v "$1" >/dev/null 2>&1
}

install_docker() {
  if command_exists docker && docker compose version >/dev/null 2>&1; then
    log "Docker / Docker Compose 已安装"
    return
  fi

  warn "未检测到可用的 Docker Compose，开始安装 Docker..."

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
    err "无法自动安装 Docker：不支持当前系统包管理器。请先手动安装 Docker 和 Docker Compose。"
    exit 1
  fi

  systemctl enable --now docker >/dev/null 2>&1 || service docker start >/dev/null 2>&1 || true

  if ! command_exists docker || ! docker compose version >/dev/null 2>&1; then
    err "Docker Compose 安装失败，请手动检查 Docker。"
    exit 1
  fi

  log "Docker / Docker Compose 安装完成"
}

random_secret() {
  if command_exists openssl; then
    openssl rand -hex 16
  else
    tr -dc 'A-Za-z0-9' </dev/urandom | head -c 32
  fi
}

resolve_install_host() {
  if [[ -n "${KULIN_INSTALL_HOST}" ]]; then
    echo "${KULIN_INSTALL_HOST}"
    return
  fi

  local public_ip=""
  public_ip=$(curl -fsSL --max-time 5 https://api.ipify.org 2>/dev/null || true)
  if [[ -n "${public_ip}" ]]; then
    echo "${public_ip}:${KULIN_PORT}"
  else
    echo "example.com:${KULIN_PORT}"
  fi
}

write_compose() {
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
    warn "检测到已有配置：${config}，将保留不覆盖"
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

install_kulin() {
  mkdir -p "${INSTALL_DIR}"
  write_compose
  write_config_if_missing

  cd "${INSTALL_DIR}"
  docker compose pull
  docker compose up -d
}

show_result() {
  local install_host
  install_host=$(grep -E '^install_host:' "${INSTALL_DIR}/data/config.yaml" | sed 's/^install_host:[[:space:]]*//' || true)

  echo
  echo -e "${CYAN}============================================${NC}"
  log "Kulin 安装完成"
  echo -e "安装目录：${INSTALL_DIR}"
  echo -e "访问地址：http://${install_host:-127.0.0.1:${KULIN_PORT}}"
  echo -e "默认账号：admin"
  echo -e "默认密码：admin"
  warn "上线后请立刻修改默认密码，并按需配置反向代理 / HTTPS。"
  echo -e "${CYAN}============================================${NC}"
}

main() {
  banner
  need_root
  install_docker
  install_kulin
  show_result
}

main "$@"
