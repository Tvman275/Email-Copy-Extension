const STORAGE_KEY = "savedEmails";
const THEME_KEY = "appearanceSettings";
const LOCK_KEY = "emailEditingLocked";
const list = document.getElementById("email-list");
const count = document.getElementById("email-count");
const status = document.getElementById("status");
const themeColor = document.getElementById("theme-color");
let emails = [{ id: 0, name: "", value: "", color: "#A88BFF", hidden: false }];
let selectedId = 0;
let nextId = 1;
let appearance = { mode: "dark", color: "#A88BFF", textMode: "basic", showHideButtons: true };
let editingLocked = false;
let feedbackTimer;
let copiedButton = null;

function persist() {
  chrome.storage.local.set({ [STORAGE_KEY]: { emails, selectedId, nextId } });
}

function persistAppearance() {
  chrome.storage.local.set({ [THEME_KEY]: appearance });
}

function applyAppearance() {
  document.documentElement.dataset.theme = appearance.mode;
  document.documentElement.style.setProperty("--accent", appearance.color);
  if (appearance.textMode === "theme") {
    document.documentElement.style.setProperty("--ink", appearance.color);
  } else {
    document.documentElement.style.removeProperty("--ink");
  }
  themeColor.value = appearance.color;
  document.getElementById("show-hide-buttons").checked = appearance.showHideButtons;
  document.querySelectorAll(".mode-button").forEach(button => {
    const selected = button.dataset.mode
      ? button.dataset.mode === appearance.mode
      : button.dataset.textMode === appearance.textMode;
    button.setAttribute("aria-pressed", String(selected));
  });
}

