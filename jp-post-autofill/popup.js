// ============================================================
// 国際郵便マイページ 住所オートフィル - popup.js
// 貼り付けた住所ブロックを解析し、content.js に送信する
// ============================================================

const $ = (id) => document.getElementById(id);

// ---- 国名リスト（判定用・英語大文字） ----
const COUNTRIES = [
  "UNITED STATES", "USA", "U.S.A", "UNITED STATES OF AMERICA",
  "UNITED KINGDOM", "GREAT BRITAIN", "ENGLAND", "SCOTLAND", "WALES", "NORTHERN IRELAND",
  "FRANCE", "GERMANY", "ITALY", "SPAIN", "PORTUGAL", "NETHERLANDS", "BELGIUM",
  "LUXEMBOURG", "SWITZERLAND", "AUSTRIA", "IRELAND", "DENMARK", "SWEDEN", "NORWAY",
  "FINLAND", "ICELAND", "POLAND", "CZECH REPUBLIC", "CZECHIA", "SLOVAKIA", "HUNGARY",
  "ROMANIA", "BULGARIA", "GREECE", "CROATIA", "SLOVENIA", "ESTONIA", "LATVIA",
  "LITHUANIA", "MALTA", "CYPRUS", "CANADA", "MEXICO", "BRAZIL", "ARGENTINA", "CHILE",
  "COLOMBIA", "PERU", "AUSTRALIA", "NEW ZEALAND", "SINGAPORE", "MALAYSIA", "THAILAND",
  "PHILIPPINES", "INDONESIA", "VIETNAM", "INDIA", "SOUTH KOREA", "KOREA", "TAIWAN",
  "HONG KONG", "CHINA", "ISRAEL", "TURKEY", "UNITED ARAB EMIRATES", "SAUDI ARABIA",
  "QATAR", "KUWAIT", "SOUTH AFRICA", "EGYPT", "MOROCCO", "UKRAINE", "SERBIA",
  "JAPAN", "MONACO", "ANDORRA", "LIECHTENSTEIN"
];

// マイページのプルダウン表記に合わせた正規化（別名 → 正式名）
const COUNTRY_ALIAS = {
  "USA": "UNITED STATES OF AMERICA",
  "U.S.A": "UNITED STATES OF AMERICA",
  "UNITED STATES": "UNITED STATES OF AMERICA",
  "UK": "UNITED KINGDOM",
  "ENGLAND": "UNITED KINGDOM",
  "SCOTLAND": "UNITED KINGDOM",
  "WALES": "UNITED KINGDOM",
  "NORTHERN IRELAND": "UNITED KINGDOM",
  "GREAT BRITAIN": "UNITED KINGDOM",
  "SOUTH KOREA": "KOREA",
  "CZECHIA": "CZECH REPUBLIC"
};

// 米国州の略称（州名欄の抽出に使用）
const US_STATES = new Set([
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA","HI","ID","IL","IN","IA","KS",
  "KY","LA","ME","MD","MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ","NM","NY",
  "NC","ND","OH","OK","OR","PA","RI","SC","SD","TN","TX","UT","VT","VA","WA","WV",
  "WI","WY","DC","PR","GU","VI","AA","AE","AP"
]);
const CA_PROVINCES = new Set(["AB","BC","MB","NB","NL","NS","NT","NU","ON","PE","QC","SK","YT"]);
const AU_STATES = new Set(["NSW","VIC","QLD","WA","SA","TAS","ACT","NT"]);

// ============================================================
// 州名が住所に書かれていない時のフォールバック用テーブル
// ============================================================

