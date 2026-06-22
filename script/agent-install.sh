#!/bin/sh
set -eu

REPO="shuijiao1/Kulin-Agent"
VERSION="${KULIN_AGENT_VERSION:-latest}"
INSTALL_DIR="${KULIN_AGENT_INSTALL_DIR:-/opt/kulin-agent}"
CONFIG_FILE="${KULIN_AGENT_CONFIG:-$INSTALL_DIR/config.yml}"
BIN="$INSTALL_DIR/kulin-agent"

fail() {
  echo "错误: $*" >&2
  exit 1
}

need() {
  command -v "$1" >/dev/null 2>&1 || fail "未找到 $1，请先安装后重试"
}

[ -n "${NZ_SERVER:-}" ] || fail "必须设置 NZ_SERVER"
[ -n "${NZ_CLIENT_SECRET:-}" ] || fail "必须设置 NZ_CLIENT_SECRET"

need uname
need mktemp
need sed
need tar

OS=$(uname -s | tr '[:upper:]' '[:lower:]')
ARCH=$(uname -m)
case "$OS" in
  linux) GOOS=linux ;;
  darwin) GOOS=darwin ;;
  *) fail "暂不支持系统: $OS" ;;
esac
case "$ARCH" in
  x86_64|amd64) GOARCH=amd64 ;;
  aarch64|arm64) GOARCH=arm64 ;;
  armv7l|armv6l) GOARCH=arm ;;
  i386|i686) GOARCH=386 ;;
  s390x) GOARCH=s390x ;;
  riscv64) GOARCH=riscv64 ;;
  loongarch64) GOARCH=loong64 ;;
  mips) GOARCH=mips ;;
  mipsel|mipsle) GOARCH=mipsle ;;
  *) fail "暂不支持架构: $ARCH" ;;
esac

if command -v curl >/dev/null 2>&1; then
  DL='curl -fsSL'
elif command -v wget >/dev/null 2>&1; then
  DL='wget -qO-'
else
  fail "未找到 curl 或 wget"
fi

if command -v unzip >/dev/null 2>&1; then
  UNZIP='unzip -oq'
else
  fail "未找到 unzip，请先安装 unzip"
fi

if [ "$VERSION" = "latest" ]; then
  API_URL="https://api.github.com/repos/$REPO/releases/latest"
  VERSION=$($DL "$API_URL" | sed -n 's/.*"tag_name"[[:space:]]*:[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
  [ -n "$VERSION" ] || fail "无法获取最新版本"
fi

ASSET="kulin-agent_${GOOS}_${GOARCH}.zip"
URL="https://github.com/$REPO/releases/download/$VERSION/$ASSET"
TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

echo "下载 Kulin Agent $VERSION ($GOOS/$GOARCH)..."
if command -v curl >/dev/null 2>&1; then
  curl -fL "$URL" -o "$TMP/$ASSET"
else
  wget -O "$TMP/$ASSET" "$URL"
fi

mkdir -p "$INSTALL_DIR"
$UNZIP "$TMP/$ASSET" -d "$TMP/extract"
FOUND=$(find "$TMP/extract" -type f -name 'kulin-agent' -o -name 'kulin-agent.exe' | head -n1)
[ -n "$FOUND" ] || fail "压缩包内未找到 kulin-agent"
install -m 0755 "$FOUND" "$BIN"

TLS_VALUE="${NZ_TLS:-true}"
UUID_VALUE="${NZ_UUID:-}"
cat > "$CONFIG_FILE" <<EOF_CFG
server: "$NZ_SERVER"
client_secret: "$NZ_CLIENT_SECRET"
tls: $TLS_VALUE
uuid: "$UUID_VALUE"
disable_auto_update: true
EOF_CFG
chmod 600 "$CONFIG_FILE"

"$BIN" service install -c "$CONFIG_FILE" || true
"$BIN" service restart -c "$CONFIG_FILE" || "$BIN" service start -c "$CONFIG_FILE"

echo "Kulin Agent 已安装并启动"
