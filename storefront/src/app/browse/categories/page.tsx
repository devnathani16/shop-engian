import { headers } from 'next/headers';
import Link from 'next/link';

interface Category {
  id: number;
  name: string;
  slug: string;
  image_url: string;
}

export default async function BrowseCategories() {
  const headersList = await headers();
  const host = headersList.get('host') || '';
  const subdomain = host.split('.')[0] || 'store';

  if (subdomain === 'localhost' || subdomain === 'www' || !host.includes('.')) {
    return (
      <div className="min-h-[60vh] flex flex-col items-center justify-center p-8 text-center">
        <h1 className="text-3xl font-bold mb-4">EaaS Storefront Engine</h1>
        <p className="text-zinc-500">Please visit a specific merchant URL to view their categories.</p>
      </div>
    );
  }

  let categories: Category[] = [];
  let fetchError = false;

  try {
    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog`, {
      cache: 'no-store'
    });
    if (res.ok) {
      const data = await res.json();
      categories = data.categories || [];
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

  return (
    <main className="w-full min-h-screen bg-zinc-50 pt-32 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-bold text-zinc-900 tracking-tight">All Categories</h1>
          <p className="text-zinc-500 mt-3 max-w-2xl mx-auto">Browse our entire collection by category.</p>
        </div>

        {categories.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-zinc-100">
            <h4 className="text-xl font-medium text-zinc-900">No Categories Found</h4>
            <p className="text-zinc-500 mt-2">This store hasn't added any categories yet.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
            {categories.map((cat) => {
              const catSlug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
              return (
              <Link key={cat.id} href={`/category/${catSlug}`} className="flex flex-col items-center gap-4 group">
                <div className="w-full aspect-square rounded-3xl overflow-hidden border border-zinc-200 group-hover:border-zinc-900 transition-colors p-1.5 bg-white shadow-sm hover:shadow-md">
                  <div className="w-full h-full rounded-2xl overflow-hidden bg-zinc-50 flex items-center justify-center">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" />
                    ) : (
                      <span className="text-xs text-zinc-400 font-medium">No Image</span>
                    )}
                  </div>
                </div>
                <span className="text-sm md:text-base font-semibold text-zinc-700 group-hover:text-zinc-900 text-center">{cat.name}</span>
              </Link>
            )})}
          </div>
        )}
      </div>
    </main>
  );
}
