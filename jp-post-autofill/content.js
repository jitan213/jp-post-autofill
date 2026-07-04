// ============================================================
// 国際郵便マイページ 住所オートフィル - content.js
// ラベル文字列（名前会社名等・国名・住所…）を手がかりに
// 直後のフォーム要素を見つけて値を入れる
// ============================================================

(() => {
  // ---- ラベル文字列 → その直後にある入力欄を探す ----
  function fieldAfterText(keywords, selector) {
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const visibleFields = Array.from(document.querySelectorAll(selector)).filter(
      f => f.type !== "hidden" && !f.disabled && !f.readOnly
    );
    let node;
    while ((node = walker.nextNode())) {
      const txt = (node.nodeValue || "").trim();
      if (!txt) continue;
      if (keywords.some(k => txt.includes(k))) {
        const anchor = node.parentElement;
        if (!anchor) continue;
        for (const f of visibleFields) {
          const pos = anchor.compareDocumentPosition(f);
          if (pos & Node.DOCUMENT_POSITION_FOLLOWING) return f;
        }
      }
    }
    return null;
  }

  // ---- 値をセットしてイベントを発火（画面側の検証を通すため） ----
  function setValue(el, value) {
    if (!el) return false;
    el.focus();
    el.value = value;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("blur", { bubbles: true }));
    return true;
  }

  // ---- 国名プルダウン: option文字列に国名（英語）を含むものを選ぶ ----
  function selectCountry(sel, countryName) {
    if (!sel || !countryName) return false;
    const target = countryName.toUpperCase().trim();
    const opts = Array.from(sel.options);
    // 完全一致優先（"FRANCE（フランス）" の先頭部分など）
    let hit = opts.find(o => o.textContent.toUpperCase().trim().startsWith(target));
    if (!hit) hit = opts.find(o => o.textContent.toUpperCase().includes(target));
    // "UNITED STATES OF AMERICA" が無ければ "UNITED STATES" で再試行
    if (!hit && target.includes("UNITED STATES")) {
      hit = opts.find(o => o.textContent.toUpperCase().includes("UNITED STATES"));
    }
    if (!hit) return false;
    sel.value = hit.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }

  // ---- 1行30文字制限に合わせて折り返す ----
  function wrapLines(text, maxLen, maxLines) {
    const result = [];
    for (const rawLine of text.split("\n")) {
      let line = rawLine.trim();
      while (line.length > maxLen) {
        // 30文字以内の最後のスペースで折る。無ければ強制で切る
        let cut = line.lastIndexOf(" ", maxLen);
        if (cut <= 0) cut = maxLen;
        result.push(line.slice(0, cut).trim());
        line = line.slice(cut).trim();
      }
      if (line) result.push(line);
    }
    return result.slice(0, maxLines).join("\n");
  }

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg.type !== "FILL_ADDRESS") return;
    const d = msg.data;
    const skipped = [];

    try {
      // 名前・会社名（1行30文字 × 最大3行）
      const nameField = fieldAfterText(["名前会社名", "名前・会社名", "お名前"], "textarea, input[type=text]");
      if (nameField && d.name) setValue(nameField, wrapLines(d.name, 30, 3));
      else if (d.name) skipped.push("名前");

      // 国名プルダウン
      const countrySel = fieldAfterText(["国名"], "select");
      if (countrySel && d.country) {
        if (!selectCountry(countrySel, d.country)) skipped.push("国名(手動で選択してください)");
      } else if (d.country) skipped.push("国名");

      // 住所（1行30文字 × 最大6行）
      const addrField = fieldAfterText(["住所"], "textarea");
      if (addrField && d.address) setValue(addrField, wrapLines(d.address, 30, 6));
      else if (d.address) skipped.push("住所");

      // 州名
      const stateField = fieldAfterText(["州名"], "input[type=text], textarea");
      if (stateField && d.state) setValue(stateField, d.state);
      else if (d.state) skipped.push("州名");

      // 郵便番号
      const postalField = fieldAfterText(["郵便番号"], "input[type=text], input[type=tel]");
      if (postalField && d.postal) setValue(postalField, d.postal);
      else if (d.postal) skipped.push("郵便番号");

      // 電話番号
      const phoneField = fieldAfterText(["電話番号"], "input[type=text], input[type=tel]");
      if (phoneField && d.phone) setValue(phoneField, d.phone);
      else if (d.phone) skipped.push("電話番号");

      sendResponse({ ok: true, skipped });
    } catch (e) {
      sendResponse({ ok: false, error: "入力中にエラー: " + e.message });
    }
    return true;
  });

  // ============================================================
  // Step2 の「次へ」が押されたら、次のStep3で自動処理する印を残す
  // （Step2→Step3はページ遷移するので sessionStorage で受け渡す）
  // ============================================================
  function isStep2() {
    const t = document.body ? document.body.innerText : "";
    return t.includes("お届け先入力");
  }
  function armStep3OnNext() {
    if (!isStep2()) return;
    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button, input[type=button], input[type=submit]");
      if (!el) return;
      const txt = (el.textContent || el.value || "").replace(/\s/g, "");
      if (txt === "次へ") {
        try { sessionStorage.setItem("jpAutoStep3", "1"); } catch (_) {}
      }
    }, true);
  }
  armStep3OnNext();

  // ============================================================
  // Step3 の「次へ」を押した瞬間に、内容品の総重量を計算して
  // sessionStorage に保存する（Step4 の総重量欄に反映するため）
  // ============================================================
  // Step3 に表示されている全ての「1個あたりの重量」と「個数」を DOM 順に
  // 収集し、内容品ごとにペアにして合計を返す
  function calcStep3TotalWeight() {
    const inputs = Array.from(document.querySelectorAll(
      'input[type=text], input[type=number], input[type=tel]'
    )).filter(f => f.offsetParent !== null && !f.disabled && !f.readOnly);

    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    const weightFields = [];
    const qtyFields = [];
    const consumed = new Set();
    let node;

    while ((node = walker.nextNode())) {
      const txt = (node.nodeValue || "").trim();
      if (!txt) continue;
      const isWeight = txt.includes("1個あたりの重量");
      const isQty = txt.includes("個数") && !txt.includes("1個あたりの重量");
      if (!isWeight && !isQty) continue;

      const anchor = node.parentElement;
      if (!anchor) continue;
      for (const f of inputs) {
        if (consumed.has(f)) continue;
        if (anchor.compareDocumentPosition(f) & Node.DOCUMENT_POSITION_FOLLOWING) {
          consumed.add(f);
          if (isWeight) weightFields.push(f);
          else qtyFields.push(f);
          break;
        }
      }
    }

    let total = 0;
    for (let i = 0; i < weightFields.length; i++) {
      const w = parseFloat(weightFields[i].value);
      if (isNaN(w) || w <= 0) continue;
      let q = 1;
      if (i < qtyFields.length) {
        const qq = parseInt(qtyFields[i].value, 10);
        if (!isNaN(qq) && qq > 0) q = qq;
      }
      total += w * q;
    }
    return total > 0 ? Math.round(total) : null;
  }

  function armStep4OnNext() {
    if (!isStep3()) return;
    if (window.__jpAutoStep4Armed) return;
    window.__jpAutoStep4Armed = true;
    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button, input[type=button], input[type=submit]");
      if (!el) return;
      const txt = (el.textContent || el.value || "").replace(/\s/g, "");
      if (txt === "次へ") {
        const w = calcStep3TotalWeight();
        if (w) {
          try { sessionStorage.setItem("jpAutoStep4Weight", String(w)); } catch (_) {}
        }
      }
    }, true);
  }

  // ============================================================
  // Step3（発送種別と内容品）自動処理
  //  - 内容品1トグルが閉じていたら開く
  //  - 個数が空なら 1 をセット
  //  - 「危険物に関しての確認」チェックが未チェックなら ON
  // 名称・価格などは触りません。
  // ============================================================

  // このページがStep3（内容品登録）かどうか
  function isStep3() {
    const t = document.body ? document.body.innerText : "";
    return t.includes("内容品登録") || t.includes("危険物に関しての確認");
  }

  // チェックボックスを確実にONにする
  function checkBox(el) {
    if (!el || el.checked) return false;
    el.checked = true;
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    el.dispatchEvent(new Event("click", { bubbles: true }));
    return true;
  }

  // 「危険物に関しての確認」チェックボックスを探してON
  function fillDangerCheck() {
    // ラベル文字の近くにあるチェックボックスを優先
    const boxes = Array.from(document.querySelectorAll('input[type="checkbox"]'))
      .filter(b => b.offsetParent !== null && !b.disabled);
    if (boxes.length === 0) return false;

    // 「危険物」テキストを含む見出しの近傍のチェックボックスを探す
    const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
    let node, dangerAnchor = null;
    while ((node = walker.nextNode())) {
      if ((node.nodeValue || "").includes("危険物に関しての確認")) {
        dangerAnchor = node.parentElement;
        break;
      }
    }
    if (dangerAnchor) {
      // アンカーと同じセクション内のチェックボックスを優先的に選ぶ
      let scope = dangerAnchor.closest("div, section, form, td, tr") || document.body;
      const scoped = Array.from(scope.querySelectorAll('input[type="checkbox"]'))
        .filter(b => b.offsetParent !== null && !b.disabled);
      if (scoped.length) return checkBox(scoped[0]);
    }
    // 見つからなければ最後の手段として最初のチェックボックス
    return checkBox(boxes[0]);
  }

  // 個数欄（空なら1）
  function fillQuantity() {
    const q = fieldAfterText(["個数"], "input[type=text], input[type=number], input[type=tel]");
    if (q && (!q.value || q.value.trim() === "" || q.value.trim() === "0")) {
      setValue(q, "1");
      return true;
    }
    return false;
  }

  // 内容品1トグルが閉じていたら開く
  function openContentToggle() {
    // 「内容品 1」の見出し要素を探す
    const headers = Array.from(document.querySelectorAll("*")).filter(el => {
      const tx = (el.textContent || "").trim();
      return /^内容品\s*1/.test(tx) && el.children.length <= 3;
    });
    for (const h of headers) {
      // すでに中身（名称欄など）が見えていれば開いているとみなす
      const alreadyOpen = fieldAfterText(["名称"], "input[type=text]");
      if (alreadyOpen && alreadyOpen.offsetParent !== null) return false;
      // クリックできそうな要素をクリック
      const clickable = h.closest("a, button, [role='button'], div") || h;
      clickable.click();
      return true;
    }
    return false;
  }

  let step3Done = false;
  let airPacketDone = false;

  // 「国際エアパケット」を選択する
  function selectAirPacket() {
    if (airPacketDone) return false;
    // 「国際エアパケット」ラベルを含む、クリック可能な発送種別ボタンを探す
    const cands = Array.from(document.querySelectorAll("a, button, li, div, label, span, img[alt]"))
      .filter(el => {
        const txt = (el.textContent || "").replace(/\s/g, "");
        const alt = (el.getAttribute && (el.getAttribute("alt") || "")) || "";
        return (txt.includes("国際エアパケット") || alt.includes("国際エアパケット")) &&
               el.offsetParent !== null;
      });
    if (cands.length === 0) return false;
    // 一番内側（テキスト量が最小 = ラベルそのもの）に近い要素をクリック
    cands.sort((a, b) => (a.textContent || "").length - (b.textContent || "").length);
    const target = cands[0];
    const clickable = target.closest("a, button, [role='button'], li, div") || target;
    clickable.click();
    airPacketDone = true;
    return true;
  }

  // 発送種別を選ぶ段階かどうかは①方式では使わないため判定省略

  // よく使う品名のクイックボタンを名称欄の近くに置く
  const QUICK_NAMES = ["camera w/o battery", "Trading card"];
  function addQuickNameButtons() {
    if (document.getElementById("jp-quick-names")) return; // 二重設置防止
    const nameField = fieldAfterText(["名称"], "input[type=text]");
    if (!nameField || nameField.offsetParent === null) return;

    const bar = document.createElement("div");
    bar.id = "jp-quick-names";
    bar.style.cssText = "display:flex;gap:6px;flex-wrap:wrap;margin:4px 0 8px;";
    QUICK_NAMES.forEach(name => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = name;
      b.style.cssText =
        "padding:6px 12px;font-size:13px;border:1px solid #b71c1c;color:#b71c1c;" +
        "background:#fff;border-radius:4px;cursor:pointer;font-family:inherit;";
      b.addEventListener("mouseenter", () => { b.style.background = "#b71c1c"; b.style.color = "#fff"; });
      b.addEventListener("mouseleave", () => { b.style.background = "#fff"; b.style.color = "#b71c1c"; });
      b.addEventListener("click", (e) => {
        e.preventDefault();
        // その時点の名称欄を取得（DOM入れ替え対策で毎回探す）
        const nf = fieldAfterText(["名称"], "input[type=text]") || nameField;
        setValue(nf, name);
      });
      bar.appendChild(b);
    });
    // 名称欄の直前（同じ親の中で input の前）に差し込む
    nameField.insertAdjacentElement("beforebegin", bar);
  }

  function cameFromStep2() {
    try { return sessionStorage.getItem("jpAutoStep3") === "1"; } catch (_) { return false; }
  }

  function runStep3() {
    if (!isStep3()) return;

    // 品名クイックボタンは常に表示（Step2経由でなくても出す）
    addQuickNameButtons();
    // Step3 の「次へ」で総重量を保存する仕込みを常時セット
    armStep4OnNext();

    // 自動入力（エアパケ選択・個数・危険物）は Step2 の「次へ」から来た時だけ発動
    if (!cameFromStep2()) return;
    if (step3Done) return;

    selectAirPacket();       // 国際エアパケットを自動選択
    openContentToggle();     // 内容品1を開く
    // 描画が遅れることがあるので数回リトライ
    let tries = 0;
    const iv = setInterval(() => {
      addQuickNameButtons();
      const q = fillQuantity();
      const d = fillDangerCheck();
      const dangerOn = !!document.querySelector('input[type="checkbox"]:checked');
      tries++;
      const qtyOk = q || ((fieldAfterText(["個数"], "input[type=text], input[type=number], input[type=tel]") || {}).value);
      if ((d || dangerOn) && qtyOk) {
        step3Done = true;
        try { sessionStorage.removeItem("jpAutoStep3"); } catch (_) {} // 使い切ったら消す
        clearInterval(iv);
      }
      if (tries >= 8) { clearInterval(iv); } // 最大約2.4秒
    }, 300);
    // 「次へ」は自動で押しません（名称・価格は手入力のため）
  }

  // ============================================================
  // Step4（発送関連情報入力）自動処理
  //  - Step3 で保存した総重量を「総重量 (g)」欄に流し込む
  //  - 既に値が入っていれば触らない（ユーザーが編集済みなら尊重）
  // ============================================================
  function isStep4() {
    const t = document.body ? document.body.innerText : "";
    return t.includes("発送関連情報入力") || t.includes("総重量");
  }

  let step4Done = false;

  function runStep4() {
    if (!isStep4()) return;
    if (step4Done) return;

    let saved = null;
    try { saved = sessionStorage.getItem("jpAutoStep4Weight"); } catch (_) {}
    if (!saved) return;

    const target = fieldAfterText(["総重量"], "input[type=text], input[type=number], input[type=tel]");
    if (!target || target.offsetParent === null) return;

    const cur = (target.value || "").trim();
    if (cur !== "" && cur !== "0") {
      // 既に値がある場合はフラグだけ落として何もしない
      step4Done = true;
      try { sessionStorage.removeItem("jpAutoStep4Weight"); } catch (_) {}
      return;
    }
    setValue(target, saved);
    step4Done = true;
    try { sessionStorage.removeItem("jpAutoStep4Weight"); } catch (_) {}
  }

  function runAll() {
    runStep3();
    runStep4();
  }

  // 初回＋DOM変化を監視（SPA的な画面切替に対応）
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runAll);
  } else {
    runAll();
  }
  const observer = new MutationObserver(() => {
    // Step3/Step4から離れたらフラグをリセット
    if (!isStep3()) { step3Done = false; }
    if (!isStep4()) { step4Done = false; }
    runAll();
  });
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
  }
})();
