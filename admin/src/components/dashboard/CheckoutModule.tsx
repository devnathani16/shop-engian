import { useState, useEffect } from 'react';
import { CreditCard, Save, Loader2, Power, Settings, X } from 'lucide-react';
import axios from 'axios';

export default function CheckoutModule({ id }: { id: string }) {
  const [shop, setShop] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);

  // Payment Providers
  const [stripeConfig, setStripeConfig] = useState({ isActive: false, publicKey: '', secretKey: '', webhookSecret: '' });
  const [razorpayConfig, setRazorpayConfig] = useState({ isActive: false, keyId: '', keySecret: '', webhookSecret: '' });
  const [payuConfig, setPayuConfig] = useState({ isActive: false, merchantKey: '', merchantSalt: '', clientId: '', clientSecret: '' });
  const [cashfreeConfig, setCashfreeConfig] = useState({ isActive: false, appId: '', secretKey: '', environment: 'sandbox' });
  const [paypalConfig, setPaypalConfig] = useState({ isActive: false, clientId: '', clientSecret: '', environment: 'sandbox', webhookId: '' });
  const [codConfig, setCodConfig] = useState({ isActive: false });

  // Modals
  const [activeModal, setActiveModal] = useState<'stripe' | 'razorpay' | 'payu' | 'cashfree' | 'paypal' | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [payUCountry, setPayUCountry] = useState('India');

  useEffect(() => {
    fetchShopAndConfigs();
  }, [id]);

  const fetchShopAndConfigs = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/shops', { withCredentials: true });
      const currentShop = res.data.shops.find((s: any) => s.id === id);
      if (currentShop) {
        setShop(currentShop);
      }

      const token = localStorage.getItem('token');
      const confRes = await axios.get(`http://localhost:8080/api/shops/${id}/payment-configs`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      
      const configs = confRes.data || [];
      configs.forEach((c: any) => {
        if (c.provider_name === 'stripe') {
          setStripeConfig({
            isActive: c.is_active,
            publicKey: c.auth_keys?.public_key || '',
            secretKey: c.auth_keys?.secret_key || '',
            webhookSecret: c.auth_keys?.webhook_secret || ''
          });
        } else if (c.provider_name === 'razorpay') {
          setRazorpayConfig({
            isActive: c.is_active,
            keyId: c.auth_keys?.key_id || '',
            keySecret: c.auth_keys?.key_secret || '',
            webhookSecret: c.auth_keys?.webhook_secret || ''
          });
        } else if (c.provider_name === 'payu') {
          setPayuConfig({
            isActive: c.is_active,
            merchantKey: c.auth_keys?.merchant_key || '',
            merchantSalt: c.auth_keys?.merchant_salt || '',
            clientId: c.auth_keys?.client_id || '',
            clientSecret: c.auth_keys?.client_secret || ''
          });
        } else if (c.provider_name === 'cashfree') {
          setCashfreeConfig({
            isActive: c.is_active,
            appId: c.auth_keys?.app_id || '',
            secretKey: c.auth_keys?.secret_key || '',
            environment: c.auth_keys?.environment || 'sandbox'
          });
        } else if (c.provider_name === 'paypal') {
          setPaypalConfig({
            isActive: c.is_active,
            clientId: c.auth_keys?.client_id || '',
            clientSecret: c.auth_keys?.client_secret || '',
            environment: c.auth_keys?.environment || 'sandbox',
            webhookId: c.auth_keys?.webhook_id || ''
          });
        } else if (c.provider_name === 'cod') {
          setCodConfig({ isActive: c.is_active });
        }
      });
    } catch (err) {
      console.error('Failed to load shop details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const saveProvider = async (providerName: string, isActive: boolean, authKeys: any) => {
    const token = localStorage.getItem('token');
    await axios.post(`http://localhost:8080/api/shops/${id}/payment-configs/${providerName}`, {
      provider_name: providerName,
      is_active: isActive,
      auth_keys: authKeys
    }, {
      headers: { 'Authorization': `Bearer ${token}` }
    });
  };

  const handleSaveModal = async (provider: string) => {
    setIsSaving(true);
    try {
      if (provider === 'stripe') {
        await saveProvider('stripe', stripeConfig.isActive, {
          public_key: stripeConfig.publicKey,
          secret_key: stripeConfig.secretKey,
          webhook_secret: stripeConfig.webhookSecret
        });
      } else if (provider === 'razorpay') {
        await saveProvider('razorpay', razorpayConfig.isActive, {
          key_id: razorpayConfig.keyId,
          key_secret: razorpayConfig.keySecret,
          webhook_secret: razorpayConfig.webhookSecret
        });
      } else if (provider === 'payu') {
        await saveProvider('payu', payuConfig.isActive, {
          merchant_key: payuConfig.merchantKey,
          merchant_salt: payuConfig.merchantSalt,
          client_id: payuConfig.clientId,
          client_secret: payuConfig.clientSecret
        });
      } else if (provider === 'cashfree') {
        await saveProvider('cashfree', cashfreeConfig.isActive, {
          app_id: cashfreeConfig.appId,
          secret_key: cashfreeConfig.secretKey,
          environment: cashfreeConfig.environment
        });
      } else if (provider === 'paypal') {
        await saveProvider('paypal', paypalConfig.isActive, {
          client_id: paypalConfig.clientId,
          client_secret: paypalConfig.clientSecret,
          environment: paypalConfig.environment,
          webhook_id: paypalConfig.webhookId
        });
      }
      
      setActiveModal(null);
      // alert('Settings saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving checkout settings');
    }
    setIsSaving(false);
  };

  const handleToggleStatus = async (provider: 'stripe' | 'razorpay' | 'payu' | 'cashfree' | 'paypal' | 'cod') => {
    try {
      if (provider === 'stripe') {
        const newStatus = !stripeConfig.isActive;
        setStripeConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('stripe', newStatus, { public_key: stripeConfig.publicKey, secret_key: stripeConfig.secretKey, webhook_secret: stripeConfig.webhookSecret });
      } else if (provider === 'razorpay') {
        const newStatus = !razorpayConfig.isActive;
        setRazorpayConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('razorpay', newStatus, { key_id: razorpayConfig.keyId, key_secret: razorpayConfig.keySecret, webhook_secret: razorpayConfig.webhookSecret });
      } else if (provider === 'payu') {
        const newStatus = !payuConfig.isActive;
        setPayuConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('payu', newStatus, { merchant_key: payuConfig.merchantKey, merchant_salt: payuConfig.merchantSalt, client_id: payuConfig.clientId, client_secret: payuConfig.clientSecret });
      } else if (provider === 'cashfree') {
        const newStatus = !cashfreeConfig.isActive;
        setCashfreeConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('cashfree', newStatus, { app_id: cashfreeConfig.appId, secret_key: cashfreeConfig.secretKey, environment: cashfreeConfig.environment });
      } else if (provider === 'paypal') {
        const newStatus = !paypalConfig.isActive;
        setPaypalConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('paypal', newStatus, { client_id: paypalConfig.clientId, client_secret: paypalConfig.clientSecret, environment: paypalConfig.environment, webhook_id: paypalConfig.webhookId });
      } else if (provider === 'cod') {
        const newStatus = !codConfig.isActive;
        setCodConfig(prev => ({ ...prev, isActive: newStatus }));
        await saveProvider('cod', newStatus, {});
      }
    } catch (err) {
      console.error('Failed to toggle status', err);
      alert('Failed to update status');
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>;
  }

  return (
    <div className="space-y-8 max-w-4xl relative">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Payment Gateways</h2>
        <p className="text-zinc-500">Configure your payment gateways to accept payments from customers.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-6 space-y-6">
          
          {/* Stripe Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-indigo-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">Stripe</h4>
                <p className="text-sm text-zinc-500">Accept credit and debit cards globally.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('stripe')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${stripeConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {stripeConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              <button 
                onClick={() => setActiveModal('stripe')}
                className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
                title="Configure API Keys"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Razorpay Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">Razorpay</h4>
                <p className="text-sm text-zinc-500">Popular gateway for Indian businesses.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('razorpay')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${razorpayConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {razorpayConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              <button 
                onClick={() => setActiveModal('razorpay')}
                className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
                title="Configure API Keys"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          {/* PayU Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-emerald-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">PayU</h4>
                <p className="text-sm text-zinc-500">Leading payment gateway for India, LatAm, and EMEA.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('payu')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${payuConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {payuConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              <button 
                onClick={() => setActiveModal('payu')}
                className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
                title="Configure API Keys"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Cashfree Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-purple-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-purple-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">Cashfree</h4>
                <p className="text-sm text-zinc-500">Payment gateway for India with wide payment methods.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('cashfree')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${cashfreeConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {cashfreeConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              <button 
                onClick={() => setActiveModal('cashfree')}
                className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
                title="Configure API Keys"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* PayPal Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-sky-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-sky-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">PayPal</h4>
                <p className="text-sm text-zinc-500">Accept PayPal and credit cards globally.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('paypal')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${paypalConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {paypalConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              <button 
                onClick={() => setActiveModal('paypal')}
                className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-lg hover:bg-zinc-50 transition-colors"
                title="Configure API Keys"
              >
                <Settings className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* COD Config */}
          <div className="flex items-center justify-between p-5 border border-zinc-200 rounded-xl hover:border-indigo-200 transition-colors">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-orange-50 rounded-xl flex items-center justify-center">
                <CreditCard className="w-6 h-6 text-orange-600" />
              </div>
              <div>
                <h4 className="font-bold text-zinc-900 text-lg">Cash on Delivery</h4>
                <p className="text-sm text-zinc-500">Allow customers to pay when their order is delivered.</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              <button 
                onClick={() => handleToggleStatus('cod')}
                className={`px-4 py-2 rounded-lg font-medium text-sm flex items-center transition-colors ${codConfig.isActive ? 'bg-green-100 text-green-700 hover:bg-green-200' : 'bg-zinc-100 text-zinc-600 hover:bg-zinc-200'}`}
              >
                <Power className="w-4 h-4 mr-2" />
                {codConfig.isActive ? 'Active' : 'Inactive'}
              </button>
              {/* COD doesn't have API keys to configure */}
            </div>
          </div>

        </div>
      </div>

      {/* Stripe Modal */}
      {activeModal === 'stripe' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-indigo-600" /> Stripe Configuration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Publishable Key</label>
                <input type="text" value={stripeConfig.publicKey} onChange={(e) => setStripeConfig(prev => ({ ...prev, publicKey: e.target.value }))} placeholder="pk_live_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Secret Key</label>
                <input type="password" value={stripeConfig.secretKey} onChange={(e) => setStripeConfig(prev => ({ ...prev, secretKey: e.target.value }))} placeholder="sk_live_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Webhook Endpoint Secret</label>
                <input type="password" value={stripeConfig.webhookSecret} onChange={(e) => setStripeConfig(prev => ({ ...prev, webhookSecret: e.target.value }))} placeholder="whsec_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500" />
                <div className="mt-4 p-4 bg-indigo-50/70 rounded-xl border border-indigo-100 text-sm text-indigo-900">
                  <p className="font-bold mb-2">Webhook URL:</p>
                  <code className="block bg-white border border-indigo-200 px-3 py-2 rounded-lg font-mono break-all mb-2">https://api.yourdomain.com/api/webhooks/payments/{shop?.subdomain}/stripe</code>
                  <p className="text-indigo-800">Ensure to select the <strong>checkout.session.completed</strong> event in your Stripe dashboard.</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-200 rounded-xl mr-3 transition-colors">Cancel</button>
              <button onClick={() => handleSaveModal('stripe')} disabled={isSaving} className="px-5 py-2.5 bg-indigo-600 text-white font-medium hover:bg-indigo-700 rounded-xl flex items-center transition-colors">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Razorpay Modal */}
      {activeModal === 'razorpay' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-blue-600" /> Razorpay Configuration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Key ID</label>
                <input type="text" value={razorpayConfig.keyId} onChange={(e) => setRazorpayConfig(prev => ({ ...prev, keyId: e.target.value }))} placeholder="rzp_live_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Key Secret</label>
                <input type="password" value={razorpayConfig.keySecret} onChange={(e) => setRazorpayConfig(prev => ({ ...prev, keySecret: e.target.value }))} placeholder="••••••••••••" className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Webhook Secret (Custom)</label>
                <input type="password" value={razorpayConfig.webhookSecret} onChange={(e) => setRazorpayConfig(prev => ({ ...prev, webhookSecret: e.target.value }))} placeholder="Enter a secure string..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500" />
                <div className="mt-4 p-4 bg-blue-50/70 rounded-xl border border-blue-100 text-sm text-blue-900">
                  <p className="font-bold mb-2">Webhook URL:</p>
                  <code className="block bg-white border border-blue-200 px-3 py-2 rounded-lg font-mono break-all mb-2">https://api.yourdomain.com/api/webhooks/payments/{shop?.subdomain}/razorpay</code>
                  <p className="text-blue-800">Select the <strong>payment.captured</strong> event in your dashboard.</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-200 rounded-xl mr-3 transition-colors">Cancel</button>
              <button onClick={() => handleSaveModal('razorpay')} disabled={isSaving} className="px-5 py-2.5 bg-blue-600 text-white font-medium hover:bg-blue-700 rounded-xl flex items-center transition-colors">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PayU Modal */}
      {activeModal === 'payu' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-emerald-600" /> PayU Configuration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex flex-col space-y-2 mb-2">
                 <label className="text-sm font-semibold text-zinc-700">Region</label>
                 <select value={payUCountry} onChange={(e) => setPayUCountry(e.target.value)} className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-emerald-500 bg-white">
                   <option value="India">India</option>
                   <option value="Global" disabled>Global / Latam (Coming Soon)</option>
                 </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Merchant Key</label>
                <input type="text" value={payuConfig.merchantKey} onChange={(e) => setPayuConfig(prev => ({ ...prev, merchantKey: e.target.value }))} placeholder="e.g. gtKFFx" className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Merchant Salt (Salt 1)</label>
                <input type="password" value={payuConfig.merchantSalt} onChange={(e) => setPayuConfig(prev => ({ ...prev, merchantSalt: e.target.value }))} placeholder="e.g. A5eIltwxSb..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500" />
              </div>
              <div className="pt-4 border-t border-zinc-100">
                <h4 className="text-sm font-bold text-zinc-800 mb-3">Advanced API Credentials (Optional)</h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Client ID</label>
                    <input type="text" value={payuConfig.clientId} onChange={(e) => setPayuConfig(prev => ({ ...prev, clientId: e.target.value }))} placeholder="e.g. 2d7700..." className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-zinc-700 mb-1">Client Secret</label>
                    <input type="password" value={payuConfig.clientSecret} onChange={(e) => setPayuConfig(prev => ({ ...prev, clientSecret: e.target.value }))} placeholder="e.g. c07f6..." className="w-full px-3 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-sm" />
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-200 rounded-xl mr-3 transition-colors">Cancel</button>
              <button onClick={() => handleSaveModal('payu')} disabled={isSaving} className="px-5 py-2.5 bg-emerald-600 text-white font-medium hover:bg-emerald-700 rounded-xl flex items-center transition-colors">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* PayPal Modal */}
      {activeModal === 'paypal' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-sky-600" /> PayPal Configuration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex flex-col space-y-2 mb-2">
                 <label className="text-sm font-semibold text-zinc-700">Environment</label>
                 <select value={paypalConfig.environment} onChange={(e) => setPaypalConfig(prev => ({ ...prev, environment: e.target.value }))} className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-sky-500 bg-white">
                   <option value="sandbox">Sandbox (Testing)</option>
                   <option value="production">Production</option>
                 </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Client ID</label>
                <input type="text" value={paypalConfig.clientId} onChange={(e) => setPaypalConfig(prev => ({ ...prev, clientId: e.target.value }))} placeholder="e.g. Ae_jR..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Client Secret</label>
                <input type="password" value={paypalConfig.clientSecret} onChange={(e) => setPaypalConfig(prev => ({ ...prev, clientSecret: e.target.value }))} placeholder="e.g. EPHV_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Webhook ID</label>
                <input type="text" value={paypalConfig.webhookId} onChange={(e) => setPaypalConfig(prev => ({ ...prev, webhookId: e.target.value }))} placeholder="e.g. 8K11158..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-sky-500 focus:border-sky-500" />
              </div>
              <div>
                <div className="mt-4 p-4 bg-sky-50/70 rounded-xl border border-sky-100 text-sm text-sky-900">
                  <p className="font-bold mb-2">Webhook URL:</p>
                  <code className="block bg-white border border-sky-200 px-3 py-2 rounded-lg font-mono break-all mb-2">https://api.yourdomain.com/api/webhooks/payments/{shop?.subdomain}/paypal</code>
                  <p className="text-sky-800">Select the <strong>PAYMENT.CAPTURE.COMPLETED</strong> event in your PayPal developer dashboard.</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-200 rounded-xl mr-3 transition-colors">Cancel</button>
              <button onClick={() => handleSaveModal('paypal')} disabled={isSaving} className="px-5 py-2.5 bg-sky-600 text-white font-medium hover:bg-sky-700 rounded-xl flex items-center transition-colors">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Cashfree Modal */}
      {activeModal === 'cashfree' && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/60 backdrop-blur-sm">
          <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-6 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
              <h3 className="text-xl font-bold text-zinc-900 flex items-center">
                <CreditCard className="w-5 h-5 mr-2 text-purple-600" /> Cashfree Configuration
              </h3>
              <button onClick={() => setActiveModal(null)} className="p-2 text-zinc-400 hover:text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"><X className="w-5 h-5" /></button>
            </div>
            <div className="p-6 space-y-5 overflow-y-auto">
              <div className="flex flex-col space-y-2 mb-2">
                 <label className="text-sm font-semibold text-zinc-700">Environment</label>
                 <select value={cashfreeConfig.environment} onChange={(e) => setCashfreeConfig(prev => ({ ...prev, environment: e.target.value }))} className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-purple-500 bg-white">
                   <option value="sandbox">Sandbox (Testing)</option>
                   <option value="production">Production</option>
                 </select>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">App ID</label>
                <input type="text" value={cashfreeConfig.appId} onChange={(e) => setCashfreeConfig(prev => ({ ...prev, appId: e.target.value }))} placeholder="e.g. 123456..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-zinc-700 mb-1">Secret Key</label>
                <input type="password" value={cashfreeConfig.secretKey} onChange={(e) => setCashfreeConfig(prev => ({ ...prev, secretKey: e.target.value }))} placeholder="e.g. cf_sec_..." className="w-full px-4 py-2.5 border border-zinc-300 rounded-xl focus:ring-2 focus:ring-purple-500 focus:border-purple-500" />
              </div>
              <div>
                <div className="mt-4 p-4 bg-purple-50/70 rounded-xl border border-purple-100 text-sm text-purple-900">
                  <p className="font-bold mb-2">Webhook URL:</p>
                  <code className="block bg-white border border-purple-200 px-3 py-2 rounded-lg font-mono break-all mb-2">https://api.yourdomain.com/api/webhooks/payments/{shop?.subdomain}/cashfree</code>
                  <p className="text-purple-800">Select the <strong>PAYMENT_SUCCESS_WEBHOOK</strong> event in your dashboard.</p>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-zinc-100 bg-zinc-50 flex justify-end">
              <button onClick={() => setActiveModal(null)} className="px-5 py-2.5 text-zinc-600 font-medium hover:bg-zinc-200 rounded-xl mr-3 transition-colors">Cancel</button>
              <button onClick={() => handleSaveModal('cashfree')} disabled={isSaving} className="px-5 py-2.5 bg-purple-600 text-white font-medium hover:bg-purple-700 rounded-xl flex items-center transition-colors">
                {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />} Save Configuration
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
