/**
 * Preferences window, opened from the GNOME Extensions app.
 * Every widget is bound to a GSettings key, so changes are saved immediately.
 */

import Adw from 'gi://Adw';
import Gdk from 'gi://Gdk';
import Gio from 'gi://Gio';
import Gtk from 'gi://Gtk';
import {ExtensionPreferences} from 'resource:///org/gnome/Shell/Extensions/js/extensions/prefs.js';
import {parseTargetDate} from './dateutil.js';

const DEFAULT_COLOR = '#ffffff';

/**
 * Convert a Gdk.RGBA color (channels from 0.0 to 1.0) to "#rrggbb".
 */
function rgbaToHex(rgba) {
    const channel = v => Math.round(v * 255).toString(16).padStart(2, '0');
    return '#' + [rgba.red, rgba.green, rgba.blue].map(channel).join('');
}

/**
 * Convert a "#rrggbb" string to a Gdk.RGBA. Falls back to white if the
 * string is not a valid color.
 */
function hexToRgba(hex) {
    const rgba = new Gdk.RGBA();
    if (!rgba.parse(hex))
        rgba.parse(DEFAULT_COLOR);
    return rgba;
}

export default class CountdownOverlayPrefs extends ExtensionPreferences {

    /**
     * Build the preferences page. GNOME calls this when the window opens.
     */
    fillPreferencesWindow(window) {
        const settings = this.getSettings();

        const page = new Adw.PreferencesPage();
        window.add(page);

        // --- Content group: title, date and finished text ---
        const content = new Adw.PreferencesGroup({title: 'Content'});
        page.add(content);

        // Simple text keys: bind the widget text directly to the setting.
        const titleRow = new Adw.EntryRow({title: 'Title'});
        settings.bind('title', titleRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        content.add(titleRow);

        // The date needs validation, so it is not bound directly.
        // Instead, we check the input on every change and only save valid values.
        const dateRow = new Adw.EntryRow({title: 'Target date (YYYY-MM-DD HH:MM)'});
        dateRow.set_text(settings.get_string('target-date'));
        const validateDate = () => {
            const {error} = parseTargetDate(dateRow.get_text());
            if (error) {
                // Show the problem: red row and error message as group description.
                dateRow.add_css_class('error');
                content.set_description(error);
            } else {
                // Valid: clear the error and save the trimmed value.
                dateRow.remove_css_class('error');
                content.set_description('');
                settings.set_string('target-date', dateRow.get_text().trim());
            }
        };
        dateRow.connect('changed', validateDate);
        validateDate(); // check the initial value too
        content.add(dateRow);

        const finishedRow = new Adw.EntryRow({title: 'Text shown when the deadline has passed'});
        settings.bind('finished-text', finishedRow, 'text', Gio.SettingsBindFlags.DEFAULT);
        content.add(finishedRow);

        // --- Appearance group: color and font sizes ---
        const display = new Adw.PreferencesGroup({title: 'Appearance'});
        page.add(display);

        // Graphical color pickers, one per color setting.
        display.add(this._colorRow(settings, 'Title color', 'title-color'));
        display.add(this._colorRow(settings, 'Countdown color', 'countdown-color'));

        display.add(this._spinRow(settings, 'Title font size (px)', 'title-font-size', 8, 200));
        display.add(this._spinRow(settings, 'Countdown font size (px)', 'countdown-font-size', 12, 300));

        // --- Position group: offset from the top-left corner of the primary monitor ---
        const position = new Adw.PreferencesGroup({title: 'Position'});
        page.add(position);
        position.add(this._spinRow(settings, 'X position (px from the left)', 'position-x', 0, 10000));
        position.add(this._spinRow(settings, 'Y position (px from the top)', 'position-y', 0, 10000));

        // --- Background group: background behind the overlay ---
        const background = new Adw.PreferencesGroup({title: 'Background'});
        page.add(background);

        const backgroundEnabledRow = new Adw.SwitchRow({title: 'Show background'});
        settings.bind('background-enabled', backgroundEnabledRow, 'active', Gio.SettingsBindFlags.DEFAULT);
        background.add(backgroundEnabledRow);

        background.add(this._colorRow(settings, 'Background color', 'background-color'));
        background.add(this._spinRow(settings, 'Background opacity (%)', 'background-opacity', 0, 100));
        background.add(this._spinRow(settings, 'Background padding (px)', 'background-padding', 0, 50));
        background.add(this._spinRow(settings, 'Background corner radius (px)', 'background-corner-radius', 0, 32));
    }

    /**
     * Create a row with a graphical color picker bound to a "#rrggbb" key.
     */
    _colorRow(settings, title, key) {
        const row = new Adw.ActionRow({title});
        const button = new Gtk.ColorDialogButton({
            dialog: new Gtk.ColorDialog({with_alpha: false}),
            rgba: hexToRgba(settings.get_string(key)),
            valign: Gtk.Align.CENTER,
        });
        // Save the picked color as "#rrggbb" each time it changes.
        button.connect('notify::rgba', () => {
            settings.set_string(key, rgbaToHex(button.get_rgba()));
        });
        row.add_suffix(button);
        row.set_activatable_widget(button); // clicking the row opens the picker
        return row;
    }

    /**
     * Create a numeric row bound to an integer GSettings key.
     * Adw.SpinRow works with doubles, so the value is rounded when saved.
     */
    _spinRow(settings, title, key, min, max) {
        const row = new Adw.SpinRow({
            title,
            adjustment: new Gtk.Adjustment({
                lower: min,
                upper: max,
                step_increment: 1,
                page_increment: 10,
            }),
        });
        row.set_value(settings.get_int(key));
        row.connect('notify::value', () => {
            settings.set_int(key, Math.round(row.get_value()));
        });
        return row;
    }
}
