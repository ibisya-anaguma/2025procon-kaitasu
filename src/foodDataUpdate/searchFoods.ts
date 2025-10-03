// うめ
// ..scraper/all_products.json(あらともの取得した材料)の名前をfoodCompositionDatabbase.csv(文部科学省食品成分DB)
// にあうように単語をフォーマット、検索をかける
// firestoreではなく、jsonで保存するようにする

// npm install fuse.jsが必要

// src/foodDataUpdate/searchfoods.ts

import Fuse from 'fuse.js';
import * as fs from 'fs';

// import rawData from "../scraper/all_products.json" with { type: "json" };
import rawData from "../scraper/all_products.json" with { type: "json" };
import foodCompositionDatabase from "./foodCompositionDatabase.json" with { type: "json" };

const logPath = "./src/foodDataUpdate/log.txt";

type ProductRaw = {
	genre: number;
	id: string; // idのサイズが大きすぎるため、bigIntではないのは計算しないから
	url: string;
	name: string;
	image: string;
	price: number;
	price_tax: number;
};

type Product = {
	genre: number;
	id: string;
	url: string;
	name: string;
	amount: string | null;
	priceTax: number;
	imgUrl: string;
	cholesterol_mg: number | null; // 以後栄養素
	fiber_g: number | null;
	K_mg: number | null;
	Ca_mg: number | null;
	VitaminC_mg: number | null;
	NaCl_EQ_g: number | null;
};
type Products = Product[];

type FoodCompositionDatabase = {
	number: string;
	name: string;
	cholesterol_mg: number;
	fiber_g: number;
	K_mg: number;
	Ca_mg: number;
	VitaminC_mg: number;
	NaCl_EQ_g: number;
	remarks: string;
}

// 変換
const flattenRaw = (() => {
  if (Array.isArray(rawData)) return rawData as ProductRaw[];
  const byGenre = rawData as Record<string, ProductRaw[]>;
  return Object.entries(byGenre).flatMap(([g, list]) =>
    (list || []).map((item) => ({
      ...item,
      genre: item.genre ?? Number(g),
    })),
  );
})();

// 生データをproductsに入れる
const products: Products = (flattenRaw as ProductRaw[]).map(
	({ id, url, name, price_tax, image }) => ({
		id,
		url,
		name,
		priceTax: price_tax,
		imgUrl: image,
		amount: null,
		cholesterol_mg: null,
		fiber_g: null,
		K_mg: null,
		Ca_mg: null,
		VitaminC_mg: null,
		NaCl_EQ_g: null,
	})
)

// productsのnameを正規化
// 【】とその中を削除

