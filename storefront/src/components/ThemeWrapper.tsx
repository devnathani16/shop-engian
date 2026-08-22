'use client';

import React, { useState } from 'react';
import ThemePreviewListener from './ThemePreviewListener';

export default function ThemeWrapper({ initialTheme, children }: { initialTheme: any, children: React.ReactNode }) {
  const [theme, setTheme] = useState(initialTheme);

  // Derive CSS variables
  const primary = theme?.global?.colors?.primary || '#000000';
  const background = theme?.global?.colors?.background || '#ffffff';
  const text = theme?.global?.colors?.text || '#1a1a1a';
  const fontFamily = theme?.global?.typography?.fontFamily || 'Inter, sans-serif';

  return (
    <>
      <ThemePreviewListener onThemeChange={setTheme} />
      <style dangerouslySetInnerHTML={{
        __html: `
          :root {
            --theme-primary: ${primary};
            --theme-bg: ${background};
            --theme-text: ${text};
            --theme-font: ${fontFamily};
          }
          body {
            background-color: var(--theme-bg);
            color: var(--theme-text);
            font-family: var(--theme-font);
          }
        `
      }} />
      
      {/* We pass down the live theme object via Context or cloning. 
          For simplicity in this layout, we can use a React Context or just 
          let the children re-render if we clone them.
          Actually, we will use a Context so deeply nested sections can access it.
      */}
      <ThemeContext.Provider value={theme}>
        {children}
      </ThemeContext.Provider>
    </>
  );
}

export const ThemeContext = React.createContext<any>(null);