function render() {
  list.replaceChildren();
  emails.forEach((email, index) => {
    const row = document.createElement("div");
    const id = email.id;
    row.className = `email-row${selectedId === id ? " selected" : ""}`;

    const radio = document.createElement("input");
    radio.type = "radio";
    radio.name = "selected-email";
    radio.checked = selectedId === id;
    radio.style.accentColor = email.color;
    radio.setAttribute("aria-label", `Select email ${index + 1}`);
    radio.addEventListener("change", () => { selectedId = id; persist(); render(); });

    const colorControl = document.createElement("div");
    colorControl.className = "email-color-control";
    if (!editingLocked) {
      const dotButton = document.createElement("button");
      dotButton.className = "email-dot-button";
      dotButton.type = "button";
      dotButton.style.setProperty("--email-dot", email.color);
      dotButton.setAttribute("aria-label", `Choose dot color for email ${index + 1}`);
      dotButton.title = `Change dot color for ${email.name || `email ${index + 1}`}`;

      const palette = document.createElement("div");
      palette.className = "email-color-palette";
      palette.hidden = true;
      palette.setAttribute("role", "group");
      palette.setAttribute("aria-label", `Color palette for email ${index + 1}`);
      const colors = ["#EF5350", "#FF9800", "#FDD835", "#66BB6A", "#26A69A", "#29B6F6", "#42A5F5", "#5C6BC0", "#AB47BC", "#EC407A", "#A88BFF", "#FFFFFF"];
      const setColor = color => {
        email.color = color.toUpperCase();
        dotButton.style.setProperty("--email-dot", email.color);
        radio.style.accentColor = email.color;
        palette.querySelectorAll("[data-color]").forEach(swatch => {
          swatch.setAttribute("aria-pressed", String(swatch.dataset.color === email.color));
        });
        persist();
      };
      colors.forEach(color => {
        const swatch = document.createElement("button");
        swatch.className = "color-swatch";
        swatch.type = "button";
        swatch.dataset.color = color;
        swatch.style.setProperty("--swatch", color);
        swatch.setAttribute("aria-label", `Set dot color to ${color}`);
        swatch.setAttribute("aria-pressed", String(color === email.color));
        swatch.addEventListener("click", () => setColor(color));
        palette.append(swatch);
      });
      const custom = document.createElement("label");
      custom.className = "custom-color-swatch";
      custom.title = "Choose a custom color";
      custom.innerHTML = '<span aria-hidden="true">+</span>';
      const colorInput = document.createElement("input");
      colorInput.type = "color";
      colorInput.value = email.color;
      colorInput.setAttribute("aria-label", `Choose custom dot color for email ${index + 1}`);
      colorInput.addEventListener("input", () => setColor(colorInput.value));
      custom.append(colorInput);
      palette.append(custom);
      dotButton.addEventListener("click", () => { palette.hidden = !palette.hidden; });
      colorControl.append(dotButton, palette);
    }

    const fields = document.createElement("div");
    fields.className = "email-fields";

    const nameInput = document.createElement("input");
    nameInput.className = "name-input";
    nameInput.type = "text";
    nameInput.value = email.name;
    nameInput.placeholder = "Name";
    nameInput.autocomplete = "off";
    nameInput.disabled = editingLocked;
    nameInput.setAttribute("aria-label", `Name for email ${index + 1}`);
    nameInput.addEventListener("input", () => {
      email.name = nameInput.value;
      const dotButton = colorControl.querySelector(".email-dot-button");
      if (dotButton) dotButton.title = `Change dot color for ${email.name || `email ${index + 1}`}`;
      persist(); clearStatus();
    });

    const input = document.createElement("input");
    input.className = "email-input";
    input.type = email.hidden ? "text" : "email";
    input.value = email.hidden ? "••••••••••" : email.value;
    input.placeholder = "name@example.com";
    input.autocomplete = "email";
    input.disabled = editingLocked;
    input.readOnly = email.hidden;
    input.setAttribute("aria-label", `Email address ${index + 1}${email.hidden ? ", hidden" : ""}`);
    input.addEventListener("input", () => { email.value = input.value; persist(); clearStatus(); });
    fields.append(nameInput, input);

    const copy = document.createElement("button");
    copy.className = "row-copy-button";
    copy.type = "button";
    copy.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1.7" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 7V5.7A1.7 1.7 0 0 0 10.8 4H5.7A1.7 1.7 0 0 0 4 5.7v6.1a1.7 1.7 0 0 0 1.7 1.7H7" stroke="currentColor" stroke-width="1.6"/></svg>';
    copy.dataset.emailIndex = String(index + 1);
    copy.setAttribute("aria-label", `Copy email ${index + 1}`);
    copy.addEventListener("click", () => copyEmail(email.value, copy));

    row.append(radio);
    if (!editingLocked) row.append(colorControl);
    row.append(fields);
    if (appearance.showHideButtons) {
      const hide = document.createElement("button");
      hide.className = "row-hide-button";
      hide.type = "button";
      hide.setAttribute("aria-label", email.hidden ? `Show email ${index + 1}` : `Hide email ${index + 1}`);
      hide.title = email.hidden ? "Show email" : "Hide email";
      hide.innerHTML = email.hidden
        ? '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m3 3 14 14M8.6 8.6a2 2 0 0 0 2.8 2.8" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/><path d="M7.2 5.3A8.5 8.5 0 0 1 10 4.8c4.5 0 7.4 5.2 7.4 5.2a13 13 0 0 1-2.2 2.7M5.3 6.1C3.6 7.3 2.6 10 2.6 10S5.5 15.2 10 15.2c.8 0 1.5-.2 2.2-.5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>'
        : '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="M2.6 10S5.5 4.8 10 4.8s7.4 5.2 7.4 5.2-2.9 5.2-7.4 5.2S2.6 10 2.6 10Z" stroke="currentColor" stroke-width="1.5"/><circle cx="10" cy="10" r="2.2" stroke="currentColor" stroke-width="1.5"/></svg>';
      hide.addEventListener("click", () => {
        email.hidden = !email.hidden;
        persist(); render();
      });
      row.append(hide);
    }
    row.append(copy);
    if (emails.length > 1 && !editingLocked) {
      const remove = document.createElement("button");
      remove.className = "remove-button";
      remove.type = "button";
      remove.textContent = "×";
      remove.setAttribute("aria-label", `Remove email ${index + 1}`);
      remove.addEventListener("click", () => openRemoveConfirmation(id));
      row.append(remove);
    }
    list.append(row);
  });
  count.textContent = String(emails.length);
  document.getElementById("add-email").hidden = editingLocked;
}

function clearStatus() {
  clearTimeout(feedbackTimer);
  status.textContent = "";
  status.classList.remove("error");
  if (copiedButton?.isConnected) {
    copiedButton.setAttribute("aria-label", `Copy email ${copiedButton.dataset.emailIndex}`);
    copiedButton.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1.7" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 7V5.7A1.7 1.7 0 0 0 10.8 4H5.7A1.7 1.7 0 0 0 4 5.7v6.1a1.7 1.7 0 0 0 1.7 1.7H7" stroke="currentColor" stroke-width="1.6"/></svg>';
  }
  copiedButton = null;
}

async function copyEmail(email, button) {
  clearStatus();
  const value = email.trim();
  if (!value) {
    status.textContent = "Enter an email address first.";
    status.classList.add("error");
    return;
  }
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const helper = document.createElement("textarea");
    helper.value = value;
    helper.style.position = "fixed";
    helper.style.opacity = "0";
    document.body.append(helper);
    helper.select();
    const copied = document.execCommand("copy");
    helper.remove();
    if (!copied) {
      status.textContent = "Could not copy. Check clipboard access.";
      status.classList.add("error");
      return;
    }
  }
  status.textContent = "Copied!";
  button.setAttribute("aria-label", "Copied!");
  button.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><path d="m4.5 10.5 3.6 3.6 7.5-8" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  copiedButton = button;
  feedbackTimer = setTimeout(clearStatus, 1600);
}

