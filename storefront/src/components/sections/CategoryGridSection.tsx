import Link from 'next/link';

export default function CategoryGridSection({ settings, categories }: { settings: any, categories: any[] }) {
  if (!categories || categories.length === 0) return null;
  const title = settings.title || "Shop by Category";

  return (
    <section className="py-16 bg-theme-bg border-b border-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-8">
          <h3 className="text-2xl font-bold text-theme-text tracking-tight">{title}</h3>
        </div>
        
        <div className="grid grid-cols-4 sm:grid-cols-6 lg:grid-cols-11 gap-4 md:gap-6">
          {categories.map((cat, idx) => {
            let visibilityClass = '';
            if (idx >= 3 && idx < 5) visibilityClass = 'hidden sm:flex';
            else if (idx >= 5 && idx < 10) visibilityClass = 'hidden lg:flex';
            else if (idx >= 10) visibilityClass = 'hidden';

            const catSlug = cat.slug || cat.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');

            return (
              <Link key={cat.id} href={`/category/${catSlug}`} className={`flex flex-col items-center gap-3 group ${visibilityClass}`}>
                <div className="w-full aspect-square rounded-2xl overflow-hidden border border-zinc-200 group-hover:border-theme-primary transition-colors p-1 bg-white">
                  <div className="w-full h-full rounded-xl overflow-hidden bg-zinc-50 flex items-center justify-center">
                    {cat.image_url ? (
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <span className="text-[10px] text-zinc-400 font-medium">No Image</span>
                    )}
                  </div>
                </div>
                <span className="text-xs md:text-sm font-medium text-theme-text group-hover:text-theme-primary text-center line-clamp-1">{cat.name}</span>
              </Link>
            );
          })}
          
          <Link href="/browse/categories" className="flex flex-col items-center gap-3 group">
            <div className="w-full aspect-square rounded-2xl overflow-hidden border border-zinc-200 group-hover:border-theme-primary transition-colors p-1 bg-white">
              <div className="w-full h-full rounded-xl overflow-hidden bg-zinc-50 flex items-center justify-center group-hover:bg-zinc-100 transition-colors">
                <span className="text-xs font-semibold text-zinc-600 group-hover:text-theme-primary">View More</span>
              </div>
            </div>
            <span className="text-xs md:text-sm font-medium text-theme-text group-hover:text-theme-primary text-center">All Categories</span>
          </Link>
        </div>
      </div>
    </section>
  );
}
