/*
 * Script To Panel extension for GNOME Shell.
 *
 * Put the output of any scripts on the top panel.
 * The first line from stdout is set to the panel label,
 * and stderr is set to the top-down menu label.
 *
 * Copyright (C) 2015 Anton Kozhemyachenko <gmerzu@gmail.com>
 * All rights reserved.
 *
 * This file is part of Script To Panel.
 *
 * Script To Panel is free software: you can redistribute it and/or modify
 * it under the terms of the GNU General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * Script To Panel is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU General Public License for more details.
 *
 * You should have received a copy of the GNU General Public License
 * along with Script To Panel.  If not, see <http://www.gnu.org/licenses/>.
 *
 */

const Gdk = imports.gi.Gdk;
const Gio = imports.gi.Gio;
const GLib = imports.gi.GLib;
const GnomeDesktop = imports.gi.GnomeDesktop;
const Lang = imports.lang;
const Mainloop = imports.mainloop;
const Shell = imports.gi.Shell;
const St = imports.gi.St;
const Clutter = imports.gi.Clutter;

const Main        = imports.ui.main;
const MessageTray = imports.ui.messageTray;
const PanelMenu   = imports.ui.panelMenu;
const PopupMenu   = imports.ui.popupMenu;
const Panel       = imports.ui.panel;

const Gettext = imports.gettext.domain('gnome-shell-extensions');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();

const SCHEMA_NAME = 'org.gnome.shell.extensions.ScriptToPanel';

function getSettings() {
	const GioSSS = Gio.SettingsSchemaSource;
	let schemaDir = Me.dir.get_child('schemas');
	let schemaSource;
	if (schemaDir.query_exists(null))
		schemaSource = GioSSS.new_from_directory(schemaDir.get_path(), GioSSS.get_default(), false);
	else
		schemaSource = GioSSS.get_default();
	let schemaObj = schemaSource.lookup(SCHEMA_NAME, true);
	if (!schemaObj)
		throw new Error('Schema ' + SCHEMA_NAME + ' could not be found for extension ' + Me.metadata.uuid + '. Please check your installation.');
	return new Gio.Settings({settings_schema: schemaObj});
}

const Future = new Lang.Class({
	Name: 'Future',

	_init: function(argv, callbackOut, callbackErr) {
		try {
			this._callbackOut = callbackOut;
			this._callbackErr = callbackErr;
			let [exit, pid, stdin, stdout, stderr] =
				GLib.spawn_async_with_pipes(null, /* cwd */
						argv, /* args */
						null, /* env */
						GLib.SpawnFlags.DO_NOT_REAP_CHILD | GLib.SpawnFlags.SEARCH_PATH,
						null /* child_setup */);
			this._stdout = new Gio.UnixInputStream({ fd: stdout, close_fd: true });
			this._stderr = new Gio.UnixInputStream({ fd: stderr, close_fd: true });
			this._dataStdout = new Gio.DataInputStream({ base_stream: this._stdout });
			this._dataStderr = new Gio.DataInputStream({ base_stream: this._stderr });
			new Gio.UnixOutputStream({ fd: stdin, close_fd: true }).close(null);

			this._childWatch = GLib.child_watch_add(GLib.PRIORITY_DEFAULT, pid, Lang.bind(this, function(pid, status, requestObj) {
				GLib.source_remove(this._childWatch);
				if (status != 0) {
					this._callbackOut('err');
					this._callbackErr('err');
				}
			}));

			this._readStdout();
			this._readStderr();
		} catch (e) {
			global.log(e.toString());
			throw e;
		}
	},

	_readStdout: function() {
		this._dataStdout.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {
			if (stream.fill_finish(result) == 0) {
				try {
					this._callbackOut(stream.peek_buffer().toString());
				} catch (e) {
					global.log(e.toString());
					throw e;
				}
				this._stdout.close(null);
				return;
			}

			stream.set_buffer_size(2 * stream.get_buffer_size());
			this._readStdout();
		}));
	},

	_readStderr: function() {
		this._dataStderr.fill_async(-1, GLib.PRIORITY_DEFAULT, null, Lang.bind(this, function(stream, result) {
			if (stream.fill_finish(result) == 0) {
				try {
					this._callbackErr(stream.peek_buffer().toString());
				} catch (e) {
					global.log(e.toString());
					throw e;
				}
				this._stderr.close(null);
				return;
			}

			stream.set_buffer_size(2 * stream.get_buffer_size());
			this._readStderr();
		}));
	}
});

