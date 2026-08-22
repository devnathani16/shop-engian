import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Loader2, Plus, Trash2, Globe, ShieldCheck, Truck, MapPin, DollarSign, Package, Activity, PlayCircle, X, Check } from 'lucide-react';

const ShippingModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState('');

  // Data State
  const [providers, setProviders] = useState<any[]>([]);
  const [zones, setZones] = useState<any[]>([]);
  const [rules, setRules] = useState<any[]>([]); // To match free shipping rules

  // New Provider State
  // Provider Form State
  const [editingProviderId, setEditingProviderId] = useState<number | null>(null);
  const [providerForm, setProviderForm] = useState({
    name: 'shiprocket',
    email: '',
    password: '',
    pickupLocation: 'Home',
    apiKey: '',
    // Shippo pickup address
    pickupStreet: '',
    pickupCity: '',
    pickupState: '',
    pickupZip: '',
    pickupCountry: 'US',
  });
  
  const [isAddingProvider, setIsAddingProvider] = useState(false);

  // New Zone State
  const [isAddingZone, setIsAddingZone] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDefault, setNewZoneDefault] = useState(false);
  const [newZoneCountry, setNewZoneCountry] = useState('IN');
  const [expandedZoneId, setExpandedZoneId] = useState<number | null>(null);

  // New Rate State (inside Zone)
  const [isAddingRate, setIsAddingRate] = useState<number | null>(null);
  const [newRateName, setNewRateName] = useState('Standard Delivery');
  const [newRateAmount, setNewRateAmount] = useState(50);

  // Simulator State
  const [products, setProducts] = useState<any[]>([]);
  const [simCart, setSimCart] = useState<{variant_id: number, quantity: number, name: string}[]>([]);
  const [simCountry, setSimCountry] = useState('IN');
  const [simState, setSimState] = useState('');
  const [simPincode, setSimPincode] = useState('110001');
  const [simResults, setSimResults] = useState<any>(null);
  const [isSimulating, setIsSimulating] = useState(false);
  const [simSelectedVariant, setSimSelectedVariant] = useState<string>('');
  const [simQty, setSimQty] = useState(1);

  const showMsg = (msg: string) => {
    setMessage(msg);
    setTimeout(() => setMessage(''), 3000);
  };

  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [provRes, zonesRes, rulesRes, prodRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/shops/${id}/shipping-providers`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops/${id}/shipping-zones`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops/${id}/shipping-rules`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops/${id}/products`, { withCredentials: true })
      ]);
      setProviders(provRes.data.providers || []);
      setZones(zonesRes.data.zones || []);
      setRules(rulesRes.data.rules || []);
      setProducts(prodRes.data.products || []);
    } catch (err) {
      console.error(err);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const openProviderForm = (provider?: any) => {
    if (provider) {
      let config: any = {};
      try { config = JSON.parse(provider.auth_config); } catch(e) {}
      setProviderForm({
        name: provider.provider_name,
        email: config.email || '',
        password: config.password || '',
        pickupLocation: config.pickup_location || 'Home',
        apiKey: config.api_key || '',
        pickupStreet: config.pickup_street || '',
        pickupCity: config.pickup_city || '',
        pickupState: config.pickup_state || '',
        pickupZip: config.pickup_zip || '',
        pickupCountry: config.pickup_country || 'US',
      });
      setEditingProviderId(provider.id);
    } else {
      setProviderForm({ name: 'shiprocket', email: '', password: '', pickupLocation: 'Home', apiKey: '', pickupStreet: '', pickupCity: '', pickupState: '', pickupZip: '', pickupCountry: 'US' });
      setEditingProviderId(null);
    }
    setIsAddingProvider(true);
  };

  // --- Global Providers API ---
  const handleSaveProvider = async () => {
    let authConfig = {};
    if (providerForm.name === 'shiprocket') {
      authConfig = { email: providerForm.email, password: providerForm.password, pickup_location: providerForm.pickupLocation };
    } else {
      // Shippo: store API key + pickup address
      authConfig = {
        api_key: providerForm.apiKey,
        pickup_street: providerForm.pickupStreet,
        pickup_city: providerForm.pickupCity,
        pickup_state: providerForm.pickupState,
        pickup_zip: providerForm.pickupZip,
        pickup_country: providerForm.pickupCountry,
      };
    }

    try {
      if (editingProviderId) {
        const isActive = providers.find(p => p.id === editingProviderId)?.is_active ?? true;
        await axios.put(`http://localhost:8080/api/shops/${id}/shipping-providers/${editingProviderId}`, {
          auth_config: JSON.stringify(authConfig),
          is_active: isActive
        }, { withCredentials: true });
        showMsg('Carrier settings updated!');
      } else {
        await axios.post(`http://localhost:8080/api/shops/${id}/shipping-providers`, {
          provider_name: providerForm.name,
          auth_config: JSON.stringify(authConfig),
          is_active: true
        }, { withCredentials: true });
        showMsg('Carrier Connected!');
      }
      setIsAddingProvider(false);
      setEditingProviderId(null);
      fetchData();
    } catch (err) {
      alert('Failed to save provider');
    }
  };

  const handleUpdateProvider = async (pid: number, isActive: boolean, config: string) => {
    try {
      await axios.put(`http://localhost:8080/api/shops/${id}/shipping-providers/${pid}`, {
        auth_config: config,
        is_active: isActive
      }, { withCredentials: true });
      showMsg('Carrier settings updated!');
      fetchData();
    } catch (err) {
      alert('Failed to update provider');
    }
  };

  // --- Zones API ---
  const handleCreateZone = async () => {
    try {
      await axios.post(`http://localhost:8080/api/shops/${id}/shipping-zones`, {
        name: newZoneName,
        is_default: newZoneDefault,
        countries: newZoneDefault ? [] : [newZoneCountry] // Use selected country
      }, { withCredentials: true });
      setIsAddingZone(false);
      setNewZoneName('');
      showMsg('Zone created!');
      fetchData();
    } catch (err) {
      alert('Failed to create zone');
    }
  };

  const handleDeleteZone = async (zid: number) => {
    if(!confirm('Delete this zone?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/shipping-zones/${zid}`, { withCredentials: true });
      showMsg('Zone deleted!');
      fetchData();
    } catch (err) {
      alert('Failed to delete zone');
    }
  };

  // --- Zone Carriers API ---
  const handleToggleZoneProvider = async (zid: number, pid: number, isCurrentlyAssigned: boolean) => {
    try {
      if (isCurrentlyAssigned) {
        await axios.delete(`http://localhost:8080/api/shops/${id}/shipping-zones/${zid}/providers/${pid}`, { withCredentials: true });
      } else {
        await axios.post(`http://localhost:8080/api/shops/${id}/shipping-zones/${zid}/providers`, { provider_id: pid }, { withCredentials: true });
      }
      fetchData();
    } catch (err) {
      alert('Failed to toggle provider in zone');
    }
  };

  // --- Zone Manual Rates API ---
  const handleCreateRate = async (zid: number) => {
    try {
      await axios.post(`http://localhost:8080/api/shops/${id}/shipping-zones/${zid}/rates`, {
        name: newRateName,
        rate: newRateAmount,
        min_weight: 0,
        max_weight: 0,
        min_order_value: 0,
        max_order_value: 0,
        estimated_days: "3-5 Days"
      }, { withCredentials: true });
      setIsAddingRate(null);
      showMsg('Rate added!');
      fetchData();
    } catch (err) {
      alert('Failed to add rate');
    }
  };

  const handleDeleteRate = async (zid: number, rid: number) => {
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/shipping-zones/${zid}/rates/${rid}`, { withCredentials: true });
      fetchData();
    } catch (err) {
      alert('Failed to delete rate');
    }
  };

  // --- Free Shipping Rules API ---
  const handleSetFreeShipping = async (zid: number, threshold: number) => {
    try {
      // Find existing rule for this zone if any
      const existingRule = rules.find(r => r.zone_id === zid && r.name === 'Free Shipping Over Threshold');
      if (existingRule) {
        await axios.delete(`http://localhost:8080/api/shops/${id}/shipping-rules/${existingRule.id}`, { withCredentials: true });
      }

      if (threshold > 0) {
        const ruleData = {
          name: "Free Shipping Over Threshold",
          priority: 10,
          zone_id: zid,
          conditions_json: JSON.stringify({
            operator: "AND",
            conditions: [{ field: "cart_total", operator: ">=", value: threshold }]
          }),
          action_json: JSON.stringify({ type: "FREE_SHIPPING", value: 0 }),
          is_active: true
        };
        await axios.post(`http://localhost:8080/api/shops/${id}/shipping-rules`, ruleData, { withCredentials: true });
        showMsg(`Free shipping rule set at ₹${threshold}`);
      } else {
        showMsg('Free shipping rule removed.');
      }
      fetchData();
    } catch (err) {
      alert('Failed to set free shipping');
    }
  };

  // Simulator
  const handleRunSimulator = async () => {
    if (simCart.length === 0) return alert('Add items to cart');
    setIsSimulating(true);
    try {
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/shipping/simulate`, {
        cart: simCart.map(i => ({ variant_id: i.variant_id, quantity: i.quantity })),
        pincode: simPincode,
        country: simCountry,
        state: simState
      }, { withCredentials: true });
      setSimResults(res.data);
    } catch(err) {
      alert('Simulation failed');
    }
    setIsSimulating(false);
  };

  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto pb-20 pt-4 px-4 space-y-12">
      <div className="mb-8">
        <div className="flex items-center space-x-3 mb-2">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center shadow-lg shadow-indigo-500/20">
            <Globe className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Shipping Settings</h1>
        </div>
        <p className="text-slate-500 ml-13 text-lg">Manage your global fulfillment network, live carriers, and rates from one place.</p>
      </div>

      {message && (
        <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-center animate-in fade-in slide-in-from-top-2 duration-300">
          <ShieldCheck className="w-5 h-5 text-emerald-600 mr-3 shrink-0" />
          <p className="text-sm font-medium text-emerald-800">{message}</p>
        </div>
      )}

      {/* SECTION 1: GLOBAL CARRIERS */}
      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center">
            <Truck className="w-5 h-5 text-indigo-600 mr-3" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Carrier Accounts</h2>
              <p className="text-sm text-slate-500">Connect your live shipping providers globally.</p>
            </div>
          </div>
          <button onClick={() => { setIsAddingProvider(!isAddingProvider); if(!isAddingProvider) openProviderForm(); }} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center shadow-sm">
            {isAddingProvider ? <X className="w-4 h-4 mr-1"/> : <Plus className="w-4 h-4 mr-1" />} 
            {isAddingProvider ? 'Cancel' : 'Connect Carrier'}
          </button>
        </div>

        <div className="p-6">
          {isAddingProvider && (
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-6">
              <h3 className="font-bold text-indigo-900 mb-4">{editingProviderId ? 'Edit Connection' : 'New Connection'}</h3>
              
              <div className="mb-4">
                <label className="text-xs font-bold text-indigo-800 uppercase">Provider</label>
                <select 
                  value={providerForm.name} 
                  onChange={e => setProviderForm({...providerForm, name: e.target.value})} 
                  disabled={!!editingProviderId}
                  className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm disabled:opacity-50"
                >
                  <option value="shiprocket">Shiprocket</option>
                  <option value="shippo">Shippo</option>
                </select>
              </div>

              {providerForm.name === 'shiprocket' ? (
                <div className="grid grid-cols-2 gap-4 mb-4">
                  <div>
                    <label className="text-xs font-bold text-indigo-800 uppercase">Email</label>
                    <input type="email" value={providerForm.email} onChange={e => setProviderForm({...providerForm, email: e.target.value})} placeholder='devnathin16@gmail.com' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-indigo-800 uppercase">Password</label>
                    <input type="password" value={providerForm.password} onChange={e => setProviderForm({...providerForm, password: e.target.value})} placeholder='********' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                  </div>
                  <div className="col-span-2">
                    <label className="text-xs font-bold text-indigo-800 uppercase">Pickup Location ID / Name</label>
                    <input type="text" value={providerForm.pickupLocation} onChange={e => setProviderForm({...providerForm, pickupLocation: e.target.value})} placeholder='Home' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                    <p className="text-xs text-indigo-500 mt-1">Found in your Shiprocket Pickup Settings</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="text-xs font-bold text-indigo-800 uppercase">Shippo API Token</label>
                    <input type="text" value={providerForm.apiKey} onChange={e => setProviderForm({...providerForm, apiKey: e.target.value})} placeholder='shippo_test_xxxxxxxx' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm font-mono" />
                  </div>
                  <div className="border-t border-indigo-100 pt-4">
                    <p className="text-xs font-bold text-indigo-800 uppercase mb-3">Pickup / Origin Address</p>
                    <p className="text-xs text-indigo-500 mb-3">This is where your packages ship FROM. Used to calculate accurate rates.</p>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="col-span-2">
                        <label className="text-xs font-semibold text-slate-600">Street Address</label>
                        <input type="text" value={providerForm.pickupStreet} onChange={e => setProviderForm({...providerForm, pickupStreet: e.target.value})} placeholder='350 5th Ave' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">City</label>
                        <input type="text" value={providerForm.pickupCity} onChange={e => setProviderForm({...providerForm, pickupCity: e.target.value})} placeholder='New York' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">State</label>
                        <input type="text" value={providerForm.pickupState} onChange={e => setProviderForm({...providerForm, pickupState: e.target.value})} placeholder='NY' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">ZIP / Postcode</label>
                        <input type="text" value={providerForm.pickupZip} onChange={e => setProviderForm({...providerForm, pickupZip: e.target.value})} placeholder='10001' className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                      </div>
                      <div>
                        <label className="text-xs font-semibold text-slate-600">Country</label>
                        <select value={providerForm.pickupCountry} onChange={e => setProviderForm({...providerForm, pickupCountry: e.target.value})} className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm">
                          <option value="US">United States (US)</option>
                          <option value="IN">India (IN)</option>
                          <option value="GB">United Kingdom (GB)</option>
                          <option value="CA">Canada (CA)</option>
                          <option value="AU">Australia (AU)</option>
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <button onClick={handleSaveProvider} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700">Save Credentials</button>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {providers.map(p => (
              <div key={p.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm flex items-start justify-between group">
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center border border-indigo-100 shrink-0">
                    <Truck className="w-6 h-6 text-indigo-600" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 uppercase tracking-wide">{p.provider_name}</h3>
                    <p className="text-xs text-slate-400 mt-0.5 max-w-[150px] truncate">Active Connection</p>
                  </div>
                </div>
                <div className="flex flex-col items-end">
                  <div className="flex items-center space-x-3 mb-2">
                    <button onClick={() => openProviderForm(p)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Edit</button>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" className="sr-only peer" checked={p.is_active} onChange={e => handleUpdateProvider(p.id, e.target.checked, p.auth_config)} />
                      <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-emerald-500"></div>
                    </label>
                  </div>
                  <span className={`text-[10px] font-bold ${p.is_active ? 'text-emerald-600' : 'text-slate-400'}`}>{p.is_active ? 'ACTIVE' : 'DISABLED'}</span>
                </div>
              </div>
            ))}
            {providers.length === 0 && !isAddingProvider && (
              <div className="col-span-2 text-center py-6 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <p className="text-slate-500 text-sm font-medium">No carriers connected. Customers will rely on manual rates.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 2: SHIPPING ZONES */}
      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="bg-slate-50 p-6 border-b border-slate-200 flex justify-between items-center">
          <div className="flex items-center">
            <MapPin className="w-5 h-5 text-indigo-600 mr-3" />
            <div>
              <h2 className="text-lg font-bold text-slate-900">Shipping Zones</h2>
              <p className="text-sm text-slate-500">Configure where you ship and how much to charge.</p>
            </div>
          </div>
          <button onClick={() => setIsAddingZone(!isAddingZone)} className="bg-indigo-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700 transition-all flex items-center shadow-sm">
            {isAddingZone ? <X className="w-4 h-4 mr-1"/> : <Plus className="w-4 h-4 mr-1" />} 
            {isAddingZone ? 'Cancel' : 'Create Zone'}
          </button>
        </div>

        <div className="p-6">
          {isAddingZone && (
            <div className="bg-indigo-50/50 p-6 rounded-2xl border border-indigo-100 mb-6">
              <h3 className="font-bold text-indigo-900 mb-4">New Zone</h3>
              <div className="flex space-x-4 mb-4">
                <div className="flex-1">
                  <label className="text-xs font-bold text-indigo-800 uppercase">Zone Name</label>
                  <input type="text" value={newZoneName} onChange={e => setNewZoneName(e.target.value)} placeholder="e.g. Domestic (India)" className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm" />
                </div>
                {!newZoneDefault && (
                  <div className="flex-1">
                    <label className="text-xs font-bold text-indigo-800 uppercase">Country</label>
                    <select value={newZoneCountry} onChange={e => setNewZoneCountry(e.target.value)} className="w-full mt-1 bg-white border border-indigo-200 rounded-xl px-4 py-2 focus:ring-2 focus:ring-indigo-500 text-sm">
                      <option value="IN">India (IN)</option>
                      <option value="US">United States (US)</option>
                      <option value="CA">Canada (CA)</option>
                      <option value="GB">United Kingdom (GB)</option>
                      <option value="AU">Australia (AU)</option>
                    </select>
                  </div>
                )}
                <div className="flex items-center mt-6">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input type="checkbox" checked={newZoneDefault} onChange={e => setNewZoneDefault(e.target.checked)} className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 w-5 h-5" />
                    <span className="text-sm font-bold text-indigo-900">Rest of World (Default)</span>
                  </label>
                </div>
              </div>
              <button onClick={handleCreateZone} className="bg-indigo-600 text-white px-6 py-2 rounded-xl text-sm font-bold hover:bg-indigo-700">Save Zone</button>
            </div>
          )}

          <div className="space-y-4">
            {zones.map(z => {
              const isExpanded = expandedZoneId === z.id;
              
              // Find Free Shipping Rule for this zone
              const freeShipRule = rules.find(r => r.zone_id === z.id && r.name === 'Free Shipping Over Threshold');
              let currentFreeShipThreshold = '';
              if (freeShipRule) {
                try {
                  const parsed = JSON.parse(freeShipRule.conditions_json);
                  currentFreeShipThreshold = parsed.conditions[0].value.toString();
                } catch(e) {}
              }

              return (
                <div key={z.id} className={`border rounded-2xl overflow-hidden transition-all duration-200 ${isExpanded ? 'border-indigo-300 shadow-md bg-white' : 'border-slate-200 shadow-sm bg-white hover:border-indigo-200'}`}>
                  {/* Header (Click to expand) */}
                  <div onClick={() => setExpandedZoneId(isExpanded ? null : z.id)} className={`px-6 py-4 cursor-pointer flex justify-between items-center select-none ${isExpanded ? 'bg-indigo-50/50' : 'bg-white'}`}>
                    <div className="flex items-center space-x-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${z.is_default ? 'bg-slate-100' : 'bg-indigo-100'}`}>
                        {z.is_default ? <Globe className="w-4 h-4 text-slate-600"/> : <MapPin className="w-4 h-4 text-indigo-600" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-lg flex items-center">
                          {z.name}
                          {z.is_default && <span className="ml-2 bg-slate-200 text-slate-700 px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider">Rest of World</span>}
                        </h3>
                        <p className="text-xs text-slate-500 font-medium">
                          {z.is_default ? 'Applies to all other countries' : (z.countries?.length > 0 ? z.countries.map((c:any)=>c.country_code).join(', ') : 'No countries assigned')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center space-x-4">
                      {z.rates?.length > 0 && <span className="text-xs font-bold text-emerald-600 bg-emerald-100 px-2 py-1 rounded-md">{z.rates.length} Rates</span>}
                      {z.providers?.length > 0 && <span className="text-xs font-bold text-indigo-600 bg-indigo-100 px-2 py-1 rounded-md">Live Rates On</span>}
                      {freeShipRule && <span className="text-xs font-bold text-pink-600 bg-pink-100 px-2 py-1 rounded-md">Free Ship</span>}
                      
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteZone(z.id); }} className="text-slate-400 hover:text-rose-500 p-2 rounded-lg hover:bg-rose-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Editor Body */}
                  {isExpanded && (
                    <div className="p-6 border-t border-indigo-100 bg-white grid grid-cols-1 lg:grid-cols-2 gap-8">
                      
                      {/* Left Column: Rates & Rules */}
                      <div className="space-y-6">
                        {/* Manual Fixed Rates */}
                        <div>
                          <div className="flex justify-between items-center mb-3">
                            <h4 className="text-sm font-bold text-slate-900 flex items-center"><DollarSign className="w-4 h-4 mr-1 text-slate-400"/> Fixed Standard Rates</h4>
                            <button onClick={() => setIsAddingRate(z.id)} className="text-xs font-bold text-indigo-600 hover:text-indigo-800">Add Rate</button>
                          </div>
                          
                          <div className="space-y-2">
                            {z.rates?.map((r:any) => (
                              <div key={r.id} className="flex justify-between items-center bg-slate-50 border border-slate-200 px-4 py-3 rounded-xl shadow-sm">
                                <div>
                                  <p className="font-bold text-slate-900 text-sm">{r.name}</p>
                                  <p className="text-xs text-slate-500">{r.estimated_days}</p>
                                </div>
                                <div className="flex items-center space-x-4">
                                  <span className="font-black text-indigo-700">₹{r.rate}</span>
                                  <button onClick={() => handleDeleteRate(z.id, r.id)} className="text-slate-400 hover:text-rose-500"><Trash2 className="w-4 h-4"/></button>
                                </div>
                              </div>
                            ))}
                            {z.rates?.length === 0 && !isAddingRate && (
                              <p className="text-xs text-slate-400 italic">No fixed rates. Click 'Add Rate' to create one.</p>
                            )}
                          </div>

                          {isAddingRate === z.id && (
                            <div className="mt-3 bg-slate-50 border border-slate-200 p-4 rounded-xl flex items-end space-x-3 animate-in fade-in slide-in-from-top-2">
                              <div className="flex-1">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Rate Name</label>
                                <input type="text" value={newRateName} onChange={e=>setNewRateName(e.target.value)} className="w-full mt-1 border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:ring-indigo-500" />
                              </div>
                              <div className="w-24">
                                <label className="text-[10px] font-bold text-slate-500 uppercase">Price (₹)</label>
                                <input type="number" value={newRateAmount} onChange={e=>setNewRateAmount(parseFloat(e.target.value))} className="w-full mt-1 border-slate-200 rounded-lg text-sm px-3 py-1.5 focus:ring-indigo-500" />
                              </div>
                              <div className="flex space-x-2">
                                <button onClick={() => handleCreateRate(z.id)} className="bg-indigo-600 text-white p-2 rounded-lg hover:bg-indigo-700"><Check className="w-4 h-4"/></button>
                                <button onClick={() => setIsAddingRate(null)} className="bg-slate-200 text-slate-600 p-2 rounded-lg hover:bg-slate-300"><X className="w-4 h-4"/></button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Free Shipping Rule */}
                        <div className="bg-pink-50/50 border border-pink-100 p-4 rounded-2xl">
                          <h4 className="text-sm font-bold text-pink-900 mb-1 flex items-center">Conditional Free Shipping</h4>
                          <p className="text-xs text-pink-700 mb-3">Waive manual fixed rates if the cart total exceeds a certain amount.</p>
                          <div className="flex items-center space-x-2">
                            <span className="text-sm font-medium text-pink-900">Free shipping for orders over: ₹</span>
                            <input 
                              type="number" 
                              placeholder="0"
                              defaultValue={currentFreeShipThreshold}
                              onBlur={(e) => handleSetFreeShipping(z.id, parseFloat(e.target.value) || 0)}
                              className="w-32 border-pink-200 rounded-lg text-sm px-3 py-1.5 focus:ring-pink-500 bg-white" 
                            />
                            {freeShipRule && <Check className="w-4 h-4 text-emerald-500"/>}
                          </div>
                        </div>
                      </div>

                      {/* Right Column: Live Carriers */}
                      <div>
                        <h4 className="text-sm font-bold text-slate-900 flex items-center mb-3"><Activity className="w-4 h-4 mr-1 text-slate-400"/> Live Carrier Fetching</h4>
                        <p className="text-xs text-slate-500 mb-4">Toggle which connected carriers should fetch live rates at checkout for this zone.</p>
                        
                        <div className="space-y-3">
                          {providers.length === 0 && <p className="text-xs text-rose-500 italic">No global carriers connected.</p>}
                          {providers.map(p => {
                            const isAssigned = z.providers?.some((zp:any) => zp.provider_id === p.id);
                            return (
                              <div key={p.id} className={`flex justify-between items-center p-3 rounded-xl border ${isAssigned ? 'bg-indigo-50 border-indigo-200' : 'bg-slate-50 border-slate-200'} transition-colors`}>
                                <div className="flex items-center space-x-3">
                                  <Truck className={`w-5 h-5 ${isAssigned ? 'text-indigo-600' : 'text-slate-400'}`} />
                                  <span className={`text-sm font-bold uppercase tracking-wide ${isAssigned ? 'text-indigo-900' : 'text-slate-500'}`}>{p.provider_name}</span>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                  <input type="checkbox" className="sr-only peer" checked={isAssigned} onChange={() => handleToggleZoneProvider(z.id, p.id, isAssigned)} />
                                  <div className="w-9 h-5 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-indigo-600"></div>
                                </label>
                              </div>
                            )
                          })}
                        </div>
                      </div>

                    </div>
                  )}
                </div>
              );
            })}
            
            {zones.length === 0 && !isAddingZone && (
              <div className="text-center py-12 bg-slate-50 rounded-2xl border border-slate-200 border-dashed">
                <MapPin className="w-8 h-8 text-slate-300 mx-auto mb-3" />
                <p className="text-slate-500 font-medium">No zones configured. Add a zone to start routing shipments.</p>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* SECTION 3: SIMULATOR */}
      <section className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-sm">
        <div className="p-6 border-b border-slate-100 bg-slate-900 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <PlayCircle className="w-6 h-6 text-indigo-400" />
            <h2 className="text-xl font-bold text-white">Crosschecker Simulator</h2>
          </div>
        </div>
        <div className="p-8 grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="space-y-6">
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200">
              <h3 className="font-bold text-slate-900 mb-4 flex items-center">
                <Package className="w-4 h-4 mr-2 text-indigo-500"/> 1. Build Test Cart
              </h3>
              <div className="flex space-x-2 mb-4">
                <select className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500" value={simSelectedVariant} onChange={e=>setSimSelectedVariant(e.target.value)}>
                  <option value="">Select a Product Variant...</option>
                  {products.map(p => 
                    p.variants?.map((v:any) => (
                      <option key={v.id} value={v.id}>{p.title} - {v.title}</option>
                    ))
                  )}
                </select>
                <input type="number" min="1" value={simQty} onChange={e=>setSimQty(parseInt(e.target.value))} className="w-20 bg-white border border-slate-200 rounded-xl px-3 py-2 text-sm text-center focus:ring-2 focus:ring-indigo-500" />
                <button onClick={() => {
                  if(!simSelectedVariant) return;
                  const pName = products.find(p=>p.variants?.find((v:any)=>v.id===parseInt(simSelectedVariant)))?.title || 'Item';
                  setSimCart([...simCart, { variant_id: parseInt(simSelectedVariant), quantity: simQty, name: pName }]);
                }} className="bg-indigo-100 text-indigo-700 px-4 py-2 rounded-xl text-sm font-bold hover:bg-indigo-200">Add</button>
              </div>
              {simCart.length > 0 && (
                <ul className="space-y-2">
                  {simCart.map((item, idx) => (
                    <li key={idx} className="flex justify-between items-center text-sm bg-white p-3 rounded-lg border border-slate-100 shadow-sm">
                      <span className="font-medium">{item.quantity}x {item.name}</span>
                      <button onClick={()=>setSimCart(simCart.filter((_,i)=>i!==idx))} className="text-rose-500 hover:text-rose-700"><Trash2 className="w-4 h-4"/></button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            
            <div className="bg-slate-50 p-6 rounded-2xl border border-slate-200 space-y-4">
              <h3 className="font-bold text-slate-900 flex items-center">
                <MapPin className="w-4 h-4 mr-2 text-indigo-500"/> 2. Destination
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">Country Code</label>
                  <input type="text" value={simCountry} onChange={e=>setSimCountry(e.target.value.toUpperCase())} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-mono" placeholder="IN, US, UK" />
                </div>
                <div>
                  <label className="text-xs font-bold text-slate-500 uppercase">State Code</label>
                  <input type="text" value={simState} onChange={e=>setSimState(e.target.value.toUpperCase())} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-mono" placeholder="MH, CA" />
                </div>
                <div className="col-span-2">
                  <label className="text-xs font-bold text-slate-500 uppercase">Pincode / Zip</label>
                  <input type="text" value={simPincode} onChange={e=>setSimPincode(e.target.value)} className="w-full mt-1 bg-white border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-indigo-500 font-mono" placeholder="110001" />
                </div>
              </div>
            </div>

            <button onClick={handleRunSimulator} disabled={isSimulating} className="w-full bg-indigo-600 text-white py-4 rounded-xl font-bold flex justify-center items-center hover:bg-indigo-700 disabled:opacity-50 transition-colors shadow-lg shadow-indigo-600/20 active:scale-95">
              {isSimulating ? <Loader2 className="w-5 h-5 animate-spin mr-2"/> : <PlayCircle className="w-5 h-5 mr-2"/>}
              Run Simulation Engine
            </button>
          </div>

          <div>
            {simResults ? (
              <div className="bg-white h-full animate-in fade-in slide-in-from-bottom-4">
                <h3 className="font-bold text-slate-900 mb-6 flex items-center"><Activity className="w-5 h-5 text-emerald-500 mr-2"/> Output Matrix</h3>
                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Cart Total</p>
                    <p className="text-xl font-black text-slate-900">₹{simResults.cart_total}</p>
                  </div>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1">Total Weight</p>
                    <p className="text-xl font-black text-slate-900">{simResults.box_dimensions?.weight} kg</p>
                  </div>
                </div>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 mb-6 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-bold text-slate-500 uppercase mb-1 flex items-center">3D Bin Dimensions</p>
                    <p className="text-sm font-mono text-slate-800">{simResults.box_dimensions?.length}x{simResults.box_dimensions?.width}x{simResults.box_dimensions?.height} cm</p>
                  </div>
                  <Package className="w-8 h-8 text-slate-300"/>
                </div>

                <h4 className="font-bold text-slate-900 mb-3 text-sm">Available Delivery Methods</h4>
                {simResults.rates && simResults.rates.length > 0 ? (
                  <div className="space-y-3">
                    {simResults.rates.map((r:any) => (
                      <div key={r.id} className="flex justify-between items-center p-4 bg-white border-2 border-indigo-50 hover:border-indigo-100 rounded-xl shadow-sm transition-colors">
                        <div>
                          <p className="font-bold text-slate-900 text-sm flex items-center">
                            {r.name}
                            {r.rate === 0 && <span className="ml-2 text-[10px] bg-pink-100 text-pink-700 px-1.5 py-0.5 rounded-md uppercase font-black tracking-wider">Free Promo</span>}
                          </p>
                          <p className="text-xs font-medium text-slate-500 mt-0.5">{r.estimated_delivery}</p>
                        </div>
                        <div className="text-right">
                          <p className={`font-black text-lg ${r.rate === 0 ? 'text-pink-600' : 'text-indigo-700'}`}>
                            {r.rate === 0 ? 'FREE' : `₹${r.rate}`}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-6 bg-rose-50 border border-rose-100 rounded-xl text-center">
                    <p className="text-rose-600 font-bold text-sm">No routes available</p>
                    <p className="text-rose-500 text-xs mt-1">Try checking your Zones or enable a default rate.</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-slate-50 border border-slate-200 border-dashed rounded-3xl h-full flex items-center justify-center p-8">
                <p className="text-slate-400 text-sm text-center font-medium max-w-[200px]">Configure your cart and destination to preview live rates.</p>
              </div>
            )}
          </div>
        </div>
      </section>

    </div>
  );
};

export default ShippingModule;
