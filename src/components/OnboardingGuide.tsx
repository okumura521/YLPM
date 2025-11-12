import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { X, ChevronRight, ChevronLeft, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface OnboardingStep {
  title: string;
  description: string;
}

const ONBOARDING_STEPS: OnboardingStep[] = [
  {
    title: 'YLPMへようこそ！',
    description: 'SNS投稿を効率的に管理できるツールです。まずは3つのステップで始めましょう。',
  },
  {
    title: 'ステップ1: Google Sheetsを作成',
    description: '投稿データを保存するためのGoogle Sheetを作成します。\n\n【手順】\n① このガイドを閉じた後、画面中央の「投稿データ保存先の作成・管理」カードをクリック\n② 「Google Sheet & drive を作成」ボタンを押す\n③ これで投稿データの保存先が作成されます（初回のみ必要）',
  },
  {
    title: 'ステップ2: AI設定（オプション）',
    description: 'AIを使って投稿文を自動生成できます。\n\n【手順】\n① 画面左側の「ユーザー設定」カードをクリック\n② AI設定セクションで「新規追加」ボタンをクリック\n③ OpenAI、Anthropic、Googleのいずれかを選択\n④ APIトークンを入力して保存\n\n※このステップはスキップしても投稿作成は可能です',
  },
  {
    title: 'ステップ3: 初めての投稿を作成',
    description: '準備完了！実際に投稿を作成してみましょう。\n\n【手順】\n① 画面右側の「投稿作成・管理」カードをクリック\n② 緑色の「新規投稿作成」ボタンを押す\n③ プラットフォームを選択して投稿内容を入力\n④ スケジュール設定をして「保存」\n\nこのガイドを閉じて、早速始めましょう！',
  },
];

const STORAGE_KEY = 'ylpm-onboarding-completed';

export function OnboardingGuide() {
  const [isOpen, setIsOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasSeenOnboarding = localStorage.getItem(STORAGE_KEY);
    if (!hasSeenOnboarding) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(STORAGE_KEY, 'true');
    setIsOpen(false);
  };

  const handleNext = () => {
    if (currentStep < ONBOARDING_STEPS.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleClose();
    }
  };

  const handlePrevious = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSkip = () => {
    handleClose();
  };

  if (!isOpen) return null;

  const step = ONBOARDING_STEPS[currentStep];
  const isLastStep = currentStep === ONBOARDING_STEPS.length - 1;

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-black/60 via-[#00BCD4]/20 to-[#FF9800]/20 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.9, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.9, y: -20 }}
          transition={{ duration: 0.3, type: "spring", stiffness: 300, damping: 30 }}
        >
          <Card className="max-w-2xl w-full relative ylpm-glass-card-modal ylpm-bounce-in shadow-2xl">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2 hover:bg-[#00BCD4]/10 transition-colors"
              onClick={handleSkip}
            >
              <X className="h-4 w-4 text-[#00BCD4]" />
            </Button>

            <CardHeader className="pb-4">
              <CardTitle className="text-3xl ylpm-section-header">{step.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <div className="p-6 rounded-lg bg-gradient-to-br from-[#00BCD4]/5 to-[#FF9800]/5 border-l-4 border-[#00BCD4]">
                <p className="text-base leading-relaxed text-gray-700 whitespace-pre-line font-medium">
                  {step.description}
                </p>
              </div>

              {/* Progress indicators */}
              <div className="flex justify-center gap-3">
                {ONBOARDING_STEPS.map((_, index) => (
                  <motion.div
                    key={index}
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: index * 0.1 }}
                    className={`h-3 rounded-full transition-all duration-500 ${
                      index === currentStep
                        ? 'w-12 bg-gradient-to-r from-[#00BCD4] to-[#00ACC1] ylpm-glow shadow-lg'
                        : index < currentStep
                        ? 'w-3 bg-gradient-to-r from-[#00BCD4] to-[#00ACC1] opacity-60'
                        : 'w-3 bg-gray-300'
                    }`}
                  />
                ))}
              </div>

              {/* Action buttons */}
              <div className="flex flex-col sm:flex-row justify-between items-center gap-4 pt-4">
                <div className="flex gap-2">
                  {currentStep > 0 && (
                    <Button
                      variant="outline"
                      onClick={handlePrevious}
                      className="flex items-center gap-2 border-2 border-[#00BCD4]/50 text-[#00BCD4] hover:bg-[#00BCD4]/10 transition-all duration-300"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      戻る
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="text-muted-foreground hover:bg-gray-100 transition-all duration-300"
                  >
                    スキップ
                  </Button>
                </div>

                <Button
                  onClick={handleNext}
                  className={`flex items-center gap-2 min-w-[140px] ${
                    isLastStep
                      ? 'ylpm-btn-success ylpm-glow'
                      : 'ylpm-btn-gradient ylpm-glow'
                  } text-lg py-6`}
                >
                  {isLastStep ? (
                    <>
                      <Check className="h-5 w-5" />
                      完了して始める
                    </>
                  ) : (
                    <>
                      次へ
                      <ChevronRight className="h-5 w-5" />
                    </>
                  )}
                </Button>
              </div>

              {/* Step counter */}
              <div className="text-center">
                <span className="inline-block px-4 py-2 rounded-full bg-gradient-to-r from-[#00BCD4]/10 to-[#FF9800]/10 border-2 border-[#00BCD4]/30 text-sm font-semibold text-[#00BCD4]">
                  ステップ {currentStep + 1} / {ONBOARDING_STEPS.length}
                </span>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
