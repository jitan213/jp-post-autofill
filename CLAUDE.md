# CLAUDE.md — 国際郵便マイページ 住所オートフィル 開発コンテキスト

このファイルは Claude Code が開発を引き継ぐための引き継ぎ書です。
まずこれを読めば、何のプロジェクトか・どう動かすか・次に何をすべきかが分かります。

## これは何か

日本郵便「国際郵便マイページ」(int-mypage.post.japanpost.jp) の発送入力を
自動化する Chrome/Brave 拡張（Manifest V3）。eBay輸出セラーが、毎回同じ
住所入力・発送種別選択・内容品登録を手作業でやる手間を消すのが目的。

ユーザー（じん / J Export Japan）はコード非経験者。Mac + Galaxy Z Fold6 を使用。
Fold6 では Lemur Browser で拡張を使う。

## フォルダ構成（このzipの中身）

- `jp-post-autofill/` … 拡張本体（これがChromeに読み込まれる実体）
  - `manifest.json` … MV3。**key を含む**（拡張ID固定用。消さないこと）
  - `content.js`   … 郵便局サイトに注入。Step2住所入力＆Step3自動処理の本体
  - `popup.html` / `popup.js` … ポップアップUI。住所貼り付け解析＆更新確認
  - `background.js` … 更新バッジ（サーバーのversion.jsonを定期確認）
- `jp-post-server/` … Fold6配布用のミニ配信サーバー（依存ゼロ, port 3999）
  - `server.js` … `/` で配布ページHTML, `/version.json`, `/jp-post-autofill.zip`
  - `version.json` / `jp-post-autofill.zip` … 配信物
  - `update.command` … Mac用ワンクリック更新（サーバーからzip取得しext上書き）
- `jp-post-agent/` … Mac常駐の自動更新（launchd）
  - `sync.sh` … ~/Downloads の最新 jp-post-autofill-v*.zip を見て ext を上書き
  - `com.jexport.jppost.sync.plist` … 30秒ごと実行のlaunchd定義
  - `install-agent.command` / `uninstall-agent.command`

## 現在のバージョン: 1.11.0

## 拡張の機能（実装済み）

### Step2「お届け先入力」
- ポップアップに eBay の「お届け先」ブロックを貼り付け → 名前/住所/州/郵便番号/
  国名/電話 に自動振り分け（popup.js の parseAddress）。国別の郵便番号形式・
  米加豪の州略称に対応。1行30字/名前3行・住所6行で自動改行。
- 「フォームに入力」で content.js が各欄を埋める（ラベル文字→直後のinputを探す方式）。
- 国名は郵便局のプルダウンから前方一致で自動選択。
- **州名フォールバック (v1.10.0〜)**: 住所テキストに州が無くても郵便番号から推定して埋める。
  - フランス: 郵便番号先頭2桁 → 県名（FR_DEPT テーブル。20xxx はコルシカ、97x は海外県）
  - 米国: ZIP 先頭3桁 → 州略称（US_ZIP_RANGES）
  - カナダ: 郵便番号先頭アルファベット → 州略称（CA_POSTAL_TO_PROV）
  - 豪州: postcode → 州略称（AU_POSTCODE_RANGES）
  - 実装: popup.js の predictStateFromPostal()。住所抽出で state が空だった時だけ動く。

### Step3「発送種別と内容品」
- **Step2で「次へ」を押して遷移してきた時だけ**自動入力が発動
  （sessionStorage "jpAutoStep3" フラグで受け渡し。content.js の cameFromStep2）。
- 発動時: 国際エアパケット自動選択 / 内容品1トグルを開く / 個数=1 /
  「危険物に関しての確認」チェックON。**「次へ」は自動で押さない**（名称・価格は手入力）。
- 名称欄の上に品名クイックボタン（QUICK_NAMES = ["camera w/o battery","Trading card"]）。
  これは Step2 経由でなくても内容品欄が見えていれば常に表示。

### Step4「発送関連情報入力」(v1.9.0〜)
- Step3 で「次へ」を押した瞬間に、表示中の内容品の Σ(1個あたりの重量 × 個数) を
  計算して sessionStorage "jpAutoStep4Weight" に保存。
- Step4 に遷移したら「総重量 (g)」欄が空なら自動で流し込む。既に値があれば触らない。
- 実装: calcStep3TotalWeight() / armStep4OnNext() / isStep4() / runStep4()。

### 更新まわり
- manifest の key で拡張IDを固定（更新時に削除・再登録が不要）。
  現在の拡張ID: aabahnoobagmbaikkgkhojamidpadfhh
- Mac常駐エージェント（jp-post-agent）が ~/Downloads の最新zipを ~/Documents/jp-post-ext
  に自動反映。ユーザーは Chrome/Brave の「更新」(丸矢印)を押すだけ。