const normalizeName = (rawName: string) : { n: string; amt: string | null} => {
	// 先に数量・単位を抽出して取り除く
	// 数字が出たところから後ろは削除、amountにもってく
	// \d+　で数字
	// ?はオプショナルチェーン、マッチしなくても大丈夫 ??は、左がnullまたはundefinedならって意味らしい
	// 分数も
	const amountRegex = /(\d+\/\d+|\d+(?:\s*[×x]\s*\d+)?(?:g|ml|l|束|個|袋入|組|本|枚|玉|食|人前|袋|箱|パック|本入|貫|切|尾|株|房))/gi;
    let n: string = rawName;
	const amountMatch = n.match(amountRegex);
	const amt : string | null = amountMatch ? amountMatch[0].trim() : null;
	if (amt) n = n.replace(amountRegex, '');

    // ここから品名の正規化
    n = n
		.replace(/【.+?】/g, '')
		.replace(/（.+?）/g, '') // 全角かっこ
		.replace(/^.*産/g, '') // 〇〇産の産の前を削除　形式が違った瞬間壊れるのはご愛嬌
		// 表記ゆれ・記号類の整理
		.replace(/[「」『』【】]/g, '')
		.replace(/^([のノ])\s*/, '')
		.replace(/(^|\s)円(\s|$)/g, ' ')
		.replace(/円$/g, '')
		.replace(/円/g, '')
		.replace(/[％%]/g, '')
		.replace(/サイズ[:：].*$/g, '')
		.replace(/クォーター/g, '')
		.replace(/＆/g, ' ')
		.replace(/カロリー\s*\d+\s*OFF/gi, '')
		.replace(/出汁の旨味|品目の/g, '')
		.replace(/増量|中|特大|ビッグ|デカうま|BOX|ミニ|プチ|大袋|ごつ盛り/g, '')
		.replace(/極撰|極熱|万能|オーガニック/g, '')
		.replace(/輸入|冷凍|ミックス/g, '')
		.replace(/パック|カット|スライス|平切|角切/g, '')
		.replace(/さくさく|素焼き|ほほえみ|らくらく/g, '')
		.replace(/トップバリュ|ベストプライス|で健康/g, '')
		.replace(/甘さギュッと|甘みの頂き|推しの/g, '')
		.replace(/手で皮がむける/g, '')
		.replace(/たねなし|はくばく/g, '')
		.replace(/ふっくら|やわらか|やんわか|マイルド|あっさりおいしい/g, '')
		.replace(/さわやか|ベストプライス盛り合わせ|刺身用|MSC認証|asc認証|ASC|asc|MSC/g, '')
		.replace(/JA相馬村|滝沢|国:ウクライナ|北海道|釧路|東京|武蔵野|栃木|新潟|九州|鹿児島|佐賀美人|駿河湾|和歌山|はごろもフーズ|金ちゃん/g, '')
		.replace(/ハウス食品|サッポロ一番/g, '')
		.replace(/白鶴酒造|白鶴|不二家|ネスカフェ|ネスレ|スターバックス/g, '')
		.replace(/ニッスイ|ニチレイ/g, '')
		.replace(/フードリエ/g, '')
		.replace(/日清のあっさりおだしがおいしいどん兵衛|ごはんにかけておいしい|おこめでつくった|コクとキレの|スパイシー|THE all－time NOODLES/g, '')
		.replace(/プレマハム|グリコ|アルファー食品|三菱食品/g, '')
		.replace(/新宿中村屋|新宿村屋/g, '')
		.replace(/日本ハム|雪印メグミルク|アヲハタ|ヤマザキ/g, '')
		.replace(/サントリー|カゴメ|ネスレ日本|ロッテ|エスピー食品|江崎/g, '')
		.replace(/明星食品|まるか食品|永谷園|薬味/g, '')
		.replace(/ちいかわ|マインクラフト|アンパンマン|キミとアイドルプリキュア|ポケモン|マッサマン/g, '')
		.replace(/丸美屋食品|丸美屋|マルハニチロ|サンポー食品|サンヨー食品|大塚食品|宝幸/g,'')
		.replace(/味の素|森永乳業|バスコ|CJジャパン|まるか商事|ペヤング/g,'')
		.replace(/一平ちゃん夜店の焼きそば/g,'焼きそば')
		.replace(/1食分の野菜が摂れるグーグーキッチン|KADOYAの/g, '')
		.replace(/日清食品|日本食研|モランボン/g,'')
		// 飲料・食品ブランドの除去
		.replace(/キリンビバレッジ|アサヒビール|アサヒ飲料|サントリー|コカコーラ|コカ・コーラ|伊藤園/g, '')
		.replace(/SNAZZ|KIRIN/g, '')
		.replace(/雪印|よつ葉乳業|よつ葉|丸大食品|明治|森永|小岩井乳業|ダノンジャパン|クラフトボス|ジョージア|レギュラーコーヒー|ブレンディ|バンホーテン|アーマッド|リンツ|ハイチュウ|メリーチョコレート|トップオブザポップ|ニップン|ダイショー|クロレラ食品ハック|デーリー|CASINO|サヴァンシア|プリマハム|米久|三田屋総本家/g, '')
		.replace(/ニュータッチ|凄麺|クノール|伊藤園|UCC|マルサンアイ|マルサン|ソイフーズ|六甲バター|男前豆腐店|GREENDAKARA|ダカラ|フーズ/g, '')
		.replace(/日清製粉ウェルナ|ホテイフーズ|ホテイ|キングオスカー/g,'')
		.replace(/安本|マルコメ|UHA味覚糖/g,'')
		.replace(/明治/g,'')
		.replace(/極洋|和光堂|伊藤ハム/g,'')
		.replace(/徳島製粉|エースコック|エスピー食品|アイリスフーズ|アイリス|エスビー食品|イチビキ/g,'')
		.replace(/レンジDELI/g,'')
		.replace(/銀座/g,'')
		.replace(/ヤマモリ/g, '')
		.replace(/Dセレクション|ボンボン/g, '')
		.replace(/ディップド\s*プレッツェル/g, 'プレッツェル')
		.replace(/Dole|センタン|ハーシー|たいめいけん|ベストプライズ|フリーフロム|DNUFT/g, '')
		// 個別商品・飲料系の寄せ
		.replace(/朝のフレッシュ\s*糖質?/g, 'コーヒーホワイトナー 液状 植物性脂肪')
		.replace(/うまい！|トキメクおやつ部|ありのままの野菜たち|レンジで簡単！/g, '')
		.replace(/マルちゃん/g, '')
		.replace(/ヤマダイ|グリーンアイ|Chill Break/g, '')
		.replace(/フジパン|キョクヨー|CIRIO/g, '')
		.replace(/森永製菓|本格|日清/g, '')
		.replace(/更征|YAMAZEN|城北麺工/g, '')
		.replace(/AGF/g, '')
		.replace(/エスピー食品|キッコーマン/g, '')
		.replace(/サトウ|サトウ食品|マ・マー/g, '')
		.replace(/プロのひと品|レンジでつくる/g, '')
		.replace(/新宿中村屋|シャキ直|入/g, '')
		.replace(/こだわり|やさしごはん|社長の/g, '')
		.replace(/おいしさそのまま|居酒屋の/g, '')
		.replace(/パパッとライス/g, '')
		.replace(/まるごと食べられる|まるごと/g, '')
		.replace(/割れちゃった|うまみとじこめ野菜|うまみとじこめきのこ/g, '')
		.replace(/プロクオリティ|バーモント|完熟トマトの/g, '')
		.replace(/ユニーク総合防災|オーガニック|有機|極|ヴィーガン/g, '') 
		.replace(/久留米|喜多方|札幌|信玄|坂内|大砲|ぶぶか|横浜発祥/g, '')
		.replace(/ゆめぴりか|こしひかり|コシヒカリ|きらら397|安心米|低音製法米のおいしいごはん/g, 'うるち米') 
		.replace(/低温製法米のおいしいごはん/g, 'うるち米')
		.replace(/ななつぼし|つや姫/g, 'うるち米')
		.replace(/カレー|カリー/g, 'カレールウ') 
		.replace(/(カレールウ)屋/g, '$1')
		.replace(/ゴーヤー/g, 'ゴーヤ') 
		.replace(/枝豆/g, 'えだまめ') 
		.replace(/つつみな/g, 'サンチュ') 
		.replace(/カップヌードル/g, 'カップめん') 
		.replace(/きのこたけのこ/g, 'ビスケット等をチョコレートで被覆したもの') 
		.replace(/ヤクルト/g, '乳酸菌飲料')
		.replace(/DONBURI亭/g, '')
		// パン・ブレッド系のブランド表記を簡素化
		.replace(/超熟|本仕込|芳醇|超芳醇|生ぶれっど|生ブレッド|湯種ブレッド|ホテルブレッド|穂のリッチホテルブレッド|山崎|ヤマザキ|パスコ|Pasco/g, '')
		.replace(/ブレッド/g, '食パン')
		.replace(/パンにおいしい/g, '')
		// 炭酸飲料・コーラ
		.replace(/コカコーラ|コカ・コーラ|コカ\b/g, 'コーラ')
		.replace(/のんある気分/g, 'ビール風味炭酸飲料')
		// 追加: ログの未マッチ対応（ブランド・宣伝・表記ゆれなど）
		.replace(/ベビーリーフ大/g, 'ベビーリーフ')
		.replace(/ベビーリーフ/g, 'リーフレタス')
		.replace(/カーネルコーン/g, 'スイートコーン')
		.replace(/フルーツパプリカ/g, 'パプリカ')
		.replace(/グローパイナップル/g, 'パイナップル')
		.replace(/^ナチュラル\s+/, '')
		.replace(/純輝鶏/g, '')
		.replace(/ダノンビオ/g, 'ヨーグルト 全脂無糖')
		.replace(/トブラローネ/g, 'ミルクチョコレート')
		.replace(/萩屋ケイちゃん/g, '調味ソース')
		.replace(/香ばしっ！/g, '')
		.replace(/キタアカリ/g, 'じゃがいも')
		.replace(/真あじ/g, 'まあじ')
		.replace(/真だい|真鯛/g, 'まだい')
		.replace(/銀鮭/g, 'ぎんざけ')
		.replace(/いくら/g, 'イクラ')
		.replace(/明太子/g, 'たらこ')
		.replace(/柿/g, 'かき')
		.replace(/春雨/g, 'はるさめ')
		.replace(/エディブルフラワー|食花/g, '食用花')
		.replace(/レッドキドニー(?:ビーンズ)?|キドニー/g, 'いんげんまめ')
		.replace(/黒豆/g, '黒大豆')
		.replace(/紅ずわいがにほぐしみ/g, 'ずわいがに 水煮缶詰')
		.replace(/さば味付/g, 'さば 缶詰 味付け')
		.replace(/さんま\s*かば焼/g, 'さんま 缶詰 かば焼')
		.replace(/オイルサーディン|いわしの油漬/g, 'いわし 缶詰 油漬')
		.replace(/いか塩辛/g, 'いか 加工品 塩辛')
		.replace(/もずく/g, 'もずく 塩蔵 塩抜き')
		.replace(/めかぶ/g, 'めかぶわかめ')
		.replace(/ベビーチーズ/g, 'プロセスチーズ')
		.replace(/スライスチーズ/g, 'プロセスチーズ')
		.replace(/チェダーチーズ/g, 'ナチュラルチーズ チェダー')
		.replace(/カマンベール/g, 'ナチュラルチーズ カマンベール')
		.replace(/モッツァレラ/g, 'ナチュラルチーズ モッツァレラ')
		.replace(/とろけるチーズ/g, 'ナチュラルチーズ モッツァレラ')
		// 菓子・スイーツ・スナック類の標準化
		.replace(/ムーンライト/g, 'ビスケット ソフトビスケット')
		.replace(/クッキー/g, 'ビスケット ソフトビスケット')
		.replace(/ビスケット/g, 'ビスケット ソフトビスケット')
		.replace(/サブレ/g, 'サブレ')
		.replace(/クラッカー/g, 'クラッカー ソーダクラッカー')
		.replace(/ウエハース/g, 'ウエハース')
		.replace(/プレッツェル/g, 'プレッツェル')
		.replace(/アルフォート|ポッキー|プリッツ|チョコビスケット|チョコがけビスケット/g, 'ビスケット等をチョコレートで被覆したもの')
		.replace(/チョコレート菓子|チョコ菓子|チョコ\b/g, 'ミルクチョコレート')
		.replace(/ダークチョコ|ブラックチョコ/g, 'スイートチョコレート')
		.replace(/ホワイトチョコ/g, 'ホワイトチョコレート')
		.replace(/アーモンドチョコ/g, 'アーモンドチョコレート')
		.replace(/キャラメル/g, 'キャラメル')
		.replace(/ラムネ/g, 'ラムネ')
		.replace(/マシュマロ/g, 'マシュマロ')
		.replace(/グミ/g, 'ゼリーキャンデー')
		.replace(/ゼリー\b(?!\s*(オレンジ|ミルク|ワイン|コーヒー))/g, 'ゼリー ミルク')
		.replace(/プリン/g, 'カスタードプリン')
		.replace(/シュークリーム|エクレア/g, 'シュークリーム')
		.replace(/ドーナツ|ドーナッツ/g, 'ドーナッツ イーストドーナッツ プレーン')
		.replace(/ワッフル/g, 'ワッフル カスタードクリーム入り')
		.replace(/ホットケーキ/g, 'ホットケーキ')
		.replace(/パイ\b/g, 'パイ パイ皮')
		.replace(/アップルパイ/g, 'パイ アップルパイ')
		.replace(/ミートパイ/g, 'パイ ミートパイ')
		.replace(/バームクーヘン|バウムクーヘン/g, 'バターケーキ')
		.replace(/カステラ/g, 'カステラ')
		.replace(/たい焼き|たい焼|今川焼/g, '今川焼 こしあん入り')
		.replace(/どらやき|どら焼き/g, 'どら焼 こしあん入り')
		.replace(/もなか|最中/g, 'もなか こしあん入り')
		.replace(/大福(餅)?/g, '大福もち こしあん入り')
		.replace(/ようかん|羊羹/g, 'きんぎょく糖')
		.replace(/せんべい|煎餅/g, '米菓 しょうゆせんべい')
		.replace(/揚げせん|揚げ煎/g, '米菓 揚げせんべい')
		.replace(/あられ|おかき/g, '米菓 あられ')
		.replace(/ポテトチップス/g, 'ポテトチップス ポテトチップス')
		.replace(/うすしお|のり塩|のりしお|しお味|塩味|ソルト|コンソメ|バターしょうゆ|バター醤油|バター|ガーリック|のり|のり味/g, '')
		.replace(/サワークリーム(?:&|\s+)?オニオン味/g, '')
		.replace(/ポテトクリスプ/g, 'ポテトチップス 成形ポテトチップス')
		.replace(/コーンスナック|とんがりコーン|カール/g, 'コーンスナック')
		.replace(/トルティアチップス/g, 'コーンスナック')
		.replace(/キャンディ|キャンデー/g, 'ドロップ')
			.replace(/飴/g, 'ドロップ')
			.replace(/コーヒー[^\n]*ドロップ/g, 'ドロップ')
			.replace(/のどドロップ/g, 'ドロップ')
		.replace(/板ガム|粒ガム|ガム/g, '糖衣ガム')
		// アイス類
		.replace(/ソフトクリーム/g, 'ソフトクリーム')
		.replace(/ラクトアイス/g, 'ラクトアイス 普通脂肪')
		.replace(/アイスミルク/g, 'アイスミルク')
		.replace(/シャーベット|氷菓/g, 'シャーベット')
		.replace(/アイス(クリーム)?/g, 'アイスクリーム 普通脂肪')
		.replace(/モナカ|チョコモナカ/g, 'アイスクリーム 普通脂肪')
		.replace(/パピコ/g, 'アイスミルク')
		.replace(/ガツン、?と.*みかん|ガツン、?と/g, 'シャーベット')
		.replace(/チョコバリ/g, 'アイスミルク')
		.replace(/白くま/g, 'アイスミルク')
		.replace(/お?赤飯|栗赤飯/g, '赤飯')
		.replace(/ひじき煮|ひじき五目/g, 'ひじきの煮物')
		.replace(/クラムチャウダー|チャウダー|ミネストローネ/g, 'スープ')
		.replace(/参鶏湯|サムゲタン/g, 'スープ')
		.replace(/カップ\s*/g, '')
		.replace(/つぶたっぷり|つぶ入り/g, '')
		.replace(/コーンクリーム/g, 'コーンクリームスープ')
		.replace(/ポタージュ/g, 'スープ')
		.replace(/コーンスープ|コーンポタージュ/g, 'コーンクリームスープ')
		.replace(/きつねうどん|ざるうどん|焼き?うどん|肉うどん|讃岐うどん|ぶっかけうどん/g, 'うどん')
		.replace(/カップめん/g, '中華スタイル即席カップめん')
		.replace(/ラーメン|らーめん|ヌードル/g, '即席中華めん')
		.replace(/とんこつ|背脂|醤油味|しょうゆ味|味噌味|みそ味|塩味/g, '')
		.replace(/ちゃんぽん/g, '即席中華めん')
		.replace(/サンマー麺/g, '即席中華めん')
		.replace(/わかめ\s*即席中華めん/g, '即席中華めん')
		.replace(/スパゲッティ|スパゲティ|パスタ/g, 'マカロニ・スパゲッティ')
		.replace(/マカロニ/g, 'マカロニ・スパゲッティ')
		.replace(/完熟/g, '')
		.replace(/生風味/g, '')
		.replace(/あえる/g, '')
		.replace(/油そば/g, '焼きそば')
		// コーヒー・紅茶等の品名寄せ
		.replace(/インスタントコーヒー/g, 'コーヒー')
		.replace(/アールグレイ|アッサム|ダージリン|セイロン|イングリッシュ\s*ブレックファースト|イングリッシュ\s*ティ(?:No\.)?/g, '紅茶')
		.replace(/鉄観音茶|鉄観音|四季春茶|烏龍茶|ウーロン茶|プーアル茶|プーアル/g, 'ウーロン茶')
		.replace(/ワンタン麺|ワンタンメン/g, '即席中華めん')
		.replace(/もち麦/g, 'おおむぎ 押麦')
		.replace(/麦ごはん/g, 'おおむぎ 押麦 めし')
		.replace(/無調整豆乳|成分無調整豆乳/g, '豆乳')
		.replace(/おいしい豆乳/g, '調製豆乳')
		.replace(/調整?豆乳|豆乳飲料/g, '調製豆乳')
		.replace(/おいしい牛乳|成分無調整牛乳/g, '普通牛乳')
		.replace(/低脂肪乳|おいしい低脂肪(?:乳)?/g, '加工乳 低脂肪')
		.replace(/ヨーグルト(?!ケーキ)/g, 'ヨーグルト 全脂無糖')
		.replace(/ラテ|カフェオレ/g, 'コーヒー コーヒー飲料 乳成分入り 加糖')
		.replace(/日本\s*エクセラふわ.*|ジョージア\s*カフェ.*|ブレンドコーヒー.*微糖/g, 'コーヒー 浸出液')
		.replace(/紅茶\s*浸出液.*(オレ|ミルクティー)?/g, '紅茶 浸出液')
		.replace(/豆乳飲料.*麦芽コーヒー|麦芽コーヒー.*豆乳飲料|豆乳.*麦芽コーヒー/g, '豆乳 豆乳飲料・麦芽コーヒー')
		.replace(/豆腐バー/g, '木綿豆腐')
		.replace(/白和え/g, '青菜の白和え')
		.replace(/麻婆豆腐|マーボー豆腐/g, '麻婆豆腐')
		.replace(/麻婆豆腐の素|マーボー豆腐の素|麻婆の素/g, 'マーボー豆腐の素')
		.replace(/チゲ/g, '豆腐チゲ')
		.replace(/厚揚げ/g, '生揚げ')
		.replace(/肉豆腐/g, '麻婆豆腐')
		.replace(/麦茶/g, '麦茶 浸出液')
		.replace(/緑茶/g, 'せん茶 浸出液')
		.replace(/ほうじ茶/g, 'ほうじ茶 浸出液')
		.replace(/ウーロン茶/g, 'ウーロン茶 浸出液')
		.replace(/紅茶/g, '紅茶 浸出液')
		.replace(/コーヒー(飲料)?/g, 'コーヒー 浸出液')
		.replace(/ココア(飲料)?/g, 'ココア ミルクココア')
		.replace(/ナムル/g, 'もやしのナムル')
		.replace(/山菜/g, 'ぜんまい')
		.replace(/コーヒーゼリー/g, 'ゼリー コーヒー')
		.replace(/釜めし/g, '調味ソース')
		.replace(/ちょい炊き/g, '')
		.replace(/鶏ごぼう/g, 'ごぼう')
		.replace(/きのこ釜めし|きのこごはん/g, 'きのこ')
		.replace(/梅ひじき/g, 'ひじきの煮物')
		.replace(/松茸/g, 'まつたけ')
		.replace(/しらすごはん|しらす/g, 'しらす干し')
		.replace(/黒豚/g, 'ぶた')
		.replace(/かしわ/g, 'にわとり')
		.replace(/地鶏/g, 'にわとり')
		.replace(/寿司のたね|五目寿司のたね|ちらしの素|ちらし寿司の素/g, 'すし酢 ちらし・稲荷用')
		.replace(/豚汁/g, 'とん汁')
		.replace(/煮込みハンバーグ.*/g, '合いびきハンバーグ')
		// 丼ものの寄せ
		.replace(/ごはん付き|ごはんと具材(?:の)?/g, '')
		.replace(/炭火焼き風?とり丼|親子丼/g, '親子丼の具')
		.replace(/牛すき丼|牛丼/g, '牛丼の具')
		.replace(/台湾丼|どて丼/g, '牛丼の具')
		.replace(/ユニ\b/g, '')
		.replace(/ルーロー飯/g, '牛丼の具')
		// カレー・ルウ系の表記ゆれ整理
		.replace(/(欧風|甘口|辛口|中辛|辛|辛さ\d+倍|ゴールド|ネオ|熟成|ごちそう|グランプリ|曜日|噂の名店|赤から|LEE|The|ゴールデン|ボンディ|100時間|レトルト|コク|旨辛|濃厚)/g, '')
		.replace(/(ビーフ|ポーク|チキン|ボン)?カレールウ/g, 'カレールウ')
		// ごはん表記ゆれ
		.replace(/(日本の)?ごはん|米ごはん|あきたこまち|うるち米ごはん/g, 'うるち米')
		.replace(/大盛り|小盛り/g, '')
		.replace(/\d+合炊き/g, '')
		.replace(/\b\d+(?:\.\d+)?\b/g, '')
		// その他ノイズ・ブランド
		.replace(/三宝本家|赤から/g, '')
		.replace(/業\b/g, '')
		.replace(/牛骨/g, '')
		// 肉類の部位標準化（大まかに寄せる）
		.replace(/牛ヒレ|牛ﾋﾚ|牛ヘレ/g, 'うし ヒレ 赤肉 生')
		.replace(/牛ロース/g, 'うし サーロイン')
		.replace(/牛もも/g, 'うし もも')
		.replace(/牛カルビ|カルビ/g, 'ばら')
		.replace(/豚(肉)?ヒレ/g, 'ぶた ヒレ 赤肉 生')
		.replace(/豚(肉)?ロース/g, 'ぶた ロース')
		.replace(/豚(肉)?もも/g, 'ぶた もも')
		.replace(/若どりむね/g, 'にわとり むね 皮なし 生')
		.replace(/若どりもも/g, 'にわとり もも 皮なし 生')
		.replace(/にわとり もも 生/g, 'にわとり もも 皮なし 生')
		.replace(/ウィ?ンナー/g, 'ウインナーソーセージ')
		.replace(/フランク(?:フルト)?/g, 'フランクフルトソーセージ')
		.replace(/おさかな(?:の)?(?:ウィンナー|ウインナー|ソーセージ)/g, '魚肉ソーセージ')
		.replace(/ベーコン/g, 'ばらベーコン')
		.replace(/ステーキ|生姜焼|しょうが焼き|とんかつ|カツ|かたまり/g, '')
		.replace(/生肉/g, '生')
		.replace(/味付け?|原料肉|トンテキ/g, '')
		.replace(/アルトバイエルン/g, 'ウインナーソーセージ')
		.replace(/豚ミンチ/g, 'ぶた ひき肉 生')
		.replace(/牛豚ミンチ[^\s]*/g, '合いびきハンバーグ')
		.replace(/若どり.*ミンチ/g, 'にわとり ひき肉 生')
		.replace(/小間切れ/g, '')
		.replace(/キャベツの千切り|千キャベツ|みじんキャベツ/g, 'キャベツ')
		.replace(/キャベツにら|キャベツピーマン/g, 'キャベツ')
		// 金額・カッコの除去
		.replace(/\d+円[)）]?/g, '')
		.replace(/[()（）]/g, '')
		// 別名・品種の統一
		.replace(/万願寺ししとう/g, 'ししとう')
		.replace(/九条ねぎ|きざみねぎ/g, '葉ねぎ')
		.replace(/白ねぎ/g, '根深ねぎ')
		.replace(/青ねぎ/g, '葉ねぎ')
		.replace(/白菜/g, 'はくさい')
		.replace(/大豆/g, 'だいず')
		.replace(/豆苗/g, 'とうみょう')
		.replace(/キウイ/g, 'キウイフルーツ')
		.replace(/パイン/g, 'パイナップル')
		.replace(/ホワイトマッシュルーム/g, 'マッシュルーム')
		.replace(/ホワイトぶなしめじ/g, 'ぶなしめじ')
		.replace(/霜降りひらたけ/g, 'ひらたけ')
		.replace(/フリルレタス/g, 'リーフレタス')
		.replace(/黒舞茸/g, 'まいたけ')
		.replace(/奥出雲ミディトマト|ミディトマト|フルーツトマト|高リコピン.?トマト|キャロル.?トマト|ピュアトマト/g, 'トマト')
		.replace(/ゼスプリ/g, '')
		.replace(/鳴門金時さつまいも/g, 'さつまいも')
		.replace(/甘栗/g, '栗')
		.replace(/洋梨/g, '西洋なし')
		.replace(/名水美人/g, '')
		.replace(/イオン農場|Torvege|クラブ/g, '')
		.replace(/茎.?ブロッコリー/g, 'ブロッコリー')
		.replace(/メンマ水煮/g, 'メンマ')
		// マルチ食材（区切り以降を削除）
		.replace(/[＆・\/／].+$/g, '')
		.replace(/\s(と|や)\s.+$/g, '')
		// 「○種」「○色」などの宣伝表現を削除
		.replace(/\d+(種|色)の/g, '')
		.replace(/彩り|ベジタブル/g, '')
		// サイズ・数量・パック表記
		.replace(/\s(大|中|小)(?=\s|$)/g, ' ')
		.replace(/大玉|中玉|小玉|Lサイズ|Mサイズ|Sサイズ|Big Pack|ホール|ハーフ/g, '')
		.replace(/ばら|少量|玉|株|房/g, '')
		.replace(/～/g, '')
		// 価格・品目数の宣伝
		.replace(/\d+品目の|\d+種の/g, '')
		.replace(/一日分の野菜が摂れる|1日分の野菜がとれる/g, '')
		.replace(/1日分の野菜が/g, '')
		// 加工・カット・下処理
		.replace(/ざく切り|粗むき|むき|きざみ|ささがき|皮なし|皮むき|皮付|素洗い|ちぎり/g, '')
		.replace(/皮ごと|皮ご/g, '')
		.replace(/洗い/g, '')
		.replace(/みじん(切り)?/g, '')
		.replace(/スティック/g, '')
		.replace(/千\b/g, '')
		.replace(/揚げなす/g, 'なす')
		// キット・用途語
		.replace(/炒め|鍋|スープ|の具材|の具|の素|用|セット|盛合せ|盛り合わせ|アソート|焼肉/g, '')
		// 調味・味付け・だしなど
		.replace(/生食|腹身|骨取り|骨取|腹骨取り|うす塩味|うす塩|薄塩|味付け|西京味噌漬け|味噌漬け|味噌煮|照り焼き|だし|昆布だし|ゆず風味|梅酢|黒酢|三杯酢|米黒酢|だし醤油|ガーリックチーズ|真空|和風おろし|ハーブ|レモン|スモーク|藻塩仕立て|そのまま/g, '')
		.replace(/丼のたれ|のたれ|たれ/g, '')
		// 容態表現
		.replace(/水煮|缶詰|瓶詰/g, '')
		.replace(/固形量/g, '')
		// 魚介類の付帯情報
		.replace(/お刺身|刺身|切身|切り|にぎり寿司|にぎり鮨|寿司種|貫|尾付|尾|小柱|たたき/g, '')
		.replace(/蒲焼/g, 'かば焼')
		.replace(/本鮪り/g, '本まぐろ')
		.replace(/ししゃも\s*オス|オスししゃも/g, 'ししゃも')
		// 料理名をざっくりカテゴリ化
		.replace(/青椒肉絲|回鍋肉|回肉|麻婆なす|チャンプルー|チャンプル|ムニエル|アヒージョ|アクアパッツァ|パエリア|炊き込みご飯/g, '調味ソース')
		.replace(/炊込みご飯/g, '調味ソース')
		// その他
		.replace(/べんり野菜|Vegetive|減の恵み|野菜ソムリエ監修/g, '')
		.replace(/お米のかわりに食べる/g, '')
		.replace(/(^|\s)揚げ(\s|$)/g, ' 油揚げ ')
		.replace(/きれている|切れている/g, '')
		.replace(/ピリ辛|たたき/g, '')
		.replace(/早出し|小粒|ティーバッグ/g, '')
		.replace(/からつき|殻付き/g, '')
		.replace(/スーパースプラウト(?:カップ)?/g, 'ブロッコリースプラウト')
		.replace(/たっこにんにく|田子にんにく/g, 'にんにく')
		.replace(/おろしにんにく|にんにくのガツンと/g, 'にんにく')
		.replace(/株とり/g, '')
		.replace(/※.*$/g, '')
		.replace(/午前便お届け不可|ヤマト便地域全便お届け不可/g, '')
		.replace(/地[:：]\s*[^\s]+/g, '')
		.replace(/[×✕✖︎]/g, '')
		.replace(/千切り|乱切り|細切り|薄切り|厚切り|みじん切り|短冊切り/g, '')
		.replace(/乱/g, '')
		.replace(/小袋|袋入り|袋入/g, '')
		.replace(/おつまみ/g, '')
		.replace(/種野菜の/g, '')
		.replace(/唐王/g, '')
		.replace(/手仕込み|シルキー|香る|グリル|旨味/g, '')
		.replace(/塩[茹ゆ]で/g, '')
		.replace(/ほうれん草/g, 'ほうれんそう')
		.replace(/大根/g, 'だいこん')
		.replace(/長いも/g, 'ながいも')
		.replace(/みず菜|水菜/g, 'みずな')
		.replace(/青じそ|大葉/g, 'しそ')
		.replace(/青葱/g, '青ねぎ')
		.replace(/葱/g, 'ねぎ')
		.replace(/ゴーヤ/g, 'にがうり')
		.replace(/焼そば/g, '焼きそば')
		.replace(/ブロッコリーの新芽/g, 'ブロッコリースプラウト')
		.replace(/イタリアンパセリ/g, 'パセリ')
		.replace(/サンチュみどりちゃん/g, 'サンチュ')
		.replace(/緑豆もやし/g, 'りょくとうもやし')
		.replace(/(^|\s)ねぎ(\s|$)/g, '$1葉ねぎ$2')
		.replace(/焼きなす/g, 'なす')
		.replace(/皮ごと食べられる|そのまま食べられる|食べやすい大きさ/g, '')
		.replace(/／/g,'/')
		.replace(/\u00A0/g, ' ')
		// 色カテゴリなどの前置きを除去（例：赤紫色野菜 ビーツ → ビーツ）
		.replace(/(赤紫色|緑黄色|和風|洋風)野菜/g, '')
		// 細かい食名寄せ
		// サンド・バーガー・ドッグ類はパン種へ寄せる
		.replace(/(一口|満足)?サンド/g, '食パン')
		.replace(/(にわとり|海老|えび|ハンバーグ|たまご|チーズ)?バーガー/g, 'バンズ')
		.replace(/ホットドッグ|ドッグ/g, 'ロールパン')
		.replace(/ベーコンエッグパン/g, 'ロールパン')
		// パンの品種
		.replace(/塩ぱん/g, 'ロールパン')
		.replace(/くるみぱん/g, 'くるみパン')
		.replace(/バゲット[^\s]*/g, 'フランスパン')
		.replace(/.+フランスパン?|ツナオニオンフランス|ラクレット.*チーズフランス/g, 'フランスパン')
		.replace(/パンオショコラ|ダノワーズショコラ/g, 'クロワッサン レギュラータイプ')
		.replace(/グレーズクリンクル/g, 'ドーナッツ イーストドーナッツ プレーン')
		.replace(/りんごとカスタードの食パン/g, '食パン')
		.replace(/はっぴぃ?めろんぱん|メロンパン/g, 'メロンパン')
		.replace(/イタリアンパニーニ/g, 'フランスパン')
		// ベーコンエピはパン扱い（ベーコン語より前に評価）
		.replace(/ベーコンエピ/g, 'フランスパン')
		// すし酢の重複・助六など
		.replace(/(助六|押し?寿司)/g, 'すし酢 巻き寿司・箱寿司用')
		.replace(/割烹/g, '')
		// すし酢の前に余計な語が付くケースを丸ごと圧縮
		.replace(/^.*?すし酢/g, 'すし酢')
		.replace(/すし酢[\s・]*(?:にぎり用酢|巻きすし酢|箱すし酢|にぎり用用|にぎり用|巻き寿司・箱寿司用|酢|用)+/g, 'すし酢 にぎり用')
		.replace(/^すし酢\s*にぎり用.*$/g, 'すし酢 にぎり用')
		.replace(/^すし酢\s*巻き寿司・箱寿司用.*$/g, 'すし酢 巻き寿司・箱寿司用')
		// 麺・米 飯類
		.replace(/牛カレールウ?うどん/g, 'うどん')
		.replace(/(焼き)?ビーフン/g, 'ビーフン')
		.replace(/にゅうめん|素麺|そうめん/g, 'そうめん・ひやむぎ ゆで')
		.replace(/(ご|御)飯/g, 'うるち米')
		.replace(/.+丼.*$/g, 'うるち米')
		.replace(/.*(うるち米).*/g, '$1')
		.replace(/つけ麺/g, '即席中華めん')
		.replace(/鶏照焼の五目/g, '')
		// 惣菜・料理名の寄せ
		.replace(/茶碗むし|茶碗蒸し/g, '鶏卵 全卵 生')
		.replace(/とん平焼き/g, 'お好み焼き')
		.replace(/オムライス|オムレツ/g, '鶏卵 全卵 生')
		.replace(/ミートソースのラザニア風/g, 'ミートソース')
		.replace(/うしとが利いた|旨みが利いた|炭火焼風/g, '')
		.replace(/とろーりれん乳三昧れん乳ホワイト/g, '加糖練乳')
		.replace(/ちゃんちゃん焼き/g, '調味ソース')
		.replace(/お魚の香味野菜焼き/g, '調味ソース')
		.replace(/海鮮和菜.*(つゆ|煮|焼|和え|味噌|みそ)/g, '調味ソース')
		.replace(/海鮮和菜\s*ぶり/g, 'ぶり 成魚 生')
		.replace(/鮮魚亭\s*うなぎひつまぶし/g, 'うなぎ かば焼')
		.replace(/焼鮭ほぐし/g, 'しろさけ 新巻き 焼き')
		.replace(/ろく助塩使|霜降り/g, '')
		.replace(/〆?しめ?さば|塩さば/g, 'まさば')
		.replace(/生もずく/g, 'もずく')
		.replace(/シークヮーサー|かぼす|すだち/g, '')
		.replace(/天然えび.*|デッカイえび.*|えび背わた取(り)?/g, 'バナメイえび 養殖 生')
		.replace(/つぶわさ/g, 'わさび 練り')
		.replace(/バジルパン粉焼/g, '調味ソース')
		.replace(/上質片口イワシ/g, 'かたくちいわし')
		.replace(/プレミアム|無着色|子たらこ/g, 'たらこ')
		.replace(/おかか佃煮/g, 'かつお 加工品 削り節つくだ煮')
		.replace(/種の/g, '')
		.replace(/[＊*].*$/g, '')
		.replace(/たこの酢の物(?:小)?/g, 'まだこ ゆで')
		.replace(/青菜の?白和え.*/g, '青菜の白和え')
		.replace(/はるさめと木耳の酢の物/g, 'はるさめ')
		.replace(/木耳/g, 'きくらげ')
		.replace(/の酢の物/g, '')
		.replace(/だいこんと揚げの煮物/g, 'だいこん')
		// かまぼこ等
		.replace(/チーズかまぼこ/g, '蒸しかまぼこ')
		// ソーセージ類（スナック系）
		.replace(/おやつソーセージ/g, 'ウインナーソーセージ')
		.replace(/ピリ?カルパス|カルパス/g, 'ドライソーセージ')
		// サラダ関連の整理
		.replace(/のサラダ/g, '')
		.replace(/サラダ小/g, '')
		.replace(/ごぼうサラダ/g, 'ごぼう')
		.replace(/ポテトサラダ/g, 'じゃがいも 乾燥マッシュポテト')
		.replace(/^海の幸と/g, '')
		.replace(/海老ブロッコリーのサラダ(?:小)?/g, 'ブロッコリー')
		.replace(/オクラの胡麻和え/g, 'オクラ')
		.replace(/野菜たっぷり/g, '')
		.replace(/フィンガー/g, '')
		.replace(/クリーム\s*バー|クリームバー|クリーム/g, '')
		.replace(/カプレーゼ/g, 'ナチュラルチーズ モッツァレラ')
		// パスタ味種の整理
		.replace(/ペペロンチーノ/g, 'マカロニ・スパゲッティ')
		.replace(/しそ|和風|明太/g, '')
		// パン細かい
		.replace(/マヨコーンパン/g, 'ロールパン')
		.replace(/朝のフレッシュ/g, '')
		.replace(/Master'?\s*s\s*Selection|マスターズセレクション/g, '')
		.replace(/阿波鶏/g, '')
		.replace(/ホワイトナー/g, '')
		.replace(/浸出液ホワイトナー/g, '浸出液 ')
		.replace(/パンにおいしい/g, '')
		// 鶏・サラダチキン・ナゲットなど
		.replace(/サラダにわとり|サラダチキン/g, 'にわとり むね 皮なし 生')
		.replace(/にわとりナゲット|ナゲット/g, 'にわとり')
		.replace(/コロコロ/g, '')
		.replace(/フィレ/g, '')
		// ハム・ベーコン・ソーセージの寄せ
		.replace(/ポークビッツ|ロイヤルポールウインナー|シャウエッセン|香薫|モーニングサーブ|ウイ.?ニー/g, 'ウインナーソーセージ')
		.replace(/DHA[^\s]*/g, '')
		.replace(/無塩せき/g, '')
		.replace(/燻製屋/g, '')
		.replace(/赤身/g, '')
		.replace(/切落し|落とし/g, '')
		.replace(/厚ポークハム.*?/g, 'ロースハム')
		.replace(/豚.*落とし/g, 'ぶた ロース')
		// 揚げ物・天ぷら・惣菜系
		.replace(/エビフライ|海老フライ/g, 'えびフライ')
		.replace(/海老天|えび天/g, 'バナメイえび 養殖 天ぷら')
		.replace(/イカ天/g, 'するめいか 胴 皮なし 天ぷら')
		.replace(/鶏天/g, 'にわとり ささみ 天ぷら')
		.replace(/アジフライ(?:小)?/g, 'まあじ フライ')
		// ピザ・パン
		.replace(/クワトロ/g, 'ピザ生地')
		.replace(/ピッツア|ピッツァ|PIZZA|pizza/g, 'ピザ')
		.replace(/ソリデラ/g, '')
		// 地名・路線・観光ワードの除去
		.replace(/北陸富山|山陰鳥取|東北仙台|山陽岡山|東海道品川|近鉄線奈良|東海道|山陽|山陰|東北/g, '')
		.replace(/N700Sのぞみ/g, '')
		// 寿司のご当地名寄せ
		.replace(/ますのすし|鱒寿司|ます寿司/g, 'すし酢 巻き寿司・箱寿司用')
		.replace(/かきの葉すし|柿の葉寿司|かきの葉寿司/g, 'すし酢 巻き寿司・箱寿司用')
		// 菓子・輸入ブランドのノイズを削除
		.replace(/ウォーカー|セレッシャル|レクラーク|サンミッシェル|ピエールビスキュイットリー|ブルックサイド|ジョルジュモニン|モナン|フーバー|トローリ|マウントハーゲン|クライス|ヴェルタースオリジナル|バールセン|カベンディッシュ|VIVANI|HITSCHLER|ゼスタ|TEARTH|Tokyo\s*Tea\s*Trading|菱和園|ひしわ|アフタヌーンティー|Afternoon\s*Tea|キーコーヒー|カフェランテ|マスコット|デルタインターナショナル|デルタ|東洋ナッツ(?:食品)?|フリトレー|金城製菓|共立食品|川越屋|川口製菓|川本昆布|東洋食品|千年屋|丸正醸造|大阪ぎょくろえん|南国製菓|おとうふ工いしかわ|共栄製茶|正栄食品工業|エバートラストジャパン|富士甚醤油|井崎商店|スタジオオカムラ|リズミックアンドベル|フーバープレッツェル|ハンター|ナチュラルピーク|サニーフルーツ|ラムフォード/g, '')
		.replace(/メープル紅はるか.*食パン/g, '食パン')
		.replace(/.+フランス$/g, 'フランスパン')
		// 乳製品・チーズ類
		.replace(/キリ\s*クリームチーズ\s*り?/g, 'クリームチーズ ')
		.replace(/クリームチーズ/g, 'ナチュラルチーズ クリーム')
		.replace(/ブルーチーズ|ゴルゴンゾーラ/g, 'ナチュラルチーズ ブルー')
		.replace(/パルメザンチーズ|パルメザン/g, 'ナチュラルチーズ パルメザン')
		.replace(/カッテージチーズ|カテージチーズ/g, 'ナチュラルチーズ カテージ')
		.replace(/さけるチーズ.*/g, 'ナチュラルチーズ モッツァレラ')
		.replace(/ビアソーセージ/g, 'ボロニアソーセージ')
		.replace(/CASINO\s*(ゴーダ|マースダム|ミモレット).*/g, 'ナチュラルチーズ ゴーダ')
		.replace(/サヴァンシア.*(ブリー|モンタベール).*/g, 'ナチュラルチーズ カマンベール')
		.replace(/ベルガーダ.*ブルーチーズ.*/g, 'ナチュラルチーズ ブルー')
		.replace(/チーズデザート.*レアチーズケーキ.*/g, 'チーズケーキ レアチーズケーキ')
		.replace(/チーズデザート.*ブルーベリー.*/g, 'チーズケーキ レアチーズケーキ')
		.replace(/チータラ.*/g, 'プロセスチーズ')
		.replace(/豆乳とココナッツ?オイル.*シュレッド.*/g, 'プロセスチーズ')
		// 卵・乳酸菌飲料
		.replace(/ヨード卵\s*光|平飼い(たまご|卵)/g, '鶏卵 全卵 生')
		.replace(/乳酸菌飲料.*Y1000.*/g, '乳酸菌飲料 乳製品')
		.replace(/カルシウム乳酸菌飲料|おいしい免疫ケア|毎朝爽快/g, '乳酸菌飲料 乳製品')
		// その他微修正
		.replace(/カレールウパン/g, 'カレーパン 皮及び具')
		.replace(/チョリソー/g, 'ドライソーセージ')
		.replace(/店内手作り/g, '')
		.replace(/人気のネタを味わう|具材を味わう|出汁が決め手！|自社製/g, '')
		.replace(/ジュワうま！|さっくり衣|サクッと衣|パリッと|ごろっと大粒肉/g, '')
		.replace(/阿波鶏/g, '')
		.replace(/巻き子/g, 'すし酢 巻き寿司・箱寿司用')
		.replace(/細巻/g, 'すし酢 巻き寿司・箱寿司用')
		.replace(/おにぎり.*$/g, 'おにぎり')
		.replace(/\s*声$/g, '')
		.replace(/穴子めし/g, 'あなご 蒸し')
		.replace(/フォカッチャ/g, 'フランスパン')
		.replace(/カリカリポテト/g, 'フライドポテト')
		.replace(/エビフライ|海老フライ/g, 'えびフライ')
		.replace(/海老天|えび天/g, 'バナメイえび 養殖 天ぷら')
		.replace(/イカ天/g, 'するめいか 胴 皮なし 天ぷら')
		.replace(/鶏天/g, 'にわとり ささみ 天ぷら')
		.replace(/ちくわ磯辺揚げ/g, '焼き竹輪')
		.replace(/アジフライ(?:小)?/g, 'まあじ フライ')
		.replace(/(まあじ|アジ)の南蛮(酢|漬け)/g, 'アジの南蛮漬け')
		.replace(/お肉屋さんのコロッケ/g, 'ポテトコロッケ')
		.replace(/焼鳥(?:串)?/g, 'にわとり 焼き鳥缶詰')
		.replace(/鶏のつくね串|つくね串/g, 'にわとり つくね')
		.replace(/豚.*落とし/g, 'ぶた ロース')
		.replace(/厚ポークハム.*?/g, 'ロースハム')
		.replace(/肉団子/g, 'ミートボール')
		.replace(/クワトロ/g, 'ピザ生地')
		.replace(/ピッツア|ピッツァ|PIZZA|pizza/g, 'ピザ')
		.replace(/ソリデラ/g, '')
		.replace(/種チーズ/g, 'チーズ')
		.replace(/種ソーセージ/g, 'ソーセージ')
		.replace(/メープル紅はるか.*食パン/g, '食パン')
		.replace(/.+フランス$/g, 'フランスパン')
		.replace(/おさつ.*クリームロール/g, 'バターケーキ')
		.replace(/おはぎ/g, '大福もち つぶしあん入り')
		// ドライフルーツの寄せ
		.replace(/アプリコッ?ト/g, 'あんず')
		.replace(/デーツ/g, 'なつめやし 乾')
		.replace(/白いちじく/g, 'いちじく 乾')
		.replace(/バナナチップ/g, 'バナナ 乾')
		.replace(/サルタナレーズン/g, '干しぶどう')
		.replace(/小豆の赤飯/g, '赤飯')
		.replace(/ママレード/g, 'マーマレード')
		.replace(/マルゲリータ|ピッツァ|ピザ/g, 'ピザ生地')
		.replace(/太巻巻/g, '太巻')
		.replace(/\bユニ\b/g, '')
		.replace(/ユニ/g, '')
		.replace(/美酢/g, '果実酢 りんご酢')
		.replace(/ヒマラヤ岩塩.*|岩塩/g, '食塩')
		.replace(/ピルクル/g, '乳酸菌飲料 乳製品')
		.replace(/ジョア/g, '乳酸菌飲料 乳製品')
		.replace(/和の紅茶.*ミルクティー/g, '紅茶 浸出液')
		.replace(/アサヒGINON.*/g, '缶チューハイ レモン風味')
		.replace(/黄桜\s*一献/g, '清酒 普通酒')
		.replace(/ロッキーマウンテン.*マシュマロ/g, 'マシュマロ')
		.replace(/リンツ.*カカオ.*/g, 'スイートチョコレート カカオ増量')
		.replace(/カンピー\s*ブルーベリージャム/g, 'ブルーベリー ジャム')
		.replace(/アンナマンマ.*トマト/g, 'トマト')
		.replace(/ポモロッソ.*トマト/g, 'トマト')
		.replace(/淡路島酪農.*淡路島牛乳|淡路島牛乳/g, '普通牛乳')
		.replace(/華はるさめサラダ/g, 'はるさめ')
		.replace(/食べられるレモン/g, 'レモン')
		.replace(/餃子の皮/g, 'ぎょうざ')
		.replace(/甘さすっきり|甘さ控えめ/g, '')
		.replace(/糖質\s*オフ|糖類オフ|オフ/g, '')
		.replace(/\d+\s*(か月|ヶ月|ヵ月)/g, '乳児用調製粉乳')
		.replace(/(餃子|ギョーザ|ギョウザ)/g, 'ぎょうざ')
		.replace(/鶏肉使サラダチキン|鶏の焼鳥串タレ/g, 'にわとり むね 皮なし 生')
		.replace(/若どりささみ/g, 'にわとり ささみ 生')
		.replace(/若どり\s*もも肉/g, 'にわとり もも 皮なし 生')
		.replace(/\b鶏\b/g, 'にわとり')
		.replace(/豚肉超うす|豚肉うす/g, '豚肉')
		.replace(/豚肉/g, 'ぶた')
		.replace(/牛肉/g, 'うし')
		.replace(/鶏肉/g, 'にわとり')
		.replace(/チキン/g, 'にわとり')
		.replace(/ベーカーズアンドベーカ[^\s]*/g, '')
		.replace(/毎日の食卓/g, '')
		.replace(/ステップ\s*キューブ/g, '乳児用調製粉乳')
		.replace(/スゴイダイズ.*無調整.*/g, '豆乳')
		.replace(/ポップコーン/g, 'コーンスナック')
		.replace(/太巻\b/g, 'すし酢 巻き寿司・箱寿司用')
		.replace(/寿司|鮨|すし/g, 'すし酢 にぎり用')
		.replace(/駅|新幹線|本線/g, '')
		.replace(/弁当/g, 'うるち米')
		.replace(/五ツ星/g, '')
		.replace(/めんPRO|PRO|高たんぱく|高タンパク/g, '')
		.replace(/^めん\s+/g, '')
		.replace(/種具材を楽しむ/g, '')
		.replace(/ビタミン[ A-Za-zＡ-Ｚ0-9０-９]+り?\s*/g, '')
		.replace(/プラス糀|米糀から作った/g, '')
		.replace(/甘酒/g, '甘酒')
		.replace(/プルーン(?!\s*(生|乾))/g, 'プルーン 乾')
		.replace(/もち棒|もちスティック/g, 'もち')
		// 飲料（茶・コーヒー・麦茶など）の表記ゆれ吸収
		.replace(/おーいお茶(?:濃い茶)?|緑茶(?:飲料)?/g, 'せん茶 浸出液')
		.replace(/やさしい麦茶|健康ミネラルむぎ茶|麦茶(?:の|\s*)?浸出液?/g, '麦茶 浸出液')
		.replace(/午後の紅茶.*(レモンティー|ミルクティー)/g, '紅茶 浸出液')
		.replace(/午後の紅茶.*おいしい無糖/g, '紅茶 浸出液')
		.replace(/コーヒー\s*飲料/g, 'コーヒー 浸出液')
		// アルコール・ノンアル関連
		.replace(/トリス(?:クラシック)?|ブラックニッカ|角瓶|WHISKY|ウィスキー/g, 'ウイスキー')
		.replace(/ボジョレー|ボージョレ|赤ワイン|白ワイン|ワイン/g, 'スイートワイン')
		.replace(/のんある気分|ノンアル(?:コール)?(?:ビール)?/g, 'ビール風味炭酸飲料')
		// 余分な重複語・空白の整理
		.replace(/\b(浸出液)(?:\s*\1)+\b/g, '$1')
		.replace(/\b(ソフトビスケット)(?:\s*\1)+\b/g, '$1')
		.replace(/(せん茶 浸出液)\1/g, '$1')
		.replace(/カレールウ即席中華めん/g, '即席中華めん')
		.replace(/カレールウカレールウ/g, 'カレールウ')
		.replace(/\s{2,}/g, ' ');

    // 前後の空白を整理
    n = n.trim();

    return { n, amt };
}

