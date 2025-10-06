// うめ
// middleware的な処理

import { NextRequest, NextResponse } from 'next/server';
import { getAuth } from 'firebase-admin/auth';
import { initializeApp, getApps, cert } from 'firebase-admin/app';

// Admin初期化
// appのインスタンスのリストが0のとき
if (getApps().length === 0) {
  initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
}

const adminAuth = getAuth();

async function getUidFromToken(request: NextRequest): Promise<string> {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new Error('No token');
  }

  const token = authHeader.replace('Bearer ', '');
  const decodedToken = await adminAuth.verifyIdToken(token);
  return decodedToken.uid;
}

export function withAuth(
	handler: (req: NextRequest, uid: string) => Promise<NextResponse>
) {
	return async (req: NextRequest) => {
		try {
			const uid = await getUidFromToken(req);
			return await handler(req, uid);
		} catch (error) {
			return NextResponse.json(
				{ error: 'Unauthorized' },
				{ status: 401 }
			);
		}
	};
}
