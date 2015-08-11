Script To Panel
===============
Script To Panel is a Gnome Shell extenstion to put the output of any scripts on the top panel.

The first line from stdout is set to the panel label, and stderr is set to the top-down menu label.

Manual installation
-------------------
Open the terminal in the directory where you have cloned the extension,

and just run

`./install.sh`

Configuration
-------------
Use dconf or similar to configure.

`dconf write /org/gnome/shell/extensions/ScriptToPanel/count 1`

`dconf write /org/gnome/shell/extensions/ScriptToPanel/script-1 "['1000', 'date']"`

Where `count` key is the total count of scripts,

`script-<N>` is a script set with a value as an array of strings:

the first element is a timeout in ms to run the script,
the second is a name of the script/command,
other elements are parameters to the script.

Restart GNOME Shell
-------------------
Don't forget to restart GNOME Shell:

`Alt+F2, r`

License
------
Copyright (C) 2015 Anton Kozhemyachenko <gmerzu@gmail.com>

All rights reserved.

This file is part of Script To Panel.

Script To Panel is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License as published by the Free Software Foundation, either version 3** of the License, or (at your option) any later version.

Script To Panel is distributed in the hope that it will be useful, but WITHOUT ANY WARRANTY; without even the implied warranty of MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the GNU General Public License for more details.

You should have received a copy of the GNU General Public License along with Script To Panel.  If not, see <http://www.gnu.org/licenses/>.
