import React, { useState, useEffect } from 'react';
import { Save, Loader2, Sparkles } from 'lucide-react';
import { useParams } from 'react-router-dom';
import axios from 'axios';

export default function AISettingsModule() {
  const { id } = useParams<{ id: string }>();
  const [shop, setShop] = useState<any>(null);
  const [enableAIRecommendations, setEnableAIRecommendations] = useState(false);
  const [enableAISearch, setEnableAISearch] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    fetchShop();
  }, [id]);

  const fetchShop = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/shops', { withCredentials: true });
      const currentShop = res.data.shops.find((s: any) => s.id === id);
      if (currentShop) {
        setShop(currentShop);
        setEnableAIRecommendations(currentShop.enable_ai_recommendations || false);
        setEnableAISearch(currentShop.enable_ai_search || false);
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
        name: shop.name,
        subdomain: shop.subdomain,
        logo_url: shop.logo_url,
        currency: shop.currency,
        origin_pincode: shop.origin_pincode,
        enable_ai_recommendations: enableAIRecommendations,
        enable_ai_search: enableAISearch
      }, { withCredentials: true });
      alert('AI Settings saved successfully!');
      fetchShop();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to save settings');
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-slate-500">Loading AI settings...</div>;
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-indigo-50 rounded-lg border border-indigo-100">
              <Sparkles className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-900">AI Features</h2>
              <p className="text-sm text-slate-500">Manage artificial intelligence capabilities for your storefront.</p>
            </div>
          </div>
        </div>
        
        <div className="p-6 space-y-6">
          <div className="flex items-center justify-between border-b border-slate-100 pb-6">
            <div>
              <h3 className="font-semibold text-slate-900">AI Product Recommendations</h3>
              <p className="text-sm text-slate-500 max-w-lg mt-1">
                Automatically show "Similar Products" on your product pages based on semantic vector embeddings (Powered by OpenRouter).
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={enableAIRecommendations}
                onChange={(e) => setEnableAIRecommendations(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-slate-900">AI Semantic Search</h3>
              <p className="text-sm text-slate-500 max-w-lg mt-1">
                Upgrade your store's search bar to understand natural language queries (e.g. "red dress for summer") using advanced AI embeddings.
              </p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer ml-4">
              <input 
                type="checkbox" 
                className="sr-only peer" 
                checked={enableAISearch}
                onChange={(e) => setEnableAISearch(e.target.checked)}
              />
              <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
            </label>
          </div>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end">
          <button 
            type="button" onClick={handleSave} disabled={isSaving}
            className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center shadow-sm disabled:opacity-50"
          >
            {isSaving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
            Save AI Settings
          </button>
        </div>
      </div>
    </div>
  );
}
