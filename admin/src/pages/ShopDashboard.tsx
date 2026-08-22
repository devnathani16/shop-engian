import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { ArrowLeft, Package, ShoppingCart, Settings, Users, Menu, X, LayoutDashboard, Tag, Image as ImageIcon, UserCircle, LogOut, Store, ShieldCheck, FolderTree, Palette, Truck, CreditCard, FileText, Receipt, Sparkles, Shield } from 'lucide-react';
import AuthSettingsModule from '../components/AuthSettingsModule';
import MediaManagerModule from '../components/MediaManagerModule';
import CategoryManagerModule from '../components/CategoryManagerModule';
import ProductManagerModule from '../components/ProductManagerModule';
import OrderManagerModule from '../components/OrderManagerModule';
import CustomerManagerModule from '../components/CustomerManagerModule';
import SettingsModule from '../components/SettingsModule';
import ShippingModule from '../components/ShippingModule';
import CheckoutModule from '../components/dashboard/CheckoutModule';
import CustomCheckoutFieldsModule from '../components/dashboard/CustomCheckoutFieldsModule';
import DiscountModule from '../components/DiscountModule';
import AbandonedCartRecoveryModal from '../components/AbandonedCartRecoveryModal';
import ThemeBuilderModule from '../components/ThemeBuilderModule';
import TaxModule from '../components/TaxModule';
import AISettingsModule from '../components/AISettingsModule';
import StaffRolesModule from '../components/StaffRolesModule';

