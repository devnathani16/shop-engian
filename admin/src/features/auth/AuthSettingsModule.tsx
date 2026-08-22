import React, { useState, useEffect } from 'react';
import { ShieldCheck, Key, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

const AuthSettingsModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [provider, setProvider] = useState('default');
  const [domain, setDomain] = useState('');
  const [publicKey, setPublicKey] = useState('');
  const [secretKey, setSecretKey] = useState(''); // Only set on update, not returned from API
  const [subdomain, setSubdomain] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

  useEffect(() => {
    fetchSettings();
  }, [id]);

  const fetchSettings = async () => {
    try {
      // Fetch shop details to get subdomain
      const shopRes = await axios.get(`http://localhost:8080/api/shops`);
      const shop = shopRes.data.shops?.find((s: any) => s.id === id);
      if (shop) setSubdomain(shop.subdomain);

      // Fetch settings
      const response = await axios.get(`http://localhost:8080/api/shops/${id}/auth-settings`);
      const data = response.data;
      setProvider(data.settings?.provider || 'default');
      setDomain(data.settings?.domain || '');
      setPublicKey(data.settings?.public_key || '');
    } catch (err) {
      console.error('Failed to load settings', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setMessage(null);
    try {
      await axios.post(`http://localhost:8080/api/shops/${id}/auth-settings`, {
        provider,
        domain: provider === 'auth0' ? domain : '', // Only send domain for Auth0
        public_key: publicKey,
        secret_key: secretKey, // Will be encrypted on backend
      });

      setMessage({ type: 'success', text: 'Authentication settings saved successfully!' });
      setSecretKey(''); // Clear out after save for security
    } catch (err: any) {
      const errorMsg = err.response?.data?.error || 'Failed to save settings';
      setMessage({ type: 'error', text: errorMsg });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-100">
          <div className="flex items-center space-x-4 mb-2">
            <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Store Authentication</h2>
              <p className="text-slate-500 text-sm">Configure how customers log into your storefront.</p>
            </div>
          </div>
        </div>

        <form onSubmit={handleSave} className="p-8 space-y-8">
          {message && (
            <div className={`p-4 rounded-xl flex items-start space-x-3 ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
              {message.type === 'success' ? <CheckCircle2 className="w-5 h-5 mt-0.5" /> : <AlertCircle className="w-5 h-5 mt-0.5" />}
              <span className="text-sm font-medium">{message.text}</span>
            </div>
          )}

          <div className="space-y-4">
            <label className="block text-sm font-medium text-slate-900">Authentication Provider</label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {['default', 'clerk', 'auth0'].map((p) => (
                <label 
                  key={p} 
                  className={`relative flex flex-col p-4 cursor-pointer rounded-xl border-2 transition-all ${
                    provider === p 
                      ? 'border-indigo-600 bg-indigo-50/50' 
                      : 'border-slate-200 hover:border-slate-300'
                  }`}
                >
                  <input 
                    type="radio" 
                    name="provider" 
                    value={p} 
                    checked={provider === p}
                    onChange={(e) => setProvider(e.target.value)}
                    className="sr-only" 
                  />
                  <span className="font-semibold text-slate-900 capitalize">{p === 'default' ? 'EaaS Built-in' : p}</span>
                  <span className="text-xs text-slate-500 mt-1">
                    {p === 'default' ? 'Simple email/password login.' : `Bring your own ${p} keys.`}
                  </span>
                  {provider === p && (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 absolute top-4 right-4" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {provider !== 'default' && (
            <div className="space-y-6 bg-slate-50 p-6 rounded-xl border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center">
                <Key className="w-4 h-4 mr-2" />
                API Credentials
              </h3>
              
              <div className="space-y-4">
                {provider === 'auth0' && (
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Auth0 Domain
                    </label>
                    <input
                      type="text"
                      value={domain}
                      onChange={(e) => setDomain(e.target.value)}
                      className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      placeholder="e.g. dev-xxxxx.us.auth0.com"
                      required={provider === 'auth0'}
                    />
                  </div>
                )}
                
                {provider === 'auth0' && subdomain && (
                  <div className="bg-indigo-50 border border-indigo-100 rounded-lg p-4 mt-2">
                    <h4 className="text-sm font-semibold text-indigo-900 mb-2">Auth0 Application URIs</h4>
                    <p className="text-xs text-indigo-700 mb-3">Copy and paste these exact URLs into your Auth0 Application settings (Note: Application Login URI can be left blank for local development since Auth0 requires https):</p>
                    <ul className="space-y-3">
                      <li>
                        <span className="block text-xs font-semibold text-indigo-900">Allowed Callback URLs</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-indigo-100 mt-1 block w-full truncate">
                          http://{subdomain}.localhost:5174/api/auth/callback
                        </code>
                      </li>
                      <li>
                        <span className="block text-xs font-semibold text-indigo-900">Allowed Logout URLs, Web Origins, & CORS</span>
                        <code className="text-xs bg-white px-2 py-1 rounded border border-indigo-100 mt-1 block w-full truncate">
                          http://{subdomain}.localhost:5174
                        </code>
                      </li>
                    </ul>
                  </div>
                )}
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Publishable / Client ID
                  </label>
                  <input
                    type="text"
                    value={publicKey}
                    onChange={(e) => setPublicKey(e.target.value)}
                    className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                    placeholder={`e.g. pk_test_...`}
                    required={provider !== 'default'}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center justify-between">
                    <span>Secret Key</span>
                    <span className="text-xs text-slate-400 font-normal">Stored encrypted</span>
                  </label>
                  <div className="relative">
                    <input
                      type="password"
                      value={secretKey}
                      onChange={(e) => setSecretKey(e.target.value)}
                      className="w-full px-4 py-2 pl-10 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-indigo-600"
                      placeholder="Leave blank to keep existing secret"
                    />
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3" />
                  </div>
                  <p className="mt-1.5 text-xs text-slate-500">
                    Your secret key is never sent back to the browser.
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="pt-4 flex justify-end">
            <button
              type="submit"
              disabled={saving}
              className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Save Settings'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AuthSettingsModule;
