#!/bin/bash
# ============================================================
# install-agent.command — 常駐同期の初回セットアップ（1回だけ）
# ダブルクリックで実行してください。
# これ以降、~/Downloads に新しい jp-post-autofill-v*.zip を保存すると
# 自動で ~/Documents/jp-post-ext が最新になります。
# あなたはChromeで丸矢印を押すだけ。
# ============================================================

set -e
AGENT_DIR="$HOME/Documents/jp-post-agent"
PLIST_SRC="$(cd "$(dirname "$0")" && pwd)/com.jexport.jppost.sync.plist"
PLIST_DST="$HOME/Library/LaunchAgents/com.jexport.jppost.sync.plist"

echo "常駐同期エージェントをセットアップします..."

# 1) エージェント用フォルダを作り、sync.sh を配置
mkdir -p "$AGENT_DIR"
cp "$(cd "$(dirname "$0")" && pwd)/sync.sh" "$AGENT_DIR/sync.sh"
chmod +x "$AGENT_DIR/sync.sh"

# 2) plist の __HOME__ を実際のホームパスに置換して LaunchAgents へ
mkdir -p "$HOME/Library/LaunchAgents"
sed "s|__HOME__|$HOME|g" "$PLIST_SRC" > "$PLIST_DST"

# 3) 既存があればアンロードしてからロード
launchctl unload "$PLIST_DST" 2>/dev/null || true
launchctl load "$PLIST_DST"

# 4) 初回同期を即実行
bash "$AGENT_DIR/sync.sh" || true

echo ""
echo "✓ セットアップ完了"
echo "  これ以降、新しい jp-post-autofill-v*.zip を ~/Downloads に保存するだけで"
echo "  30秒以内に ~/Documents/jp-post-ext が自動更新されます。"
echo "  Chromeの chrome://extensions で丸矢印を押せば反映されます。"
echo ""
echo "  ※Chromeにはこのフォルダを登録してください: ~/Documents/jp-post-ext"
echo ""
read -p "Enterで閉じます"