const ShopDashboard: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { user, logout } = useAuth();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [analytics, setAnalytics] = useState<any>(null);
  const [abandonedCarts, setAbandonedCarts] = useState<any[]>([]);
  const [recoveryModalCart, setRecoveryModalCart] = useState<any>(null);

  useEffect(() => {
    if (activeTab === 'overview') {
      const token = localStorage.getItem('token');
      
      // Fetch initial data
      axios.get(`http://localhost:8080/api/shops/${id}/analytics`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => setAnalytics(res.data)).catch(console.error);

      axios.get(`http://localhost:8080/api/shops/${id}/abandoned-carts`, {
        headers: { 'Authorization': `Bearer ${token}` }
      }).then(res => setAbandonedCarts(res.data.carts || [])).catch(console.error);

      // Setup Server-Sent Events for Live Updates
      const es = new EventSource(`http://localhost:8080/api/shops/${id}/events`, { withCredentials: true });
      
      es.addEventListener('new_order', (e) => {
        try {
          const newOrder = JSON.parse(e.data);
          setAnalytics((prev: any) => {
            if (!prev) return prev;
            return {
              ...prev,
              total_orders: prev.total_orders + 1,
              total_revenue: prev.total_revenue + newOrder.total_amount
            };
          });
        } catch (err) {}
      });

      es.addEventListener('cart_abandoned', (e) => {
        try {
          const updatedCart = JSON.parse(e.data);
          setAbandonedCarts((prev) => {
            const exists = prev.find(c => c.id === updatedCart.id);
            if (exists) {
              return prev.map(c => c.id === updatedCart.id ? updatedCart : c);
            }
            return [updatedCart, ...prev].sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime());
          });
        } catch (err) {}
      });

      return () => {
        es.close();
      };
    }
  }, [id, activeTab]);

  const formatCurrency = (value: number) => {
    const currency = analytics?.currency || 'USD';
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  const navigation = [
    { id: 'overview', name: 'Overview', icon: LayoutDashboard },
    { id: 'products', name: 'Products', icon: Package },
    { id: 'categories', name: 'Categories', icon: FolderTree },
    { id: 'orders', name: 'Orders', icon: ShoppingCart },
    { id: 'customers', name: 'Customers', icon: Users },
    { id: 'media', name: 'Media Library', icon: ImageIcon },
    { id: 'authentication', name: 'Authentication', icon: ShieldCheck },
    { id: 'discounts', name: 'Discounts', icon: Tag },
    { id: 'shipping', name: 'Shipping & Rules', icon: Truck },
    { id: 'tax', name: 'Taxes', icon: Receipt },
    { id: 'checkout', name: 'Payment Gateways', icon: CreditCard },
    { id: 'custom-fields', name: 'Checkout Fields', icon: FileText },
    { id: 'theme', name: 'Theme Settings', icon: Palette },
    { id: 'settings', name: 'Store Settings', icon: Settings },
    { id: 'ai', name: 'AI Features', icon: Sparkles },
    { id: 'staff', name: 'Staff & Roles', icon: Shield },
  ];

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/40 via-slate-50 to-slate-100 flex flex-col">
      {/* Global Top Navbar */}
      <nav className="h-16 bg-white/60 backdrop-blur-lg border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)] flex items-center justify-between px-4 lg:px-8 sticky top-0 z-40">
        <div className="flex items-center">
          <button 
            onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            className="lg:hidden p-2 mr-2 text-slate-500 hover:bg-slate-50 rounded-lg transition-colors"
          >
            {isSidebarOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
          
          <Link to="/dashboard" className="flex items-center space-x-2 mr-6">
            <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold">
              e
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900 hidden sm:block">eaas</span>
          </Link>

          <div className="hidden sm:flex items-center px-3 py-1.5 bg-slate-100 rounded-lg text-sm font-medium text-slate-600">
            <ArrowLeft className="w-4 h-4 mr-2" />
            <Link to="/dashboard" className="hover:text-primary transition-colors">Back to all stores</Link>
          </div>
        </div>

        <div className="flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <UserCircle className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-slate-900 hidden md:block">{user?.email}</span>
            <button onClick={logout} className="ml-2 text-slate-400 hover:text-red-500 transition-colors" title="Log out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Layout (Sidebar + Content) */}
      <div className="flex-1 flex overflow-hidden relative">
        
        {/* Offcanvas Backdrop (Mobile) */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-20 lg:hidden"
            onClick={() => setIsSidebarOpen(false)}
            style={{ top: '64px' }} // Below navbar
          />
        )}

        {/* Sidebar */}
        <aside 
          className={`absolute lg:static inset-y-0 left-0 w-64 bg-white border-r border-slate-200 z-30 flex flex-col transition-transform duration-300 ease-in-out ${
            isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
          }`}
          style={{ height: 'calc(100vh - 64px)' }} // Account for top navbar
        >
          <div className="px-4 py-6 overflow-y-auto flex-1">
            <div className="bg-slate-50 border border-slate-100 rounded-xl p-4 mb-6 text-center">
              <div className="w-12 h-12 bg-primary/10 text-primary rounded-full flex items-center justify-center mx-auto mb-2">
                <Store className="w-6 h-6" />
              </div>
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Store ID</p>
              <p className="text-xs font-mono text-slate-700 truncate px-2" title={id}>{id}</p>
            </div>

            <nav className="space-y-1">
              {navigation.map((item) => {
                const Icon = item.icon;
                const isActive = activeTab === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      setActiveTab(item.id);
                      if (window.innerWidth < 1024) setIsSidebarOpen(false); // Close on mobile only
                    }}
                    className={`w-full flex items-center space-x-3 px-4 py-3 rounded-xl font-medium transition-all ${
                      isActive 
                        ? 'bg-gradient-to-r from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/25' 
                        : 'text-slate-600 hover:bg-indigo-50/50 hover:text-indigo-900'
                    }`}
                  >
                    <Icon className={`w-5 h-5 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>
          </div>
          
          <div className="p-4 border-t border-slate-100">
            <a 
              href="#" 
              className="flex items-center justify-center w-full py-2.5 bg-slate-900 text-white rounded-xl font-medium hover:bg-slate-800 transition-colors text-sm mb-2"
            >
              View Live Store
            </a>
            <button
              onClick={() => {
                logout();
              }}
              className="flex items-center justify-center w-full py-2.5 bg-red-50 text-red-600 rounded-xl font-medium hover:bg-red-100 transition-colors text-sm"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </button>
          </div>
        </aside>

        {/* Dashboard Content View */}
        <main className="flex-1 overflow-y-auto p-6 md:p-8 lg:pr-8" style={{ height: 'calc(100vh - 64px)' }}>
          <div className="max-w-6xl mx-auto">
            <h1 className="text-2xl font-bold text-slate-900 capitalize mb-8">
              {navigation.find(n => n.id === activeTab)?.name || 'Dashboard'}
            </h1>

            {activeTab === 'overview' && (
              <>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                  {[
                    { title: 'Total Revenue', value: analytics ? formatCurrency(analytics.total_revenue) : formatCurrency(0), icon: ShoppingCart, color: 'text-green-600', bg: 'bg-green-50' },
                    { title: 'Total Orders', value: analytics ? analytics.total_orders : '0', icon: ShoppingCart, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { title: 'Products', value: analytics ? analytics.total_products : '0', icon: Package, color: 'text-purple-600', bg: 'bg-purple-50' },
                    { title: 'Customers', value: analytics ? analytics.total_customers : '0', icon: Users, color: 'text-orange-600', bg: 'bg-orange-50' },
                  ].map((stat, i) => (
                    <div key={i} className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_8px_30px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group">
                      <div className="flex items-center justify-between mb-4">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3 ${stat.bg} ${stat.color}`}>
                          <stat.icon className="w-6 h-6" />
                        </div>
                      </div>
                      <h3 className="text-slate-500 text-sm font-medium mb-1">{stat.title}</h3>
                      <p className="text-3xl font-extrabold text-slate-900 truncate" title={stat.value}>{stat.value}</p>
                    </div>
                  ))}
                </div>

                {analytics?.sales_chart && analytics.sales_chart.length > 0 && (
                  <div className="bg-white/70 backdrop-blur-xl p-6 rounded-3xl border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] mb-8">
                    <h3 className="text-lg font-bold text-slate-900 mb-6">Sales (Last 30 Days)</h3>
                    <div className="h-72 w-full">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={analytics.sales_chart} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                          <defs>
                            <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                              <stop offset="95%" stopColor="#4f46e5" stopOpacity={0.05}/>
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                          <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dy={10} />
                          <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 12}} dx={-10} tickFormatter={(val) => formatCurrency(val)} />
                          <Tooltip 
                            contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)' }}
                            formatter={(value: any) => [formatCurrency(Number(value)), 'Sales']}
                          />
                          <Area type="monotone" dataKey="sales" stroke="url(#colorSales)" strokeWidth={3} fillOpacity={1} fill="url(#colorSales)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900">Top Products</h3>
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Product</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Sold</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Revenue</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {analytics?.top_products?.map((p: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{p.title}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 text-right">{p.quantity}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-slate-900 text-right">{formatCurrency(p.revenue)}</td>
                            </tr>
                          ))}
                          {(!analytics?.top_products || analytics.top_products.length === 0) && (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No sales data yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden flex flex-col">
                    <div className="p-6 border-b border-slate-100">
                      <h3 className="text-lg font-bold text-slate-900 flex items-center">
                        <ShoppingCart className="w-5 h-5 mr-2 text-rose-500" />
                        Abandoned Carts
                      </h3>
                    </div>
                    <div className="overflow-x-auto flex-1">
                      <table className="w-full">
                        <thead className="bg-slate-50/50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Value</th>
                            <th className="px-6 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {abandonedCarts.map((c: any, i: number) => (
                            <tr key={i} className="hover:bg-slate-50/50 transition-colors">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-slate-900">{c.customer_email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-rose-600 text-right">{formatCurrency(c.value)}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-right">
                                <button 
                                  onClick={() => setRecoveryModalCart(c)}
                                  className="text-primary hover:text-blue-700 font-semibold bg-primary/10 px-3 py-1.5 rounded-lg transition-colors"
                                >
                                  {c.status === 'RecoveryEmailSent' ? 'Resend Email' : 'Send Email'}
                                </button>
                              </td>
                            </tr>
                          ))}
                          {abandonedCarts.length === 0 && (
                            <tr><td colSpan={3} className="px-6 py-8 text-center text-slate-500">No abandoned carts currently.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
                
                <AbandonedCartRecoveryModal
                  isOpen={!!recoveryModalCart}
                  onClose={() => setRecoveryModalCart(null)}
                  shopId={id || ''}
                  cart={recoveryModalCart}
                  currency={analytics?.currency || 'USD'}
                  onSuccess={() => {
                    // Update the local state to reflect the sent email
                    setAbandonedCarts(prev => prev.map(c => c.id === recoveryModalCart.id ? { ...c, status: 'RecoveryEmailSent' } : c));
                  }}
                />
              </>
            )}

            {activeTab === 'authentication' && (
              <AuthSettingsModule />
            )}

            {activeTab === 'media' && (
              <MediaManagerModule />
            )}

            {activeTab === 'categories' && (
              <CategoryManagerModule />
            )}

            {activeTab === 'products' && (
              <ProductManagerModule />
            )}

            {activeTab === 'customers' && (
              <CustomerManagerModule />
            )}

            {activeTab === 'settings' && (
              <SettingsModule id={id || ''} />
            )}

            { activeTab === 'shipping' && (
              <ShippingModule />
            )}

            {activeTab === 'discounts' && (
              <DiscountModule />
            )}

            {activeTab === 'checkout' && (
              <CheckoutModule id={id || ''} />
            )}

            {activeTab === 'custom-fields' && (
              <CustomCheckoutFieldsModule id={id || ''} />
            )}

            {activeTab === 'theme' && (
              <ThemeBuilderModule id={id || ''} />
            )}

            {activeTab === 'orders' && (
              <OrderManagerModule id={id || ''} />
            )}

            {activeTab === 'tax' && (
              <TaxModule id={id || ''} />
            )}

            {activeTab === 'ai' && (
              <AISettingsModule />
            )}

            {activeTab === 'staff' && (
              <StaffRolesModule id={id || ''} />
            )}

            {activeTab !== 'overview' && activeTab !== 'authentication' && activeTab !== 'media' && activeTab !== 'categories' && activeTab !== 'products' && activeTab !== 'customers' && activeTab !== 'settings' && activeTab !== 'shipping' && activeTab !== 'orders' && activeTab !== 'checkout' && activeTab !== 'custom-fields' && activeTab !== 'discounts' && activeTab !== 'theme' && activeTab !== 'tax' && activeTab !== 'ai' && activeTab !== 'staff' && (
              <div className="bg-white rounded-2xl border border-slate-100 p-12 text-center shadow-sm">
                <Package className="w-12 h-12 text-slate-200 mx-auto mb-4" />
                <h2 className="text-xl font-bold text-slate-900 mb-2 capitalize">{activeTab} Module</h2>
                <p className="text-slate-500">The {activeTab} module is currently under construction.</p>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
};

export default ShopDashboard;
