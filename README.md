# Email Copy Extension

A compact Chromium extension for keeping email addresses in the toolbar popup and copying the selected address with one click. It uses Manifest V3 and plain HTML, CSS, and JavaScript. Email entries are saved locally with `chrome.storage.local`. The `icons` folder contains the extension's SVG source and Chromium-ready PNG icons.

## Install in Chromium

1. Save or clone this folder on your computer.
2. Open `chrome://extensions` in Chromium (or `edge://extensions` in Microsoft Edge).
3. Turn on **Developer mode**.
4. Choose **Load unpacked** and select this project folder, the one containing `manifest.json`.
5. Pin **Email Copy Extension** from the Extensions menu if you want quick access, then select its toolbar icon.

## Use

- Edit the email address in the input.
- Select the radio button beside an address to choose which one to copy.
- Choose **Add another email** to create another independently editable entry. Use the × control to remove an entry.
- Choose **Copy email**. The popup briefly shows **Copied!** after copying.
- Addresses and the current selection persist on this device between popup opens and browser restarts.
- Open the gear menu to choose **Light** or **Dark** mode, select a theme color, and choose whether text uses the **Theme color** or **Basic** (white in dark mode, black in light mode). Appearance choices are saved on this device.
- Use the lock button beside the gear to prevent edits. Locking hides the add and remove controls and makes addresses read-only. Each address has its own **Copy** button.
- Give each address a name, choose its dot color from the preset palette or custom picker, and use the eye button to mask or reveal the address. **Show hide buttons** in appearance settings controls whether eye buttons appear. Dot color controls are hidden while editing is locked.
- Removing an address asks for confirmation first.

## Check the extension

- Confirm the extension loads without an error at `chrome://extensions`.
- Open the popup, edit the first address, add another address, and verify each field retains its own value.
- Select each address in turn and use **Copy email**; paste into a text field to verify the selected value was copied.
- Close and reopen the popup to confirm addresses and selection persist. Remove an entry and confirm the remaining list still works.

The popup uses no remote code, external libraries, or network access.

_Notice:This is Made with Codex And ChatGPT_
