import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface HelpLink {
  label: string;
  url: string;
}

interface HelpTooltipProps {
  title?: string;
  description: string;
  links?: HelpLink[];
  className?: string;
}

export function HelpTooltip({ title, description, links, className }: HelpTooltipProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Info
            className={`h-4 w-4 text-muted-foreground cursor-help hover:text-foreground transition-colors ${className || ''}`}
            aria-label="ヘルプ情報"
          />
        </TooltipTrigger>
        <TooltipContent className="max-w-xs p-4" side="right">
          {title && (
            <p className="font-semibold mb-2 text-sm">{title}</p>
          )}
          <p className="text-sm leading-relaxed whitespace-pre-wrap">{description}</p>
          {links && links.length > 0 && (
            <div className="mt-3 pt-3 border-t">
              <p className="text-xs font-semibold mb-2">参考リンク:</p>
              <ul className="space-y-1">
                {links.map((link, index) => (
                  <li key={index}>
                    <a
                      href={link.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 underline inline-flex items-center gap-1"
                    >
                      {link.label}
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
