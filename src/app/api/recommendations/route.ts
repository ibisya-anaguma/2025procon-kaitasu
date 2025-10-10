import { NextRequest, NextResponse } from "next/server";
import { withAuth } from "@/lib/middleware";
import { getCollection, addFoodDetails } from "@/lib/apiUtils";

export const GET = withAuth(async (_req: NextRequest, uid: string) =>  {
	const items = await getCollection(uid, history);

	let recommendItems : number[];
	
	// historyを取得
	history = getCollection(uid, history);

	// historyから更新頻度でおすすめ
	history = 

	// tokenを


	const mergedItems = addFoodDetails(items);

	return NextResponse.json({ NextResponse })
});
