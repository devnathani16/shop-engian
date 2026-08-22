'use client';

import React, { useContext } from 'react';
import { ThemeContext } from './ThemeWrapper';
import HeroSection from './sections/HeroSection';
import CategoryGridSection from './sections/CategoryGridSection';
import FeaturedProductsSection from './sections/FeaturedProductsSection';
import TextBlock from './sections/TextBlock';
import TextImageBlock from './sections/TextImageBlock';

export default function DynamicRenderer({ categories, products, currency, subdomain, activePage = 'home' }: { categories: any[], products: any[], currency: string, subdomain: string, activePage?: string }) {
  const theme = useContext(ThemeContext);

  if (!theme) return null;

  const sectionsToRender = theme.pages?.[activePage] || theme.sections || [];

  if (sectionsToRender.length === 0) return null;

  return (
    <main className="w-full">
      {sectionsToRender.map((section: any) => {
        switch (section.type) {
          case 'hero':
            return <HeroSection key={section.id} settings={section.settings} subdomain={subdomain} />;
          case 'category_grid':
            return <CategoryGridSection key={section.id} settings={section.settings} categories={categories} />;
          case 'featured_products':
            return <FeaturedProductsSection key={section.id} settings={section.settings} products={products} currency={currency} />;
          case 'text_block':
            return <TextBlock key={section.id} settings={section.settings} />;
          case 'text_image_block':
            return <TextImageBlock key={section.id} settings={section.settings} />;
          default:
            return <div key={section.id} className="p-4 border-2 border-red-500 m-4">Unknown section type: {section.type}</div>;
        }
      })}
    </main>
  );
}