document.getElementById("add-email").addEventListener("click", () => {
  const email = { id: nextId++, value: "" };
  email.name = "";
  email.color = appearance.color;
  email.hidden = false;
  emails.push(email);
  selectedId = email.id;
  persist(); render();
  list.lastElementChild.querySelector(".name-input").focus();
});

const settingsToggle = document.getElementById("settings-toggle");
const settingsPanel = document.getElementById("appearance-settings");
settingsToggle.addEventListener("click", () => {
  const isOpen = settingsToggle.getAttribute("aria-expanded") === "true";
  settingsToggle.setAttribute("aria-expanded", String(!isOpen));
  settingsPanel.hidden = isOpen;
});

const lockToggle = document.getElementById("lock-toggle");
function updateLockButton() {
  lockToggle.setAttribute("aria-pressed", String(editingLocked));
  lockToggle.setAttribute("aria-label", editingLocked ? "Unlock email editing" : "Lock email editing");
  lockToggle.title = editingLocked ? "Unlock email editing" : "Lock email editing";
  lockToggle.innerHTML = editingLocked
    ? '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 6.7-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
}
lockToggle.addEventListener("click", () => {
  editingLocked = !editingLocked;
  chrome.storage.local.set({ [LOCK_KEY]: editingLocked });
  updateLockButton();
  render();
});

let pendingRemoveId = null;
const removeDialog = document.getElementById("confirm-remove");
function openRemoveConfirmation(id) {
  pendingRemoveId = id;
  removeDialog.showModal();
}
document.getElementById("cancel-remove").addEventListener("click", () => removeDialog.close());
document.getElementById("confirm-remove-button").addEventListener("click", () => {
  const id = pendingRemoveId;
  if (id !== null) {
    emails = emails.filter(item => item.id !== id);
    if (selectedId === id) selectedId = emails[0].id;
    persist(); render();
  }
  pendingRemoveId = null;
  removeDialog.close();
});
removeDialog.addEventListener("close", () => { pendingRemoveId = null; });

document.addEventListener("click", event => {
  if (event.target.closest(".email-color-control")) return;
  document.querySelectorAll(".email-color-palette:not([hidden])").forEach(palette => { palette.hidden = true; });
});

document.querySelectorAll(".mode-button").forEach(button => {
  button.addEventListener("click", () => {
    if (button.dataset.mode) appearance.mode = button.dataset.mode;
    if (button.dataset.textMode) appearance.textMode = button.dataset.textMode;
    applyAppearance();
    persistAppearance();
  });
});

themeColor.addEventListener("input", () => {
  appearance.color = themeColor.value.toUpperCase();
  applyAppearance();
  persistAppearance();
});

document.getElementById("show-hide-buttons").addEventListener("change", event => {
  appearance.showHideButtons = event.target.checked;
  persistAppearance();
  render();
});

chrome.storage.local.get([STORAGE_KEY, THEME_KEY, LOCK_KEY], result => {
  const saved = result[STORAGE_KEY];
  const savedAppearance = result[THEME_KEY];
  editingLocked = result[LOCK_KEY] === true;
  updateLockButton();
  if (savedAppearance && (savedAppearance.mode === "dark" || savedAppearance.mode === "light") && /^#[0-9a-f]{6}$/i.test(savedAppearance.color)) {
    appearance = {
      mode: savedAppearance.mode,
      color: savedAppearance.color.toUpperCase(),
      textMode: savedAppearance.textMode === "theme" ? "theme" : "basic",
      showHideButtons: savedAppearance.showHideButtons !== false
    };
  }
  applyAppearance();
  if (saved && Array.isArray(saved.emails) && saved.emails.length) {
    emails = saved.emails.filter(item => item && typeof item.value === "string" && Number.isFinite(item.id));
    emails = emails.map(email => ({
      ...email,
      name: typeof email.name === "string" ? email.name : "",
      color: /^#[0-9a-f]{6}$/i.test(email.color) ? email.color.toUpperCase() : appearance.color,
      hidden: email.hidden === true
    }));
    if (!emails.length) emails = [{ id: 0, name: "", value: "", color: appearance.color, hidden: false }];
    selectedId = emails.some(item => item.id === saved.selectedId) ? saved.selectedId : emails[0].id;
    nextId = Number.isFinite(saved.nextId) ? saved.nextId : Math.max(...emails.map(item => item.id)) + 1;
  } else {
    emails = [{ id: 0, name: "", value: "", color: appearance.color, hidden: false }];
    selectedId = 0;
    nextId = 1;
  }
  render();
});
