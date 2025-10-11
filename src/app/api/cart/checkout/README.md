# チェックアウト処理（決済処理）

このディレクトリには、イオンネットスーパーへの自動カート追加と決済処理を行うPythonスクリプトが含まれています。

## セットアップ

### 1. Python依存関係のインストール

```bash
cd src/app/api/cart/checkout
pip3 install -r requirements.txt
```

または、プロジェクトルートから：

```bash
pip3 install -r src/app/api/cart/checkout/requirements.txt
```

### 2. 環境変数の設定

`.env.local`ファイルに以下を追加：

```bash
# Firebase Admin SDK
GOOGLE_APPLICATION_CREDENTIALS=/path/to/your/serviceAccountKey.json
FIREBASE_PROJECT_ID=your-project-id

# または、Next.jsの既存設定を使用
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
```

### 3. Firebase Service Accountの取得

1. [Firebase Console](https://console.firebase.google.com/)にアクセス
2. プロジェクト設定 → サービスアカウント
3. 「新しい秘密鍵の生成」をクリック
4. ダウンロードしたJSONファイルを安全な場所に保存
5. `GOOGLE_APPLICATION_CREDENTIALS`環境変数でそのパスを指定

## 動作の流れ

1. ユーザーがカートページで「注文確定」ボタンをクリック
2. `POST /api/cart/checkout`が呼ばれる
3. Pythonスクリプト`aeon_netsuper_cart.py`が実行される：
   - ユーザーのカート情報をFirestoreから取得
   - Seleniumを使ってイオンネットスーパーにログイン
   - 各商品をイオンのカートに追加
   - 処理完了後、Firestoreのカートを履歴に移動してクリア
4. 成功/失敗をユーザーに通知

## トラブルシューティング

### Pythonスクリプトが見つからない

```bash
which python3
# または
python3 --version
```

Python 3.8以降が必要です。

### Seleniumのエラー

Chromedriverが自動でインストールされますが、失敗する場合：

```bash
# Chromeがインストールされているか確認
# macOS
ls /Applications/Google\ Chrome.app

# Chromedriverを手動でインストール
brew install chromedriver
```

### Firebase認証エラー

- Service Account JSONファイルのパスが正しいか確認
- ファイルの権限が読み取り可能か確認
- プロジェクトIDが正しいか確認

## 開発モード

開発中は`--headless`フラグを外してブラウザの動作を確認できます：

`route.ts`の`--headless`行をコメントアウト：

```typescript
// '--headless',  // コメントアウトしてブラウザを表示
```

## 本番環境での注意事項

- ヘッドレスモードで実行される
- タイムアウトは5分（300秒）
- エラーログはサーバーログに出力される
- ユーザーのイオンネットスーパーのログイン情報が必要

