const STORAGE_KEY = "savedEmails";
const THEME_KEY = "appearanceSettings";
const LOCK_KEY = "emailEditingLocked";
const list = document.getElementById("email-list");
const count = document.getElementById("email-count");
const status = document.getElementById("status");
const themeColor = document.getElementById("theme-color");
const backgroundColor = document.getElementById("background-color");
const strokeColor = document.getElementById("stroke-color");
const brandIcon = document.getElementById("brand-icon");
const settingsFile = document.getElementById("settings-file");
const emailsFile = document.getElementById("emails-file");
const emailSearch = document.getElementById("email-search");
const emailSort = document.getElementById("email-sort");
const emptyState = document.getElementById("email-empty");
const DEFAULT_FEATURES = { searchSort: true, emailHiding: true, emailColors: true, importExport: true, editingLock: true, emailValidation: true };
let emails = [{ id: 0, name: "", value: "", color: "#A88BFF", hidden: false }];
let nextId = 1;
let appearance = {
  mode: "dark",
  iconStyle: "exotic",
  color: "#A88BFF",
  textMode: "basic",
  showHideButtons: true,
  hideNameWithEmail: false,
  hideButtonsWhenLocked: true,
  backgroundColor: null,
  strokeColor: "#787880",
  themeButtons: false,
  sortOrder: "custom",
  features: { ...DEFAULT_FEATURES }
};
let editingLocked = false;
let feedbackTimer;
let copiedButton = null;
let pointerReorder = null;

function persist() {
  chrome.storage.local.set({ [STORAGE_KEY]: { emails, nextId } });
}

function persistAppearance() {
  chrome.storage.local.set({ [THEME_KEY]: appearance });
}

function normalizeFeatures(features) {
  return Object.fromEntries(Object.entries(DEFAULT_FEATURES).map(([key, defaultValue]) => [
    key,
    features && typeof features[key] === "boolean" ? features[key] : defaultValue
  ]));
}

function isValidEmail(value) {
  const probe = document.createElement("input");
  probe.type = "email";
  probe.value = value.trim();
  return probe.value.length > 0 && probe.validity.valid;
}

function showMessage(message, isError = false) {
  clearStatus();
  status.textContent = message;
  status.classList.toggle("error", isError);
  feedbackTimer = setTimeout(clearStatus, 2600);
}

