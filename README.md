# Email Copy Extension

A compact Chromium extension for keeping email addresses in the toolbar popup and copying any address with one click. It uses Manifest V3 and plain HTML, CSS, and JavaScript. Email entries are saved locally with `chrome.storage.local`. The `icons` folder contains the supplied Exotic Mail artwork and resized PNG icons, plus a simple alternate toolbar icon.

## Install in Chromium

1. Save or clone this folder on your computer.
2. Open `chrome://extensions` in Chromium (or `edge://extensions` in Microsoft Edge).
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this project folder, the one containing `manifest.json`.
5. Pin **Email Copy Extension** from the Extensions menu if you want quick access, then select its toolbar icon.

## Use

- Edit the email address in the input.
- Choose **Add another email** to create another independently editable entry. Use the × control to remove an entry.
- Choose **Copy email**. The popup briefly shows **Copied!** after copying.
- Search by name or visible email address. Use the sort menu for custom order, name, email address, or newest first; the selected sort order is saved.
- In Custom order, drag the grip beside an email to reorder it, or focus the grip and press the up/down arrow keys. Reordering switches other sort modes to Custom and is disabled while searching or locked.
- Addresses and the current selection persist on this device between popup opens and browser restarts.
- Open the gear menu to choose **Light** or **Dark** mode, select a theme color, and choose whether text uses the **Theme color** or **Basic** (white in dark mode, black in light mode). Appearance choices are saved on this device.
- In **Extension icon**, choose **Exotic** for the supplied artwork or **Simple** for the compact purple envelope. The toolbar icon updates and the choice is saved with appearance settings.
- Use the lock button beside the gear to prevent edits. Locking hides the add and remove controls and makes addresses read-only. Each address has its own **Copy** button.
- Give each address a name, choose its dot color from the preset palette or custom picker, and use the eye button to mask or reveal the address. The color dot remains visible while locked, but its picker is hidden. **Show hide buttons** in appearance settings controls whether eye buttons appear.
- Appearance settings can also hide the name whenever its email is hidden, and can hide eye buttons while editing is locked.
- The **Features** section in settings lets you switch Search and Sort, email hiding, dot colors, backups, and the editing lock on or off.
- **Email validation** is enabled by default. Invalid non-empty addresses are highlighted, and copying them is blocked until corrected. Turn it off in **Settings → Features** to copy any text as entered.
- Customize the popup background and stroke colors. **Theme-colored buttons** applies the selected theme color to the interface buttons; **Reset** returns the background to its light or dark mode default.
- Use **Settings backup** to export or import appearance preferences as JSON. Use **Email backup** to export or import names, addresses, dot colors, and hidden states. Email imports accept this extension's JSON backup, simple JSON lists, CSV, or one-address-per-line text files. Imports replace the current list after confirmation and require the extension to be unlocked.
- Removing an address asks for confirmation first.

## Check the extension

- Confirm the extension loads without an error at `chrome://extensions`.
- Open the popup, edit the first address, add another address, and verify each field retains its own value.
- Use each address's Copy icon; paste into a text field to verify that address was copied.
- Close and reopen the popup to confirm addresses and selection persist. Remove an entry and confirm the remaining list still works.

The popup uses no remote code, external libraries, or network access.

_Notice:This is Made with Codex And ChatGPT_

_Unless otherwise noted, this project’s content is licensed under CC BY-NC 4.0. Attribution is required, and commercial use is not permitted._ 
