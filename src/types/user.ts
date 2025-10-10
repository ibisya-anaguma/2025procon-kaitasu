// ユーザー情報の型定義

export interface UserInformation {
  name: string;
  monthlyBudget: number;
  resetDay: number;
  surveyCompleted?: boolean;
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
  surveyCompleted?: boolean;
}

// 病気の種類
export type DiseaseType = 'Hypertension' | 'KidneyDisease' | 'Sarcopenia' | 'Diabetes' | 'Osteoporosis';

// 増やす栄養素の種類
export type IncreaseNutrientType = 'Protein' | 'VitaminD' | 'Ca' | 'Fiber' | 'Potassium';

// 減らす栄養素の種類
export type ReduceNutrientType = 'Salt' | 'Fat' | 'Sugar' | 'Vitamin' | 'Mineral';

// 日本語ラベル
export const DISEASE_LABELS: Record<DiseaseType, string> = {
  Hypertension: '高血圧',
  KidneyDisease: '腎臓病',
  Sarcopenia: 'サルコペニア',
  Diabetes: '糖尿病',
  Osteoporosis: '骨粗鬆症'
};

export const INCREASE_NUTRIENT_LABELS: Record<IncreaseNutrientType, string> = {
  Protein: 'タンパク質',
  VitaminD: 'ビタミンD',
  Ca: 'カルシウム',
  Fiber: '食物繊維',
  Potassium: 'カリウム'
};

export const REDUCE_NUTRIENT_LABELS: Record<ReduceNutrientType, string> = {
  Salt: '塩分の取りすぎ',
  Fat: '脂質の取りすぎ',
  Sugar: '糖質の取りすぎ',
  Vitamin: 'ビタミン\nの取りすぎ',
  Mineral: 'ミネラル\nの取りすぎ'
};