function downloadJson(filename, content) {
  const blob = new Blob([JSON.stringify(content, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 3000);
}

async function readJsonFile(file) {
  if (!file) throw new Error("Choose a JSON file first.");
  try {
    return JSON.parse(await file.text());
  } catch {
    throw new Error("That file is not valid JSON.");
  }
}

function applyAppearance() {
  const root = document.documentElement;
  brandIcon.src = appearance.iconStyle === "simple" ? "icons/simple-128.png" : "icons/exotic-128.png";
  root.dataset.theme = appearance.mode;
  root.dataset.buttonTheme = String(appearance.themeButtons);
  const effectiveBackground = appearance.backgroundColor || (appearance.mode === "dark" ? "#1D1B20" : "#FFFFFF");
  const stroke = appearance.strokeColor.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
  const [red, green, blue] = appearance.color.match(/[0-9a-f]{2}/gi).map(value => parseInt(value, 16));
  const accentLuminance = [red, green, blue].map(value => {
    const channel = value / 255;
    return channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4;
  });
  const buttonText = 0.2126 * accentLuminance[0] + 0.7152 * accentLuminance[1] + 0.0722 * accentLuminance[2] > 0.179 ? "#000000" : "#FFFFFF";
  root.style.setProperty("--surface", effectiveBackground);
  root.style.setProperty("--stroke", `rgba(${stroke.join(", ")}, 0.16)`);
  root.style.setProperty("--accent", appearance.color);
  root.style.setProperty("--button-ink", buttonText);
  if (appearance.textMode === "theme") {
    root.style.setProperty("--ink", appearance.color);
  } else {
    root.style.removeProperty("--ink");
  }
  themeColor.value = appearance.color;
  backgroundColor.value = effectiveBackground;
  strokeColor.value = appearance.strokeColor;
  document.getElementById("theme-buttons").checked = appearance.themeButtons;
  document.getElementById("show-hide-buttons").checked = appearance.showHideButtons;
  document.getElementById("hide-name-with-email").checked = appearance.hideNameWithEmail;
  document.getElementById("hide-buttons-when-locked").checked = appearance.hideButtonsWhenLocked;
  emailSort.value = appearance.sortOrder;
  applyFeatureOptions();
  updateLockButton();
  document.querySelectorAll(".mode-button").forEach(button => {
    const selected = button.dataset.mode
      ? button.dataset.mode === appearance.mode
      : button.dataset.textMode
        ? button.dataset.textMode === appearance.textMode
        : button.dataset.iconStyle === appearance.iconStyle;
    button.setAttribute("aria-pressed", String(selected));
  });
}

function applyFeatureOptions() {
  document.querySelectorAll("[data-feature]").forEach(input => {
    input.checked = appearance.features[input.dataset.feature];
  });
  document.getElementById("list-tools").hidden = !appearance.features.searchSort;
  document.getElementById("backup-controls").hidden = !appearance.features.importExport;
  document.getElementById("show-hide-setting").hidden = !appearance.features.emailHiding;
  document.getElementById("hide-name-setting").hidden = !appearance.features.emailHiding;
  document.getElementById("hide-locked-setting").hidden = !appearance.features.emailHiding;
  if (!appearance.features.searchSort) {
    emailSearch.value = "";
    appearance.sortOrder = "custom";
    emailSort.value = "custom";
  }
}

function getVisibleEmails() {
  const query = emailSearch.value.trim().toLocaleLowerCase();
  const visible = emails.filter(email => {
    if (!query) return true;
    const nameIsHidden = email.hidden && appearance.hideNameWithEmail;
    const searchable = `${nameIsHidden ? "" : email.name} ${email.hidden ? "" : email.value}`.toLocaleLowerCase();
    return searchable.includes(query);
  });
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });
  if (appearance.sortOrder === "name") {
    visible.sort((a, b) => collator.compare(a.name || a.value, b.name || b.value));
  } else if (appearance.sortOrder === "email") {
    visible.sort((a, b) => collator.compare(a.value, b.value));
  } else if (appearance.sortOrder === "newest") {
    visible.sort((a, b) => b.id - a.id);
  }
  return visible;
}

function prepareManualOrder() {
  if (emailSearch.value.trim()) {
    showMessage("Clear search before reordering emails.", true);
    return false;
  }
  if (appearance.sortOrder !== "custom") {
    emails = getVisibleEmails();
    appearance.sortOrder = "custom";
    emailSort.value = "custom";
    persistAppearance();
    persist();
  }
  return true;
}

function moveEmail(id, offset) {
  const from = emails.findIndex(email => email.id === id);
  const to = from + offset;
  if (from < 0 || to < 0 || to >= emails.length) return;
  const [email] = emails.splice(from, 1);
  emails.splice(to, 0, email);
  persist();
  render();
  list.querySelector(`[data-email-id="${id}"]`)?.focus();
  showMessage("Email order updated.");
}

function moveEmailRelative(sourceId, targetId, afterTarget) {
  const from = emails.findIndex(email => email.id === sourceId);
  const to = emails.findIndex(email => email.id === targetId);
  if (from < 0 || to < 0 || from === to) return;
  const [email] = emails.splice(from, 1);
  const targetPosition = emails.findIndex(item => item.id === targetId);
  emails.splice(targetPosition + (afterTarget ? 1 : 0), 0, email);
  persist();
  render();
  showMessage("Email order updated.");
}

function clearPointerReorder(pointerId) {
  if (!pointerReorder || (pointerId !== undefined && pointerReorder.pointerId !== pointerId)) return;
  pointerReorder = null;
  document.querySelectorAll(".email-row.drag-over, .email-row.dragging").forEach(row => row.classList.remove("drag-over", "dragging"));
}

