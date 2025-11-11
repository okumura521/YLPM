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
    description: '投稿データを保存するためのGoogle Sheetを作成します。\n\n【手順】\n1. このガイドを閉じた後、画面上部の「シート作成」ボタンをクリック\n2. 指示に従ってGoogle Sheetsを作成\n3. これは最初に一度だけ必要です',
  },
  {
    title: 'ステップ2: AI設定（オプション）',
    description: 'AIを使って投稿文を自動生成できます。\n\n【手順】\n1. 画面右上の「設定」ボタンをクリック\n2. AI設定セクションでOpenAI、Anthropic、Googleのいずれかを選択\n3. APIキーを入力して保存\n※このステップはスキップしても構いません',
  },
  {
    title: 'ステップ3: 初めての投稿を作成',
    description: '準備完了！実際に投稿を作成してみましょう。\n\n【手順】\n1. メインページ（投稿管理画面）に移動\n2. 「新規投稿」ボタンをクリック\n3. 投稿内容を入力して、複数のSNSに一括投稿できます\n\nこのガイドを閉じて、早速始めましょう！',
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
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <AnimatePresence mode="wait">
        <motion.div
          key={currentStep}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <Card className="max-w-2xl w-full relative">
            <Button
              variant="ghost"
              size="icon"
              className="absolute right-2 top-2"
              onClick={handleSkip}
            >
              <X className="h-4 w-4" />
            </Button>

            <CardHeader className="pb-4">
              <CardTitle className="text-2xl">{step.title}</CardTitle>
            </CardHeader>

            <CardContent className="space-y-6">
              <p className="text-lg leading-relaxed text-muted-foreground whitespace-pre-line">
                {step.description}
              </p>

              {/* Progress indicators */}
              <div className="flex justify-center gap-2">
                {ONBOARDING_STEPS.map((_, index) => (
                  <div
                    key={index}
                    className={`h-2 rounded-full transition-all duration-300 ${
                      index === currentStep
                        ? 'w-8 bg-primary'
                        : index < currentStep
                        ? 'w-2 bg-primary/50'
                        : 'w-2 bg-gray-300'
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
                      className="flex items-center gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      戻る
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={handleSkip}
                    className="text-muted-foreground"
                  >
                    スキップ
                  </Button>
                </div>

                <Button
                  onClick={handleNext}
                  className="flex items-center gap-2 min-w-[120px]"
                >
                  {isLastStep ? (
                    <>
                      <Check className="h-4 w-4" />
                      完了
                    </>
                  ) : (
                    <>
                      次へ
                      <ChevronRight className="h-4 w-4" />
                    </>
                  )}
                </Button>
              </div>

              {/* Step counter */}
              <div className="text-center text-sm text-muted-foreground">
                {currentStep + 1} / {ONBOARDING_STEPS.length}
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
