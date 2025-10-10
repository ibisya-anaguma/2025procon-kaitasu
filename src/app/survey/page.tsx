"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import type { DiseaseType, IncreaseNutrientType, ReduceNutrientType } from "@/types/user";
import { DISEASE_LABELS, INCREASE_NUTRIENT_LABELS, REDUCE_NUTRIENT_LABELS } from "@/types/user";

function SurveyPageContent() {
  const router = useRouter();
  const { user } = useAuth();
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  
  // アンケート回答
  const [selectedDiseases, setSelectedDiseases] = useState<DiseaseType[]>([]);
  const [selectedIncreaseNutrients, setSelectedIncreaseNutrients] = useState<IncreaseNutrientType[]>([]);
  const [selectedReduceNutrients, setSelectedReduceNutrients] = useState<ReduceNutrientType[]>([]);

  // アンケート完了済みかチェック（機能オフ中）
  useEffect(() => {
    /* 機能オフ中
    const checkSurveyCompletion = async () => {
      if (!user) return;

      try {
        const idToken = await user.getIdToken();
        const response = await fetch('/api/user-information', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (response.ok) {
          const data = await response.json();
          // すでに完了している場合はホームにリダイレクト
          if (data.surveyCompleted) {
            router.push('/');
          }
        }
      } catch (error) {
        console.error('Error checking survey completion:', error);
      }
    };

    checkSurveyCompletion();
    */
  }, [user, router]);

  const handleNext = async () => {
    if (currentPage < 3) {
      setCurrentPage(currentPage + 1);
    } else {
      // 3ページ目の次へボタン：アンケート結果を保存
      setIsLoading(true);
      try {
        if (user) {
          const idToken = await user.getIdToken();
          
          // アンケート回答を保存
          await fetch('/api/user-information', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              disease: selectedDiseases,
              increaseNutrients: selectedIncreaseNutrients,
              reduceNutrients: selectedReduceNutrients,
            }),
          });

          // アンケート完了フラグを保存
          await fetch('/api/user-information', {
            method: 'PATCH',
            headers: {
              'Authorization': `Bearer ${idToken}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ surveyCompleted: true }),
          });
        }
        router.push('/');
      } catch (error) {
        console.error('Error completing survey:', error);
        router.push('/');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleBack = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
    }
  };

  // ボタンの選択/解除処理
  const toggleDisease = (disease: DiseaseType) => {
    setSelectedDiseases(prev => 
      prev.includes(disease) 
        ? prev.filter(d => d !== disease)
        : [...prev, disease]
    );
  };

  const toggleIncreaseNutrient = (nutrient: IncreaseNutrientType) => {
    setSelectedIncreaseNutrients(prev =>
      prev.includes(nutrient)
        ? prev.filter(n => n !== nutrient)
        : [...prev, nutrient]
    );
  };

  const toggleReduceNutrient = (nutrient: ReduceNutrientType) => {
    setSelectedReduceNutrients(prev =>
      prev.includes(nutrient)
        ? prev.filter(n => n !== nutrient)
        : [...prev, nutrient]
    );
  };

  // 各ページの質問と選択肢
  const getPageContent = () => {
    switch (currentPage) {
      case 1:
        return {
          question: '現在、治療中または持病がありますか？(複数選択できます)',
          options: [
            ...Object.entries(DISEASE_LABELS).map(([key, label]) => ({
              key: key as DiseaseType,
              label,
              isSelected: selectedDiseases.includes(key as DiseaseType),
              onClick: () => toggleDisease(key as DiseaseType),
            })),
            {
              key: 'none' as const,
              label: 'とくになし',
              isSelected: selectedDiseases.length === 0,
              onClick: () => setSelectedDiseases([]),
            },
          ],
        };
      case 2:
        return {
          question: '食事の際、摂取を心がけている栄養はありますか？（複数選択できます）',
          options: [
            ...Object.entries(INCREASE_NUTRIENT_LABELS).map(([key, label]) => ({
              key: key as IncreaseNutrientType,
              label,
              isSelected: selectedIncreaseNutrients.includes(key as IncreaseNutrientType),
              onClick: () => toggleIncreaseNutrient(key as IncreaseNutrientType),
            })),
            {
              key: 'none' as const,
              label: 'とくになし',
              isSelected: selectedIncreaseNutrients.length === 0,
              onClick: () => setSelectedIncreaseNutrients([]),
            },
          ],
        };
      case 3:
        return {
          question: '食事の際、心がけていることはありますか？（複数選択できます）',
          options: [
            ...Object.entries(REDUCE_NUTRIENT_LABELS).map(([key, label]) => ({
              key: key as ReduceNutrientType,
              label,
              isSelected: selectedReduceNutrients.includes(key as ReduceNutrientType),
              onClick: () => toggleReduceNutrient(key as ReduceNutrientType),
            })),
            {
              key: 'none' as const,
              label: 'とくになし',
              isSelected: selectedReduceNutrients.length === 0,
              onClick: () => setSelectedReduceNutrients([]),
            },
          ],
        };
      default:
        return { question: '', options: [] };
    }
  };

  const pageContent = getPageContent();

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: 'var(--, #FDA900)', backgroundColor: '#FDA900' }}>
      <div
        style={{
          width: '1200px',
          height: '720px',
          flexShrink: 0,
          borderRadius: '20px',
          background: 'var(--, #FFF)',
          backgroundColor: '#FFF',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          position: 'relative',
          padding: '40px',
        }}>
        {/* タイトル */}
        <h1
          style={{
            color: 'var(--, #101010)',
            textAlign: 'center',
            fontFamily: '"BIZ UDPGothic"',
            fontSize: '40px',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '100%',
            letterSpacing: '2.08px',
            marginBottom: '40px',
          }}>
          かいたす利用前アンケート
        </h1>

        {/* 質問テキスト */}
        <p
          style={{
            color: 'var(--, #101010)',
            textAlign: 'center',
            fontFamily: '"BIZ UDPGothic"',
            fontSize: '36px',
            fontStyle: 'normal',
            fontWeight: 700,
            lineHeight: '100%',
            letterSpacing: '1.872px',
            marginBottom: '60px',
          }}>
          {pageContent.question}
        </p>

        {/* ボタングリッド（3×2） */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 280px)',
            gridTemplateRows: 'repeat(2, 150px)',
            gap: '31px',
            marginBottom: '60px',
          }}>
          {pageContent.options.map((option, i) => (
            <Button
              key={option.key}
              variant="ghost"
              className="border border-transparent p-0"
              onClick={option.onClick}
              style={{
                width: '280px',
                height: '150px',
                flexShrink: 0,
                borderRadius: '10px',
                border: '6px solid #FDA900',
                background: 'var(--, #FFF)',
                backgroundColor: option.isSelected ? '#FDA900' : '#FFF',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: option.isSelected 
                  ? '0 4px 4px 0 rgba(0, 0, 0, 0.25) inset'
                  : '4.5px 4.5px 0 0 #E4E2E2',
                transition: 'all 0.2s',
              }}>
              <span
                style={{
                  color: 'var(--, #101010)',
                  textAlign: 'center',
                  fontFamily: '"BIZ UDPGothic"',
                  fontSize: '32px',
                  fontStyle: 'normal',
                  fontWeight: 700,
                  lineHeight: 'normal',
                  letterSpacing: '1.664px',
                  whiteSpace: 'pre-line',
                }}>
                {option.label}
              </span>
            </Button>
          ))}
        </div>

        {/* 戻る・次へボタン */}
        <div
          style={{
            display: 'flex',
            gap: '40px',
            position: 'absolute',
            bottom: '40px',
          }}>
          <Button
            variant="ghost"
            className="border border-transparent p-0"
            onClick={handleBack}
            disabled={currentPage === 1}
            style={{
              width: '200px',
              height: '70px',
              flexShrink: 0,
              borderRadius: '15px',
              border: '4px solid #ADADAD',
              background: 'var(--, #FFF)',
              backgroundColor: '#FFF',
              opacity: currentPage === 1 ? 0.5 : 1,
            }}>
            <span
              style={{
                color: 'var(--, #101010)',
                textAlign: 'center',
                fontFamily: '"BIZ UDPGothic"',
                fontSize: '28px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: 'normal',
                letterSpacing: '1.456px',
              }}>
              戻る
            </span>
          </Button>

          <Button
            variant="ghost"
            className="border border-transparent p-0"
            onClick={handleNext}
            disabled={isLoading}
            style={{
              width: '200px',
              height: '70px',
              flexShrink: 0,
              borderRadius: '15px',
              border: '4px solid #FDA900',
              background: 'var(--, #FFF)',
              backgroundColor: '#FFF',
              boxShadow: '4.5px 4.5px 0 0 #E4E2E2',
              opacity: isLoading ? 0.6 : 1,
            }}>
            <span
              style={{
                color: 'var(--, #101010)',
                textAlign: 'center',
                fontFamily: '"BIZ UDPGothic"',
                fontSize: '28px',
                fontStyle: 'normal',
                fontWeight: 700,
                lineHeight: 'normal',
                letterSpacing: '1.456px',
              }}>
              {isLoading ? '保存中...' : currentPage === 3 ? '完了' : '次へ'}
            </span>
          </Button>
        </div>

        {/* ページインジケーター */}
        <div
          style={{
            position: 'absolute',
            top: '20px',
            right: '40px',
            color: '#ADADAD',
            fontFamily: '"BIZ UDPGothic"',
            fontSize: '24px',
            fontWeight: 700,
          }}>
          {currentPage} / 3
        </div>
      </div>
    </div>
  );
}

export default function SurveyPage() {
  return (
    <ProtectedRoute>
      <SurveyPageContent />
    </ProtectedRoute>
  );
}

