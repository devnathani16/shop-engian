import { useState, useEffect } from 'react';
import axios from 'axios';
import {
  Globe,
  MapPin,
  Tag,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Receipt,
  ToggleLeft,
  ToggleRight,
  AlertTriangle,
  Star
} from 'lucide-react';

interface TaxCategory {
  id: number;
  shop_id: string;
  name: string;
  is_default: boolean;
}

interface TaxZoneCountry {
  id: number;
  tax_zone_id: number;
  country_code: string;
}

interface TaxZoneRegion {
  id: number;
  tax_zone_id: number;
  region_code: string;
}

interface TaxRate {
  id: number;
  tax_zone_id: number;
  tax_category_id: number;
  name: string;
  rate: number;
  rate_type: string;
  is_compound: boolean;
  priority: number;
}

interface TaxZone {
  id: number;
  shop_id: string;
  name: string;
  is_default: boolean;
  inclusive: boolean;
  enabled: boolean;
  countries: TaxZoneCountry[];
  regions: TaxZoneRegion[];
  rates: TaxRate[];
}

interface ShopTaxOverride {
  id: number;
  shop_id: string;
  scope_type: string;
  scope_id: number;
  tax_zone_id: number;
  rate: number;
  exempt: boolean;
}

interface Product {
  id: number;
  title: string;
  tax_category_id: number | null;
}

const API_BASE = 'http://localhost:8080';

