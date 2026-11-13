const THEME_KEY = "appearanceSettings";

function applyToolbarIcon(style = "exotic") {
  const prefix = style === "simple" ? "simple" : "exotic";
  chrome.action.setIcon({
    path: {
      16: `icons/${prefix}-16.png`,
      32: `icons/${prefix}-32.png`
    }
  });
}

function loadToolbarIcon() {
  chrome.storage.local.get(THEME_KEY, result => {
    applyToolbarIcon(result[THEME_KEY]?.iconStyle);
  });
}

chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== "local" || !changes[THEME_KEY]) return;
  applyToolbarIcon(changes[THEME_KEY].newValue?.iconStyle);
});

chrome.runtime.onInstalled.addListener(loadToolbarIcon);
chrome.runtime.onStartup.addListener(loadToolbarIcon);
loadToolbarIcon();
