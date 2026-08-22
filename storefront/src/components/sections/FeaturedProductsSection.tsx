import Link from 'next/link';
import ProductGrid from '../ProductGrid';

export default function FeaturedProductsSection({ settings, products, currency }: { settings: any, products: any[], currency: string }) {
  const title = settings.title || "Featured Products";
  const subtitle = settings.subtitle || "Curated selections for the modern lifestyle.";

  return (
    <section id="products" className="py-20 bg-theme-bg min-h-[50vh]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between mb-10">
          <div>
            <h3 className="text-2xl font-bold text-theme-text tracking-tight">{title}</h3>
            {subtitle && <p className="text-zinc-500 mt-1">{subtitle}</p>}
          </div>
          {products.length > 0 && (
            <Link href="#" className="hidden sm:block text-sm font-medium text-theme-text hover:underline">
              View all
            </Link>
          )}
        </div>

        {products.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-zinc-100">
            <h4 className="text-xl font-medium text-theme-text">Coming Soon</h4>
            <p className="text-zinc-500 mt-2">This store hasn't added any products yet.</p>
          </div>
        ) : (
          <ProductGrid products={products} />
        )}
      </div>
    </section>
  );
}
