#!/usr/bin/env bash
set -e

echo "========================================================"
echo "        Building Mouseflare for macOS (Universal)      "
echo "========================================================"
echo ""

# Check for swift compiler
if ! command -v swift &> /dev/null; then
    echo "[Error] Swift compiler not found."
    echo "Please install Xcode Command Line Tools by running: xcode-select --install"
    exit 1
fi

echo "Compiling release binary with Swift Package Manager..."
swift build -c release

BINARY_PATH="$(swift build -c release --show-bin-path)/Mouseflare"

if [ -f "$BINARY_PATH" ]; then
    echo "Applying ad-hoc code signature for local execution..."
    codesign --force --deep --sign - "$BINARY_PATH" 2>/dev/null || true

    echo ""
    echo "========================================================"
    echo "  BUILD SUCCESSFUL!"
    echo "  Binary: $BINARY_PATH"
    echo "========================================================"
    echo ""
    echo "Launching Mouseflare now..."
    echo "(Look for the ✨ icon in your macOS Menu Bar at the top right)"
    echo "Press Ctrl+C to stop, or choose 'Quit Mouseflare' from the menu bar."
    echo ""
    exec "$BINARY_PATH"
else
    echo "[Error] Build failed. Binary not found."
    exit 1
fi
