#!/bin/bash
# ============================================================
# uninstall-agent.command — 常駐同期を止めて削除
# ダブルクリックで実行。自動更新をやめたいときに使います。
# （拡張本体やChromeの登録はそのまま残ります）
# ============================================================

PLIST_DST="$HOME/Library/LaunchAgents/com.jexport.jppost.sync.plist"

launchctl unload "$PLIST_DST" 2>/dev/null || true
rm -f "$PLIST_DST"

echo "✓ 常駐同期を停止・削除しました。"
echo "  （拡張本体 ~/Documents/jp-post-ext とChromeの登録は残っています）"
read -p "Enterで閉じます"
