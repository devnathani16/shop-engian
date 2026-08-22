'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

interface Product {
  id: number;
  title: string;
  price: number;
  compare_at_price?: number;
  image_url: string;
}

export default function ProductRecommendations({ productId, subdomain }: { productId: number, subdomain: string }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/products/${productId}/recommendations`)
      .then(res => {
        if (!res.ok) throw new Error('Failed to fetch recommendations');
        return res.json();
      })
      .then(data => {
        setProducts(data || []);
        setLoading(false);
      })
      .catch(err => {
        console.error(err);
        setLoading(false);
      });
  }, [productId, subdomain]);

  if (loading || products.length === 0) {
    return null;
  }

  return (
    <div className="mt-16 border-t border-zinc-200 pt-16 pb-20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between mb-8">
          <h2 className="text-2xl font-bold tracking-tight text-zinc-900">You may also like</h2>
        </div>
        
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {products.map((product) => (
            <Link key={product.id} href={`/product/${product.id}`} className="group block">
              <div className="aspect-[4/5] w-full overflow-hidden rounded-xl bg-zinc-100 relative">
                {product.image_url ? (
                  <img 
                    src={product.image_url} 
                    alt={product.title} 
                    className="h-full w-full object-cover object-center group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-zinc-200 text-zinc-400">
                    No Image
                  </div>
                )}
                {product.compare_at_price && product.compare_at_price > product.price && (
                  <span className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded">
                    Sale
                  </span>
                )}
              </div>
              <div className="mt-4 flex flex-col">
                <h3 className="text-sm font-medium text-zinc-900 truncate">{product.title}</h3>
                <div className="mt-1 flex items-center space-x-2">
                  <span className="text-sm font-semibold text-zinc-900">${product.price.toFixed(2)}</span>
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <span className="text-xs text-zinc-500 line-through">${product.compare_at_price.toFixed(2)}</span>
                  )}
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