const normalizedName: string[] = new Array(products.length);
for (let i = 0; i < products.length; i++) {
	const { n, amt } = normalizeName(products[i].name);

	normalizedName[i] = n;

	products[i].amount = amt;
}

// foodCompositionDatabase読み込み
const DB = foodCompositionDatabase as FoodCompositionDatabase[];
const options = {
	keys: [
		{name : "name", weight: 0.8},
		{name : "remarks", weight: 0.2},
	],
	threshold: 0.4, // 低いほど厳密
	shouldSort: true, // 検索をスコア順にソート
	ignoreLocation: true
}
const fuse = new Fuse(DB, options);

// logのリセット
fs.writeFileSync(logPath, '', 'utf8');

function logAppend(data: string) {
	fs.appendFile(logPath, data+"\n", function(err) {
		if(err) {
			throw err;
		}
	});
}

let matchProducts = 0;
const total = products.length;
for (let i = 0; i < total; i++) {

	const matches = fuse.search(normalizedName[i]);
	const match = matches[0];

	if (match) {
		const foodData = match.item;

		Object.assign(products[i], {
			cholesterol_mg: foodData.cholesterol_mg,
			fiber_g: foodData.fiber_g,
			K_mg: foodData.K_mg,
			Ca_mg: foodData.Ca_mg,
			VitaminC_mg: foodData.VitaminC_mg,
			NaCl_EQ_g: foodData.NaCl_EQ_g,
		});

		// console.log(`✅ ${normalizedName[i]} > ${foodData.name} / ${match.item.remarks}`);
		logAppend(`✅ ${normalizedName[i]} > ${foodData.name} / ${match.item.remarks}`);
		matchProducts++;
	} else {
		// console.log(`❌ だめ: ${normalizedName[i]}`);
		logAppend(`❌ だめ: ${normalizedName[i]}`);
	}

	// 進捗
	const done = Math.floor((i + 1) / total * 30);
	const bar = "#".repeat(done).padEnd(30, "-");
	process.stdout.write(`\r[${bar}] ${i + 1}/${total}`);
}
console.log(); // 改行

console.log("マッチ率:", 100 * matchProducts / products.length , "%");

fs.writeFileSync('src/foodDataUpdate/foodData.json', JSON.stringify(products, null, 4), "utf8");
