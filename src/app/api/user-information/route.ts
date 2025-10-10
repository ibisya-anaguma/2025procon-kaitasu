import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebaseAdmin';

// GET /api/user-information - ユーザー情報を取得
export async function GET(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // トークンを検証してuidを取得
    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('トークン検証エラー:', error);
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    // Firestoreからユーザー情報を取得
    const userDoc = await adminDb.collection('users').doc(uid).get();
    
    if (!userDoc.exists) {
      // ドキュメントが存在しない場合、デフォルト値を返す
      const defaultData = {
        name: '',
        monthlyBudget: 50000,
        resetDay: 1
      };
      
      // デフォルト値でドキュメントを作成
      await adminDb.collection('users').doc(uid).set({
        userName: '',
        monthlyBudget: 50000,
        resetDay: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      });
      
      return NextResponse.json(defaultData);
    }
    
    const userData = userDoc.data();
    
    // レスポンス形式に合わせてデータを整形
    const response = {
      name: userData?.userName || '',
      monthlyBudget: userData?.monthlyBudget || 50000,
      resetDay: userData?.resetDay || 1,
      surveyCompleted: userData?.surveyCompleted || false
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error('ユーザー情報取得エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

// POST /api/user-information - ユーザー情報を初期設定（健康設定）
export async function POST(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // トークンを検証してuidを取得
    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('トークン検証エラー:', error);
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    // リクエストボディを取得
    const body = await request.json();
    const { disease, increaseNutrients, reduceNutrients } = body;

    // バリデーション
    const validDiseases = ['Hypertension', 'KidneyDisease', 'Sarcopenia', 'Diabetes', 'Osteoporosis'];
    const validIncreaseNutrients = ['Protein', 'VitaminD', 'Ca', 'Fiber', 'Potassium'];
    const validReduceNutrients = ['Salt', 'Fat', 'Sugar', 'Vitamin', 'Mineral'];

    if (disease && !Array.isArray(disease)) {
      return NextResponse.json({ error: 'diseaseは配列である必要があります' }, { status: 400 });
    }
    if (increaseNutrients && !Array.isArray(increaseNutrients)) {
      return NextResponse.json({ error: 'increaseNutrientsは配列である必要があります' }, { status: 400 });
    }
    if (reduceNutrients && !Array.isArray(reduceNutrients)) {
      return NextResponse.json({ error: 'reduceNutrientsは配列である必要があります' }, { status: 400 });
    }

    // 値の検証
    if (disease && disease.some(d => !validDiseases.includes(d))) {
      return NextResponse.json({ error: '無効なdiseaseの値が含まれています' }, { status: 400 });
    }
    if (increaseNutrients && increaseNutrients.some(n => !validIncreaseNutrients.includes(n))) {
      return NextResponse.json({ error: '無効なincreaseNutrientsの値が含まれています' }, { status: 400 });
    }
    if (reduceNutrients && reduceNutrients.some(n => !validReduceNutrients.includes(n))) {
      return NextResponse.json({ error: '無効なreduceNutrientsの値が含まれています' }, { status: 400 });
    }

    // Firestoreのユーザードキュメントを更新
    await adminDb.collection('users').doc(uid).set({
      disease: disease || [],
      increaseNutrients: increaseNutrients || [],
      reduceNutrients: reduceNutrients || [],
      updatedAt: new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ msg: 'success' });
  } catch (error) {
    console.error('ユーザー情報設定エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}

// PATCH /api/user-information - ユーザー情報を更新
export async function PATCH(request: NextRequest) {
  try {
    // Authorizationヘッダーからトークンを取得
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '認証トークンが必要です' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    
    // トークンを検証してuidを取得
    let uid: string;
    try {
      const decodedToken = await adminAuth.verifyIdToken(token);
      uid = decodedToken.uid;
    } catch (error) {
      console.error('トークン検証エラー:', error);
      return NextResponse.json({ error: '無効な認証トークンです' }, { status: 401 });
    }

    // リクエストボディを取得
    const body = await request.json();
    const { name, monthlyBudget, resetDay, surveyCompleted } = body;

    // 更新するフィールドを準備
    const updateData: any = {};
    
    if (name !== undefined) {
      updateData.userName = name;
    }
    if (monthlyBudget !== undefined) {
      if (typeof monthlyBudget !== 'number' || monthlyBudget < 0) {
        return NextResponse.json({ error: 'monthlyBudgetは0以上の数値である必要があります' }, { status: 400 });
      }
      updateData.monthlyBudget = monthlyBudget;
    }
    if (resetDay !== undefined) {
      if (typeof resetDay !== 'number' || resetDay < 1 || resetDay > 31) {
        return NextResponse.json({ error: 'resetDayは1-31の数値である必要があります' }, { status: 400 });
      }
      updateData.resetDay = resetDay;
    }
    if (surveyCompleted !== undefined) {
      if (typeof surveyCompleted !== 'boolean') {
        return NextResponse.json({ error: 'surveyCompletedはbooleanである必要があります' }, { status: 400 });
      }
      updateData.surveyCompleted = surveyCompleted;
    }

    // 少なくとも1つのフィールドが更新される必要がある
    if (Object.keys(updateData).length === 0) {
      return NextResponse.json({ error: '更新するフィールドが指定されていません' }, { status: 400 });
    }

    // タイムスタンプを追加
    updateData.updatedAt = new Date().toISOString();

    // Firestoreのユーザー情報を更新
    await adminDb.collection('users').doc(uid).set(updateData, { merge: true });

    return NextResponse.json({ msg: 'success' });
  } catch (error) {
    console.error('ユーザー情報更新エラー:', error);
    return NextResponse.json({ error: 'サーバーエラーが発生しました' }, { status: 500 });
  }
}
