// ============================================================
// 拡張配信用ミニサーバー（ウルスタとは完全に独立）
// このフォルダにある version.json と jp-post-autofill.zip を
// http://localhost:3999 / http://<TailscaleのIP>:3999 で配信します。
// 依存パッケージなし。起動: node server.js
// アプデ確認・ダウンロードの時だけ動いていればOKです。
// ============================================================

const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = 3999;
const DIR = __dirname;

const TYPES = {
  ".json": "application/json; charset=utf-8",
  ".zip": "application/zip",
  ".txt": "text/plain; charset=utf-8",
  ".md": "text/plain; charset=utf-8"
};

const server = http.createServer((req, res) => {
  // CORS（拡張ポップアップからのfetchを許可）
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");

  let name = decodeURIComponent((req.url || "/").split("?")[0]);

  // ルート = 配布ページ（バージョン表示 + ダウンロードボタン）
  if (name === "/" || name === "/index.html") {
    let ver = "?";
    try { ver = JSON.parse(fs.readFileSync(path.join(DIR, "version.json"), "utf8")).version; } catch (e) {}
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(`<!DOCTYPE html>
<html lang="ja"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>住所オートフィル 配布ページ</title>
<style>
  body{font-family:"Hiragino Kaku Gothic ProN","Yu Gothic",Meiryo,sans-serif;background:#faf8f5;color:#1c1c1c;margin:0;padding:24px 16px;line-height:1.7}
  .card{max-width:520px;margin:0 auto;background:#fff;border:1px solid #d9d4cc;border-radius:8px;padding:20px}
  h1{font-size:18px;background:#b71c1c;color:#fff;margin:-20px -20px 16px;padding:14px 20px;border-radius:8px 8px 0 0}
  .ver{font-size:14px;color:#1b6e2a;font-weight:700;margin-bottom:16px}
  a.dl{display:block;text-align:center;background:#b71c1c;color:#fff;text-decoration:none;font-weight:700;font-size:16px;padding:14px;border-radius:6px;margin-bottom:20px}
  h2{font-size:14px;border-left:4px solid #b71c1c;padding-left:8px;margin:20px 0 8px}
  ol{padding-left:20px;margin:0;font-size:13px}
  li{margin-bottom:6px}
  code{background:#f0ece5;padding:1px 5px;border-radius:3px;font-size:12px}
</style></head><body>
<div class="card">
<h1>国際郵便マイページ 住所オートフィル</h1>
<div class="ver">✓ 最新バージョン: ${ver}</div>
<a class="dl" href="/jp-post-autofill.zip">最新版をダウンロード (zip)</a>
<h2>Fold6（Lemur Browser）</h2>
<ol>
<li>上のボタンで zip をダウンロード</li>
<li>Lemurメニュー →「拡張機能」→ デベロッパーモードON</li>
<li>「+(from .zip)」→ ダウンロードした zip を選択</li>
<li>すでに旧版が入っている場合は先に削除してから読み込む</li>
</ol>
<h2>Mac（Chrome）</h2>
<ol>
<li>zip をダウンロードして解凍</li>
<li><code>chrome://extensions</code> → デベロッパーモードON</li>
<li>「パッケージ化されていない拡張機能を読み込む」→ 解凍したフォルダを選択</li>
</ol>
</div></body></html>`);
    return;
  }

  // ディレクトリトラバーサル防止: ファイル名のみ許可
  name = path.basename(name);
  const file = path.join(DIR, name);

  if (!fs.existsSync(file) || !fs.statSync(file).isFile()) {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("not found: " + name);
    return;
  }
  const ext = path.extname(file).toLowerCase();
  res.writeHead(200, {
    "Content-Type": TYPES[ext] || "application/octet-stream",
    "Content-Disposition": ext === ".zip" ? `attachment; filename="${name}"` : "inline"
  });
  fs.createReadStream(file).pipe(res);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("配信サーバー起動中:");
  console.log(`  Mac本体:      http://localhost:${PORT}`);
  console.log(`  Fold6(Tailscale): http://100.93.41.106:${PORT}`);
  console.log("止めるには Ctrl + C");
});
