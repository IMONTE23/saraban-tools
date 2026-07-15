// background.js — Saraban Tools (auto relay only)

chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
  // Forward progress / done / error messages from content → popup
  if (['progress', 'done', 'error'].includes(msg.action)) {
    chrome.runtime.sendMessage(msg).catch(() => {});
    sendResponse({ ok: true });
    return true;
  }
  return false;
});
