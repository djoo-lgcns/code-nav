#!/usr/bin/env bash
# ==============================================================================
# CodeNav 1-Liner Installer for Linux & macOS
# Repository: https://github.com/djoo-lgcns/code-nav
# Usage:
#   curl -fsSL https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.sh | bash
#   curl -fsSL https://raw.githubusercontent.com/djoo-lgcns/code-nav/main/install.sh | zsh
# ==============================================================================

set -e

REPO="djoo-lgcns/code-nav"
INSTALL_DIR="${HOME}/.local/bin"
BINARY_NAME="code-nav"
TARGET="${INSTALL_DIR}/${BINARY_NAME}"

# 1. Detect OS & Architecture
OS="$(uname -s | tr '[:upper:]' '[:lower:]')"
ARCH="$(uname -m)"

case "$ARCH" in
  x86_64|amd64) ARCH="x64" ;;
  aarch64|arm64) ARCH="arm64" ;;
  *)
    echo "❌ Unsupported architecture: $ARCH"
    exit 1
    ;;
esac

case "$OS" in
  linux|darwin) ;;
  *)
    echo "❌ Unsupported OS: $OS (Only Linux and macOS are supported)"
    exit 1
    ;;
esac

echo "🚀 Installing CodeNav for ${OS}-${ARCH}..."

# 2. Ensure installation directory exists
mkdir -p "$INSTALL_DIR"

# 3. Download or install code-nav binary
RELEASE_URL="https://github.com/${REPO}/releases/latest/download/code-nav-${OS}-${ARCH}"

if command -v curl >/dev/null 2>&1; then
  HTTP_CODE=$(curl -sL -w "%{http_code}" -o "$TARGET" "$RELEASE_URL" || true)
elif command -v wget >/dev/null 2>&1; then
  wget -qO "$TARGET" "$RELEASE_URL" || true
  HTTP_CODE="200"
else
  echo "❌ Neither curl nor wget was found. Please install one of them."
  exit 1
fi

# Fallback for local build/testing environment if remote asset is not published yet
if [ "$HTTP_CODE" != "200" ] || [ ! -s "$TARGET" ]; then
  if [ -f "./dist/code-nav" ]; then
    echo "⚠️ Remote release not found, using local build ./dist/code-nav..."
    cp "./dist/code-nav" "$TARGET"
  elif command -v bun >/dev/null 2>&1 && [ -f "./scripts/code-nav.ts" ]; then
    echo "⚠️ Building from local source..."
    bun build --compile ./scripts/code-nav.ts --outfile "$TARGET"
  fi
fi

if [ ! -s "$TARGET" ]; then
  echo "❌ Failed to download code-nav binary. Please check repository releases: https://github.com/${REPO}/releases"
  exit 1
fi

chmod +x "$TARGET"

# 4. Check ast-grep dependency
if ! command -v ast-grep >/dev/null 2>&1; then
  echo "📦 ast-grep not found. Installing standalone ast-grep binary..."
  SG_URL="https://github.com/ast-grep/ast-grep/releases/latest/download/ast-grep-${OS}-${ARCH}.tar.gz"
  if curl -sL "$SG_URL" | tar -xz -C "$INSTALL_DIR" 2>/dev/null; then
    echo "✅ ast-grep installed to ${INSTALL_DIR}/ast-grep"
  else
    echo "⚠️ Could not auto-install ast-grep. Please install ast-grep manually: npm install -g @ast-grep/cli"
  fi
fi

# 5. PATH Verification
if [[ ":$PATH:" != *":$INSTALL_DIR:"* ]]; then
  SHELL_NAME="$(basename "$SHELL")"
  RC_FILE=""
  case "$SHELL_NAME" in
    zsh)  RC_FILE="$HOME/.zshrc" ;;
    bash) RC_FILE="$HOME/.bashrc" ;;
    *)    RC_FILE="$HOME/.profile" ;;
  esac

  echo ""
  echo "⚠️ ${INSTALL_DIR} is not in your PATH."
  echo "   Add the following line to your ${RC_FILE}:"
  echo "   export PATH=\"${INSTALL_DIR}:\$PATH\""
  echo ""
fi

echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 CodeNav installed successfully!"
echo "   Binary location: ${TARGET}"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "👉 Quick Start (CLI):"
echo "   code-nav def <Symbol> [path]   # Find definition"
echo "   code-nav outline <filePath>    # Outline file symbols"
echo ""
echo "👉 Quick Start (MCP in AI Agents):"
echo "   Claude Code:   claude mcp add code-nav -- ${TARGET} --mcp"
echo "   Kiro CLI:      kiro-cli mcp add code-nav -- ${TARGET} --mcp"
echo "   Antigravity:   Add { \"code-nav\": { \"command\": \"${TARGET}\", \"args\": [\"--mcp\"] } } to mcp_config.json"
echo ""
