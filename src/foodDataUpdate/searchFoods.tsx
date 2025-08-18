// うめ
// ..scraper/all_products.json(あらともの取得した材料)の名前をfoodCompositionDatabbase.csv(文部科学省食品成分DB)
// にあうように単語をフォーマット、検索をかける

// Firebaseにその後食品成分DBに保存する

// src/foodDataUpdate/searchfoods.tsx

import beforeFoods from '../scraper/all_products.json'
import foods from './foodCompositionDatabase.csv'

type Foods = {
	name: string
}

type FormatedName = {
	name: string
}

export default {

}
