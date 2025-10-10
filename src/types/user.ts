// ユーザー情報の型定義

export interface UserInformation {
  name: string;
  monthlyBudget: number;
  resetDay: number;
}

export interface UserHealthSettings {
  disease: string[];
  increaseNutrients: string[];
  reduceNutrients: string[];
}

export interface UserInformationUpdate {
  name?: string;
  monthlyBudget?: number;
  resetDay?: number;
}

// 病気の種類
export type DiseaseType = 'Hypertension' | 'HeartDisease' | 'Sarcopenia' | 'Diabetes' | 'Osteoporosis';

// 増やす栄養素の種類
export type IncreaseNutrientType = 'Protein' | 'VitaminD' | 'Ca' | 'Fiber';

// 減らす栄養素の種類
export type ReduceNutrientType = 'Salt' | 'Fat' | 'Sugar' | 'Vitamin' | 'Mineral';

// 日本語ラベル
export const DISEASE_LABELS: Record<DiseaseType, string> = {
  Hypertension: '高血圧',
  HeartDisease: '心疾患',
  Sarcopenia: 'サルコペニア',
  Diabetes: '糖尿病',
  Osteoporosis: '骨粗鬆症'
};

export const INCREASE_NUTRIENT_LABELS: Record<IncreaseNutrientType, string> = {
  Protein: 'タンパク質',
  VitaminD: 'ビタミンD',
  Ca: 'カルシウム',
  Fiber: '食物繊維'
};

export const REDUCE_NUTRIENT_LABELS: Record<ReduceNutrientType, string> = {
  Salt: '塩分',
  Fat: '脂質',
  Sugar: '糖質',
  Vitamin: 'ビタミン',
  Mineral: 'ミネラル'
};
