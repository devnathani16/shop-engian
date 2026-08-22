import React from 'react';
import Link from 'next/link';
import { useCurrency } from './CurrencyProvider';

interface ProductOption {
  id?: number;
  name: string;
  values: string;
}

interface ProductVariant {
  id: number;
  title: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  option5: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  image_url?: string;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  compare_at_price?: number;
  image_url: string;
  options?: ProductOption[];
  variants?: ProductVariant[];
}

export default function ProductGrid({ products }: { products: Product[] }) {
  const { formatPrice } = useCurrency();
  
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-10">
      {products.map((product) => {
        const slug = product.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
        const href = `/product/${product.id}/${slug}`;
        
        return (
          <Link href={href} key={product.id} className="group relative flex flex-col bg-white rounded-2xl overflow-hidden border border-zinc-100 shadow-sm hover:shadow-md transition-shadow">
            <div className="aspect-[4/5] bg-zinc-100 overflow-hidden relative flex items-center justify-center">
              {product.image_url ? (
                <img 
                  src={product.image_url} 
                  alt={product.title} 
                  className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500"
                />
              ) : (
                <span className="text-zinc-400 font-medium">No Image</span>
              )}
            </div>
            <div className="p-5 flex flex-col flex-1">
              <h4 className="text-base font-semibold text-zinc-900 line-clamp-1 group-hover:text-zinc-600 transition-colors">{product.title}</h4>
              {product.description && (
                <p className="text-sm text-zinc-500 mt-1 line-clamp-1">
                  {product.description.replace(/<[^>]*>?/gm, '')}
                </p>
              )}
              {product.variants && product.variants.length > 0 ? (
                (() => {
                  const prices = product.variants.map(v => v.price);
                  const min = Math.min(...prices);
                  const max = Math.max(...prices);
                  return (
                    <p className="text-base font-medium text-zinc-900 mt-2">
                      {min === max ? formatPrice(min) : `${formatPrice(min)} - ${formatPrice(max)}`}
                    </p>
                  );
                })()
              ) : (
                <div className="flex items-center space-x-2 mt-2">
                  <p className="text-base font-medium text-zinc-900">{formatPrice(product.price)}</p>
                  {product.compare_at_price && product.compare_at_price > product.price && (
                    <p className="text-sm font-medium text-zinc-400 line-through">{formatPrice(product.compare_at_price)}</p>
                  )}
                </div>
              )}
              
              <div className="mt-auto pt-4">
                <div className="w-full text-center bg-white border border-zinc-200 text-zinc-900 py-2.5 rounded-xl text-sm font-medium group-hover:bg-zinc-50 group-hover:border-zinc-300 transition-colors">
                  {product.variants && product.variants.length > 0 ? 'Select Options' : 'View Details'}
                </div>
              </div>
            </div>
          </Link>
        );
      })}
    </div>
  );
}

