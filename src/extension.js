/**
 * Countdown Overlay
 *
 * Draws a title and a live countdown on the desktop wallpaper layer, so it is
 * hidden behind application windows. Settings are read from GSettings and
 * update the overlay as soon as they change.
 */

import GLib from 'gi://GLib';
import St from 'gi://St';
import Clutter from 'gi://Clutter';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import {Extension} from 'resource:///org/gnome/shell/extensions/extension.js';
import {parseTargetDate} from './dateutil.js';

/**
 * Format a duration in milliseconds as "N d HH:MM:SS".
 */
function formatRemaining(ms) {
    const total = Math.floor(ms / 1000);
    const days = Math.floor(total / 86400);
    const hours = Math.floor((total % 86400) / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = n => String(n).padStart(2, '0');
    return `${days}d ${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// Soft dark shadow so the text stays readable on light wallpapers.
const SHADOW = 'text-shadow: 0px 0px 6px rgba(0, 0, 0, 0.8);';

function hexToRgb(hex) {
    const match = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(hex.trim());
    if (!match)
        return {r: 0, g: 0, b: 0};

    let digits = match[1];
    if (digits.length === 3)
        digits = digits.replace(/./g, c => c + c);

    const value = parseInt(digits, 16);
    return {
        r: (value >> 16) & 255,
        g: (value >> 8) & 255,
        b: value & 255,
    };
}

export default class CountdownOverlayExtension extends Extension {

    /**
     * Called when the extension is turned on: build the actors, apply the
     * current settings and start the one-second refresh timer.
     */
    enable() {
        this._settings = this.getSettings();

        // Container holding the labels, stacked vertically.
        // reactive: false lets mouse clicks pass through to the desktop.
        this._container = new St.BoxLayout({orientation: Clutter.Orientation.VERTICAL});
        this._titleLabel = new St.Label({text: ''});
        this._countLabel = new St.Label({text: ''});

        // Both labels stay in the container; the title is hidden when empty
        // so the countdown stays centered.
        this._container.add_child(this._titleLabel);
        this._container.add_child(this._countLabel);

        // Add to the background group (below normal windows) so the overlay
        // is visible on the desktop but hidden by windows. This is a private
        // API: if it breaks on a future GNOME version, try
        // Main.layoutManager.uiGroup instead (which draws above windows).
        Main.layoutManager._backgroundGroup.add_child(this._container);

        this._refreshAll();

        // Re-apply everything whenever any setting changes.
        this._settingsId = this._settings.connect('changed', () => this._refreshAll());

        // Keep the overlay on the primary monitor when displays are
        // connected, disconnected or rearranged.
        this._monitorsId = Main.layoutManager.connect('monitors-changed', () => {
            this._applyPosition();
        });

        // Refresh the countdown every second.
        this._timeoutId = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 1, () => {
            this._updateCountdown();
            return GLib.SOURCE_CONTINUE; // keep the timer running
        });
    }

    /**
     * Called when the extension is turned off or uninstalled: release every
     * resource created in enable(), so nothing is left behind.
     */
    disable() {
        if (this._timeoutId) {
            GLib.Source.remove(this._timeoutId);
            this._timeoutId = null;
        }
        if (this._settingsId) {
            this._settings.disconnect(this._settingsId);
            this._settingsId = null;
        }
        if (this._monitorsId) {
            Main.layoutManager.disconnect(this._monitorsId);
            this._monitorsId = null;
        }

        // Destroying the container also destroys its child labels.
        this._container?.destroy();
        this._container = null;
        this._titleLabel = null;
        this._countLabel = null;
        this._settings = null;
    }

    /**
     * Re-apply every setting to the overlay. Called on enable and whenever a
     * setting changes.
     */
    _refreshAll() {
        this._applyStyle();
        this._applyBackground();
        this._applyPosition();
        this._updateTitle();
        this._updateCountdown();
    }

    /**
     * Apply color and font sizes from the settings to the labels.
     * St uses CSS-like style strings.
     */
    _applyStyle() {
        if (!this._settings)
            return;

        const titleColor = this._settings.get_string('title-color');
        const countdownColor = this._settings.get_string('countdown-color');
        const titleSize = this._settings.get_int('title-font-size');
        const countdownSize = this._settings.get_int('countdown-font-size');

        this._titleLabel?.set_style(
            `color: ${titleColor}; font-size: ${titleSize}px; font-weight: bold; ${SHADOW}`);
        this._countLabel?.set_style(
            `color: ${countdownColor}; font-size: ${countdownSize}px; font-weight: bold; ` +
            `font-family: monospace; ${SHADOW}`);
    }

    /**
     * Apply background style to the container. Keep padding and border-radius
     * constant to avoid moving the text when toggling the background.
     * When disabled, set alpha to 0 (fully transparent).
     */
    _applyBackground() {
        if (!this._container || !this._settings)
            return;

        const enabled = this._settings.get_boolean('background-enabled');
        const color = this._settings.get_string('background-color');
        const opacityPercent = this._settings.get_int('background-opacity');
        const padding = this._settings.get_int('background-padding');
        const radius = this._settings.get_int('background-corner-radius');

        const {r, g, b} = hexToRgb(color);
        const alpha = enabled ? Math.max(0, Math.min(100, opacityPercent)) / 100 : 0;

        this._container.set_style(
            `padding: ${padding}px; border-radius: ${radius}px; background-color: rgba(${r}, ${g}, ${b}, ${alpha});`);
    }

    /**
     * Place the overlay at the configured offset from the primary monitor's
     * top-left corner. Monitor coordinates are global, so they must be added.
     */
    _applyPosition() {
        const monitor = Main.layoutManager.primaryMonitor;
        if (!monitor)
            return;
        const x = this._settings.get_int('position-x');
        const y = this._settings.get_int('position-y');
        this._container.set_position(monitor.x + x, monitor.y + y);
    }

    /**
     * Refresh the title label. The label is hidden when the title is empty,
     * so the countdown stays centered.
     */
    _updateTitle() {
        if (!this._settings)
            return;

        const title = this._settings.get_string('title').trim();
        this._titleLabel?.set_text(title);
        if (this._titleLabel)
            this._titleLabel.visible = title.length > 0;
    }

    /**
     * Refresh the countdown text.
     */
    _updateCountdown() {
        if (!this._container || !this._settings)
            return;

        // The date is validated on every update, so a bad value stored
        // manually in GSettings shows a message instead of crashing.
        const {date, error} = parseTargetDate(this._settings.get_string('target-date'));
        if (error) {
            this._countLabel?.set_text('Invalid date');
            return;
        }

        const remaining = date.getTime() - Date.now();
        this._countLabel?.set_text(
            remaining > 0
                ? formatRemaining(remaining)
                : this._settings.get_string('finished-text'));
    }
}