- **エージェント実体の場所（2026-07-04 移設）**: `~/Library/Application Support/jp-post-agent/`
  - `sync.sh` / `sync.log` / `.last_synced` / `launchd.err.log` / `launchd.out.log` すべてここ
  - 旧場所 `~/Documents/jp-post-agent/` は macOS の TCC (プライバシー保護) で launchd から
    "Operation not permitted" となり動かなくなったため移設。**Documents 配下に戻さないこと**。
  - plist は `~/Library/LaunchAgents/com.jexport.jppost.sync.plist` のまま（中身のパスだけ更新済）
  - 再登録: `launchctl bootout gui/$(id -u) <plist>` → `launchctl bootstrap gui/$(id -u) <plist>`
- Fold6 は jp-post-server を起動し http://100.93.41.106:3999 からzipを落として入れ直す。
- **v1.11.0〜のポップアップUI改修**: 「配布ページを開く」ボタンを廃止し、popup 内の
  `<a id="download" href="…zip" download>` で直接zipをDL（Lemurでも確実に落ちる形）。
  presetボタン/URLフィールドは `<details>詳細設定</details>` に格納。
  Fold6ワークフロー: Macでサーバー起動 → Fold6のポップアップ開く → 自動検出で
  新バージョンが出ればDLボタンが青く出る → クリックしてzipDL → Lemur拡張機能画面で読み込み。
- 拡張のアイコン: `jp-post-autofill/icons/icon{16,32,48,128}.png`（郵便局レッド背景に白抜き「郵」）。
  manifest の `icons` と `action.default_icon` から参照。

## ローカルでの動かし方 / 検証

拡張なのでビルド不要。素の HTML/CSS/JS。

- 構文チェック: `node --check jp-post-autofill/content.js` など
- DOM挙動の単体テストは jsdom で可能:
  `npm i jsdom --no-save` して、content.js 内の関数（fieldAfterText,
  parseAddress, selectAirPacket 等）を切り出してテストする。
- Chrome/Brave: chrome://extensions → デベロッパーモード →
  「パッケージ化されていない拡張機能を読み込む」で **jp-post-autofill/** を指定。
  ※ユーザー環境では実体は ~/Documents/jp-post-ext。開発時はこの jp-post-autofill/ を直接読んでよい。

## 重要な制約・ユーザーの好み

- ユーザーはコード非経験者。**完成した成果物を渡す**運用（部分パッチより全体）。
- ターミナルコマンドは1つずつ・フルパスで案内する。
- content.js はページ読み込み時に走る。**開きっぱなしのタブには効かない**
  （変更後はページをリロード or Step2から進み直す必要がある）。
- 郵便局サイトのDOMはラベル文字を手がかりに要素を探す作り（class名に依存しない）。
  郵便局側の文言変更に弱いので、動かない時はまず実DOMを確認する。
- key と拡張IDは固定資産。manifestからkeyを消さない。

## 既知の未確認事項 / 次にやること（TODO）

1. **実機での動作未確認**: v1.8.0 の Step3 自動処理（エアパケ選択・危険物チェック・
   品名ボタン表示）を実際の郵便局ページで確認できていない。
   - 特に selectAirPacket() が郵便局の発送種別ボタンの実DOMに当たるか要確認。
     現状は "国際エアパケット" というテキスト/alt を持つ要素を探してクリックしている。
     実際のHTML構造（imgのalt か、隣接labelか、input[type=radio]か）を見て要調整。
   - fillDangerCheck() が「危険物に関しての確認」の正しいチェックボックスを掴めているか。
   - openContentToggle() が内容品1の開閉をトグルできているか（既に開いている場合は触らない設計）。
2. 品名ボタンの候補追加・編集（QUICK_NAMES）。ユーザー要望で増える可能性。
3. Step3で「次へ」まで自動化するかは保留（現在は手動。名称・価格が手入力のため）。
4. Fold6(Lemur)での自動更新は未対応（フォルダ上書き方式が使えないため手動）。

## デバッグの勘所

- 拡張が古いまま反映されていない事故が多い。まず chrome://extensions で
  表示バージョンが最新か、読み込みフォルダのパスが正しいか（消えたDownloads内を
  指していないか）を確認する。
- content.js のログを増やすなら console.log を仕込み、郵便局ページの
  DevTools コンソールで確認。isStep2()/isStep3() の判定は innerText の
  文字列一致なので、文言が変わると誤判定する。

## 配布物の作り方（新バージョンを出す時）

1. jp-post-autofill/manifest.json と jp-post-server/version.json の version を上げる
2. `cd <このフォルダの親> && zip -rq /path/out/jp-post-autofill-vX.Y.Z.zip <このフォルダ>`
   ただし配布zip内の jp-post-server/jp-post-autofill.zip も更新すること
   （= jp-post-autofill/ だけを固めた zip を jp-post-server/ に置く）
3. ユーザーは ~/Downloads に置く → 常駐エージェントが ext を更新 → ブラウザで丸矢印
