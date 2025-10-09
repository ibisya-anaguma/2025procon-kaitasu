// うめ
// middleware的な処理

import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebaseAdmin'

async function getUidFromToken(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token');
  }

  const token = authHeader.replace('Bearer ', '');
  const decodedToken = await adminAuth.verifyIdToken(token);
  return decodedToken.uid;
}

export type WithAuthHandler = (
	req: NextRequest,
	uid: string,
	context?: any
) => Promise<NextResponse> | NextResponse;

export function withAuth(handler: WithAuthHandler) {
	return async (req: NextRequest, context?: any) => {
		let uid: string;
		try {
			uid = await getUidFromToken(req);
		} catch (error) {
			return NextResponse.json(
				{ error: 'Unauthorized' },
				{ status: 401 }
			);
		}
		// handlerの実行は別でエラーを出す
		try {
			return await handler(req, uid, context);
		} catch (error: any) {
			return NextResponse.json(
				// { error: "Internal Server Error" },
				// debug用
				{ error: "Internal Server Error", message: error?.message, code: error?.code },
				{ status: 500 }
			);
		}
	};
}

