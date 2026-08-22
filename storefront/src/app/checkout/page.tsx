'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import Script from 'next/script';
import { Package, Truck, CreditCard, ChevronRight, CheckCircle, Loader2 } from 'lucide-react';
import { useUser } from '@clerk/nextjs';
import { useCurrency } from '@/components/CurrencyProvider';

declare global {
  interface Window {
    Razorpay: any;
  }
}

type CartItem = any;

interface ShippingRate {
  id: string;
  name: string;
  rate: number;
  estimated_delivery: string;
}

export default function CheckoutPage() {
  const { formatPrice } = useCurrency();
  const { user, isLoaded } = useUser();
  const [cart, setCart] = useState<CartItem[]>([]);
  const [showCustomFieldsModal, setShowCustomFieldsModal] = useState(false);
  const [tempCustomValues, setTempCustomValues] = useState<Record<number, Record<string, string>>>({});
  const [subdomain, setSubdomain] = useState('');
  
  // Checkout Config
  const [checkoutConfig, setCheckoutConfig] = useState<any>(null);
  
  // Custom Fields State
  const [customFieldData, setCustomFieldData] = useState<Record<string, string>>({});

  // Contact State
  const [email, setEmail] = useState('');

  // Address State
  const [selectedAddress, setSelectedAddress] = useState({
    address_line_1: '',
    address_line_2: '',
    city: '',
    state: '',
    country: '',
    postcode: '',
    phone: '',
    lat: 0,
    lon: 0
  });

  // Shipping State
  const [shippingRates, setShippingRates] = useState<ShippingRate[]>([]);
  const [isLoadingRates, setIsLoadingRates] = useState(false);
  const [selectedRate, setSelectedRate] = useState<ShippingRate | null>(null);

  // Payment State
  const [paymentMethod, setPaymentMethod] = useState('COD');

  // Status
  const [isProcessing, setIsProcessing] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [completedOrderId, setCompletedOrderId] = useState<number | null>(null);

  const [discountCode, setDiscountCode] = useState('');
  const [appliedDiscountCode, setAppliedDiscountCode] = useState('');
  const [discountAmount, setDiscountAmount] = useState(0);
  const [discountError, setDiscountError] = useState('');

  // Tax State
  const [taxAmount, setTaxAmount] = useState(0);
  const [taxRate, setTaxRate] = useState(0);
  const [taxBreakdown, setTaxBreakdown] = useState<{name: string; rate: number; amount: number}[]>([]);
  const [taxInclusive, setTaxInclusive] = useState(false);

  useEffect(() => {
    // Load Cart
    const savedCart = JSON.parse(localStorage.getItem('cart') || '[]');
    setCart(savedCart);
    const sub = window.location.hostname.split('.')[0] || 'Store';
    setSubdomain(sub);
    
    // Fetch Checkout Config
    fetch(`http://127.0.0.1:8080/api/storefront/${sub}/checkout/config`)
      .then(res => res.json())
      .then(data => {
        setCheckoutConfig(data);
        if (data.cod_enabled) setPaymentMethod('COD');
        else if (data.stripe_enabled) setPaymentMethod('Stripe');
        else if (data.razorpay_enabled) setPaymentMethod('Razorpay');
        else if (data.payu_enabled) setPaymentMethod('PayU');
        else if (data.paypal_enabled) setPaymentMethod('PayPal');
      })
      .catch(err => console.error(err));
  }, []);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);

  const fetchShippingRates = async (addr: typeof selectedAddress) => {
    if (!addr.postcode || addr.postcode.length < 5 || !addr.country || addr.country.length < 2) return;
    setIsLoadingRates(true);
    try {
      const payload = {
        cart: cart.map((item: any) => ({ variant_id: item.variant_id, quantity: item.quantity })),
        pincode: addr.postcode,
        country: addr.country,
        state: addr.state,
        city: addr.city,
        address_line_1: addr.address_line_1,
        discount_code: appliedDiscountCode
      };
      const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/checkout/rates`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      setShippingRates(data.rates || []);
      setDiscountAmount(data.discount_amount || 0);
      setDiscountError(data.discount_error || '');
      setTaxAmount(data.tax_amount || 0);
      setTaxRate(data.tax_rate || 0);
      setTaxBreakdown(data.tax_breakdown || []);
      setTaxInclusive(data.tax_inclusive || false);
      if (data.rates && data.rates.length > 0) {
        setSelectedRate(data.rates[0]);
      }
    } catch (err) {
      console.error(err);
    }
    setIsLoadingRates(false);
  };

  // Auto-fetch shipping rates when address changes (debounced)
  useEffect(() => {
    if (!subdomain || cart.length === 0) return;
    const timer = setTimeout(() => {
      fetchShippingRates(selectedAddress);
    }, 1000);
    return () => clearTimeout(timer);
  }, [selectedAddress, subdomain, cart, appliedDiscountCode]);

  // Sync Cart for Abandoned Cart Recovery (debounced)
  useEffect(() => {
    if (!subdomain || cart.length === 0 || !email) return;
    const timer = setTimeout(() => {
      fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/cart-sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, cart, value: cartTotal })
      }).catch(err => console.error("Failed to sync cart", err));
    }, 2000);
    return () => clearTimeout(timer);
  }, [email, cart, cartTotal, subdomain]);

  // Pre-fill email if logged in
  useEffect(() => {
    if (isLoaded && user?.primaryEmailAddress?.emailAddress && !email) {
      setEmail(user.primaryEmailAddress.emailAddress);
    }
  }, [isLoaded, user]);

  const handleApplyDiscount = () => {
    setAppliedDiscountCode(discountCode);
  };

  const handleCheckoutClick = () => {
    const needsFields = cart.some(item => {
      if (!item.product?.custom_fields) return false;
      try {
        const fields = JSON.parse(item.product.custom_fields);
        return fields.length > 0 && !item.custom_field_values;
      } catch { return false; }
    });
    if (needsFields) {
      setShowCustomFieldsModal(true);
    } else {
      handlePlaceOrder();
    }
  };

  const handlePlaceOrder = async () => {
    const latestCart = JSON.parse(localStorage.getItem('cart') || '[]');
    const finalCart = latestCart.length > 0 ? latestCart : cart;
    setIsProcessing(true);
    try {
      const payload = {
        cart: finalCart.map((item: any) => ({ variant_id: item.variant_id, quantity: item.quantity, custom_field_values: item.custom_field_values || {} })),
        address: selectedAddress,
        shipping_rate: selectedRate,
        customer_email: email || 'guest@example.com',
        customer_name: user?.fullName || 'Guest',
        customer_id: user?.id || 'guest',
        payment_method: paymentMethod,
        discount_code: appliedDiscountCode,
        custom_field_data: JSON.stringify(customFieldData)
      };


      const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/checkout/process`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      
      if (res.ok) {
        const data = await res.json();
        
        if (paymentMethod === 'PayU' && data.client_secret) {
          try {
            const fields = JSON.parse(data.client_secret);
            const form = document.createElement('form');
            form.method = 'POST';
            form.action = data.payment_url; // https://test.payu.in/_payment
            
            for (const key in fields) {
              const hiddenField = document.createElement('input');
              hiddenField.type = 'hidden';
              hiddenField.name = key;
              hiddenField.value = fields[key];
              form.appendChild(hiddenField);
            }
            
            document.body.appendChild(form);
            form.submit();
          } catch (e) {
            console.error('Failed to parse PayU config', e);
            alert('Failed to initialize PayU payment');
            setIsProcessing(false);
          }
        } else if (paymentMethod === 'Cashfree' && data.client_secret) {
          if (!(window as any).Cashfree) {
            alert('Cashfree SDK is not loaded properly.');
            setIsProcessing(false);
            return;
          }
          try {
            const cashfree = (window as any).Cashfree({
              mode: checkoutConfig.cashfree_environment || 'sandbox'
            });
            cashfree.checkout({
              paymentSessionId: data.client_secret,
              redirectTarget: "_self"
            });
          } catch (e) {
            console.error('Cashfree Error:', e);
            alert('Error initializing Cashfree payment');
            setIsProcessing(false);
          }
        } else if (data.payment_url && (paymentMethod === 'Stripe' || paymentMethod === 'PayPal')) {
          localStorage.removeItem('cart');
          window.location.href = data.payment_url;
        } else if (paymentMethod === 'Razorpay' && data.payment_session_id) {
          if (!checkoutConfig?.razorpay_key_id) {
            alert('DEBUG: Razorpay key is missing from configuration.');
            setIsProcessing(false);
            return;
          }
          if (!window.Razorpay) {
            alert('DEBUG: Razorpay SDK failed to load. window.Razorpay is undefined.');
            setIsProcessing(false);
            return;
          }
          
          try {
            const rzpAmount = Math.round((cartTotal - discountAmount + (selectedRate?.rate || 0) + (taxInclusive ? 0 : taxAmount)) * 100);
            if (rzpAmount < 100) {
              alert('DEBUG: Amount must be at least ₹1 to process payment via Razorpay. Current amount: ' + rzpAmount);
              setIsProcessing(false);
              return;
            }
            const options = {
              key: checkoutConfig.razorpay_key_id,
              amount: rzpAmount,
              currency: 'INR',
              name: checkoutConfig.store_name || 'Store',
              description: 'Order Checkout',
              order_id: data.payment_session_id,
              handler: function (response: any) {
                localStorage.removeItem('cart');
                setCompletedOrderId(data.order_id);
                setOrderComplete(true);
              },
              prefill: {
                name: user?.fullName || 'Guest',
                email: user?.primaryEmailAddress?.emailAddress || 'guest@example.com',
              },
              theme: {
                color: '#18181b'
              },
              modal: {
                ondismiss: function() {
                  setIsProcessing(false);
                }
              }
            };

            const rzp = new window.Razorpay(options);
            rzp.on('payment.failed', function (response: any){
              alert("Payment Failed: " + response.error.description);
              setIsProcessing(false);
            });
            rzp.open();
          } catch (err: any) {
            alert('Failed to open Razorpay checkout: ' + err.message);
            console.error('Razorpay Error:', err);
          }
        } else if (paymentMethod === 'Razorpay' && !data.payment_session_id) {
          alert('Backend returned empty payment_session_id! Please contact support.');
        } else {
          localStorage.removeItem('cart');
          setCompletedOrderId(data.order_id);
          setOrderComplete(true);
        }
      } else {
        const errData = await res.json();
        alert('Checkout failed: ' + (errData.error || 'Unknown error'));
      }
    } catch (err: any) {
      console.error(err);
      alert('Checkout failed: ' + err.message);
    }
    setIsProcessing(false);
  };

  if (orderComplete) {
    return (
      <div className="min-h-screen bg-zinc-50 flex flex-col items-center justify-center p-4">
        <div className="bg-white p-12 rounded-3xl shadow-xl text-center max-w-lg w-full">
          <div className="w-24 h-24 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-12 h-12" />
          </div>
          <h1 className="text-3xl font-extrabold text-zinc-900 mb-4">Order Confirmed!</h1>
          <p className="text-lg text-zinc-500 mb-8">
            Thank you for your purchase. We've received your order and will begin processing it shortly.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <a href="/" className="inline-block bg-zinc-900 text-white px-8 py-4 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20 active:scale-95">
              Continue Shopping
            </a>
            {completedOrderId && (
              <button 
                onClick={async () => {
                  try {
                    const printWin = window.open('', '_blank'); // Open synchronously
                    const res = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/orders/${completedOrderId}/invoice`, {
                      method: 'POST',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ customer_email: email || user?.primaryEmailAddress?.emailAddress })
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
                        alert('Invoice is not available yet. Check My Orders page later.');
                      }
                    } else {
                      if (printWin) printWin.close();
                      alert('Failed to download invoice');
                    }
                  } catch (e) {
                    alert('Error fetching invoice');
                  }
                }}
                className="inline-block bg-white text-zinc-900 border border-zinc-200 px-8 py-4 rounded-xl font-bold hover:bg-zinc-50 transition-colors shadow-sm active:scale-95"
              >
                Download Invoice
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-zinc-50 font-sans pb-24">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-24">
        <h1 className="text-3xl font-extrabold text-zinc-900 mb-8">Checkout</h1>
        
        <div className="flex flex-col lg:flex-row gap-10">
          
          {/* Left Column: Forms */}
          <div className="w-full lg:w-2/3 space-y-8">
            
            {/* Contact Information Section */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold mr-4">1</div>
                <h2 className="text-xl font-bold text-zinc-900">Contact Information</h2>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-zinc-700 mb-1">Email Address</label>
                <input 
                  type="email" 
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                />
              </div>
            </div>

            {/* Address Section */}
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold mr-4">2</div>
                <h2 className="text-xl font-bold text-zinc-900">Delivery Address</h2>
              </div>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Phone Number</label>
                  <input 
                    type="tel" 
                    value={selectedAddress.phone}
                    onChange={(e) => setSelectedAddress({...selectedAddress, phone: e.target.value})}
                    placeholder="+1 (555) 000-0000"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Address Line 1</label>
                  <input 
                    type="text" 
                    value={selectedAddress.address_line_1}
                    onChange={(e) => setSelectedAddress({...selectedAddress, address_line_1: e.target.value})}
                    placeholder="123 Main St"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-1">Address Line 2 (Optional)</label>
                  <input 
                    type="text" 
                    value={selectedAddress.address_line_2}
                    onChange={(e) => setSelectedAddress({...selectedAddress, address_line_2: e.target.value})}
                    placeholder="Apartment 4B"
                    className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                  />
                </div>
                
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">City</label>
                    <input 
                      type="text" 
                      value={selectedAddress.city}
                      onChange={(e) => setSelectedAddress({...selectedAddress, city: e.target.value})}
                      placeholder="New York"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">State / Province</label>
                    <input 
                      type="text" 
                      value={selectedAddress.state}
                      onChange={(e) => setSelectedAddress({...selectedAddress, state: e.target.value})}
                      placeholder="NY"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Country</label>
                    <select
                      value={selectedAddress.country}
                      onChange={(e) => setSelectedAddress({...selectedAddress, country: e.target.value})}
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                    >
                      <option value="">Select Country</option>
                      <option value="IN">India</option>
                      <option value="US">United States</option>
                      <option value="GB">United Kingdom</option>
                      <option value="CA">Canada</option>
                      <option value="AU">Australia</option>
                      <option value="DE">Germany</option>
                      <option value="FR">France</option>
                      <option value="SG">Singapore</option>
                      <option value="AE">UAE</option>
                      <option value="NZ">New Zealand</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-1">Pincode / Zip Code</label>
                    <input 
                      type="text" 
                      value={selectedAddress.postcode}
                      onChange={(e) => setSelectedAddress({...selectedAddress, postcode: e.target.value})}
                      placeholder="10001"
                      className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Shipping Section */}
            <div className={`bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 transition-opacity ${!selectedAddress ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold mr-4">3</div>
                <h2 className="text-xl font-bold text-zinc-900">Shipping Method</h2>
              </div>
              
              {isLoadingRates ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="w-8 h-8 animate-spin text-zinc-400" />
                </div>
              ) : shippingRates.length > 0 ? (
                <div className="space-y-3">
                  {shippingRates.map(rate => (
                    <label 
                      key={rate.id}
                      className={`flex items-center justify-between p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedRate?.id === rate.id ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}
                    >
                      <div className="flex items-center">
                        <input 
                          type="radio" 
                          name="shipping_rate" 
                          className="w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                          checked={selectedRate?.id === rate.id}
                          onChange={() => setSelectedRate(rate)}
                        />
                        <div className="ml-4">
                          <p className="font-semibold text-zinc-900">{rate.name}</p>
                          <p className="text-sm text-zinc-500">{rate.estimated_delivery}</p>
                        </div>
                      </div>
                      <span className="font-bold text-zinc-900">
                        {rate.rate === 0 ? 'Free' : `₹${rate.rate.toFixed(2)}`}
                      </span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="text-zinc-500 text-sm">
                  {selectedAddress ? 
                    "No shipping methods are currently available for this region." : 
                    "Please select a valid address to see shipping rates."}
                </div>
              )}
            </div>

            {/* Custom Fields Section */}
            {checkoutConfig && checkoutConfig.custom_checkout_fields && JSON.parse(checkoutConfig.custom_checkout_fields).length > 0 && (
              <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100">
                <div className="flex items-center mb-6">
                  <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold mr-4">*</div>
                  <h2 className="text-xl font-bold text-zinc-900">Additional Information</h2>
                </div>
                <div className="space-y-4">
                  {JSON.parse(checkoutConfig.custom_checkout_fields).map((field: any, idx: number) => (
                    <div key={idx}>
                      <label className="block text-sm font-medium text-zinc-700 mb-1">
                        {field.name} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      <input 
                        type="text" 
                        value={customFieldData[field.name] || ''}
                        onChange={(e) => setCustomFieldData({...customFieldData, [field.name]: e.target.value})}
                        required={field.required}
                        className="w-full px-4 py-3 bg-zinc-50 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-all"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment Section */}
            <div className={`bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 transition-opacity ${!selectedRate ? 'opacity-50 pointer-events-none' : ''}`}>
              <div className="flex items-center mb-6">
                <div className="w-8 h-8 rounded-full bg-zinc-900 text-white flex items-center justify-center font-bold mr-4">4</div>
                <h2 className="text-xl font-bold text-zinc-900">Payment</h2>
              </div>
              
              <div className="space-y-4">
                {checkoutConfig?.cod_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'COD' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="COD"
                      checked={paymentMethod === 'COD'}
                      onChange={() => setPaymentMethod('COD')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900 flex items-center">
                        Cash on Delivery (COD)
                        <span className="ml-3 px-2 py-0.5 rounded text-xs font-bold bg-emerald-100 text-emerald-700">Available</span>
                      </p>
                      <p className="text-sm text-zinc-500 mt-1">Pay with cash when your order is delivered to your address.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}

                {!checkoutConfig?.stripe_enabled && !checkoutConfig?.razorpay_enabled && !checkoutConfig?.cod_enabled && !checkoutConfig?.paypal_enabled && (
                  <div className="p-4 bg-red-50 text-red-600 rounded-xl text-sm font-medium border border-red-100">
                    No payment methods are currently configured for this store.
                  </div>
                )}

                {checkoutConfig?.stripe_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'Stripe' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="Stripe"
                      checked={paymentMethod === 'Stripe'}
                      onChange={() => setPaymentMethod('Stripe')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900">Pay with Card (Stripe)</p>
                      <p className="text-sm text-zinc-500 mt-1">Securely pay with your credit or debit card via Stripe.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}

                {checkoutConfig?.paypal_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'PayPal' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="PayPal"
                      checked={paymentMethod === 'PayPal'}
                      onChange={() => setPaymentMethod('PayPal')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900">Pay with PayPal</p>
                      <p className="text-sm text-zinc-500 mt-1">Securely pay with your PayPal account or credit card.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}

                {checkoutConfig?.razorpay_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'Razorpay' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="Razorpay"
                      checked={paymentMethod === 'Razorpay'}
                      onChange={() => setPaymentMethod('Razorpay')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900">Pay with Razorpay</p>
                      <p className="text-sm text-zinc-500 mt-1">Pay with UPI, Cards, Netbanking via Razorpay.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}

                {checkoutConfig?.payu_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'PayU' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="PayU"
                      checked={paymentMethod === 'PayU'}
                      onChange={() => setPaymentMethod('PayU')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900">Pay with PayU</p>
                      <p className="text-sm text-zinc-500 mt-1">Pay with Cards, UPI, Wallets, and Netbanking via PayU.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}

                {checkoutConfig?.cashfree_enabled && (
                  <label className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === 'Cashfree' ? 'border-zinc-900 bg-zinc-50' : 'border-zinc-100 hover:border-zinc-200'}`}>
                    <input 
                      type="radio" 
                      name="payment_method" 
                      value="Cashfree"
                      checked={paymentMethod === 'Cashfree'}
                      onChange={() => setPaymentMethod('Cashfree')}
                      className="mt-1 w-4 h-4 text-zinc-900 border-zinc-300 focus:ring-zinc-900" 
                    />
                    <div className="ml-4 flex-1">
                      <p className="font-semibold text-zinc-900">Pay with Cashfree</p>
                      <p className="text-sm text-zinc-500 mt-1">Pay with UPI, Cards, Netbanking, and Wallets via Cashfree.</p>
                    </div>
                    <CreditCard className="w-6 h-6 text-zinc-400" />
                  </label>
                )}
              </div>
            </div>

          </div>

          {/* Right Column: Order Summary */}
          <div className="w-full lg:w-1/3">
            <div className="bg-white p-8 rounded-3xl shadow-sm border border-zinc-100 sticky top-24">
              <h2 className="text-xl font-bold text-zinc-900 mb-6">Order Summary</h2>
              
              <div className="space-y-4 mb-6">
                {cart.map((item, idx) => (
                  <div key={idx} className="flex items-center space-x-4">
                    <div className="w-16 h-16 bg-zinc-100 rounded-xl overflow-hidden shrink-0">
                      {item.product.image_url ? (
                        <img src={item.product.image_url} className="w-full h-full object-cover" />
                      ) : (
                        <Package className="w-6 h-6 text-zinc-300 m-5" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-zinc-900 line-clamp-1">{item.product.title}</h4>
                      <p className="text-sm text-zinc-500">Qty: {item.quantity}</p>
                    </div>
                    <div className="font-semibold text-zinc-900">
                      {formatPrice(item.product.price * item.quantity)}
                    </div>
                  </div>
                ))}
              </div>

              <div className="border-t border-zinc-100 pt-6 space-y-3 mb-6">
                
                {/* Discount Code Input */}
                <div className="flex space-x-2 pb-4">
                  <input 
                    type="text" 
                    placeholder="Discount code" 
                    value={discountCode}
                    onChange={(e) => setDiscountCode(e.target.value.toUpperCase())}
                    className="flex-1 px-4 py-2 border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 outline-none uppercase"
                  />
                  <button 
                    onClick={handleApplyDiscount}
                    className="px-4 py-2 bg-zinc-100 hover:bg-zinc-200 text-zinc-900 font-medium rounded-xl transition-colors"
                  >
                    Apply
                  </button>
                </div>
                {discountError && <p className="text-red-500 text-sm">{discountError}</p>}
                
                <div className="flex justify-between text-zinc-500">
                  <span>Subtotal</span>
                  <span>{formatPrice(cartTotal)}</span>
                </div>
                {discountAmount > 0 && (
                  <div className="flex justify-between text-emerald-600 font-medium">
                    <span>Discount ({appliedDiscountCode})</span>
                    <span>-{formatPrice(discountAmount)}</span>
                  </div>
                )}
                <div className="flex justify-between text-zinc-500">
                  <span>Shipping</span>
                  <span>{selectedRate ? (selectedRate.rate === 0 ? 'Free' : formatPrice(selectedRate.rate)) : '-'}</span>
                </div>
                {taxAmount > 0 && (
                  <div className="flex justify-between text-zinc-500">
                    <span>{taxBreakdown.length > 0 ? taxBreakdown.map(t => t.name).join(' + ') : 'Tax'} ({(taxRate * 100).toFixed(0)}%)</span>
                    <span>{taxInclusive ? 'Included' : formatPrice(taxAmount)}</span>
                  </div>
                )}
                {taxInclusive && taxAmount > 0 && (
                  <div className="text-xs text-zinc-400">
                    Incl. {formatPrice(taxAmount)} tax
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg text-zinc-900 pt-3 border-t border-zinc-100">
                  <span>Total</span>
                  <span>{formatPrice(cartTotal - discountAmount + (selectedRate?.rate || 0) + (taxInclusive ? 0 : taxAmount))}</span>
                </div>
              </div>

              <div className="mt-8 mb-6 bg-zinc-50 border border-zinc-200 p-4 rounded-xl flex items-start space-x-3">
                <input 
                  type="checkbox" 
                  id="dpdp-consent"
                  checked={dpdpConsent}
                  onChange={(e) => setDpdpConsent(e.target.checked)}
                  className="mt-1 w-5 h-5 rounded border-zinc-300 text-zinc-900 focus:ring-zinc-900"
                />
                <label htmlFor="dpdp-consent" className="text-xs text-zinc-600 leading-relaxed cursor-pointer select-none">
                  <strong>Mandatory Consent:</strong> I explicitly consent to the collection and processing of my personal data (Name, Email, Address, Phone) to fulfill this order and for legal compliance purposes, in accordance with the Digital Personal Data Protection (DPDP) Act, 2023. I understand I have the right to request erasure of this data at any time.
                </label>
              </div>

              <button 
                onClick={handleCheckoutClick}
                disabled={!selectedRate || isProcessing}
                className="w-full bg-zinc-900 text-white py-4 rounded-xl font-bold hover:bg-zinc-800 transition-colors shadow-lg shadow-zinc-900/20 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none flex items-center justify-center"
              >
                {isProcessing ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Complete Order'}
              </button>
            </div>
          </div>

        </div>
      </div>


      {/* Custom Fields Modal */}
      {showCustomFieldsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-zinc-100">
            <h2 className="text-2xl font-extrabold text-zinc-900 mb-6">Product Personalization</h2>
            <p className="text-zinc-500 mb-6">Some items in your cart require custom information before checkout.</p>
            
            <div className="space-y-8">
              {cart.map((item, cartIdx) => {
                if (!item.product?.custom_fields) return null;
                let fields: any[] = [];
                try { fields = JSON.parse(item.product.custom_fields); } catch {}
                if (fields.length === 0) return null;

                return (
                  <div key={cartIdx} className="bg-zinc-50 p-6 rounded-2xl border border-zinc-100">
                    <div className="flex items-center space-x-4 mb-4">
                      <img src={item.product.image_url} alt={item.product.title} className="w-16 h-16 rounded-xl object-cover bg-white" />
                      <div>
                        <h3 className="font-bold text-zinc-900">{item.product.title}</h3>
                        <p className="text-sm text-zinc-500">{item.variant.title}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-4">
                      {fields.map((f, i) => (
                        <div key={i}>
                          <label className="block text-sm font-medium text-zinc-700 mb-1">
                            {f.name} {f.required && <span className="text-red-500">*</span>}
                          </label>
                          {f.type === 'textarea' ? (
                            <textarea 
                              required={f.required}
                              value={tempCustomValues[cartIdx]?.[f.name] || ''}
                              onChange={e => setTempCustomValues({ ...tempCustomValues, [cartIdx]: { ...tempCustomValues[cartIdx], [f.name]: e.target.value } })}
                              className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                            />
                          ) : (
                            <input 
                              type={f.type === 'file' ? 'file' : 'text'}
                              required={f.required}
                              value={f.type !== 'file' ? (tempCustomValues[cartIdx]?.[f.name] || '') : undefined}
                              onChange={e => setTempCustomValues({ ...tempCustomValues, [cartIdx]: { ...tempCustomValues[cartIdx], [f.name]: e.target.value } })}
                              className="w-full px-4 py-2 border border-zinc-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900"
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="mt-8 flex space-x-4">
              <button 
                onClick={() => setShowCustomFieldsModal(false)}
                className="flex-1 py-4 font-bold text-zinc-600 bg-zinc-100 rounded-xl hover:bg-zinc-200 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  const updatedCart = [...cart];
                  for (let i = 0; i < updatedCart.length; i++) {
                    if (tempCustomValues[i]) {
                      updatedCart[i].custom_field_values = tempCustomValues[i];
                    }
                  }
                  setCart(updatedCart);
                  localStorage.setItem('cart', JSON.stringify(updatedCart));
                  setShowCustomFieldsModal(false);
                  
                  setTimeout(() => handlePlaceOrder(), 100);
                }}
                className="flex-1 py-4 font-bold text-white bg-zinc-900 rounded-xl hover:bg-zinc-800 transition-colors shadow-lg"
              >
                Save & Continue
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
