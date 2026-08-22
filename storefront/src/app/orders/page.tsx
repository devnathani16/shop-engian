'use client';

import React, { useState, useEffect } from 'react';
import { useUser, RedirectToSignIn } from '@clerk/nextjs';
import Link from 'next/link';
import { Package, Clock, CheckCircle2, XCircle, ArrowRight, Loader2 } from 'lucide-react';
import { useCurrency } from '@/components/CurrencyProvider';
import { useSearchParams } from 'next/navigation';

export default function OrdersPage() {
  const { formatPrice, isLoading: currencyLoading } = useCurrency();
  const { user, isLoaded, isSignedIn } = useUser();
  const [orders, setOrders] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const searchParams = useSearchParams();

  useEffect(() => {
    if (!isLoaded || !isSignedIn) {
      if (isLoaded && !isSignedIn) setIsLoading(false);
      return;
    }

    const fetchOrders = async () => {
      try {
        const host = window.location.host;
        const subdomain = host.split('.')[0];

        // If redirected from Cashfree, verify payment first
        const cfOrderId = searchParams.get('cf_order_id');
        if (cfOrderId) {
          try {
            await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/checkout/verify-payment`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ cf_order_id: cfOrderId, provider: 'cashfree' })
            });
          } catch (e) {
            console.error('Cashfree verification error:', e);
          }
        }

        // Fetch orders
        const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/orders?customer_id=${user.id}`);
        if (res.ok) {
          const data = await res.json();
          setOrders(data.orders || []);
        }
      } catch (err) {
        console.error("Failed to load orders:", err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchOrders();
  }, [isLoaded, isSignedIn, user, searchParams]);

  const getStatusIcon = (status: string) => {
    if (status.toLowerCase().includes('pending')) return <Clock className="w-5 h-5 text-amber-500" />;
    if (status.toLowerCase().includes('cancelled')) return <XCircle className="w-5 h-5 text-red-500" />;
    return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
  };

  const handleDownloadInvoice = async (orderId: number) => {
    try {
      const printWin = window.open('', '_blank'); // Open synchronously
      const host = window.location.host;
      const subdomain = host.split('.')[0];
      const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/orders/${orderId}/invoice`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ customer_email: user?.primaryEmailAddress?.emailAddress })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.invoice_url) {
          if (printWin) printWin.location.href = data.invoice_url;
          else window.open(data.invoice_url, '_blank');
        } else if (data.html) {
          if (printWin) {
            printWin.document.write(data.html);
            printWin.document.close();
            printWin.focus();
            setTimeout(() => printWin.print(), 500);
          } else {
            alert('Popup blocked. Please allow popups.');
          }
        } else {
          if (printWin) printWin.close();
          alert('Invoice is not available yet.');
        }
      } else {
        if (printWin) printWin.close();
        const data = await res.json();
        alert(data.error || 'Failed to download invoice');
      }
    } catch (err) {
      alert('Failed to download invoice');
    }
  };

  if (!isLoaded || isLoading) {
    return (
      <div className="min-h-screen bg-zinc-50 flex items-center justify-center">
        <Loader2 className="w-10 h-10 animate-spin text-zinc-400" />
      </div>
    );
  }

  if (!isSignedIn) {
    return <RedirectToSignIn />;
  }

  return (
    <div className="min-h-screen bg-zinc-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        
        <div className="flex items-center space-x-4 mb-10 text-sm">
          <Link href="/" className="text-zinc-500 hover:text-zinc-900 transition-colors">Home</Link>
          <span className="text-zinc-300">/</span>
          <span className="font-medium text-zinc-900">My Orders</span>
        </div>

        <h1 className="text-3xl md:text-4xl font-extrabold text-zinc-900 mb-8">Order History</h1>

        {orders.length === 0 ? (
          <div className="bg-white rounded-3xl p-16 text-center border border-zinc-100 shadow-sm flex flex-col items-center">
            <div className="w-24 h-24 bg-zinc-50 rounded-full flex items-center justify-center mb-6">
              <Package className="w-10 h-10 text-zinc-300" />
            </div>
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">No orders yet</h2>
            <p className="text-zinc-500 mb-8">You haven't placed any orders. Start browsing our catalog.</p>
            <Link 
              href="/"
              className="px-8 py-3 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20"
            >
              Start Shopping
            </Link>
          </div>
        ) : (
          <div className="space-y-8">
            {orders.map((order) => (
              <div key={order.id} className="bg-white rounded-3xl border border-zinc-100 shadow-sm overflow-hidden transition-all hover:shadow-md">
                {/* Order Header */}
                <div className="bg-zinc-50/50 p-6 border-b border-zinc-100 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Order #{order.id}</p>
                    <p className="text-sm text-zinc-500">
                      Placed on {new Date(order.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}
                    </p>
                  </div>
                  <div className="flex items-center gap-6">
                    <div>
                      <p className="text-sm font-semibold text-zinc-500 uppercase tracking-wider mb-1">Total</p>
                      <p className="font-bold text-zinc-900">{formatPrice(order.total_amount)}</p>
                    </div>
                    <div className="h-10 w-px bg-zinc-200 hidden md:block"></div>
                    <div className="flex items-center gap-2 bg-white px-4 py-2 rounded-full border border-zinc-200 shadow-sm">
                      {getStatusIcon(order.status)}
                      <span className="font-bold text-sm text-zinc-700">{order.status}</span>
                    </div>
                  </div>
                </div>

                {/* Order Items */}
                <div className="p-6">
                  <div className="space-y-6">
                    {order.items && order.items.map((item: any) => (
                      <div key={item.id} className="flex gap-6 items-center">
                        <div className="w-20 h-20 bg-zinc-50 rounded-2xl overflow-hidden shrink-0 border border-zinc-100">
                          {item.image_url ? (
                            <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                          ) : (
                            <div className="w-full h-full flex items-center justify-center">
                              <Package className="w-6 h-6 text-zinc-300" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-zinc-900 line-clamp-1">{item.title}</h3>
                          <p className="text-sm text-zinc-500 mt-1">Qty: {item.quantity}</p>
                        </div>
                        <div className="text-right">
                          <p className="font-bold text-zinc-900">{formatPrice(item.price)}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                
                {/* Order Footer */}
                <div className="p-6 bg-zinc-50/30 border-t border-zinc-100 text-sm text-zinc-500 flex justify-between items-center flex-wrap gap-4">
                  <div className="flex items-center gap-4">
                    <span>Shipping: {order.shipping_courier || 'Standard'}</span>
                    {order.shiprocket_awb && (
                      <span className="font-medium text-zinc-700 bg-white px-3 py-1 rounded-full border border-zinc-200 shadow-sm">
                        Tracking: {order.shiprocket_awb}
                      </span>
                    )}
                  </div>
                  <div>
                    <button 
                      onClick={() => handleDownloadInvoice(order.id)}
                      className="text-xs font-semibold px-4 py-2 bg-white text-zinc-900 border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-colors shadow-sm"
                    >
                      Download Invoice
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
