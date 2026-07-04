#!/bin/bash
# ============================================================
# sync.sh — 常駐同期スクリプト（launchdから定期実行される）
# ~/Downloads にある最新の jp-post-autofill-v*.zip を見つけて、
# Chromeが読み込むフォルダ ~/Documents/jp-post-ext を自動更新する。
# 反映後はユーザーがChromeの丸矢印を押すだけ。
# ============================================================

EXT_DIR="$HOME/Documents/jp-post-ext"
STATE="$HOME/Documents/jp-post-agent/.last_synced"
LOG="$HOME/Documents/jp-post-agent/sync.log"
DL="$HOME/Downloads"

mkdir -p "$EXT_DIR" "$(dirname "$STATE")"

# 最新の jp-post-autofill-v*.zip を探す（更新日時が一番新しいもの）
LATEST_ZIP="$(ls -t "$DL"/jp-post-autofill-v*.zip 2>/dev/null | head -1)"
[ -z "$LATEST_ZIP" ] && exit 0   # zipが無ければ何もしない

# 前回反映したものと同じなら何もしない（ファイル名+更新時刻で判定）
SIG="$(basename "$LATEST_ZIP")|$(stat -f %m "$LATEST_ZIP" 2>/dev/null)"
[ -f "$STATE" ] && [ "$(cat "$STATE")" = "$SIG" ] && exit 0

TMP="$(mktemp -d)"
if ! unzip -oq "$LATEST_ZIP" -d "$TMP"; then
  echo "$(date '+%F %T') 展開失敗: $LATEST_ZIP" >> "$LOG"
  rm -rf "$TMP"; exit 0
fi

# zip内の拡張本体（manifest.jsonのあるフォルダ）を特定
SRC="$(find "$TMP" -name manifest.json -maxdepth 4 -path '*jp-post-autofill*' | head -1 | xargs dirname 2>/dev/null)"
[ -z "$SRC" ] && SRC="$(find "$TMP" -name manifest.json -maxdepth 4 | head -1 | xargs dirname 2>/dev/null)"
if [ -z "$SRC" ]; then
  echo "$(date '+%F %T') manifest見つからず: $LATEST_ZIP" >> "$LOG"
  rm -rf "$TMP"; exit 0
fi

# バージョン比較（現行 EXT_DIR より新しい時だけ反映）
NEW_V="$(grep -o '"version"[^,]*' "$SRC/manifest.json" | head -1 | grep -o '[0-9][0-9.]*')"
CUR_V="0.0.0"
[ -f "$EXT_DIR/manifest.json" ] && CUR_V="$(grep -o '"version"[^,]*' "$EXT_DIR/manifest.json" | head -1 | grep -o '[0-9][0-9.]*')"

verge() { [ "$(printf '%s\n%s' "$1" "$2" | sort -t. -k1,1n -k2,2n -k3,3n | head -1)" = "$2" ]; }
# NEW_V >= CUR_V のとき反映（同値でも上書きしておくと安全）
if verge "$NEW_V" "$CUR_V"; then
  rm -rf "$EXT_DIR"/*
  cp -r "$SRC"/. "$EXT_DIR"/
  echo "$SIG" > "$STATE"
  echo "$(date '+%F %T') 反映: v$NEW_V (from $(basename "$LATEST_ZIP"))" >> "$LOG"
fi

rm -rf "$TMP"
