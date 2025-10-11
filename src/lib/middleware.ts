// うめ
// middleware的な処理

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin'

async function getUidFromToken(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  
  // 開発環境: 認証ヘッダーがない場合はテストユーザーを使用
  if (!authHeader?.startsWith('Bearer ')) {
    if (process.env.NODE_ENV === 'development') {
      console.warn('[middleware] No auth token, using test user in development mode');
      return 'test-user-123';
    }
    throw new Error('No token');
  }

  const token = authHeader.replace('Bearer ', '');
  
  // 開発環境: テストトークンの場合はテストユーザーを返す
  if (process.env.NODE_ENV === 'development' && token === 'test-token-123') {
    console.warn('[middleware] Using test token, returning test user');
    return 'test-user-123';
  }

  const decodedToken = await adminAuth.verifyIdToken(token);
  return decodedToken.uid;
}

export type WithAuthHandler<Context = undefined> = (
  req: NextRequest,
  uid: string,
  context: Context
) => Promise<NextResponse> | NextResponse;

export function withAuth<Context = undefined>(handler: WithAuthHandler<Context>) {
	return async (req: NextRequest, context?: Context) => {
		let uid: string;
		try {
			uid = await getUidFromToken(req);
			} catch {
			return NextResponse.json(
				{ error: 'Unauthorized' },
				{ status: 401 }
			);
		}
		// handlerの実行は別でエラーを出す
		try {
			return await handler(req, uid, context as Context);
		} catch (error: unknown) {
			const err = error instanceof Error ? { message: error.message, stack: error.stack } : {};
			return NextResponse.json(
				{
					error: "Internal Server Error",
					...err
				},
				{ status: 500 }
			);
		}
	};
}
