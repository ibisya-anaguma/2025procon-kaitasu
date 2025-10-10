# 認証機能セットアップガイド

## 実装済み機能

### ✅ 完了した実装

1. **Email/Password認証**
   - ユーザー登録（`/register`）
   - ログイン（`/login`）
   - パスワード表示/非表示切り替え
   - エラーハンドリングと日本語エラーメッセージ

2. **OAuth認証**
   - Google認証
   - Facebook認証
   - ポップアップベースの認証フロー

3. **認証状態管理**
   - `AuthContext`でグローバル認証状態管理
   - `useAuth`フックで簡単にアクセス
   - 自動ログイン状態の確認

4. **保護されたルート**
   - `ProtectedRoute`コンポーネント
   - 未認証ユーザーは自動的にログインページへリダイレクト
   - ログイン後に元のページへ戻る機能

5. **ログアウト機能**
   - サイドバーからログアウト
   - ログアウト後は自動的にログインページへ

6. **Firestoreユーザープロファイル**
   - 初回登録時に自動的にユーザードキュメント作成
   - ユーザー情報（名前、メール、予算設定など）を保存
   - Firestoreセキュリティルール実装済み

## ファイル構成

```
src/
├── contexts/
│   └── AuthContext.tsx          # 認証コンテキスト
├── components/
│   └── auth/
│       └── ProtectedRoute.tsx   # 保護されたルートコンポーネント
├── app/
│   ├── login/
│   │   └── page.tsx             # ログインページ
│   ├── register/
│   │   └── page.tsx             # 新規登録ページ
│   ├── (dashboard)/
│   │   └── layout.tsx           # 保護されたダッシュボードレイアウト
│   └── layout.tsx               # AuthProviderでラップ
├── lib/
│   ├── firebase.ts              # Firebase設定
│   └── auth-client.ts           # 認証ヘルパー関数
├── middleware.ts                # Next.jsミドルウェア
└── firestore.rules              # Firestoreセキュリティルール

```

## 使用方法

### 1. 認証状態へのアクセス

```tsx
"use client";

import { useAuth } from "@/contexts/AuthContext";

export default function MyComponent() {
  const { user, loading, signOut } = useAuth();

  if (loading) return <div>読み込み中...</div>;
  if (!user) return <div>ログインが必要です</div>;

  return (
    <div>
      <p>ようこそ、{user.displayName}さん</p>
      <button onClick={signOut}>ログアウト</button>
    </div>
  );
}
```

### 2. 保護されたページの作成

ページを`(dashboard)`ディレクトリ内に配置するだけで自動的に保護されます：

```tsx
// src/app/(dashboard)/my-protected-page/page.tsx
"use client";

export default function MyProtectedPage() {
  // このページは認証済みユーザーのみアクセス可能
  return <div>保護されたコンテンツ</div>;
}
```

### 3. 認証付きAPIリクエスト

```tsx
import { fetchWithAuth } from "@/lib/auth-client";

// 自動的にAuthorizationヘッダーが追加されます
const response = await fetchWithAuth("/api/my-endpoint", {
  method: "POST",
  body: JSON.stringify(data),
});
```

## Firebase設定

### 必要な環境変数（`.env.local`）

```env
# Firebase Client SDK
NEXT_PUBLIC_FIREBASE_API_KEY=your_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id

# Firebase Admin SDK
FIREBASE_PROJECT_ID=your_project_id
FIREBASE_CLIENT_EMAIL=your_service_account_email
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
```

### Firebase Console設定

1. **Authentication有効化**
   ```
   Firebase Console → Authentication → Sign-in method
   - Email/Password: 有効化
   - Google: 有効化（OAuth同意画面設定必要）
   - Facebook: 有効化（Facebook App ID設定必要）
   ```

2. **承認済みドメイン追加**
   ```
   Authentication → Settings → Authorized domains
   - localhost
   - your-production-domain.com
   ```

3. **Firestoreセキュリティルールのデプロイ**
   ```bash
   # Firebase CLIインストール
   npm install -g firebase-tools

   # ログイン
   firebase login

   # プロジェクト初期化（既存の場合はスキップ）
   firebase init firestore

   # ルールをデプロイ
   firebase deploy --only firestore:rules
   ```

### Google OAuth設定

1. Google Cloud Consoleで認証情報を作成
2. 承認済みのリダイレクトURIを追加：
   - `http://localhost:3000`（開発環境）
   - `https://your-domain.com`（本番環境）
   - `https://your-project.firebaseapp.com/__/auth/handler`

### Facebook OAuth設定

1. Facebook Developers（developers.facebook.com）でアプリ作成
2. Facebook LoginをONにする
3. 有効なOAuthリダイレクトURIを追加：
   - `https://your-project.firebaseapp.com/__/auth/handler`
4. Firebase ConsoleのFacebook設定にApp IDとApp Secretを入力

## Firestoreデータ構造

### ユーザードキュメント（`/users/{userId}`）

```typescript
{
  email: string;
  displayName: string;
  photoURL: string | null;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  monthlyBudget: number;
  preferences: {
    notifications: boolean;
    theme: "light" | "dark";
  };
}
```

## セキュリティ考慮事項

1. **環境変数の保護**
   - `.env.local`は`.gitignore`に含める
   - 本番環境では環境変数を適切に設定

2. **Firestoreセキュリティルール**
   - ユーザーは自分のデータのみアクセス可能
   - 商品データは読み取り専用
   - 管理者権限は別途実装が必要な場合あり

3. **トークン管理**
   - IDトークンは自動的に管理される
   - トークンの有効期限は1時間（自動更新）

## トラブルシューティング

### ログインできない

1. Firebase Consoleで認証方法が有効化されているか確認
2. 環境変数が正しく設定されているか確認
3. ブラウザのコンソールでエラーメッセージを確認

### OAuth認証がポップアップブロックされる

- ブラウザのポップアップブロックを解除
- または、リダイレクトベースの認証に切り替え

### Firestoreの権限エラー

1. `firestore.rules`が正しくデプロイされているか確認
2. ユーザーが認証されているか確認
3. Firebase Consoleのルールタブでテスト実行

## 今後の拡張機能案

- [ ] パスワードリセット機能
- [ ] メール確認機能
- [ ] プロフィール写真のアップロード
- [ ] 管理者ロール機能
- [ ] 二要素認証
- [ ] アカウント削除機能
- [ ] セッション管理とデバイス一覧

## サポートとドキュメント

- [Firebase Authentication ドキュメント](https://firebase.google.com/docs/auth)
- [Next.js認証ベストプラクティス](https://nextjs.org/docs/authentication)
- [Firestore セキュリティルール](https://firebase.google.com/docs/firestore/security/get-started)
