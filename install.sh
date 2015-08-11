NAME="ScriptToPanel@gmerzu.gmail.com"
INST_DIR="${HOME}/.local/share/gnome-shell/extensions/${NAME}"

echo "Installing extension ..."
mkdir -p "${INST_DIR}"
mkdir -p "${INST_DIR}"/schemas

cp metadata.json extension.js stylesheet.css "${INST_DIR}"/
cp schemas/org.gnome.shell.extensions.ScriptToPanel.gschema.xml "${INST_DIR}"/schemas/
glib-compile-schemas "${INST_DIR}"/schemas/

echo "All done."
