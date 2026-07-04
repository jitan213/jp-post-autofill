#!/bin/bash
# ============================================================
# update.command — Mac用ワンクリック更新
# ダブルクリックすると、配信サーバーから最新版を取得して
# Chromeが読み込んでいるフォルダを丸ごと上書きします。
# あとはChromeの拡張ページで丸矢印(更新)を押すだけ。
#
# 【重要】Chromeにはこの EXT_DIR を「読み込む」で登録してください:
#   ~/Documents/jp-post-ext
# ============================================================

set -e

EXT_DIR="$HOME/Documents/jp-post-ext"        # Chromeが読み込むフォルダ（固定）
SERVER="http://localhost:3999"                # 同じMac上のサーバー
TMP="$(mktemp -d)"

echo "最新版を取得中: $SERVER/jp-post-autofill.zip"
if ! curl -fsS "$SERVER/jp-post-autofill.zip" -o "$TMP/latest.zip"; then
  echo ""
  echo "✗ サーバーに接続できませんでした。"
  echo "  別ターミナルで次を実行してサーバーを起動してから、もう一度このファイルを開いてください:"
  echo "    node ~/Documents/jp-post-server/server.js"
  echo ""
  read -p "Enterで閉じます"
  exit 1
fi

echo "展開中..."
rm -rf "$TMP/x" && mkdir -p "$TMP/x"
unzip -oq "$TMP/latest.zip" -d "$TMP/x"

# zip内の実体フォルダ（jp-post-autofill）を特定
SRC="$(find "$TMP/x" -name manifest.json -maxdepth 3 | head -1 | xargs dirname)"
if [ -z "$SRC" ]; then echo "✗ 展開に失敗しました"; read -p "Enterで閉じます"; exit 1; fi

echo "上書き先: $EXT_DIR"
mkdir -p "$EXT_DIR"
# 中身を入れ替え（古いファイルも消してから）
rm -rf "$EXT_DIR"/*
cp -r "$SRC"/. "$EXT_DIR"/

NEWVER="$(node -e "console.log(require('$EXT_DIR/manifest.json').version)" 2>/dev/null || echo '?')"
rm -rf "$TMP"

echo ""
echo "✓ 更新完了 (バージョン $NEWVER)"
echo "  → Chromeの chrome://extensions を開き、この拡張の丸矢印(更新)を押してください。"
echo ""
read -p "Enterで閉じます"