export default function TaxModule({ id }: { id: string }) {
  const [activeTab, setActiveTab] = useState<'zones' | 'categories' | 'overrides'>('zones');

  const [categories, setCategories] = useState<TaxCategory[]>([]);
  const [zones, setZones] = useState<TaxZone[]>([]);
  const [overrides, setOverrides] = useState<ShopTaxOverride[]>([]);
  const [products, setProducts] = useState<Product[]>([]);

  // UI State
  const [expandedZones, setExpandedZones] = useState<number[]>([]);
  
  // Forms State
  const [newCategory, setNewCategory] = useState({ name: '', is_default: false });
  const [newZone, setNewZone] = useState({ name: '', is_default: false, inclusive: false, enabled: true });
  const [newCountry, setNewCountry] = useState<{ [zoneId: number]: string }>({});
  const [newRegion, setNewRegion] = useState<{ [zoneId: number]: string }>({});
  const [newRate, setNewRate] = useState<{ [zoneId: number]: Partial<TaxRate> }>({});
  
  const [newOverride, setNewOverride] = useState({
    scope_type: 'product',
    scope_id: 0,
    tax_zone_id: 0,
    rate: 0,
    exempt: false
  });

  const axiosConfig = { withCredentials: true };

  useEffect(() => {
    fetchCategories();
    fetchZones();
    fetchOverrides();
    fetchProducts();
  }, [id]);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shops/${id}/tax-categories`, axiosConfig);
      setCategories(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchZones = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shops/${id}/tax-zones`, axiosConfig);
      setZones(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchOverrides = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shops/${id}/tax-overrides`, axiosConfig);
      setOverrides(res.data || []);
    } catch (e) {
      console.error(e);
    }
  };

  const fetchProducts = async () => {
    try {
      const res = await axios.get(`${API_BASE}/api/shops/${id}/products`, axiosConfig);
      setProducts(res.data.products || []);
    } catch (e) {
      console.error(e);
    }
  };

  // Categories Handlers
  const handleCreateCategory = async () => {
    if (!newCategory.name) return;
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-categories`, newCategory, axiosConfig);
      setNewCategory({ name: '', is_default: false });
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCategory = async (catId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-categories/${catId}`, axiosConfig);
      fetchCategories();
    } catch (e) {
      console.error(e);
    }
  };

  // Zones Handlers
  const toggleZoneExpand = (zoneId: number) => {
    if (expandedZones.includes(zoneId)) {
      setExpandedZones(expandedZones.filter(z => z !== zoneId));
    } else {
      setExpandedZones([...expandedZones, zoneId]);
    }
  };

  const handleCreateZone = async () => {
    if (!newZone.name) return;
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-zones`, newZone, axiosConfig);
      setNewZone({ name: '', is_default: false, inclusive: false, enabled: true });
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  const handleUpdateZone = async (zoneId: number, data: Partial<TaxZone>) => {
    try {
      await axios.put(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}`, data, axiosConfig);
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteZone = async (zoneId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}`, axiosConfig);
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  // Countries
  const handleAddCountry = async (zoneId: number) => {
    const code = newCountry[zoneId];
    if (!code) return;
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/countries`, { country_code: code }, axiosConfig);
      setNewCountry({ ...newCountry, [zoneId]: '' });
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteCountry = async (zoneId: number, countryId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/countries/${countryId}`, axiosConfig);
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  // Regions
  const handleAddRegion = async (zoneId: number) => {
    const code = newRegion[zoneId];
    if (!code) return;
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/regions`, { region_code: code }, axiosConfig);
      setNewRegion({ ...newRegion, [zoneId]: '' });
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRegion = async (zoneId: number, regionId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/regions/${regionId}`, axiosConfig);
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  // Rates
  const handleAddRate = async (zoneId: number) => {
    const rateData = newRate[zoneId];
    if (!rateData || !rateData.tax_category_id || !rateData.name || rateData.rate === undefined) return;
    
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/rates`, {
        ...rateData,
        rate_type: rateData.rate_type || 'percentage',
        is_compound: rateData.is_compound || false,
        priority: rateData.priority || 0
      }, axiosConfig);
      
      setNewRate({ ...newRate, [zoneId]: {} });
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteRate = async (zoneId: number, rateId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-zones/${zoneId}/rates/${rateId}`, axiosConfig);
      fetchZones();
    } catch (e) {
      console.error(e);
    }
  };

  // Overrides Handlers
  const handleCreateOverride = async () => {
    if (!newOverride.scope_id || !newOverride.tax_zone_id) return;
    try {
      await axios.post(`${API_BASE}/api/shops/${id}/tax-overrides`, newOverride, axiosConfig);
      setNewOverride({
        scope_type: 'product',
        scope_id: 0,
        tax_zone_id: 0,
        rate: 0,
        exempt: false
      });
      fetchOverrides();
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteOverride = async (overrideId: number) => {
    try {
      await axios.delete(`${API_BASE}/api/shops/${id}/tax-overrides/${overrideId}`, axiosConfig);
      fetchOverrides();
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="space-y-6">
      {/* Compliance Disclaimer */}
      <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-xl flex items-start space-x-3">
        <AlertTriangle className="text-amber-500 w-5 h-5 flex-shrink-0 mt-0.5" />
        <p className="text-amber-800 text-sm">
          <strong>Compliance Disclaimer:</strong> This calculates and collects tax at checkout. You are responsible for registering and remitting collected tax in jurisdictions where you have a legal obligation.
        </p>
      </div>

      {/* Header & Tabs */}
      <div className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 p-6 border-b border-slate-200">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white shadow-md">
              <Receipt className="w-5 h-5" />
            </div>
            <h2 className="text-xl font-bold text-slate-800">Tax Settings</h2>
          </div>
        </div>
        
        <div className="border-b border-slate-200">
          <div className="flex space-x-6 px-6">
            {(['zones', 'categories', 'overrides'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`py-4 px-2 font-semibold text-sm border-b-2 transition-colors ${
                  activeTab === tab
                    ? 'border-indigo-600 text-indigo-600'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <div className="p-6">
          {/* ZONES TAB */}
          {activeTab === 'zones' && (
            <div className="space-y-6">
              <div className="flex items-end space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">New Zone Name</label>
                  <input
                    type="text"
                    value={newZone.name}
                    onChange={e => setNewZone({ ...newZone, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., European Union"
                  />
                </div>
                <button
                  onClick={handleCreateZone}
                  disabled={!newZone.name}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Zone
                </button>
              </div>

              <div className="space-y-4">
                {zones.map(zone => {
                  const isExpanded = expandedZones.includes(zone.id);
                  return (
                    <div key={zone.id} className="border border-slate-200 rounded-2xl overflow-hidden">
                      <div 
                        className="bg-white p-4 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors"
                        onClick={() => toggleZoneExpand(zone.id)}
                      >
                        <div className="flex items-center space-x-4">
                          {isExpanded ? <ChevronDown className="w-5 h-5 text-slate-400" /> : <ChevronRight className="w-5 h-5 text-slate-400" />}
                          <h3 className="font-semibold text-slate-800">{zone.name}</h3>
                          <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-indigo-100 text-indigo-700">
                            {zone.countries?.length || 0} Countries
                          </span>
                        </div>
                        <div className="flex items-center space-x-4 text-sm text-slate-500">
                          <div className="flex items-center space-x-2">
                            <span>Inclusive:</span>
                            {zone.inclusive ? <ToggleRight className="w-5 h-5 text-emerald-500" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                          </div>
                          <div className="flex items-center space-x-2">
                            <span>Enabled:</span>
                            {zone.enabled ? <ToggleRight className="w-5 h-5 text-indigo-600" /> : <ToggleLeft className="w-5 h-5 text-slate-300" />}
                          </div>
                        </div>
                      </div>

                      {isExpanded && (
                        <div className="p-6 bg-slate-50 border-t border-slate-200 space-y-6">
                          {/* Zone Settings */}
                          <div className="flex items-center justify-between">
                            <div className="flex space-x-6">
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={zone.inclusive}
                                  onChange={e => handleUpdateZone(zone.id, { inclusive: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-slate-700">Prices Include Tax</span>
                              </label>
                              <label className="flex items-center space-x-2 cursor-pointer">
                                <input 
                                  type="checkbox" 
                                  checked={zone.enabled}
                                  onChange={e => handleUpdateZone(zone.id, { enabled: e.target.checked })}
                                  className="rounded text-indigo-600 focus:ring-indigo-500"
                                />
                                <span className="text-sm font-medium text-slate-700">Zone Enabled</span>
                              </label>
                            </div>
                            <button 
                              onClick={() => handleDeleteZone(zone.id)}
                              className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center"
                            >
                              <Trash2 className="w-4 h-4 mr-1" /> Delete Zone
                            </button>
                          </div>

                          <div className="grid grid-cols-2 gap-6">
                            {/* Countries */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <h4 className="font-semibold text-slate-800 mb-3 flex items-center"><Globe className="w-4 h-4 mr-2" /> Countries</h4>
                              <div className="flex space-x-2 mb-3">
                                <input
                                  type="text"
                                  value={newCountry[zone.id] || ''}
                                  onChange={e => setNewCountry({...newCountry, [zone.id]: e.target.value.toUpperCase()})}
                                  placeholder="Country Code (e.g. US)"
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                                  maxLength={2}
                                />
                                <button
                                  onClick={() => handleAddCountry(zone.id)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold"
                                >
                                  Add
                                </button>
                              </div>
                              <ul className="space-y-2">
                                {zone.countries?.map(c => (
                                  <li key={c.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                                    <span className="font-medium">{c.country_code}</span>
                                    <button onClick={() => handleDeleteCountry(zone.id, c.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                  </li>
                                ))}
                                {!zone.countries?.length && <p className="text-xs text-slate-400 italic">No countries added</p>}
                              </ul>
                            </div>

                            {/* Regions */}
                            <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                              <h4 className="font-semibold text-slate-800 mb-3 flex items-center"><MapPin className="w-4 h-4 mr-2" /> Regions / States</h4>
                              <div className="flex space-x-2 mb-3">
                                <input
                                  type="text"
                                  value={newRegion[zone.id] || ''}
                                  onChange={e => setNewRegion({...newRegion, [zone.id]: e.target.value.toUpperCase()})}
                                  placeholder="Region Code (e.g. CA)"
                                  className="flex-1 px-3 py-1.5 text-sm rounded-lg border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                                />
                                <button
                                  onClick={() => handleAddRegion(zone.id)}
                                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-lg text-sm font-semibold"
                                >
                                  Add
                                </button>
                              </div>
                              <ul className="space-y-2">
                                {zone.regions?.map(r => (
                                  <li key={r.id} className="flex justify-between items-center text-sm p-2 bg-slate-50 rounded-lg">
                                    <span className="font-medium">{r.region_code}</span>
                                    <button onClick={() => handleDeleteRegion(zone.id, r.id)} className="text-red-500 hover:text-red-700"><Trash2 className="w-4 h-4"/></button>
                                  </li>
                                ))}
                                {!zone.regions?.length && <p className="text-xs text-slate-400 italic">No regions added</p>}
                              </ul>
                            </div>
                          </div>

                          {/* Rates */}
                          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
                            <h4 className="font-semibold text-slate-800 mb-3 flex items-center"><Tag className="w-4 h-4 mr-2" /> Tax Rates</h4>
                            
                            <div className="overflow-x-auto mb-4">
                              <table className="w-full text-left text-sm text-slate-600">
                                <thead>
                                  <tr className="border-b border-slate-200 bg-slate-50">
                                    <th className="px-4 py-2 font-semibold">Category</th>
                                    <th className="px-4 py-2 font-semibold">Name</th>
                                    <th className="px-4 py-2 font-semibold">Rate (%)</th>
                                    <th className="px-4 py-2 font-semibold">Type</th>
                                    <th className="px-4 py-2 font-semibold">Compound</th>
                                    <th className="px-4 py-2 font-semibold">Priority</th>
                                    <th className="px-4 py-2 font-semibold text-right">Actions</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {zone.rates?.map(rate => (
                                    <tr key={rate.id} className="border-b border-slate-100 last:border-0">
                                      <td className="px-4 py-2 font-medium">
                                        {categories.find(c => c.id === rate.tax_category_id)?.name || 'Unknown'}
                                      </td>
                                      <td className="px-4 py-2">{rate.name}</td>
                                      <td className="px-4 py-2 font-bold text-slate-800">{rate.rate}</td>
                                      <td className="px-4 py-2 capitalize">{rate.rate_type}</td>
                                      <td className="px-4 py-2">{rate.is_compound ? 'Yes' : 'No'}</td>
                                      <td className="px-4 py-2">{rate.priority}</td>
                                      <td className="px-4 py-2 text-right">
                                        <button onClick={() => handleDeleteRate(zone.id, rate.id)} className="text-red-500 hover:text-red-700">
                                          <Trash2 className="w-4 h-4 inline" />
                                        </button>
                                      </td>
                                    </tr>
                                  ))}
                                  {!zone.rates?.length && (
                                    <tr><td colSpan={7} className="px-4 py-4 text-center text-slate-400 italic">No rates configured for this zone</td></tr>
                                  )}
                                </tbody>
                              </table>
                            </div>

                            <div className="grid grid-cols-6 gap-3 bg-slate-50 p-3 rounded-xl border border-slate-200 items-end">
                              <div className="col-span-1">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Category</label>
                                <select 
                                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                  value={newRate[zone.id]?.tax_category_id || ''}
                                  onChange={e => setNewRate({...newRate, [zone.id]: {...newRate[zone.id], tax_category_id: parseInt(e.target.value)}})}
                                >
                                  <option value="">Select...</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                              </div>
                              <div className="col-span-2">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Rate Name</label>
                                <input 
                                  type="text" placeholder="e.g. VAT 20%"
                                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                  value={newRate[zone.id]?.name || ''}
                                  onChange={e => setNewRate({...newRate, [zone.id]: {...newRate[zone.id], name: e.target.value}})}
                                />
                              </div>
                              <div className="col-span-1">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Rate</label>
                                <input 
                                  type="number" step="0.01" placeholder="0.00"
                                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                  value={newRate[zone.id]?.rate || ''}
                                  onChange={e => setNewRate({...newRate, [zone.id]: {...newRate[zone.id], rate: parseFloat(e.target.value)}})}
                                />
                              </div>
                              <div className="col-span-1">
                                <label className="block text-xs font-medium text-slate-500 mb-1">Type</label>
                                <select 
                                  className="w-full px-2 py-1.5 text-sm rounded-lg border border-slate-200 bg-white"
                                  value={newRate[zone.id]?.rate_type || 'percentage'}
                                  onChange={e => setNewRate({...newRate, [zone.id]: {...newRate[zone.id], rate_type: e.target.value}})}
                                >
                                  <option value="percentage">%</option>
                                  <option value="fixed">Fixed</option>
                                </select>
                              </div>
                              <div className="col-span-1">
                                <button
                                  onClick={() => handleAddRate(zone.id)}
                                  className="w-full bg-slate-800 hover:bg-slate-900 text-white px-3 py-1.5 rounded-lg text-sm font-semibold"
                                >
                                  Add Rate
                                </button>
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* CATEGORIES TAB */}
          {activeTab === 'categories' && (
            <div className="space-y-6">
              <div className="flex items-end space-x-4 bg-slate-50 p-4 rounded-2xl border border-slate-100">
                <div className="flex-1">
                  <label className="block text-xs font-semibold text-slate-500 mb-1">Category Name</label>
                  <input
                    type="text"
                    value={newCategory.name}
                    onChange={e => setNewCategory({ ...newCategory, name: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl border border-slate-200 focus:ring-2 focus:ring-indigo-500"
                    placeholder="e.g., Standard Rate, Reduced Rate"
                  />
                </div>
                <div className="flex items-center mb-2 mr-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input 
                      type="checkbox"
                      checked={newCategory.is_default}
                      onChange={e => setNewCategory({ ...newCategory, is_default: e.target.checked })}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span className="text-sm font-medium text-slate-700">Set as Default</span>
                  </label>
                </div>
                <button
                  onClick={handleCreateCategory}
                  disabled={!newCategory.name}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-semibold flex items-center"
                >
                  <Plus className="w-4 h-4 mr-2" /> Add Category
                </button>
              </div>

              <div className="grid gap-3">
                {categories.map(cat => (
                  <div key={cat.id} className="flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl shadow-sm">
                    <div className="flex items-center space-x-3">
                      <span className="font-semibold text-slate-800">{cat.name}</span>
                      {cat.is_default && (
                        <span className="px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-700 flex items-center">
                          <Star className="w-3 h-3 mr-1 fill-emerald-700" /> Default
                        </span>
                      )}
                    </div>
                    <button 
                      onClick={() => handleDeleteCategory(cat.id)}
                      className="text-red-500 hover:text-red-700 p-2 rounded-lg hover:bg-red-50 transition-colors"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                ))}
                {!categories.length && <div className="text-center p-8 text-slate-500">No tax categories configured.</div>}
              </div>
            </div>
          )}

          {/* OVERRIDES TAB */}
          {activeTab === 'overrides' && (
            <div className="space-y-6">
              
              <div className="bg-slate-50 p-5 rounded-2xl border border-slate-200 space-y-4">
                <h3 className="font-semibold text-slate-800">Add Exception / Override</h3>
                <div className="grid grid-cols-5 gap-4 items-end">
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Scope</label>
                    <select 
                      value={newOverride.scope_type}
                      onChange={e => setNewOverride({ ...newOverride, scope_type: e.target.value, scope_id: 0 })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value="product">Product</option>
                      <option value="tax_category">Category</option>
                    </select>
                  </div>
                  <div className="col-span-2">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Target</label>
                    {newOverride.scope_type === 'product' ? (
                      <select 
                        value={newOverride.scope_id}
                        onChange={e => setNewOverride({ ...newOverride, scope_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value={0}>Select Product...</option>
                        {products.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
                      </select>
                    ) : (
                      <select 
                        value={newOverride.scope_id}
                        onChange={e => setNewOverride({ ...newOverride, scope_id: parseInt(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      >
                        <option value={0}>Select Category...</option>
                        {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    )}
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-500 mb-1">Zone</label>
                    <select 
                      value={newOverride.tax_zone_id}
                      onChange={e => setNewOverride({ ...newOverride, tax_zone_id: parseInt(e.target.value) })}
                      className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                    >
                      <option value={0}>Select Zone...</option>
                      {zones.map(z => <option key={z.id} value={z.id}>{z.name}</option>)}
                    </select>
                  </div>
                  <div className="flex items-center space-x-3 mb-2">
                    <label className="flex items-center space-x-2">
                      <input 
                        type="checkbox"
                        checked={newOverride.exempt}
                        onChange={e => setNewOverride({ ...newOverride, exempt: e.target.checked })}
                        className="rounded text-indigo-600 focus:ring-indigo-500"
                      />
                      <span className="text-sm font-medium">Exempt</span>
                    </label>
                  </div>
                </div>

                {!newOverride.exempt && (
                  <div className="flex items-end space-x-4">
                    <div className="w-48">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Override Rate (%)</label>
                      <input 
                        type="number" step="0.01"
                        value={newOverride.rate}
                        onChange={e => setNewOverride({ ...newOverride, rate: parseFloat(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-slate-200 bg-white"
                      />
                    </div>
                  </div>
                )}
                
                <div className="flex justify-end pt-2">
                  <button
                    onClick={handleCreateOverride}
                    disabled={!newOverride.scope_id || !newOverride.tax_zone_id}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 text-white px-4 py-2 rounded-xl text-sm font-semibold flex items-center"
                  >
                    <Plus className="w-4 h-4 mr-2" /> Add Override
                  </button>
                </div>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                <table className="w-full text-left text-sm text-slate-600">
                  <thead className="bg-slate-50 border-b border-slate-200">
                    <tr>
                      <th className="px-6 py-3 font-semibold">Scope</th>
                      <th className="px-6 py-3 font-semibold">Target</th>
                      <th className="px-6 py-3 font-semibold">Zone</th>
                      <th className="px-6 py-3 font-semibold">Rate</th>
                      <th className="px-6 py-3 font-semibold">Exempt</th>
                      <th className="px-6 py-3 font-semibold text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {overrides.map(override => {
                      const zone = zones.find(z => z.id === override.tax_zone_id);
                      let targetName = 'Unknown';
                      if (override.scope_type === 'product') {
                        targetName = products.find(p => p.id === override.scope_id)?.title || `Product #${override.scope_id}`;
                      } else {
                        targetName = categories.find(c => c.id === override.scope_id)?.name || `Category #${override.scope_id}`;
                      }

                      return (
                        <tr key={override.id} className="hover:bg-slate-50">
                          <td className="px-6 py-4 capitalize font-medium">{override.scope_type.replace('_', ' ')}</td>
                          <td className="px-6 py-4">{targetName}</td>
                          <td className="px-6 py-4">{zone?.name || `Zone #${override.tax_zone_id}`}</td>
                          <td className="px-6 py-4 font-semibold text-slate-800">{override.exempt ? '-' : `${override.rate}%`}</td>
                          <td className="px-6 py-4">
                            {override.exempt ? 
                              <span className="px-2 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-700">Exempt</span> : 
                              <span className="text-slate-400">-</span>
                            }
                          </td>
                          <td className="px-6 py-4 text-right">
                            <button onClick={() => handleDeleteOverride(override.id)} className="text-red-500 hover:text-red-700">
                              <Trash2 className="w-4 h-4 inline" />
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {!overrides.length && (
                      <tr><td colSpan={6} className="px-6 py-8 text-center text-slate-500">No overrides configured</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
