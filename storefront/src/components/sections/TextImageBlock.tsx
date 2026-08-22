import React from 'react';

export default function TextImageBlock({ settings }: { settings: any }) {
  return (
    <section className="w-full py-20 bg-[var(--theme-bg)] text-[var(--theme-text)]">
      <div className="max-w-7xl mx-auto px-6 flex flex-col md:flex-row items-center gap-12">
        <div className="w-full md:w-1/2">
          {settings.imageUrl && (
            <img src={settings.imageUrl} alt={settings.title || "Image"} className="w-full h-auto rounded-xl shadow-2xl object-cover aspect-square md:aspect-[4/3]" />
          )}
        </div>
        <div className="w-full md:w-1/2 flex flex-col justify-center">
          {settings.title && <h2 className="text-4xl md:text-5xl font-bold mb-6 font-[var(--theme-font)]">{settings.title}</h2>}
          {settings.content && <p className="text-lg opacity-80 leading-relaxed whitespace-pre-wrap">{settings.content}</p>}
        </div>
      </div>
    </section>
  );
}
