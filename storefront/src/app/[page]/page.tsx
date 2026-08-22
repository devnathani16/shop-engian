import { headers } from 'next/headers';
import Link from 'next/link';
import ThemeWrapper from '../../components/ThemeWrapper';
import DynamicRenderer from '../../components/DynamicRenderer';
import { notFound } from 'next/navigation';

export default async function CustomPage({ params }: { params: { page: string } }) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'store';
  
  if (subdomain === 'localhost' || subdomain === 'www' || !host.includes('.')) {
    notFound();
  }

  // Await the params per Next.js 15 requirements
  const { page } = await params;

  let categories = [];
  let products = [];
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

  if (fetchError || !themeConfig || !themeConfig.pages || !themeConfig.pages[page]) {
    return (
      <div className="min-h-[80vh] flex flex-col items-center justify-center p-8 text-center bg-white">
        <h1 className="text-2xl font-bold mb-2 text-zinc-900">Page Not Found</h1>
        <p className="text-zinc-500">The page "{page}" does not exist on this store.</p>
        <Link href="/" className="mt-4 text-sm font-medium text-theme-primary hover:underline">
          Return Home
        </Link>
      </div>
    );
  }

  return (
    <ThemeWrapper initialTheme={themeConfig}>
      <DynamicRenderer 
        categories={categories} 
        products={products} 
        currency={shop?.currency || 'USD'} 
        subdomain={subdomain}
        activePage={page}
      />
    </ThemeWrapper>
  );
}
