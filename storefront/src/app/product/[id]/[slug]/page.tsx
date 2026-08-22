import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import ProductView from '../../../../components/ProductView';
import ProductRecommendations from '../../../../components/ProductRecommendations';

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  compare_at_price?: number;
  image_url: string;
  category_id: number | null;
  options?: any[];
  variants?: any[];
}

export default async function ProductPage({ params }: { params: { id: string; slug: string } }) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'store';
  
  // Wait for params in Next.js 15+
  const resolvedParams = await params;
  const { id } = resolvedParams;

  if (subdomain === 'localhost' || subdomain === 'www' || !host.includes('.')) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">EaaS Storefront Engine</h1>
        <p className="text-zinc-500">Please visit a specific merchant URL to view this product.</p>
      </div>
    );
  }

  let products: Product[] = [];
  let shop: any = null;
  let fetchError = false;

  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      shop = data.shop || {};
      products = data.products || [];
    } else {
      fetchError = true;
    }
  } catch (e) {
    fetchError = true;
  }

  if (fetchError) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-2xl font-bold mb-2">Store Not Found</h1>
        <p className="text-zinc-500">The store "{subdomain}" does not exist or is currently unavailable.</p>
      </div>
    );
  }

  const product = products.find(p => p.id.toString() === id);

  if (!product) {
    notFound();
  }

  return (
    <main>
      <ProductView product={product} currency={shop?.currency || 'USD'} />
      {shop?.enable_ai_recommendations && (
        <ProductRecommendations productId={product.id} subdomain={subdomain} />
      )}
    </main>
  );
}
