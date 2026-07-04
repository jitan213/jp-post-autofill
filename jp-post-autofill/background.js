// ============================================================
// background.js — 定期アップデートチェック
// 新版があれば拡張アイコンに赤バッジ「新」を表示する
// （Lemurがservice worker非対応でも本体機能には影響しません）
// ============================================================

const PRESETS = ["http://100.93.41.106:3999", "http://localhost:3999"];

function cmpVer(a, b) {
  const pa = a.split(".").map(Number), pb = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return 1;
    if ((pa[i] || 0) < (pb[i] || 0)) return -1;
  }
  return 0;
}

async function ping(url) {
  try {
    const r = await fetch(`${url}/version.json?t=${Date.now()}`, { cache: "no-store" });
    if (!r.ok) return null;
    return await r.json();
  } catch (e) { return null; }
}

async function checkAndBadge() {
  const stored = await chrome.storage.local.get(["serverUrl"]);
  const candidates = [...new Set([stored.serverUrl, ...PRESETS].filter(Boolean))];
  const current = chrome.runtime.getManifest().version;
  for (const url of candidates) {
    const info = await ping(url.replace(/\/+$/, ""));
    if (info && info.version) {
      if (cmpVer(info.version, current) > 0) {
        chrome.action.setBadgeText({ text: "新" });
        chrome.action.setBadgeBackgroundColor({ color: "#b71c1c" });
      } else {
        chrome.action.setBadgeText({ text: "" });
      }
      return;
    }
  }
  // サーバー不達時はバッジを触らない（オフラインで消えないように空にする）
  chrome.action.setBadgeText({ text: "" });
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.alarms.create("updateCheck", { periodInMinutes: 360 });
  checkAndBadge();
});
chrome.runtime.onStartup.addListener(checkAndBadge);
chrome.alarms.onAlarm.addListener((a) => {
  if (a.name === "updateCheck") checkAndBadge();
});
