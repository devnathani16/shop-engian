'use client';

import React, { useState, useEffect } from 'react';

export default function DPDPCookieBanner() {
  const [show, setShow] = useState(false);
  
  useEffect(() => {
    if (!localStorage.getItem('dpdp_cookie_consent')) {
      setShow(true);
    }
  }, []);

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-white border-t border-zinc-200 shadow-2xl p-4 sm:p-6 z-50 flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="flex-1 text-sm text-zinc-600 leading-relaxed max-w-4xl">
        <strong>Privacy Notice (DPDP Act, 2023):</strong> We use essential cookies to ensure our checkout and store functions properly. We do not use third-party trackers or sell your personal data. By continuing to use this site, you consent to our privacy practices.
      </div>
      <div className="flex items-center space-x-3 shrink-0">
        <button 
          onClick={() => {
            localStorage.setItem('dpdp_cookie_consent', 'accepted');
            setShow(false);
          }}
          className="bg-zinc-900 text-white px-6 py-2.5 rounded-lg font-semibold hover:bg-zinc-800 transition-colors shadow-md"
        >
          Accept & Continue
        </button>
      </div>
    </div>
  );
}
