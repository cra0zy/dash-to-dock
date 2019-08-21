// -*- mode: js; js-indent-level: 4; indent-tabs-mode: nil -*-

const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const Shell = imports.gi.Shell;
const Signals = imports.signals;

// Use __ () and N__() for the extension gettext domain, and reuse
// the shell domain with the default _() and N_()
const Gettext = imports.gettext.domain('dashtodock');
const __ = Gettext.gettext;
const N__ = function(e) { return e };

/**
 * This class maintains a Shell.App representing the Trash and keeps it
 * up-to-date as the trash fills and is emptied over time.
 */
var Trash = class DashToDock_Trash {

    constructor() {
        this._file = Gio.file_new_for_uri('trash://');
        try {
            this._monitor = this._file.monitor_directory(0, null);
            this._signalId = this._monitor.connect(
                'changed',
                this._onTrashChange.bind(this));
        } catch (e) {
            log(`Unable to monitor trash: ${e}`);
        }
        this._lastEmpty = true;
        this._empty = true;
        this._onTrashChange();
    }

    destroy() {
        if (this._monitor) {
            this._monitor.disconnect(this._signalId);
            this._monitor.run_dispose();
        }
        this._file.run_dispose();
    }

    _onTrashChange() {
        try {
            let children = this._file.enumerate_children('*', 0, null);
            this._empty = children.next_file(null) == null;
            children.close(null);
        } catch (e) {
            log(`Unable to enumerate trash children: ${e}`);
        }

        this._ensureApp();
    }

    _ensureApp() {
        if (this._trashApp == null ||
            this._lastEmpty != this._empty) {
            let trashKeys = new GLib.KeyFile();
            trashKeys.set_string('Desktop Entry', 'Name', __('Trash'));
            trashKeys.set_string('Desktop Entry', 'Icon',
                                 this._empty ? 'user-trash' : 'user-trash-full');
            trashKeys.set_string('Desktop Entry', 'Type', 'Application');
            trashKeys.set_string('Desktop Entry', 'Exec', 'gio open trash:///');
            trashKeys.set_string('Desktop Entry', 'StartupNotify', 'false');
            trashKeys.set_string('Desktop Entry', 'XdtdUri', 'trash:///');
            if (!this._empty) {
                trashKeys.set_string('Desktop Entry', 'Actions', 'empty-trash;');
                trashKeys.set_string('Desktop Action empty-trash', 'Name', __('Empty Trash'));
                trashKeys.set_string('Desktop Action empty-trash', 'Exec',
                                     'dbus-send --print-reply --dest=org.gnome.Nautilus /org/gnome/Nautilus org.gnome.Nautilus.FileOperations.EmptyTrash');
            }

            let trashAppInfo = Gio.DesktopAppInfo.new_from_keyfile(trashKeys);
            this._trashApp = new Shell.App({appInfo: trashAppInfo});
            this._lastEmpty = this._empty;

            this.emit('changed');
        }
    }

    getApp() {
        return this._trashApp;
    }
}
Signals.addSignalMethods(Trash.prototype);