const ScriptToPanel = new Lang.Class({
	Name: 'ScriptToPanel',
	Extends: PanelMenu.Button,

	_init: function(script) {
		this.parent(0.0, "ScriptToPanel");

		this.script = script;

		this._scriptOutput= new St.Label({
			style_class: 'script-output',
			y_align: Clutter.ActorAlign.CENTER,
			text: '\u2026'
		});

		this.actor.add_actor(this._scriptOutput);

		this._createMenu();

		this._runTimer();
	},

	_createMenu: function() {
		this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

		let item = new PopupMenu.PopupMenuItem('\u2026');
		item.label.add_style_class_name('scipt-output-full');
		item.actor.reactive = false;
		item.actor.can_focus = false;

		let icon = new St.Icon({ icon_name: 'view-refresh-symbolic', icon_size: 16 });
		let button = new St.Bin({ style_class: 'reload-button',
								reactive: true,
								can_focus: true,
								x_fill: true,
								y_fill: false,
								track_hover: true
		});
		let that = this;
		button.connect('button-press-event', function() {
			item.label.set_text('Reloading...');
			that._runScript();
		});
		button.set_child(icon);
		item.actor.add_actor(button);

		this.menu.addMenuItem(item);

		this._scriptOutputFull = item.label;
	},

	_setScriptOutput: function(text) {
		text = text.split('\n')[0].trim();
		if (text == '')
			text = '\u2026';
		this._scriptOutput.set_text(text);
	},

	_setScriptOutputFull: function(text) {
		text = text.trim();
		if (text == '')
			text = '\u2026';
		this._scriptOutputFull.set_text(text);
	},

	_runScript: function() {
		try {
			let that = this;
			delete new Future(this.script.cmd,
					Lang.bind(that, that._setScriptOutput),
					Lang.bind(that, that._setScriptOutputFull)
			);
		} catch (e) {
			global.log(e.toString());
			throw e;
		}
	},

	_runTimer: function() {
		let that = this;
		this._runScript();
		let timer_source = Mainloop.timeout_add(this.script.timeout, function() {
			if (_isRun)
				that._runScript();
			return _isRun;
		});
		_timerSources.push(timer_source);
	},

	_showNotification: function(subject, text) {
		let source = new MessageTray.Source("ScriptToPanel applet", 'utilities-scripttopanel');
		Main.messageTray.add(source);

		let notification = new MessageTray.Notification(source, subject, text);
		notification.setTransient(true);
		source.notify(notification);
	}
});

let _scripts = [];
let _ScriptsToPanel = [];
let _isRun = false;
let _timerSources = [];
let _settings = getSettings();

function init() {
	let keys = _settings.list_keys();
	if (keys.indexOf('count') > -1) {
		let count = _settings.get_int('count');
		for (var i = 1; i <= count; i++) {
			if (keys.indexOf('script-' + i) < 0)
				continue;
			let script = _settings.get_strv('script-' + i);
			let timeout = script[0];
			let cmd = script.slice(1);
			_scripts.push({ timeout: timeout, cmd: cmd });
		}
	}
	else {
		let scripts = Me.metadata['scripts'];
		if (scripts)
			_scripts = scripts;
	}
}

function enable() {
	_isRun = true;
	for (var i = 0; i < _scripts.length; i++) {
		let script = _scripts[i];
		let s = new ScriptToPanel(script);
		s.num = i;
		_ScriptsToPanel.push(s);
		Mainloop.timeout_add(1000, function() {
			try {
				Main.panel.addToStatusArea('scripttopanel-' + s.num, s, 2, 'center');
			} catch (e) {
				global.log(e.toString());
				throw e;
			}
		});
	}
}

function disable() {
	_isRun = false;
	for (var i = 0; i < _timerSources.length; i++)
		Mainloop.source_remove(_timerSources[i]);
	_timerSources = [];
	for (var i = 0; i < _ScriptsToPanel.length; i++) {
		let s = _ScriptsToPanel[i];
		s.destroy();
	}
}