// フランス県: 郵便番号の先頭2桁 → 県名（アクセント記号なしで統一）
const FR_DEPT = {
  "01":"Ain","02":"Aisne","03":"Allier","04":"Alpes-de-Haute-Provence",
  "05":"Hautes-Alpes","06":"Alpes-Maritimes","07":"Ardeche","08":"Ardennes",
  "09":"Ariege","10":"Aube","11":"Aude","12":"Aveyron","13":"Bouches-du-Rhone",
  "14":"Calvados","15":"Cantal","16":"Charente","17":"Charente-Maritime",
  "18":"Cher","19":"Correze","21":"Cote-d'Or","22":"Cotes-d'Armor",
  "23":"Creuse","24":"Dordogne","25":"Doubs","26":"Drome","27":"Eure",
  "28":"Eure-et-Loir","29":"Finistere","30":"Gard","31":"Haute-Garonne",
  "32":"Gers","33":"Gironde","34":"Herault","35":"Ille-et-Vilaine",
  "36":"Indre","37":"Indre-et-Loire","38":"Isere","39":"Jura","40":"Landes",
  "41":"Loir-et-Cher","42":"Loire","43":"Haute-Loire","44":"Loire-Atlantique",
  "45":"Loiret","46":"Lot","47":"Lot-et-Garonne","48":"Lozere","49":"Maine-et-Loire",
  "50":"Manche","51":"Marne","52":"Haute-Marne","53":"Mayenne","54":"Meurthe-et-Moselle",
  "55":"Meuse","56":"Morbihan","57":"Moselle","58":"Nievre","59":"Nord",
  "60":"Oise","61":"Orne","62":"Pas-de-Calais","63":"Puy-de-Dome","64":"Pyrenees-Atlantiques",
  "65":"Hautes-Pyrenees","66":"Pyrenees-Orientales","67":"Bas-Rhin","68":"Haut-Rhin",
  "69":"Rhone","70":"Haute-Saone","71":"Saone-et-Loire","72":"Sarthe","73":"Savoie",
  "74":"Haute-Savoie","75":"Paris","76":"Seine-Maritime","77":"Seine-et-Marne",
  "78":"Yvelines","79":"Deux-Sevres","80":"Somme","81":"Tarn","82":"Tarn-et-Garonne",
  "83":"Var","84":"Vaucluse","85":"Vendee","86":"Vienne","87":"Haute-Vienne",
  "88":"Vosges","89":"Yonne","90":"Territoire de Belfort","91":"Essonne",
  "92":"Hauts-de-Seine","93":"Seine-Saint-Denis","94":"Val-de-Marne","95":"Val-d'Oise"
};
// フランス海外県（3桁）
const FR_OVERSEAS = {
  "971":"Guadeloupe","972":"Martinique","973":"Guyane",
  "974":"La Reunion","976":"Mayotte"
};

// カナダ: 郵便番号の先頭アルファベット → 州略称
const CA_POSTAL_TO_PROV = {
  "A":"NL","B":"NS","C":"PE","E":"NB",
  "G":"QC","H":"QC","J":"QC",
  "K":"ON","L":"ON","M":"ON","N":"ON","P":"ON",
  "R":"MB","S":"SK","T":"AB","V":"BC",
  "X":"NT","Y":"YT"
};

// 米国: ZIPの先頭3桁レンジ → 州略称
// 参考: USPS SCF 表。網羅的だが最頻レンジをカバー。
const US_ZIP_RANGES = [
  [ 5,  5,"NY"],[10, 27,"MA"],[28, 29,"RI"],[30, 38,"NH"],[39, 49,"ME"],
  [50, 59,"VT"],[60, 69,"CT"],[70, 89,"NJ"],[90, 98,"AE"],
  [100,119,"NY"],[120,149,"NY"],[150,196,"PA"],[197,199,"DE"],
  [200,205,"DC"],[206,219,"MD"],[220,246,"VA"],[247,268,"WV"],
  [270,289,"NC"],[290,299,"SC"],[300,319,"GA"],[320,349,"FL"],
  [340,344,"AA"],[350,369,"AL"],[370,385,"TN"],[386,397,"MS"],[398,399,"GA"],
  [400,427,"KY"],[430,459,"OH"],[460,479,"IN"],[480,499,"MI"],
  [500,528,"IA"],[530,549,"WI"],[550,567,"MN"],[570,577,"SD"],
  [580,588,"ND"],[590,599,"MT"],[600,629,"IL"],[630,658,"MO"],
  [660,679,"KS"],[680,693,"NE"],[700,714,"LA"],[716,729,"AR"],
  [730,749,"OK"],[750,799,"TX"],[800,816,"CO"],[820,831,"WY"],
  [832,838,"ID"],[840,847,"UT"],[850,865,"AZ"],[870,884,"NM"],
  [889,898,"NV"],[900,961,"CA"],[962,966,"AP"],[967,968,"HI"],
  [970,979,"OR"],[980,994,"WA"],[995,999,"AK"]
];