function render() {
  list.replaceChildren();
  const visibleEmails = getVisibleEmails();
  visibleEmails.forEach((email, index) => {
    const row = document.createElement("div");
    const id = email.id;
    row.className = "email-row";
    row.dataset.emailId = String(id);
    const shouldValidate = appearance.features.emailValidation && Boolean(email.value.trim());
    const hasInvalidEmail = shouldValidate && !isValidEmail(email.value);
    row.classList.toggle("email-invalid", hasInvalidEmail);

    if (emails.length > 1 && !editingLocked) {
      const dragHandle = document.createElement("button");
      dragHandle.className = "drag-handle";
      dragHandle.type = "button";
      dragHandle.dataset.emailId = String(id);
      dragHandle.innerHTML = '<svg viewBox="0 0 16 20" fill="currentColor" aria-hidden="true"><circle cx="5" cy="5" r="1.2"/><circle cx="11" cy="5" r="1.2"/><circle cx="5" cy="10" r="1.2"/><circle cx="11" cy="10" r="1.2"/><circle cx="5" cy="15" r="1.2"/><circle cx="11" cy="15" r="1.2"/></svg>';
      const reorderTitle = emailSearch.value.trim() ? "Clear search to reorder" : appearance.sortOrder === "custom" ? "Drag to reorder (arrow keys also work)" : "Drag to reorder; this switches to Custom order";
      dragHandle.title = reorderTitle;
      dragHandle.setAttribute("aria-label", `Reorder ${email.name || email.value || `email ${index + 1}`}`);
      dragHandle.setAttribute("aria-keyshortcuts", "ArrowUp ArrowDown");
      dragHandle.addEventListener("keydown", event => {
        if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
        event.preventDefault();
        if (prepareManualOrder()) moveEmail(id, event.key === "ArrowUp" ? -1 : 1);
      });
      dragHandle.addEventListener("pointerdown", event => {
        if (!event.isPrimary || event.button !== 0) return;
        if (!prepareManualOrder()) {
          event.preventDefault();
          return;
        }
        event.preventDefault();
        pointerReorder = {
          id,
          pointerId: event.pointerId,
          startX: event.clientX,
          startY: event.clientY,
          targetId: id,
          afterTarget: false,
          moved: false
        };
        dragHandle.setPointerCapture(event.pointerId);
        row.classList.add("dragging");
      });
      dragHandle.addEventListener("pointermove", event => {
        if (!pointerReorder || pointerReorder.pointerId !== event.pointerId) return;
        if (Math.hypot(event.clientX - pointerReorder.startX, event.clientY - pointerReorder.startY) > 4) pointerReorder.moved = true;
        if (!pointerReorder.moved) return;
        const underPointer = document.elementFromPoint(event.clientX, event.clientY)?.closest(".email-row");
        document.querySelectorAll(".email-row.drag-over").forEach(item => item.classList.remove("drag-over"));
        if (!underPointer) {
          pointerReorder.targetId = null;
          return;
        }
        pointerReorder.targetId = Number(underPointer.dataset.emailId);
        const bounds = underPointer.getBoundingClientRect();
        pointerReorder.afterTarget = event.clientY > bounds.top + bounds.height / 2;
        underPointer.classList.add("drag-over");
      });
      dragHandle.addEventListener("pointerup", event => {
        if (!pointerReorder || pointerReorder.pointerId !== event.pointerId) return;
        const move = pointerReorder;
        clearPointerReorder(event.pointerId);
        if (move.moved && move.targetId !== null && move.targetId !== move.id) {
          moveEmailRelative(move.id, move.targetId, move.afterTarget);
        }
      });
      dragHandle.addEventListener("pointercancel", event => clearPointerReorder(event.pointerId));
      dragHandle.addEventListener("lostpointercapture", event => clearPointerReorder(event.pointerId));
      row.append(dragHandle);
    }

    const colorControl = document.createElement("div");
    colorControl.className = "email-color-control";
    if (!editingLocked && appearance.features.emailColors) {
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
    } else {
      const dot = document.createElement("span");
      dot.className = "email-color-dot";
      dot.style.setProperty("--email-dot", appearance.features.emailColors ? email.color : appearance.color);
      dot.setAttribute("aria-label", `Email color ${appearance.features.emailColors ? email.color : appearance.color}`);
      colorControl.append(dot);
    }

    const fields = document.createElement("div");
    fields.className = "email-fields";

    const nameInput = document.createElement("input");
    nameInput.className = "name-input";
    nameInput.type = "text";
    const hideName = email.hidden && appearance.hideNameWithEmail;
    nameInput.value = hideName ? "••••••" : email.name;
    nameInput.placeholder = "Name";
    nameInput.autocomplete = "off";
    nameInput.disabled = editingLocked;
    nameInput.readOnly = hideName;
    nameInput.setAttribute("aria-label", `Name for email ${index + 1}${hideName ? ", hidden" : ""}`);
    nameInput.addEventListener("input", () => {
      if (hideName) return;
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
    if (shouldValidate) input.setAttribute("aria-invalid", String(hasInvalidEmail));
    input.addEventListener("input", () => {
      email.value = input.value;
      const invalid = appearance.features.emailValidation && Boolean(email.value.trim()) && !isValidEmail(email.value);
      row.classList.toggle("email-invalid", invalid);
      if (appearance.features.emailValidation && email.value.trim()) input.setAttribute("aria-invalid", String(invalid));
      else input.removeAttribute("aria-invalid");
      persist(); clearStatus();
    });
    fields.append(nameInput, input);

    const copy = document.createElement("button");
    copy.className = "row-copy-button";
    copy.type = "button";
    copy.innerHTML = '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="7" y="7" width="9" height="10" rx="1.7" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 7V5.7A1.7 1.7 0 0 0 10.8 4H5.7A1.7 1.7 0 0 0 4 5.7v6.1a1.7 1.7 0 0 0 1.7 1.7H7" stroke="currentColor" stroke-width="1.6"/></svg>';
    copy.dataset.emailIndex = String(index + 1);
    copy.setAttribute("aria-label", `Copy email ${index + 1}`);
    copy.addEventListener("click", () => copyEmail(email.value, copy));

    row.append(colorControl);
    row.append(fields);
    if (appearance.features.emailHiding && appearance.showHideButtons && (!editingLocked || !appearance.hideButtonsWhenLocked)) {
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
  count.textContent = emailSearch.value.trim() ? `${visibleEmails.length}/${emails.length}` : String(emails.length);
  emptyState.hidden = visibleEmails.length > 0;
  emptyState.textContent = emailSearch.value.trim() ? "No matching emails." : "No email addresses.";
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
  if (appearance.features.emailValidation && !isValidEmail(value)) {
    showMessage("Enter a valid email address before copying.", true);
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
  emailSearch.value = "";
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
  lockToggle.hidden = !appearance.features.editingLock;
  lockToggle.innerHTML = editingLocked
    ? '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 7 0v2.5" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>'
    : '<svg viewBox="0 0 20 20" fill="none" aria-hidden="true"><rect x="4" y="8.5" width="12" height="9" rx="2" stroke="currentColor" stroke-width="1.4"/><path d="M6.5 8.5V6a3.5 3.5 0 0 1 6.7-1.4" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
  document.getElementById("import-emails").disabled = editingLocked;
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

document.querySelectorAll(".icon-style-button").forEach(button => {
  button.addEventListener("click", () => {
    appearance.iconStyle = button.dataset.iconStyle === "simple" ? "simple" : "exotic";
    applyAppearance();
    persistAppearance();
  });
});

themeColor.addEventListener("input", () => {
  appearance.color = themeColor.value.toUpperCase();
  applyAppearance();
  persistAppearance();
});

emailSearch.addEventListener("input", render);
emailSort.addEventListener("change", () => {
  appearance.sortOrder = emailSort.value;
  persistAppearance();
  render();
});

backgroundColor.addEventListener("input", () => {
  appearance.backgroundColor = backgroundColor.value.toUpperCase();
  applyAppearance();
  persistAppearance();
});

document.getElementById("reset-background").addEventListener("click", () => {
  appearance.backgroundColor = null;
  applyAppearance();
  persistAppearance();
});

strokeColor.addEventListener("input", () => {
  appearance.strokeColor = strokeColor.value.toUpperCase();
  applyAppearance();
  persistAppearance();
});

document.getElementById("theme-buttons").addEventListener("change", event => {
  appearance.themeButtons = event.target.checked;
  applyAppearance();
  persistAppearance();
});

document.getElementById("show-hide-buttons").addEventListener("change", event => {
  appearance.showHideButtons = event.target.checked;
  persistAppearance();
  render();
});

document.getElementById("hide-name-with-email").addEventListener("change", event => {
  appearance.hideNameWithEmail = event.target.checked;
  persistAppearance();
  render();
});

document.getElementById("hide-buttons-when-locked").addEventListener("change", event => {
  appearance.hideButtonsWhenLocked = event.target.checked;
  persistAppearance();
  render();
});

document.querySelectorAll("[data-feature]").forEach(input => {
  input.addEventListener("change", () => {
    const feature = input.dataset.feature;
    appearance.features[feature] = input.checked;
    if (feature === "emailHiding" && !input.checked) {
      emails.forEach(email => { email.hidden = false; });
      persist();
    }
    if (feature === "editingLock" && !input.checked && editingLocked) {
      editingLocked = false;
      chrome.storage.local.set({ [LOCK_KEY]: false });
    }
    persistAppearance();
    applyAppearance();
    render();
  });
});

document.getElementById("export-settings").addEventListener("click", () => {
  downloadJson("email-copy-settings.json", {
    format: "email-copy-settings",
    version: 1,
    exportedAt: new Date().toISOString(),
    settings: appearance
  });
  showMessage("Settings exported.");
});

document.getElementById("import-settings").addEventListener("click", () => settingsFile.click());
settingsFile.addEventListener("change", async () => {
  try {
    const data = await readJsonFile(settingsFile.files[0]);
    if (data.format !== "email-copy-settings" || data.version !== 1 || !data.settings) {
      throw new Error("This is not a supported settings backup.");
    }
    const imported = data.settings;
    if (!(imported.mode === "dark" || imported.mode === "light") || !/^#[0-9a-f]{6}$/i.test(imported.color)) {
      throw new Error("The settings backup contains invalid theme values.");
    }
    appearance = {
      mode: imported.mode,
      iconStyle: imported.iconStyle === "simple" ? "simple" : "exotic",
      color: imported.color.toUpperCase(),
      textMode: imported.textMode === "theme" ? "theme" : "basic",
      showHideButtons: imported.showHideButtons !== false,
      hideNameWithEmail: imported.hideNameWithEmail === true,
      hideButtonsWhenLocked: imported.hideButtonsWhenLocked !== false,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(imported.backgroundColor) ? imported.backgroundColor.toUpperCase() : null,
      strokeColor: /^#[0-9a-f]{6}$/i.test(imported.strokeColor) ? imported.strokeColor.toUpperCase() : "#787880",
      themeButtons: imported.themeButtons === true,
      sortOrder: ["custom", "name", "email", "newest"].includes(imported.sortOrder) ? imported.sortOrder : "custom",
      features: normalizeFeatures(imported.features)
    };
    if (!appearance.features.emailHiding) {
      emails.forEach(email => { email.hidden = false; });
      persist();
    }
    if (!appearance.features.editingLock && editingLocked) {
      editingLocked = false;
      chrome.storage.local.set({ [LOCK_KEY]: false });
    }
    applyAppearance();
    persistAppearance();
    render();
    showMessage("Settings imported.");
  } catch (error) {
    showMessage(error.message || "Could not import settings.", true);
  } finally {
    settingsFile.value = "";
  }
});

document.getElementById("export-emails").addEventListener("click", () => {
  downloadJson("email-copy-addresses.json", {
    format: "email-copy-emails",
    version: 1,
    exportedAt: new Date().toISOString(),
    emails: emails.map(({ id, name, value, color, hidden }) => ({ id, name, value, color, hidden }))
  });
  showMessage("Emails exported.");
});

document.getElementById("import-emails").addEventListener("click", () => {
  if (editingLocked) {
    showMessage("Unlock editing before importing emails.", true);
    return;
  }
  emailsFile.click();
});

let pendingEmailImport = null;
const importDialog = document.getElementById("confirm-import");
emailsFile.addEventListener("change", async () => {
  try {
    const file = emailsFile.files[0];
    if (!file) return;
    const text = await file.text();
    let data;
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
    let sourceEmails;
    if (Array.isArray(data)) {
      sourceEmails = data;
    } else if (data && Array.isArray(data.emails)) {
      sourceEmails = data.emails;
      if (data.format && data.format !== "email-copy-emails") throw new Error("That JSON file is a settings backup, not an email backup.");
      if (data.format === "email-copy-emails" && data.version !== 1) throw new Error("This email backup version is not supported.");
    } else if (data && Array.isArray(data.addresses)) {
      sourceEmails = data.addresses;
    } else if (data && Array.isArray(data.contacts)) {
      sourceEmails = data.contacts;
    } else if (!data) {
      sourceEmails = text.split(/\r?\n/).map(line => line.trim()).filter(Boolean).flatMap(line => {
        const columns = line.split(/[,\t;]/).map(column => column.trim().replace(/^"|"$/g, ""));
        if (columns.every(column => /^(name|email|email address|address)$/i.test(column))) return [];
        const emailColumn = columns.findIndex(column => column.includes("@"));
        if (emailColumn >= 0) return [{ name: columns.slice(0, emailColumn).join(" "), value: columns[emailColumn] }];
        return [{ name: "", value: columns[columns.length - 1] }];
      });
    } else {
      throw new Error("No email list was found. Choose an email backup, JSON list, CSV, or text file.");
    }
    if (!sourceEmails.length) throw new Error("The selected file contains no email addresses.");

    const normalized = sourceEmails.map((email, index) => {
      const value = typeof email === "string" ? email : email?.value ?? email?.address ?? email?.email;
      if (typeof value !== "string") throw new Error(`Email entry ${index + 1} has no address.`);
      return {
        id: index,
        name: typeof email === "object" && email && typeof (email.name ?? email.label) === "string" ? (email.name ?? email.label) : "",
        value,
        color: typeof email === "object" && email && /^#[0-9a-f]{6}$/i.test(email.color) ? email.color.toUpperCase() : appearance.color,
        hidden: typeof email === "object" && email?.hidden === true
      };
    });
    pendingEmailImport = { emails: normalized };
    const noun = normalized.length === 1 ? "address" : "addresses";
    document.getElementById("confirm-import-message").textContent = `This will replace your current email list with ${normalized.length} imported ${noun}.`;
    importDialog.showModal();
  } catch (error) {
    showMessage(error.message || "Could not import emails.", true);
  } finally {
    emailsFile.value = "";
  }
});

document.getElementById("cancel-import").addEventListener("click", () => {
  pendingEmailImport = null;
  importDialog.close();
});
document.getElementById("confirm-import-button").addEventListener("click", () => {
  if (pendingEmailImport && !editingLocked) {
    emails = pendingEmailImport.emails;
    nextId = emails.length;
    persist();
    render();
    showMessage(`${emails.length} email${emails.length === 1 ? "" : "s"} imported.`);
  }
  pendingEmailImport = null;
  importDialog.close();
});
importDialog.addEventListener("close", () => { pendingEmailImport = null; });

chrome.storage.local.get([STORAGE_KEY, THEME_KEY, LOCK_KEY], result => {
  const saved = result[STORAGE_KEY];
  const savedAppearance = result[THEME_KEY];
  editingLocked = result[LOCK_KEY] === true;
  updateLockButton();
  if (savedAppearance && (savedAppearance.mode === "dark" || savedAppearance.mode === "light") && /^#[0-9a-f]{6}$/i.test(savedAppearance.color)) {
    appearance = {
      mode: savedAppearance.mode,
      iconStyle: savedAppearance.iconStyle === "simple" ? "simple" : "exotic",
      color: savedAppearance.color.toUpperCase(),
      textMode: savedAppearance.textMode === "theme" ? "theme" : "basic",
      showHideButtons: savedAppearance.showHideButtons !== false,
      hideNameWithEmail: savedAppearance.hideNameWithEmail === true,
      hideButtonsWhenLocked: savedAppearance.hideButtonsWhenLocked !== false,
      backgroundColor: /^#[0-9a-f]{6}$/i.test(savedAppearance.backgroundColor) ? savedAppearance.backgroundColor.toUpperCase() : null,
      strokeColor: /^#[0-9a-f]{6}$/i.test(savedAppearance.strokeColor) ? savedAppearance.strokeColor.toUpperCase() : "#787880",
      themeButtons: savedAppearance.themeButtons === true,
      sortOrder: ["custom", "name", "email", "newest"].includes(savedAppearance.sortOrder) ? savedAppearance.sortOrder : "custom",
      features: normalizeFeatures(savedAppearance.features)
    };
  }
  if (!appearance.features.editingLock && editingLocked) {
    editingLocked = false;
    chrome.storage.local.set({ [LOCK_KEY]: false });
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
    nextId = Number.isFinite(saved.nextId) ? saved.nextId : Math.max(...emails.map(item => item.id)) + 1;
  } else {
    emails = [{ id: 0, name: "", value: "", color: appearance.color, hidden: false }];
    nextId = 1;
  }
  if (!appearance.features.emailHiding && emails.some(email => email.hidden)) {
    emails.forEach(email => { email.hidden = false; });
    persist();
  }
  render();
});
