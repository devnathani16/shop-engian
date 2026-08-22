'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ThemePreviewListener({ onThemeChange }: { onThemeChange: (theme: any) => void }) {
  const router = useRouter();

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // In production, verify event.origin
      if (event.data && event.data.type === 'UPDATE_THEME') {
        onThemeChange(event.data.payload);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onThemeChange]);

  return null;
}
