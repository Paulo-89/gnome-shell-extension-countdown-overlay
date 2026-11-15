#!/usr/bin/env bash

# Launch a nested GNOME Shell session to test the extension.
# Requirements: gnome-shell, dbus-run-session, mutter-devkit

set -euo pipefail

dbus-run-session gnome-shell --devkit --wayland
