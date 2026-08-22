'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag, X, Plus, Minus, ArrowRight, ShieldCheck, Truck } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface CartItem {
  variant_id: number;
  quantity: number;
  product: {
    title: string;
    price: number;
    image_url: string;
  }
}

import { useCurrency } from '@/components/CurrencyProvider';

export default function CartPage() {
  const router = useRouter();
  const [cart, setCart] = useState<CartItem[]>([]);
  const { formatPrice, isLoading: currencyLoading } = useCurrency();
  const [isLoading, setIsLoading] = useState(true);

  const loadCart = () => {
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
  };

  useEffect(() => {
    loadCart();
    setIsLoading(false);

    window.addEventListener('storage', loadCart);
    const handleCartUpdate = () => loadCart();
    window.addEventListener('cart-updated', handleCartUpdate);
    
    return () => {
      window.removeEventListener('storage', loadCart);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);
  const subtotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const updateQuantity = (variantId: number, delta: number) => {
    const newCart = cart.map(item => {
      if (item.variant_id === variantId) {
        const newQty = item.quantity + delta;
        return { ...item, quantity: newQty > 0 ? newQty : 0 };
      }
      return item;
    }).filter(item => item.quantity > 0);
    
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  const removeItem = (variantId: number) => {
    const newCart = cart.filter(item => item.variant_id !== variantId);
    setCart(newCart);
    localStorage.setItem('cart', JSON.stringify(newCart));
    window.dispatchEvent(new Event('cart-updated'));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-zinc-50">
        <div className="animate-pulse flex flex-col items-center">
          <ShoppingBag className="w-12 h-12 text-zinc-300 mb-4" />
          <div className="h-4 w-32 bg-zinc-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50/50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center space-x-4 mb-10">
          <Link href="/" className="text-zinc-500 hover:text-zinc-900 transition-colors">
            Home
          </Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">Shopping Cart</span>
        </div>

        <h1 className="text-4xl font-extrabold text-zinc-900 tracking-tight mb-12">Your Cart</h1>

        {cart.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-zinc-100 shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6 border-8 border-white shadow-sm">
              <ShoppingBag className="w-10 h-10 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Your cart is empty</h2>
            <p className="text-zinc-500 mb-8 max-w-md">Looks like you haven't added anything to your cart yet. Discover our latest products and collections.</p>
            <Link 
              href="/"
              className="px-8 py-4 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all hover:scale-105 shadow-xl shadow-zinc-900/20"
            >
              Continue Shopping
            </Link>
          </div>
        ) : (
          <div className="lg:grid lg:grid-cols-12 lg:gap-12 lg:items-start">
            <div className="lg:col-span-8 space-y-6">
              {cart.map((item) => (
                <div key={item.variant_id} className="bg-white rounded-3xl p-6 flex flex-col sm:flex-row gap-6 border border-zinc-100 shadow-sm group">
                  <div className="w-full sm:w-40 h-40 bg-zinc-50 rounded-2xl overflow-hidden shrink-0 border border-zinc-100 relative group-hover:border-zinc-300 transition-colors">
                    {item.product.image_url ? (
                      <img src={item.product.image_url} alt={item.product.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-zinc-300">
                        <ShoppingBag className="w-10 h-10" />
                      </div>
                    )}
                  </div>
                  
                  <div className="flex-1 flex flex-col justify-between py-1">
                    <div>
                      <div className="flex justify-between items-start">
                        <div>
                          <h3 className="text-xl font-bold text-zinc-900 mb-1">
                            {item.product.title}
                          </h3>
                          <p className="text-zinc-500 text-sm">Variant details...</p>
                        </div>
                        <button 
                          onClick={() => removeItem(item.variant_id)}
                          className="p-2 text-zinc-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                          title="Remove item"
                        >
                          <X className="w-5 h-5" />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-6">
                      <div className="flex items-center bg-zinc-50 rounded-xl p-1 border border-zinc-200">
                        <button 
                          onClick={() => updateQuantity(item.variant_id, -1)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-zinc-600 transition-all active:scale-95"
                        >
                          <Minus className="w-4 h-4" />
                        </button>
                        <span className="w-12 text-center text-base font-bold text-zinc-900">
                          {item.quantity}
                        </span>
                        <button 
                          onClick={() => updateQuantity(item.variant_id, 1)}
                          className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-white hover:shadow-sm text-zinc-600 transition-all active:scale-95"
                        >
                          <Plus className="w-4 h-4" />
                        </button>
                      </div>
                      <p className="text-2xl font-black text-zinc-900">
                        {formatPrice(item.product.price * item.quantity)}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            <div className="lg:col-span-4 mt-12 lg:mt-0">
              <div className="bg-white rounded-3xl p-8 border border-zinc-100 shadow-xl shadow-zinc-900/5 sticky top-8">
                <h2 className="text-2xl font-bold text-zinc-900 mb-6">Order Summary</h2>
                
                <div className="space-y-4 text-zinc-600 mb-8">
                  <div className="flex justify-between items-center text-lg">
                    <span>Subtotal ({totalItems} items)</span>
                    <span className="font-semibold text-zinc-900">{formatPrice(subtotal)}</span>
                  </div>
                  <div className="flex justify-between items-center text-lg pb-6 border-b border-zinc-100">
                    <span>Shipping estimate</span>
                    <span className="text-sm text-zinc-500 italic">Calculated at checkout</span>
                  </div>
                  <div className="flex justify-between items-center text-2xl font-black text-zinc-900 pt-2">
                    <span>Total</span>
                    <span>{formatPrice(subtotal)}</span>
                  </div>
                </div>

                <Link 
                  href="/checkout" 
                  className="w-full bg-zinc-900 text-white px-6 py-5 rounded-2xl font-bold text-lg hover:bg-zinc-800 transition-all shadow-xl shadow-zinc-900/20 active:scale-[0.98] flex items-center justify-center group mb-6"
                >
                  Checkout securely
                  <ArrowRight className="w-6 h-6 ml-2 group-hover:translate-x-1 transition-transform" />
                </Link>

                <div className="space-y-4">
                  <div className="flex items-center text-sm text-zinc-500">
                    <ShieldCheck className="w-5 h-5 mr-3 text-emerald-500 shrink-0" />
                    <span>Secure encrypted checkout process</span>
                  </div>
                  <div className="flex items-center text-sm text-zinc-500">
                    <Truck className="w-5 h-5 mr-3 text-blue-500 shrink-0" />
                    <span>Live carrier rates and fast shipping</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
