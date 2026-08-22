import { headers } from 'next/headers';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ProductGrid from '../../../components/ProductGrid';

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
  compare_at_price?: number;
  image_url: string;
  category_id: number | null;
  options?: any[];
  variants?: any[];
}

export default async function CategoryPage({ params }: { params: { slug: string } }) {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'store';
  
  // Wait for params in Next.js 15+ (Next 14 allows sync access but Next 15 requires awaiting it)
  const resolvedParams = await params;
  const { slug } = resolvedParams;

  if (subdomain === 'localhost' || subdomain === 'www' || !host.includes('.')) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">EaaS Storefront Engine</h1>
        <p className="text-zinc-500">Please visit a specific merchant URL to view this category.</p>
      </div>
    );
  }

  let categories: Category[] = [];
  let products: Product[] = [];
  let fetchError = false;

  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      categories = data.categories || [];
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

  const category = categories.find(c => {
    const fallbackSlug = c.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    return c.slug === slug || fallbackSlug === slug || c.id.toString() === slug;
  });

  if (!category) {
    notFound();
  }

  const categoryProducts = products.filter(p => p.category_id === category.id);

  return (
    <main className="w-full min-h-screen bg-zinc-50 pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        
        {/* Breadcrumbs */}
        <nav className="flex text-sm text-zinc-500 mb-8" aria-label="Breadcrumb">
          <ol className="inline-flex items-center space-x-1 md:space-x-3">
            <li className="inline-flex items-center">
              <Link href="/" className="hover:text-zinc-900 transition-colors">Home</Link>
            </li>
            <li>
              <div className="flex items-center">
                <span className="mx-2">/</span>
                <Link href="/browse/categories" className="hover:text-zinc-900 transition-colors">Categories</Link>
              </div>
            </li>
            <li aria-current="page">
              <div className="flex items-center">
                <span className="mx-2">/</span>
                <span className="text-zinc-900 font-medium">{category.name}</span>
              </div>
            </li>
          </ol>
        </nav>

        {/* Header */}
        <div className="mb-10 flex flex-col md:flex-row md:items-end justify-between gap-6 bg-white p-8 rounded-3xl border border-zinc-200 shadow-sm">
          <div className="flex items-center gap-6">
            {category.image_url && (
              <div className="w-24 h-24 rounded-2xl overflow-hidden bg-zinc-100 flex-shrink-0 border border-zinc-200">
                <img src={category.image_url} alt={category.name} className="w-full h-full object-cover" />
              </div>
            )}
            <div>
              <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">{category.name}</h1>
              <p className="text-zinc-500 mt-2">{categoryProducts.length} Product{categoryProducts.length !== 1 ? 's' : ''}</p>
            </div>
          </div>
        </div>

        {/* Product Grid */}
        {categoryProducts.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-3xl border border-zinc-100">
            <h4 className="text-xl font-medium text-zinc-900">No Products Found</h4>
            <p className="text-zinc-500 mt-2">There are currently no products available in this category.</p>
            <Link href="/" className="inline-block mt-6 px-6 py-3 bg-zinc-900 text-white font-medium rounded-full hover:bg-zinc-800 transition-colors">
              Continue Shopping
            </Link>
          </div>
        ) : (
          <ProductGrid products={categoryProducts} />
        )}
      </div>
    </main>
  );
}
