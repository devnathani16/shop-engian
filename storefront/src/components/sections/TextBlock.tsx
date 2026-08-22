import React from 'react';

export default function TextBlock({ settings }: { settings: any }) {
  return (
    <section className="w-full py-16 bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="max-w-4xl mx-auto px-6 text-center">
        {settings.title && <h2 className="text-3xl md:text-5xl font-bold mb-6 font-[var(--theme-font)]">{settings.title}</h2>}
        {settings.content && <p className="text-lg md:text-xl opacity-90">{settings.content}</p>}
      </div>
    </section>
  );
}