// オーストラリア: postcode → state
const AU_POSTCODE_RANGES = [
  [800, 899,"NT"],[900, 999,"NT"],
  [1000,1999,"NSW"],[2000,2599,"NSW"],[2600,2618,"ACT"],[2619,2899,"NSW"],
  [2900,2920,"ACT"],[2921,2999,"NSW"],[3000,3999,"VIC"],[4000,4999,"QLD"],
  [5000,5999,"SA"],[6000,6999,"WA"],[7000,7999,"TAS"]
];

// ---- 郵便番号 → 州名の推定（住所に州が無い場合の補完） ----
function predictStateFromPostal(country, postal) {
  if (!postal || !country) return "";
  const c = country.toUpperCase();
  const p = postal.replace(/\s/g, "").toUpperCase();

  if (c.includes("FRANCE")) {
    if (/^\d{5}$/.test(p)) {
      const two = p.slice(0, 2);
      if (two === "20") {
        const n = parseInt(p, 10);
        return (n >= 20000 && n <= 20190) ? "Corse-du-Sud" : "Haute-Corse";
      }
      const three = p.slice(0, 3);
      return FR_OVERSEAS[three] || FR_DEPT[two] || "";
    }
    return "";
  }

  if (c.includes("CANADA")) {
    const first = p.charAt(0);
    return CA_POSTAL_TO_PROV[first] || "";
  }

  if (c.includes("UNITED STATES")) {
    const m = p.match(/^(\d{3})/);
    if (!m) return "";
    const prefix = parseInt(m[1], 10);
    for (const [s, e, st] of US_ZIP_RANGES) {
      if (prefix >= s && prefix <= e) return st;
    }
    return "";
  }

  if (c.includes("AUSTRALIA")) {
    const m = p.match(/^(\d{3,4})/);
    if (!m) return "";
    const n = parseInt(m[1], 10);
    for (const [s, e, st] of AU_POSTCODE_RANGES) {
      if (n >= s && n <= e) return st;
    }
    return "";
  }

  return "";
}

// ---- 郵便番号パターン（国別） ----
function postalPatterns(countryUpper) {
  const c = countryUpper;
  if (c.includes("UNITED KINGDOM")) return [/\b[A-Z]{1,2}\d[A-Z\d]?\s?\d[A-Z]{2}\b/i];
  if (c.includes("CANADA")) return [/\b[A-Z]\d[A-Z]\s?\d[A-Z]\d\b/i];
  if (c.includes("UNITED STATES")) return [/\b\d{5}(?:-\d{4})?\b/];
  if (c.includes("NETHERLANDS")) return [/\b\d{4}\s?[A-Z]{2}\b/];
  if (c.includes("POLAND")) return [/\b\d{2}-\d{3}\b/];
  if (c.includes("BRAZIL")) return [/\b\d{5}-?\d{3}\b/];
  if (c.includes("PORTUGAL")) return [/\b\d{4}-\d{3}\b/];
  if (c.includes("JAPAN")) return [/\b\d{3}-?\d{4}\b/];
  if (c.includes("KOREA")) return [/\b\d{5}\b/];
  if (c.includes("AUSTRALIA") || c.includes("NEW ZEALAND") || c.includes("SWITZERLAND") ||
      c.includes("AUSTRIA") || c.includes("BELGIUM") || c.includes("DENMARK") ||
      c.includes("NORWAY") || c.includes("LUXEMBOURG") || c.includes("HUNGARY")) return [/\b\d{4}\b/];
  // フランス・ドイツ・イタリア・スペインなど5桁圏 + 汎用
  return [/\b\d{5}\b/, /\b\d{4,7}\b/];
}

// ---- 電話番号らしい行か ----
function isPhoneLine(line) {
  const digits = (line.match(/\d/g) || []).length;
  return digits >= 7 && /^[+＋]?[\d\s\-().]+$/.test(line.trim());
}

