import { headers } from 'next/headers';
import Link from 'next/link';
import ThemeWrapper from '../components/ThemeWrapper';
import DynamicRenderer from '../components/DynamicRenderer';

interface Category {
  id: number;
  name: string;
  slug: string;
  image_url: string;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  image_url: string;
}

export default async function Home() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'store';
  
  // Default generic view
  if (subdomain === 'localhost' || subdomain === 'www' || !host.includes('.')) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-4xl font-bold mb-4">EaaS Storefront Engine</h1>
        <p className="text-zinc-500 max-w-md">Please visit a specific merchant URL to view their store.</p>
      </div>
    );
  }

  // Fetch catalog from backend
  let categories: Category[] = [];
  let products: Product[] = [];
  let themeConfig: any = null;
  let shop: any = null;
  let fetchError = false;

  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      shop = data.shop || {};
      categories = data.categories || [];
      products = data.products || [];
    } else {
      fetchError = true;
    }

    const themeRes = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/theme`, {
      cache: 'no-store'
    });
    if (themeRes.ok) {
      const themeData = await themeRes.json();
      themeConfig = themeData.config;
    }
  } catch (e) {
    fetchError = true;
  }

  if (fetchError) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center bg-white">
        <h1 className="text-2xl font-bold mb-2 text-zinc-900">Store Not Found</h1>
        <p className="text-zinc-500">The store "{subdomain}" does not exist or is currently unavailable.</p>
      </div>
    );
  }

  // Fallback to empty sections if no theme is found (though the backend should return default)
  if (!themeConfig) themeConfig = { global: {}, sections: [] };

  return (
    <ThemeWrapper initialTheme={themeConfig}>
      <DynamicRenderer 
        categories={categories} 
        products={products} 
        currency={shop?.currency || 'USD'} 
        subdomain={subdomain}
        activePage="home"
      />
    </ThemeWrapper>
  );
}
