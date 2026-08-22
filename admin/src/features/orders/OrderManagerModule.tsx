import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { Package, Loader2, RefreshCw, X, ChevronRight, CheckCircle2, MapPin, Box, Tag, FileText } from 'lucide-react';

export default function OrderManagerModule({ id }: { id: string }) {
  const [orders, setOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  const fetchOrders = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const token = localStorage.getItem('token');
      const res = await axios.get(`http://localhost:8080/api/shops/${id}/orders`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      setOrders(Array.isArray(res.data) ? res.data : []);
      
      // Update selected order if it's currently open
      if (selectedOrder) {
        const updated = (Array.isArray(res.data) ? res.data : []).find((o: any) => o.id === selectedOrder.id);
        if (updated) setSelectedOrder(updated);
      }
    } catch (err) {
      console.error('Failed to fetch orders:', err);
    } finally {
      setLoading(false);
    }
  }, [id, selectedOrder]);

  useEffect(() => {
    fetchOrders();
  }, [id]);

  const handleCancelOrder = async (orderId: string) => {
    if (!confirm('Are you sure you want to cancel this order? This will also cancel the fulfillment shipment if one exists.')) return;
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/shops/${id}/orders/${orderId}/cancel`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to cancel order');
    }
  };

  const handleGenerateAWB = async (orderId: string) => {
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/shops/${id}/orders/${orderId}/awb`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      fetchOrders();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to generate AWB');
    }
  };

  const handleGenerateLabel = async (orderId: string) => {
    let printWin: Window | null = null;
    try {
      printWin = window.open('', '_blank'); // Open immediately to bypass popup blocker
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/orders/${orderId}/label`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.label_url) {
        if (printWin) {
          printWin.location.href = res.data.label_url;
        } else {
          window.open(res.data.label_url, '_blank');
        }
      } else if (res.data.html) {
        if (printWin) {
          printWin.document.write(res.data.html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => printWin?.print(), 500);
        } else {
          alert('Popup was blocked by your browser. Please allow popups to print labels.');
        }
      } else {
        if (printWin) printWin.close();
      }
      fetchOrders();
    } catch (err: any) {
      if (typeof printWin !== 'undefined' && printWin) printWin.close();
      alert(err.response?.data?.error || 'Failed to generate Label');
    }
  };

  const handleGenerateInvoice = async (orderId: string) => {
    let printWin: Window | null = null;
    try {
      printWin = window.open('', '_blank'); // Open immediately to bypass popup blocker
      const token = localStorage.getItem('token');
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/orders/${orderId}/invoice`, {}, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.data.invoice_url) {
        if (printWin) {
          printWin.location.href = res.data.invoice_url;
        } else {
          window.open(res.data.invoice_url, '_blank');
        }
      } else if (res.data.html) {
        if (printWin) {
          printWin.document.write(res.data.html);
          printWin.document.close();
          printWin.focus();
          setTimeout(() => printWin?.print(), 500);
        } else {
          alert('Popup was blocked by your browser. Please allow popups to print invoices.');
        }
      } else {
        if (printWin) printWin.close();
      }
      fetchOrders();
    } catch (err: any) {
      if (typeof printWin !== 'undefined' && printWin) printWin.close();
      alert(err.response?.data?.error || 'Failed to generate Invoice');
    }
  };

  const getStatusColor = (status: string) => {
    if (status === 'Cancelled') return 'bg-red-100 text-red-800 border-red-200';
    if (status.includes('Pending')) return 'bg-amber-100 text-amber-800 border-amber-200';
    if (status === 'Paid' || status.includes('Delivered')) return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  if (loading && orders.length === 0) return (
    <div className="p-8 flex items-center justify-center text-zinc-400 gap-3 min-h-[400px]">
      <Loader2 className="w-6 h-6 animate-spin" />
      <span className="font-medium">Loading orders...</span>
    </div>
  );

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-zinc-900 tracking-tight">Orders</h1>
          <p className="text-zinc-500 mt-1">Manage your storefront orders and fulfillments</p>
        </div>
        <button
          onClick={fetchOrders}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-zinc-600 bg-white border border-zinc-200 rounded-xl hover:bg-zinc-50 transition-colors shadow-sm"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      <div className="bg-white rounded-3xl border border-zinc-200 shadow-sm overflow-hidden">
        {orders.length === 0 ? (
          <div className="p-16 text-center flex flex-col items-center bg-zinc-50/30">
            <div className="w-20 h-20 bg-white rounded-2xl flex items-center justify-center border border-zinc-100 shadow-sm mb-6">
              <Package className="w-10 h-10 text-zinc-300" />
            </div>
            <h3 className="text-xl font-bold text-zinc-900">No orders yet</h3>
            <p className="text-zinc-500 max-w-sm mt-2">When customers place orders on your storefront, they will appear here.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50/80 border-b border-zinc-200">
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Order</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Date</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Payment Status</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider">Fulfillment</th>
                  <th className="px-6 py-4 text-xs font-semibold text-zinc-500 uppercase tracking-wider text-right">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {orders.map(order => (
                  <tr 
                    key={order.id} 
                    onClick={() => setSelectedOrder(order)}
                    className="hover:bg-zinc-50/80 transition-colors cursor-pointer group"
                  >
                    <td className="px-6 py-4 text-sm font-bold text-zinc-900">#{order.id}</td>
                    <td className="px-6 py-4 text-sm text-zinc-500">
                      {new Date(order.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm font-semibold text-zinc-900">{order.customer_name || 'Customer'}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">{order.customer_email}</div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold border ${getStatusColor(order.status)}`}>
                        {order.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm">
                      {order.shiprocket_awb ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                          <span className="font-medium text-zinc-700">Shipped</span>
                        </div>
                      ) : order.shiprocket_shipment_id ? (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-blue-500"></div>
                          <span className="font-medium text-zinc-700">Processing</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full bg-zinc-300"></div>
                          <span className="text-zinc-500">Unfulfilled</span>
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-4 text-sm font-bold text-zinc-900 text-right">
                      <div className="flex items-center justify-end gap-4">
                        <span>₹{Number(order.total_amount).toFixed(2)}</span>
                        <ChevronRight className="w-5 h-5 text-zinc-300 group-hover:text-zinc-600 transition-colors" />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Slide-over Order Details View */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex justify-end bg-zinc-900/40 backdrop-blur-sm transition-all" onClick={() => setSelectedOrder(null)}>
          <div 
            className="w-full max-w-2xl bg-white h-full shadow-2xl flex flex-col border-l border-zinc-200 animate-in slide-in-from-right duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-8 py-6 border-b border-zinc-100 bg-white">
              <div>
                <h2 className="text-2xl font-bold text-zinc-900">Order #{selectedOrder.id}</h2>
                <p className="text-sm text-zinc-500 mt-1">
                  Placed on {new Date(selectedOrder.created_at).toLocaleString()}
                </p>
              </div>
              <button 
                onClick={() => setSelectedOrder(null)}
                className="p-2 hover:bg-zinc-100 rounded-full transition-colors text-zinc-500 hover:text-zinc-900"
              >
                <X className="w-6 h-6" />
              </button>
            </div>

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto p-8 space-y-8 bg-zinc-50/30">
              
              {/* Status and Action Banner */}
              <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div className="flex items-center gap-3">
                  <span className={`inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-bold border ${getStatusColor(selectedOrder.status)}`}>
                    {selectedOrder.status}
                  </span>
                  {selectedOrder.payment_method && (
                    <span className="text-sm font-medium text-zinc-500 bg-zinc-100 px-3 py-1.5 rounded-lg border border-zinc-200">
                      {selectedOrder.payment_method}
                    </span>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {selectedOrder.status !== 'Cancelled' && (
                    <button 
                      onClick={() => handleCancelOrder(selectedOrder.id)}
                      className="text-red-600 hover:bg-red-50 hover:border-red-200 border border-transparent px-3 py-1.5 rounded-lg text-sm font-semibold transition-colors"
                    >
                      Cancel Order
                    </button>
                  )}
                  {!selectedOrder.shiprocket_awb && selectedOrder.status !== 'Cancelled' && (
                    <button 
                      onClick={() => handleGenerateAWB(selectedOrder.id)}
                      className="bg-indigo-600 text-white hover:bg-indigo-700 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                    >
                      Fulfill Order
                    </button>
                  )}
                  {selectedOrder.status !== 'Cancelled' && (
                    <>
                      <button 
                        onClick={() => handleGenerateLabel(selectedOrder.id)}
                        className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                      >
                        <Tag className="w-4 h-4" />
                        Print Label
                      </button>
                      <button 
                        onClick={() => handleGenerateInvoice(selectedOrder.id)}
                        className="flex items-center gap-2 bg-white border border-zinc-200 text-zinc-700 hover:bg-zinc-50 px-4 py-1.5 rounded-lg text-sm font-bold shadow-sm transition-colors"
                      >
                        <FileText className="w-4 h-4" />
                        Print Invoice
                      </button>
                    </>
                  )}
                </div>
              </div>

              {/* Grid Layout for Customer and Shipping */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Customer Details */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-zinc-400" />
                    Customer Info
                  </h3>
                  <div className="space-y-3">
                    <p className="font-bold text-zinc-900">{selectedOrder.customer_name || 'No Name Provided'}</p>
                    <p className="text-sm text-zinc-600">{selectedOrder.customer_email}</p>
                    <p className="text-sm text-zinc-600">{selectedOrder.customer_phone}</p>
                  </div>
                </div>

                {/* Shipping Details */}
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4 flex items-center gap-2">
                    <MapPin className="w-4 h-4 text-zinc-400" />
                    Shipping Address
                  </h3>
                  <div className="space-y-1.5 text-sm text-zinc-600">
                    <p className="font-bold text-zinc-900">{selectedOrder.customer_name || 'Customer'}</p>
                    <p>{selectedOrder.address_line_1}</p>
                    <p>{selectedOrder.city}, {selectedOrder.state} {selectedOrder.pincode}</p>
                    <p>{selectedOrder.country}</p>
                  </div>
                  
                  {selectedOrder.shiprocket_awb && (
                    <div className="mt-4 pt-4 border-t border-zinc-100">
                      <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">Tracking Number</p>
                      <p className="font-mono text-sm font-bold text-emerald-600 bg-emerald-50 px-2 py-1 rounded w-fit">
                        {selectedOrder.shiprocket_awb}
                      </p>
                    </div>
                  )}
                </div>
              </div>

              {/* Order Items */}
              <div className="bg-white border border-zinc-200 rounded-2xl shadow-sm overflow-hidden">
                <div className="p-6 border-b border-zinc-100">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider flex items-center gap-2">
                    <Box className="w-4 h-4 text-zinc-400" />
                    Line Items
                  </h3>
                </div>
                <div className="divide-y divide-zinc-100">
                  {selectedOrder.items?.map((item: any) => (
                    <div key={item.id} className="p-6 flex items-center gap-6 hover:bg-zinc-50/50 transition-colors">
                      <div className="w-16 h-16 bg-zinc-100 rounded-xl overflow-hidden border border-zinc-200 shrink-0">
                        {item.image_url ? (
                          <img src={item.image_url} alt={item.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <Package className="w-6 h-6 text-zinc-400" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-zinc-900 truncate">{item.title}</p>
                        <p className="text-sm text-zinc-500 mt-1">₹{item.price} × {item.quantity}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="font-bold text-zinc-900">₹{(item.price * item.quantity).toFixed(2)}</p>
                      </div>
                    </div>
                  ))}
                </div>
                
                {/* Financial Breakdown */}
                <div className="p-6 bg-zinc-50/50 border-t border-zinc-200">
                  <div className="w-full max-w-sm ml-auto space-y-3">
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Subtotal</span>
                      <span className="font-medium text-zinc-900">₹{selectedOrder.subtotal?.toFixed(2) || '0.00'}</span>
                    </div>
                    
                    {selectedOrder.discount_amount > 0 && (
                      <div className="flex justify-between text-sm text-emerald-600">
                        <span>Discount {selectedOrder.discount_code ? `(${selectedOrder.discount_code})` : ''}</span>
                        <span className="font-bold">-₹{selectedOrder.discount_amount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="flex justify-between text-sm text-zinc-600">
                      <span>Shipping ({selectedOrder.shipping_courier || 'Standard'})</span>
                      <span className="font-medium text-zinc-900">₹{selectedOrder.shipping_cost?.toFixed(2) || '0.00'}</span>
                    </div>
                    
                    {selectedOrder.tax_amount > 0 && (
                      <div className="flex justify-between text-sm text-zinc-600">
                        <span>Tax</span>
                        <span className="font-medium text-zinc-900">₹{selectedOrder.tax_amount.toFixed(2)}</span>
                      </div>
                    )}
                    
                    <div className="pt-4 mt-4 border-t border-zinc-200 flex justify-between items-center">
                      <span className="font-bold text-zinc-900">Total</span>
                      <span className="text-xl font-extrabold text-zinc-900">₹{selectedOrder.total_amount?.toFixed(2) || '0.00'}</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Custom Fields (if any) */}
              {selectedOrder.custom_field_data && Object.keys(JSON.parse(selectedOrder.custom_field_data || '{}')).length > 0 && (
                <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-sm">
                  <h3 className="text-sm font-bold text-zinc-900 uppercase tracking-wider mb-4">Additional Details</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {Object.entries(JSON.parse(selectedOrder.custom_field_data)).map(([k, v]) => (
                      <div key={k}>
                        <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-1">{k}</p>
                        <p className="text-sm font-medium text-zinc-900">{v as string}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            </div>
          </div>
        </div>
      )}
    </div>
  );
}