// ---- メイン解析 ----
function parseAddress(text) {
  const out = { name: "", address: "", state: "", postal: "", country: "", phone: "" };
  let lines = text.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  if (lines.length === 0) return out;

  // 1) 電話番号（どの行にあっても拾う）
  const phoneIdx = lines.findIndex(isPhoneLine);
  if (phoneIdx !== -1) {
    out.phone = lines[phoneIdx].replace(/＋/g, "+");
    lines.splice(phoneIdx, 1);
  }

  // 2) 国名（末尾側から国名リストに一致する行を探す）
  let countryIdx = -1;
  for (let i = lines.length - 1; i >= 0; i--) {
    const up = lines[i].toUpperCase().replace(/\./g, "").trim();
    const hit = COUNTRIES.find(c => up === c || up === c.replace(/\./g, ""));
    if (hit) { countryIdx = i; out.country = COUNTRY_ALIAS[hit] || hit; break; }
  }
  if (countryIdx === -1 && lines.length >= 3) {
    // リストに無い国でも、最終行が英字のみなら国名とみなす
    const last = lines[lines.length - 1];
    if (/^[A-Za-z .'()-]+$/.test(last)) {
      countryIdx = lines.length - 1;
      out.country = last.toUpperCase();
    }
  }
  if (countryIdx !== -1) lines.splice(countryIdx, 1);

  // 3) 名前 = 先頭行
  out.name = lines.shift() || "";

  // 4) 郵便番号・州名を残りの行から抽出
  const patterns = postalPatterns(out.country);
  for (let i = lines.length - 1; i >= 0 && !out.postal; i--) {
    for (const p of patterns) {
      const m = lines[i].match(p);
      if (m) {
        out.postal = m[0].toUpperCase();
        lines[i] = lines[i].replace(m[0], "").replace(/\s{2,}/g, " ").replace(/[,、]\s*$/, "").trim();
        break;
      }
    }
  }

  // 州名（US/CA/AU）: 行内の2〜3文字の略称トークンを探す
  const stateSets =
    out.country.includes("UNITED STATES") ? US_STATES :
    out.country.includes("CANADA") ? CA_PROVINCES :
    out.country.includes("AUSTRALIA") ? AU_STATES : null;
  if (stateSets) {
    for (let i = lines.length - 1; i >= 0 && !out.state; i--) {
      const tokens = lines[i].split(/[\s,]+/);
      for (let t = tokens.length - 1; t >= 0; t--) {
        const tok = tokens[t].toUpperCase().replace(/[.,]/g, "");
        if (stateSets.has(tok)) {
          out.state = tok;
          tokens.splice(t, 1);
          lines[i] = tokens.join(" ").replace(/\s{2,}/g, " ").replace(/[,、]\s*$/, "").trim();
          break;
        }
      }
    }
  }

  // 州名がまだ空なら、郵便番号から推定して埋める
  // （フランスは県、カナダは郵便番号先頭文字、米国はZIP、豪州はpostcodeから）
  if (!out.state) {
    out.state = predictStateFromPostal(out.country, out.postal);
  }

  // 5) 残り全部が住所
  out.address = lines.filter(Boolean).join("\n");
  return out;
}

// ---- 貼り付け → 自動振り分け ----
$("raw").addEventListener("input", () => {
  const parsed = parseAddress($("raw").value);
  $("name").value = parsed.name;
  $("addr").value = parsed.address;
  $("state").value = parsed.state;
  $("postal").value = parsed.postal;
  $("country").value = parsed.country;
  $("phone").value = parsed.phone;
  setStatus("", "");
});

function setStatus(msg, cls) {
  const el = $("status");
  el.textContent = msg;
  el.className = cls;
}

// ---- フォームに入力 ----
$("fill").addEventListener("click", async () => {
  const data = {
    name: $("name").value.trim(),
    address: $("addr").value.trim(),
    state: $("state").value.trim(),
    postal: $("postal").value.trim(),
    country: $("country").value.trim(),
    phone: $("phone").value.trim()
  };
  if (!data.name && !data.address) {
    setStatus("先に住所を貼り付けてください", "err");
    return;
  }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) {
      setStatus("タブが取得できません。ページをリロードして再実行してください", "err");
      return;
    }
    // tab.url が取れる時だけドメインチェック（Lemur等はURLを返さないことがある）
    if (tab.url && !/int-mypage\.post\.japanpost\.jp/.test(tab.url)) {
      setStatus("国際郵便マイページのお届け先入力画面を開いてから実行してください", "err");
      return;
    }
    const res = await chrome.tabs.sendMessage(tab.id, { type: "FILL_ADDRESS", data });
    if (res && res.ok) {
      const skipped = res.skipped && res.skipped.length ? `（未入力: ${res.skipped.join("・")}）` : "";
      setStatus(`入力しました ${skipped}`, "ok");
    } else {
      setStatus(res && res.error ? res.error : "入力に失敗しました", "err");
    }
  } catch (e) {
    setStatus("ページと通信できません。ページを一度リロードしてから再実行してください", "err");
  }
});

