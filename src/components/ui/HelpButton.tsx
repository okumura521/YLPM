import { useState } from 'react';
import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface HelpSection {
  title: string;
  content: string;
}

interface HelpButtonProps {
  pageTitle: string;
  sections: HelpSection[];
  className?: string;
}

export function HelpButton({ pageTitle, sections, className }: HelpButtonProps) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={() => setIsOpen(true)}
        className={`flex items-center gap-2 border-2 border-[#00BCD4] text-[#00BCD4] hover:bg-[#00BCD4] hover:text-white transition-all duration-300 shadow-md hover:shadow-lg ${className || ''}`}
      >
        <HelpCircle className="h-4 w-4" />
        ヘルプ
      </Button>

      <Dialog open={isOpen} onOpenChange={setIsOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto ylpm-glass-card-modal">
          <DialogHeader>
            <div className="ylpm-section-header text-2xl">{pageTitle}の使い方</div>
            <DialogDescription>
              このページの機能と使い方を説明します
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 mt-4">
            {sections.map((section, index) => (
              <div key={index} className="space-y-2">
                <h3 className="text-lg font-semibold text-gray-900">
                  {section.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed whitespace-pre-wrap">
                  {section.content}
                </p>
              </div>
            ))}

            <div className="pt-4 border-t">
              <p className="text-sm text-muted-foreground">
                さらに詳しい情報が必要な場合は、Discord 「No135時短&効率改善になるデジタルツールを作って地域の活動に貢献しよう！」チャンネルにお問い合わせください。
              </p>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
