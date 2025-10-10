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
