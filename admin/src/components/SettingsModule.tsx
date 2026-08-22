'use client';

import React, { useState, useEffect } from 'react';
import { Save, AlertTriangle, Store, Loader2, Image as ImageIcon } from 'lucide-react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

export default function SettingsModule({ id }: { id: string }) {
  const navigate = useNavigate();
  const [shop, setShop] = useState<any>(null);
  const [name, setName] = useState('');
  const [subdomain, setSubdomain] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [currency, setCurrency] = useState('USD');
  const [originPincode, setOriginPincode] = useState('');
  const [enableAIRecommendations, setEnableAIRecommendations] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const [deleteConfirmation, setDeleteConfirmation] = useState('');
  const [showDeleteModal, setShowDeleteModal] = useState(false);

  useEffect(() => {
    fetchShop();
  }, [id]);

  const fetchShop = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/shops', { withCredentials: true });
      const currentShop = res.data.shops.find((s: any) => s.id === id);
      if (currentShop) {
        setShop(currentShop);
        setName(currentShop.name);
        setSubdomain(currentShop.subdomain);
        setLogoUrl(currentShop.logo_url || '');
        setCurrency(currentShop.currency || 'USD');
        setOriginPincode(currentShop.origin_pincode || '');
        setEnableAIRecommendations(currentShop.enable_ai_recommendations || false);
      }
    } catch (err) {
      console.error('Failed to load shop details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.put(`http://localhost:8080/api/shops/${id}`, {
        name,
        subdomain,
        logo_url: logoUrl,
        currency,
        origin_pincode: originPincode,
        enable_ai_recommendations: enableAIRecommendations
      }, { withCredentials: true });
      alert('Settings saved successfully!');
      fetchShop();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (deleteConfirmation !== shop.name) {
      alert('Store name does not match.');
      return;
    }
    setIsDeleting(true);
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}`, { withCredentials: true });
      alert('Store permanently deleted.');
      navigate('/');
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to delete store');
      setIsDeleting(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100">
              <Store className="w-5 h-5 text-slate-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">Store Profile</h2>
              <p className="text-sm text-slate-500">Update your store details and branding.</p>
            </div>
          </div>
        </div>

        <div className="p-6">
          <form id="settings-form" onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Store Name</label>
                <input 
                  type="text" required value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Subdomain</label>
                <div className="flex">
                  <input 
                    type="text" required value={subdomain} onChange={(e) => setSubdomain(e.target.value)}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-l-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium"
                  />
                  <span className="inline-flex items-center px-4 rounded-r-xl border border-l-0 border-slate-200 bg-slate-100 text-slate-500 sm:text-sm font-semibold">
                    .store.link
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Currency</label>
                <select 
                  value={currency} onChange={(e) => setCurrency(e.target.value)}
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium appearance-none"
                >
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="CAD">CAD ($)</option>
                  <option value="AUD">AUD ($)</option>
                  <option value="JPY">JPY (¥)</option>
                  <option value="INR">INR (₹)</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Store Origin Pincode</label>
                <input 
                  type="text" value={originPincode} onChange={(e) => setOriginPincode(e.target.value)}
                  placeholder="e.g. 10001 or 110001"
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium"
                />
                <p className="text-xs text-slate-500 mt-2">
                  Used as the pickup/origin zip code for calculating live shipping rates.
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Brand Logo URL</label>
                <input 
                  type="url" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all font-medium mb-3"
                />
                {logoUrl ? (
                  <div className="w-24 h-24 bg-slate-100 rounded-xl border border-slate-200 overflow-hidden flex items-center justify-center p-2">
                    <img src={logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain" />
                  </div>
                ) : (
                  <div className="w-24 h-24 bg-slate-50 rounded-xl border-2 border-dashed border-slate-200 flex items-center justify-center">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                  </div>
                )}
              </div>
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            type="submit" form="settings-form" disabled={isSaving}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center shadow-md hover:shadow-lg disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save Settings
          </button>
        </div>
      </div>



      {/* Danger Zone */}
      <div className="bg-white rounded-2xl border border-rose-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-rose-100 flex items-center justify-between bg-rose-50/50">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-rose-100 rounded-lg border border-rose-200 text-rose-600">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-rose-900">Danger Zone</h2>
              <p className="text-sm text-rose-700">Irreversible destructive actions.</p>
            </div>
          </div>
        </div>
        <div className="p-6 flex items-center justify-between">
          <div>
            <h3 className="font-semibold text-slate-900">Delete this store</h3>
            <p className="text-sm text-slate-500 mt-1 max-w-lg">
              Once you delete a store, there is no going back. Please be certain. All products, orders, and customer data will be permanently wiped.
            </p>
          </div>
          <button 
            onClick={() => setShowDeleteModal(true)}
            className="bg-rose-100 text-rose-700 hover:bg-rose-600 hover:text-white px-5 py-2.5 rounded-xl font-bold transition-colors shadow-sm"
          >
            Delete Store
          </button>
        </div>
      </div>

      {/* Delete Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-3xl p-8 max-w-md w-full shadow-2xl">
            <div className="w-12 h-12 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mb-4 border-4 border-rose-50">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-2xl font-bold text-slate-900 mb-2">Delete Store</h2>
            <p className="text-slate-500 mb-6">
              This action cannot be undone. This will permanently delete the <strong className="text-slate-900">{shop?.name}</strong> store, database, and all associated data.
            </p>
            
            <label className="block text-sm font-semibold text-slate-700 mb-2">
              Please type <strong className="bg-slate-100 px-1 py-0.5 rounded text-rose-600 font-mono">{shop?.name}</strong> to confirm.
            </label>
            <input 
              type="text" value={deleteConfirmation} onChange={(e) => setDeleteConfirmation(e.target.value)}
              className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-rose-500/20 focus:border-rose-500 transition-all font-medium mb-8"
              placeholder="Store name..."
            />
            
            <div className="flex space-x-3">
              <button 
                onClick={() => { setShowDeleteModal(false); setDeleteConfirmation(''); }}
                className="flex-1 px-4 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button 
                onClick={handleDelete}
                disabled={deleteConfirmation !== shop?.name || isDeleting}
                className="flex-1 px-4 py-3 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-colors flex items-center justify-center disabled:opacity-50"
              >
                {isDeleting ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Delete Store'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
