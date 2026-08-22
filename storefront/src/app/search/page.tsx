'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Search, Filter, X, Loader2 } from 'lucide-react';
import { useSearchParams, useRouter, usePathname } from 'next/navigation';
import ProductGrid from '@/components/ProductGrid';

function SearchContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currency, setCurrency] = useState('USD');
  const [isLoading, setIsLoading] = useState(true);
  
  // Filter state
  const q = searchParams.get('q') || '';
  const minPrice = searchParams.get('min_price') || '';
  const maxPrice = searchParams.get('max_price') || '';
  const categoryId = searchParams.get('category_id') || '';

  const [localQ, setLocalQ] = useState(q);
  const [localMin, setLocalMin] = useState(minPrice);
  const [localMax, setLocalMax] = useState(maxPrice);
  const [localCategory, setLocalCategory] = useState(categoryId);
  
  const [showMobileFilters, setShowMobileFilters] = useState(false);

  useEffect(() => {
    const fetchResults = async () => {
      setIsLoading(true);
      try {
        const host = window.location.host;
        const subdomain = host.split('.')[0];
        
        // Build query string
        const params = new URLSearchParams();
        if (q) params.append('q', q);
        if (minPrice) params.append('min_price', minPrice);
        if (maxPrice) params.append('max_price', maxPrice);
        if (categoryId) params.append('category_id', categoryId);
        
        const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/catalog?${params.toString()}`);
        if (res.ok) {
          const data = await res.json();
          setProducts(data.products || []);
          setCategories(data.categories || []);
          if (data.shop && data.shop.currency) {
            setCurrency(data.shop.currency);
          }
        }
      } catch (e: any) {
        console.error("Search API Error:", e.message || e);
        // Fallback to empty state if backend is unreachable or CORS fails
        setProducts([]);
        setCategories([]);
      } finally {
        setIsLoading(false);
      }
    };
    
    fetchResults();
  }, [q, minPrice, maxPrice, categoryId]);

  const applyFilters = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const params = new URLSearchParams();
    if (localQ) params.append('q', localQ);
    if (localMin) params.append('min_price', localMin);
    if (localMax) params.append('max_price', localMax);
    if (localCategory) params.append('category_id', localCategory);
    
    router.push(`${pathname}?${params.toString()}`);
    setShowMobileFilters(false);
  };

  const clearFilters = () => {
    setLocalQ('');
    setLocalMin('');
    setLocalMax('');
    setLocalCategory('');
    router.push(pathname);
    setShowMobileFilters(false);
  };

  const FilterPanel = () => (
    <div className="space-y-8">
      <div>
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Search</h3>
        <div className="relative">
          <input
            type="text"
            value={localQ}
            onChange={(e) => setLocalQ(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none transition-all"
            onKeyDown={(e) => e.key === 'Enter' && applyFilters()}
          />
          <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-3.5" />
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Price Range</h3>
        <div className="flex items-center space-x-3">
          <div className="flex-1 relative">
            <span className="absolute left-3 top-3 text-zinc-400">$</span>
            <input
              type="number"
              value={localMin}
              onChange={(e) => setLocalMin(e.target.value)}
              placeholder="Min"
              className="w-full pl-7 pr-3 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>
          <span className="text-zinc-400">-</span>
          <div className="flex-1 relative">
            <span className="absolute left-3 top-3 text-zinc-400">$</span>
            <input
              type="number"
              value={localMax}
              onChange={(e) => setLocalMax(e.target.value)}
              placeholder="Max"
              className="w-full pl-7 pr-3 py-3 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none transition-all"
            />
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Category</h3>
        <div className="space-y-2">
          <button
            onClick={() => { setLocalCategory(''); }}
            className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium ${localCategory === '' ? 'bg-zinc-900 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'}`}
          >
            All Categories
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => { setLocalCategory(cat.id.toString()); }}
              className={`w-full text-left px-4 py-2.5 rounded-xl transition-all font-medium ${localCategory === cat.id.toString() ? 'bg-zinc-900 text-white' : 'bg-white hover:bg-zinc-100 text-zinc-600 border border-zinc-200'}`}
            >
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-4 border-t border-zinc-100 flex gap-3">
        <button
          onClick={() => applyFilters()}
          className="flex-1 bg-zinc-900 text-white py-3 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
        >
          Apply Filters
        </button>
        <button
          onClick={clearFilters}
          className="px-4 bg-white border border-zinc-200 text-zinc-600 py-3 rounded-xl font-bold hover:bg-zinc-50 transition-colors"
          title="Clear Filters"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-zinc-50/30">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 tracking-tight">
            {q ? `Search results for "${q}"` : 'Browse Catalog'}
          </h1>
          <button 
            className="md:hidden flex items-center px-4 py-2 bg-white border border-zinc-200 rounded-xl font-medium shadow-sm"
            onClick={() => setShowMobileFilters(true)}
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>
        </div>

        <div className="flex flex-col md:flex-row gap-10">
          {/* Desktop Sidebar */}
          <div className="hidden md:block w-72 shrink-0">
            <div className="sticky top-8 bg-zinc-50 p-6 rounded-3xl border border-zinc-100">
              <FilterPanel />
            </div>
          </div>

          {/* Mobile Sidebar */}
          {showMobileFilters && (
            <div className="fixed inset-0 z-50 flex md:hidden">
              <div className="fixed inset-0 bg-zinc-900/40 backdrop-blur-sm" onClick={() => setShowMobileFilters(false)} />
              <div className="relative ml-auto w-full max-w-sm h-full bg-white shadow-2xl flex flex-col">
                <div className="flex items-center justify-between p-6 border-b border-zinc-100">
                  <h2 className="text-xl font-bold text-zinc-900">Filters</h2>
                  <button onClick={() => setShowMobileFilters(false)} className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-100 rounded-full">
                    <X className="w-6 h-6" />
                  </button>
                </div>
                <div className="p-6 overflow-y-auto flex-1">
                  <FilterPanel />
                </div>
              </div>
            </div>
          )}

          {/* Results Area */}
          <div className="flex-1">
            {isLoading ? (
              <div className="h-64 flex flex-col items-center justify-center">
                <Loader2 className="w-8 h-8 text-zinc-400 animate-spin mb-4" />
                <p className="text-zinc-500 font-medium">Searching catalog...</p>
              </div>
            ) : products.length === 0 ? (
              <div className="bg-white rounded-3xl p-16 text-center border border-zinc-100 shadow-sm flex flex-col items-center">
                <div className="w-20 h-20 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
                  <Search className="w-8 h-8 text-zinc-400" />
                </div>
                <h2 className="text-xl font-bold text-zinc-900 mb-2">No products found</h2>
                <p className="text-zinc-500">Try adjusting your filters or search terms.</p>
                <button 
                  onClick={clearFilters}
                  className="mt-6 px-6 py-2 bg-zinc-100 text-zinc-900 rounded-lg font-medium hover:bg-zinc-200 transition-colors"
                >
                  Clear all filters
                </button>
              </div>
            ) : (
              <div>
                <p className="text-zinc-500 text-sm font-medium mb-6">Showing {products.length} result{products.length !== 1 ? 's' : ''}</p>
                <ProductGrid products={products} />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-zinc-400" /></div>}>
      <SearchContent />
    </Suspense>
  );
}
