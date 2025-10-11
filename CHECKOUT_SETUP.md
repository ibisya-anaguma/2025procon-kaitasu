# 決済処理（Checkout）セットアップ完了

## ✅ 完了した作業

1. **Python依存関係のインストール**
   - ✅ Selenium 4.36.0
   - ✅ webdriver-manager 4.0.2
   - ✅ firebase-admin 6.5.0（既存）

2. **checkout APIの修正**
   - ✅ uidを自動的にPythonスクリプトに渡す
   - ✅ Firebase認証情報の環境変数を読み取る
   - ✅ ヘッドレスモードで実行
   - ✅ 5分のタイムアウト設定
   - ✅ 詳細なログ出力

3. **ドキュメント作成**
   - ✅ requirements.txt
   - ✅ README.md（checkout処理の説明）

## 🔧 追加で必要な設定

### 1. Firebase Service Accountの設定

`.env.local`に以下を追加してください（まだの場合）：

```bash
# Firebase Admin SDK用
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/serviceAccountKey.json
```

または、環境変数を直接設定：

```bash
export GOOGLE_APPLICATION_CREDENTIALS="/path/to/your/serviceAccountKey.json"
```

### 2. Service Account JSONファイルの取得方法

1. [Firebase Console](https://console.firebase.google.com/) にアクセス
2. プロジェクトを選択
3. ⚙️ → プロジェクトの設定 → サービスアカウント
4. 「新しい秘密鍵の生成」をクリック
5. ダウンロードしたJSONファイルを安全な場所に保存（例：`~/firebase-serviceAccount.json`）
6. `.env.local`にパスを設定

### 3. イオンネットスーパーのログイン

初回実行時にブラウザが開き、イオンネットスーパーへのログインが必要になります：

1. ユーザー名とパスワードを入力
2. ログイン後、ブラウザのプロファイルに保存される
3. 2回目以降は自動的にログイン状態を維持

## 🚀 テスト方法

### 1. 開発サーバーを起動

```bash
npm run dev
```

### 2. ブラウザでテスト

1. http://localhost:3002 にアクセス
2. ログイン
3. カタログページで商品を選択
4. 「購入」ボタンでカートに追加
5. カートページで「注文確定」ボタンをクリック

### 3. 動作確認のポイント

**コンソールログで確認：**
- `[checkout] Starting checkout for uid: xxx`
- `[checkout] Executing: python3 ...`
- スクリプトの実行ログ

**成功時：**
- 「注文が確定しました！」のメッセージ
- カートがクリアされる
- 履歴ページ（/history）で注文が確認できる

**失敗時：**
- エラーメッセージが表示される
- サーバーログでエラー詳細を確認

## 🐛 トラブルシューティング

### Python実行エラー

```bash
# Pythonのバージョン確認
python3 --version  # 3.8以降が必要
```

### Selenium/Chromedriverエラー

```bash
# Google Chromeがインストールされているか確認
ls /Applications/Google\ Chrome.app

# または手動でChromedriverをインストール
brew install chromedriver
xattr -d com.apple.quarantine /opt/homebrew/bin/chromedriver
```

### Firebase認証エラー

```bash
# Service Accountファイルのパスを確認
echo $GOOGLE_APPLICATION_CREDENTIALS

# ファイルが存在するか確認
ls -l $GOOGLE_APPLICATION_CREDENTIALS

# ファイルの権限を確認
chmod 600 /path/to/serviceAccountKey.json
```

### ログの確認

サーバーログを確認：

```bash
# 開発サーバーのターミナルでログを確認
# [checkout] で始まる行がcheckout処理のログ
```

## 📝 注意事項

### 開発環境

- 初回実行時はブラウザが表示される（ログイン用）
- ヘッドレスモードでも動作するが、初回はGUIで実行推奨
- タイムアウトは5分（長時間かかる場合がある）

### 本番環境

- ヘッドレスモードで自動実行
- ログはサーバーログに出力
- エラー時は適切にハンドリング
- Chromeがサーバーにインストールされている必要がある

## 📚 関連ファイル

- `src/app/api/cart/checkout/route.ts` - Checkout API
- `src/app/api/cart/checkout/aeon_netsuper_cart.py` - Pythonスクリプト
- `src/app/api/cart/checkout/requirements.txt` - Python依存関係
- `src/app/api/cart/checkout/README.md` - 詳細ドキュメント
- `src/app/(dashboard)/cart/page.tsx` - カートUI

## 🎉 次のステップ

1. Firebase Service Accountを設定
2. 開発サーバーを起動
3. 実際に商品をカートに入れて「注文確定」をテスト
4. エラーが出た場合はログを確認
5. 成功したら履歴ページで注文を確認

準備ができたら、実際にテストしてみてください！

