#!/usr/bin/env bash
set -e

UUID="countdown-overlay@paulo89.dev"
EXT_DIR="${HOME}/.local/share/gnome-shell/extensions/${UUID}"

echo "Installing ${UUID} to ${EXT_DIR}"

mkdir -p "${EXT_DIR}"
cp -r ./* "${EXT_DIR}/"

echo "Compiling schemas..."
glib-compile-schemas "${EXT_DIR}/schemas/"

echo "Done."
echo "On Wayland, log out and back in. On X11, press Alt+F2, type 'r', and press Enter."
echo "And to enable the extension, run:"
echo "  gnome-extensions enable ${UUID}"
echo "  or use a Gnome Extension manager"
