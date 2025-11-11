import React, { createContext, useContext, useState, useEffect } from 'react';

type FontSize = 'small' | 'medium' | 'large';
type CompactMode = boolean;

interface FontSizeContextType {
  fontSize: FontSize;
  compactMode: CompactMode;
  setFontSize: (size: FontSize) => void;
  setCompactMode: (compact: CompactMode) => void;
}

const FontSizeContext = createContext<FontSizeContextType | undefined>(undefined);

const FONT_SIZE_KEY = 'ylpm-font-size';
const COMPACT_MODE_KEY = 'ylpm-compact-mode';

export function FontSizeProvider({ children }: { children: React.ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSize>(() => {
    const saved = localStorage.getItem(FONT_SIZE_KEY);
    return (saved as FontSize) || 'medium';
  });

  const [compactMode, setCompactModeState] = useState<CompactMode>(() => {
    const saved = localStorage.getItem(COMPACT_MODE_KEY);
    return saved === 'true';
  });

  useEffect(() => {
    // フォントサイズのCSSクラスを適用
    const root = document.documentElement;
    root.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
    root.classList.add(`font-size-${fontSize}`);

    // コンパクトモードのCSSクラスを適用
    if (compactMode) {
      root.classList.add('compact-mode');
    } else {
      root.classList.remove('compact-mode');
    }
  }, [fontSize, compactMode]);

  const setFontSize = (size: FontSize) => {
    setFontSizeState(size);
    localStorage.setItem(FONT_SIZE_KEY, size);
  };

  const setCompactMode = (compact: CompactMode) => {
    setCompactModeState(compact);
    localStorage.setItem(COMPACT_MODE_KEY, compact.toString());
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, compactMode, setFontSize, setCompactMode }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (context === undefined) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