// ============================================================
// アップデート確認（ウルスタHelperと同じ方式）
// サーバーの /ext/jp-post/version.json を見て新版があれば
// 「最新版をダウンロード」ボタンを表示する
// ============================================================

const PRESET_LOCAL = "http://localhost:3999";
const PRESET_TAIL = "http://100.93.41.106:3999";
// 出先でも使えるように常に試す公開URL（raw.githubusercontent.com は redirect が無いので
// Lemur含め全ブラウザで安定してDLできる）
const PRESET_GITHUB = "https://raw.githubusercontent.com/jitan213/jp-post-autofill/main/jp-post-server";

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

// サーバー自動検出: 保存済みURL → Tailscale → localhost の順に探す
// ヒットしたら「最新版をダウンロード」リンクの href を直接zipに向ける
async function autoDetect() {
  const verEl = $("verStatus");
  const dlLink = $("download");
  dlLink.style.display = "none";
  dlLink.removeAttribute("href");
  dlLink.removeAttribute("download");
  const current = chrome.runtime.getManifest().version;
  verEl.textContent = "サーバーを探しています...";

  const stored = await chrome.storage.local.get(["serverUrl"]);
  // 家: Tailscale/localhost（Macのjp-post-serverが起動時）
  // 出先: GitHub Releases（常時公開・認証不要）
  const candidates = [...new Set(
    [$("serverUrl").value.trim(), stored.serverUrl, PRESET_TAIL, PRESET_LOCAL, PRESET_GITHUB]
      .filter(Boolean).map(u => u.replace(/\/+$/, ""))
  )];

  for (const url of candidates) {
    const info = await ping(url);
    if (!info || !info.version) continue;

    // 見つかったサーバーを自動保存（次回以降・再インストール後もゼロ設定）
    $("serverUrl").value = url;
    await chrome.storage.local.set({ serverUrl: url });

    if (cmpVer(info.version, current) > 0) {
      verEl.innerHTML =
        `<span style="color:#b71c1c;font-weight:700;">新しい版 ${info.version} があります</span><br>` +
        `<span style="color:#8a8378;">現在 ${current} / サーバー ${url}</span>`;
      // <a href> でブラウザ側のダウンロード機構を使う（Lemur等でも確実）
      const zipUrl = `${url}/${info.zip || "jp-post-autofill.zip"}?t=${Date.now()}`;
      dlLink.href = zipUrl;
      dlLink.setAttribute("download", info.zip || "jp-post-autofill.zip");
      dlLink.style.display = "block";
      dlLink.style.background = "#0d47a1";
      dlLink.style.color = "#fff";
      dlLink.style.padding = "11px";
      dlLink.style.borderRadius = "4px";
      dlLink.style.fontWeight = "700";
      dlLink.style.fontSize = "14px";
      dlLink.style.marginTop = "10px";
      dlLink.textContent = `⬇ 最新版 ${info.version} をダウンロード`;
    } else {
      verEl.innerHTML =
        `<span style="color:#1b6e2a;">✓ 最新版です（${current}）</span>`;
      try { chrome.action.setBadgeText({ text: "" }); } catch (e) {}
    }
    return;
  }
  verEl.innerHTML =
    `現在のバージョン: ${current}<br>` +
    `<span style="color:#b71c1c;">サーバー未接続</span>` +
    `<br><span style="font-size:11px;">Macで jp-post-server を起動してから再確認してください</span>`;
}

async function initSettings() {
  const stored = await chrome.storage.local.get(["serverUrl"]);
  $("serverUrl").value = stored.serverUrl || PRESET_TAIL;
  autoDetect();
}

$("presetLocal").addEventListener("click", () => { $("serverUrl").value = PRESET_LOCAL; autoDetect(); });
$("presetTail").addEventListener("click", () => { $("serverUrl").value = PRESET_TAIL; autoDetect(); });
$("presetGithub").addEventListener("click", () => { $("serverUrl").value = PRESET_GITHUB; autoDetect(); });
$("recheck").addEventListener("click", autoDetect);
$("saveServer").addEventListener("click", async () => {
  await chrome.storage.local.set({ serverUrl: $("serverUrl").value.trim() });
  autoDetect();
});

initSettings();
