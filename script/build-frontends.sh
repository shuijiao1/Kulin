#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(realpath "$(dirname "${BASH_SOURCE[0]}")/..")"

build_admin() {
  echo "==> Building admin frontend"
  pushd "$ROOT_DIR/web/admin" >/dev/null
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile=false
    pnpm run build
  elif command -v npm >/dev/null 2>&1; then
    npm ci
    npm run build
  else
    echo "pnpm or npm is required" >&2
    exit 1
  fi
  rm -rf "$ROOT_DIR/cmd/dashboard/admin-dist"
  cp -a dist "$ROOT_DIR/cmd/dashboard/admin-dist"
  popd >/dev/null
}

build_dash() {
  echo "==> Building public dashboard frontend"
  pushd "$ROOT_DIR/web/dash" >/dev/null
  if command -v pnpm >/dev/null 2>&1; then
    pnpm install --frozen-lockfile
    pnpm run build
  else
    echo "pnpm is required" >&2
    exit 1
  fi
  rm -rf "$ROOT_DIR/cmd/dashboard/user-dist"
  cp -a dist "$ROOT_DIR/cmd/dashboard/user-dist"
  popd >/dev/null
}

build_admin
build_dash
