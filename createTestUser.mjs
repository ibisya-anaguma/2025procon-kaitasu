// createTestUser.mjs
import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword } from "firebase/auth";

const firebaseConfig = {
  apiKey: "あなたのFirebase APIキー",
  authDomain: "プロジェクトID.firebaseapp.com",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);

const email = "testuser@example.com";
const password = "testpassword123";

try {
  const userCredential = await createUserWithEmailAndPassword(auth, email, password);
  console.log("✅ ユーザー作成成功:", userCredential.user.uid);
  const token = await userCredential.user.getIdToken();
  console.log("🎫 IDトークン:", token);
} catch (error) {
  console.error("❌ エラー:", error.message);
}

PORT=4000