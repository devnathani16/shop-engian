'use client';

import React, { useState, useEffect } from 'react';
import { ShoppingBag } from 'lucide-react';
import Link from 'next/link';

interface CartItem {
  variant_id: number;
  quantity: number;
  product: {
    title: string;
    price: number;
    image_url: string;
  }
}

export default function CartButton() {
  const [cart, setCart] = useState<CartItem[]>([]);

  const loadCart = () => {
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
  };

  useEffect(() => {
    loadCart();
    
    window.addEventListener('storage', loadCart);
    
    const handleCartUpdate = () => loadCart();
    window.addEventListener('cart-updated', handleCartUpdate);
    
    return () => {
      window.removeEventListener('storage', loadCart);
      window.removeEventListener('cart-updated', handleCartUpdate);
    };
  }, []);

  const totalItems = cart.reduce((sum, item) => sum + item.quantity, 0);

  return (
    <Link 
      href="/cart"
      className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors relative flex items-center justify-center" 
      title="Cart"
    >
      <ShoppingBag className="w-5 h-5" />
      {totalItems > 0 && (
        <span className="absolute -top-1 -right-1 w-5 h-5 bg-zinc-900 text-white text-[10px] font-bold rounded-full flex items-center justify-center border-2 border-white shadow-sm">
          {totalItems}
        </span>
      )}
    </Link>
  );
}
