import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Globe, Search, Loader2, ArrowLeft, X, Server, Check, ShoppingCart } from 'lucide-react';
import { Link } from 'react-router-dom';
import toast from 'react-hot-toast';

interface RegisteredDomain {
  id: number;
  domain_name: string;
  status: string;
  expiry_date: string;
  auto_renew: boolean;
}

interface DomainResult {
  domain: string;
  available: boolean;
  price: number;
  premium: boolean;
}

interface DNSRecord {
  type: string;
  name: string;
  value: string;
  ttl?: number;
}

const DomainDashboard: React.FC = () => {
  const { user } = useAuth();
  const [searchQuery, setSearchQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<DomainResult[]>([]);
  const [brandName, setBrandName] = useState('');

  const [myDomains, setMyDomains] = useState<RegisteredDomain[]>([]);
  const [isLoadingDomains, setIsLoadingDomains] = useState(true);

  // Purchase state
  const [purchasingDomain, setPurchasingDomain] = useState<string | null>(null);

  // DNS Modal State
  const [activeDnsDomain, setActiveDnsDomain] = useState<string | null>(null);
  const [dnsRecords, setDnsRecords] = useState<DNSRecord[]>([]);
  const [isLoadingDns, setIsLoadingDns] = useState(false);

  // New DNS Record Form
  const [newDnsType, setNewDnsType] = useState('A');
  const [newDnsName, setNewDnsName] = useState('@');
  const [newDnsValue, setNewDnsValue] = useState('');
  const [isAddingDns, setIsAddingDns] = useState(false);

  useEffect(() => {
    fetchMyDomains();
  }, []);

  const fetchMyDomains = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/domains', { withCredentials: true });
      setMyDomains(res.data.domains || []);
    } catch (err) {
      console.error("Failed to fetch domains", err);
    } finally {
      setIsLoadingDomains(false);
    }
  };

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsSearching(true);
    setSearchResults([]);
    setBrandName('');
    try {
      const res = await axios.post('http://localhost:8080/api/domains/search', { domain: searchQuery }, { withCredentials: true });
      setSearchResults(res.data.results || []);
      setBrandName(res.data.brand || '');
    } catch (err: any) {
      console.error(err);
      toast.error(err.response?.data?.error || "Failed to search domain");
    } finally {
      setIsSearching(false);
    }
  };

  const loadRazorpay = () => new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

  const handlePurchase = async (domain: string, price: number) => {
    setPurchasingDomain(domain);
    const toastId = toast.loading("Initiating secure checkout...");

    try {
      const isLoaded = await loadRazorpay();
      if (!isLoaded) {
        toast.error("Failed to load payment SDK", { id: toastId });
        setPurchasingDomain(null);
        return;
      }

      // 1. Initiate Order
      const initRes = await axios.post('http://localhost:8080/api/domains/purchase/initiate', {
        domain: domain
      }, { withCredentials: true });

      const { order_id, amount, currency } = initRes.data;
      toast.dismiss(toastId);

      // 2. Open Razorpay Checkout
      const options = {
        key: "rzp_test_TT2ASAKWRC3klD",
        amount: amount,
        currency: currency,
        name: "Shop Engine",
        description: `Domain Registration: ${domain}`,
        order_id: order_id,
        handler: async function (response: any) {
          const verifyToast = toast.loading("Registering domain...");
          try {
            await axios.post('http://localhost:8080/api/domains/purchase/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              domain: domain
            }, { withCredentials: true });

            toast.success("Domain registered successfully!", { id: verifyToast });
            setSearchResults([]);
            setSearchQuery('');
            fetchMyDomains();
          } catch (err: any) {
            toast.error(err.response?.data?.error || "Registration failed", { id: verifyToast });
          }
        },
        modal: {
          ondismiss: () => setPurchasingDomain(null)
        },
        prefill: { email: user?.email },
        theme: { color: "#4f46e5" }
      };

      const rzp = new (window as any).Razorpay(options);
      rzp.open();

    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to initiate purchase", { id: toastId });
    } finally {
      setPurchasingDomain(null);
    }
  };

  const openDnsManager = async (domain: string) => {
    setActiveDnsDomain(domain);
    setIsLoadingDns(true);
    setDnsRecords([]);
    try {
      const res = await axios.get(`http://localhost:8080/api/domains/${domain}/dns`, { withCredentials: true });
      setDnsRecords(res.data.records || []);
    } catch (err) {
      toast.error("Failed to load DNS records");
    } finally {
      setIsLoadingDns(false);
    }
  };

  const handleAddDnsRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDnsDomain || !newDnsValue) return;
    setIsAddingDns(true);
    try {
      await axios.post(`http://localhost:8080/api/domains/${activeDnsDomain}/dns`, {
        type: newDnsType, name: newDnsName, value: newDnsValue
      }, { withCredentials: true });
      toast.success("DNS record added!");
      setNewDnsValue('');
      openDnsManager(activeDnsDomain);
    } catch (err: any) {
      toast.error(err.response?.data?.error || "Failed to add DNS record");
    } finally {
      setIsAddingDns(false);
    }
  };

  const availableCount = searchResults.filter(r => r.available).length;

  return (
    <div className="min-h-screen bg-slate-50 font-sans text-slate-900">
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link to="/dashboard" className="p-2 -ml-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
              <ArrowLeft className="w-5 h-5" />
            </Link>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-100 text-indigo-600 flex items-center justify-center">
                <Globe className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold text-slate-900 tracking-tight">Domain Registry</h1>
            </div>
          </div>
          <div className="text-sm font-medium text-slate-600">{user?.email}</div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-8 relative">

        {/* Domain Search */}
        <section className="bg-white rounded-2xl border border-slate-200 p-8 shadow-sm text-center relative overflow-hidden">
          <h2 className="text-3xl font-extrabold mb-3">Find your perfect domain</h2>
          <p className="text-slate-500 mb-8 max-w-2xl mx-auto text-lg">Search across 20 TLDs. Register and connect to your store instantly.</p>

          <form onSubmit={handleSearch} className="max-w-3xl mx-auto flex items-center shadow-md rounded-2xl overflow-hidden border-2 border-slate-200 focus-within:border-indigo-500 transition-all bg-white">
            <div className="pl-6 pr-3 text-slate-400"><Search className="w-6 h-6" /></div>
            <input
              type="text"
              placeholder="Enter your brand name (e.g., myawesomebrand)"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1 py-5 px-2 outline-none text-xl font-medium text-slate-800 placeholder:font-normal placeholder:text-slate-400"
            />
            <button
              type="submit"
              disabled={isSearching || !searchQuery}
              className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold text-lg py-5 px-10 transition-colors flex items-center"
            >
              {isSearching ? <Loader2 className="w-6 h-6 animate-spin" /> : "Search"}
            </button>
          </form>
        </section>

        {/* Multi-TLD Search Results */}
        {searchResults.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-2xl font-bold text-slate-800">
                Results for <span className="text-indigo-600">"{brandName}"</span>
              </h2>
              <span className="text-sm font-semibold text-green-700 bg-green-100 px-3 py-1 rounded-full">
                {availableCount} available
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {searchResults.map((result) => (
                <div
                  key={result.domain}
                  className={`bg-white rounded-xl border-2 p-5 transition-all ${
                    result.available
                      ? 'border-green-200 hover:border-green-400 hover:shadow-md'
                      : 'border-slate-100 opacity-60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 text-base truncate pr-2">{result.domain}</h3>
                    {result.available ? (
                      <span className="flex-shrink-0 w-5 h-5 bg-green-500 rounded-full flex items-center justify-center">
                        <Check className="w-3 h-3 text-white" />
                      </span>
                    ) : (
                      <span className="flex-shrink-0 w-5 h-5 bg-slate-300 rounded-full flex items-center justify-center">
                        <X className="w-3 h-3 text-white" />
                      </span>
                    )}
                  </div>

                  <div className="flex items-center justify-between">
                    <div>
                      <span className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded ${
                        result.available ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-500'
                      }`}>
                        {result.available ? 'Available' : 'Taken'}
                      </span>
                      {result.premium && (
                        <span className="ml-2 text-xs font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded">Premium</span>
                      )}
                    </div>

                    {result.available && (
                      <span className="text-lg font-black text-slate-900">
                        ₹{result.price.toLocaleString('en-IN')}
                        <span className="text-xs font-normal text-slate-500">/yr</span>
                      </span>
                    )}
                  </div>

                  {result.available && (
                    <button
                      onClick={() => handlePurchase(result.domain, result.price)}
                      disabled={purchasingDomain === result.domain}
                      className="mt-4 w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 rounded-lg transition-all flex items-center justify-center text-sm"
                    >
                      {purchasingDomain === result.domain ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <><ShoppingCart className="w-4 h-4 mr-2" /> Buy Now</>
                      )}
                    </button>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Domains Portfolio */}
        <section>
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center text-slate-800">
              <Globe className="w-6 h-6 mr-3 text-indigo-600" />
              My Domain Portfolio
            </h2>
            <button onClick={fetchMyDomains} className="text-sm font-medium text-indigo-600 hover:text-indigo-800">Refresh</button>
          </div>

          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
            {isLoadingDomains ? (
              <div className="p-16 flex justify-center"><Loader2 className="w-8 h-8 animate-spin text-indigo-600" /></div>
            ) : myDomains.length === 0 ? (
              <div className="p-16 text-center text-slate-500">
                <div className="w-16 h-16 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-4">
                  <Globe className="w-8 h-8 text-slate-400" />
                </div>
                <h3 className="text-lg font-semibold text-slate-900 mb-1">No domains yet</h3>
                <p>Search for a domain above to start building your brand.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-slate-50 border-b border-slate-200 text-slate-600">
                    <tr>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Domain</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Status</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Auto-Renew</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs">Expiry</th>
                      <th className="px-6 py-4 font-semibold uppercase tracking-wider text-xs text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myDomains.map((d) => (
                      <tr key={d.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-6 py-5 font-bold text-slate-900 text-base">{d.domain_name}</td>
                        <td className="px-6 py-5">
                          <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-bold uppercase tracking-wider ${d.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                            {d.status}
                          </span>
                        </td>
                        <td className="px-6 py-5 text-slate-600 font-medium">{d.auto_renew ? 'Enabled' : 'Disabled'}</td>
                        <td className="px-6 py-5 text-slate-600 font-medium">
                          {new Date(d.expiry_date).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-5 text-right">
                          <button onClick={() => openDnsManager(d.domain_name)}
                            className="inline-flex items-center text-sm font-semibold text-indigo-700 hover:text-indigo-900 bg-indigo-50 hover:bg-indigo-100 px-4 py-2 rounded-lg transition-colors border border-indigo-100">
                            <Server className="w-4 h-4 mr-2" /> Manage DNS
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </section>

      </main>

      {/* DNS Management Modal */}
      {activeDnsDomain && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200 bg-slate-50/50">
              <div>
                <h3 className="text-xl font-bold text-slate-900">DNS Zone Manager</h3>
                <p className="text-sm text-slate-500 font-medium">{activeDnsDomain}</p>
              </div>
              <button onClick={() => setActiveDnsDomain(null)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-200 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 bg-slate-50">
              <div className="bg-white rounded-xl border border-slate-200 p-5 mb-6 shadow-sm">
                <h4 className="font-semibold text-slate-900 mb-4 text-sm uppercase tracking-wider">Add New Record</h4>
                <form onSubmit={handleAddDnsRecord} className="flex items-end gap-4">
                  <div className="w-32">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Type</label>
                    <select value={newDnsType} onChange={(e) => setNewDnsType(e.target.value)}
                      className="w-full p-2.5 border border-slate-300 rounded-lg text-sm bg-slate-50 focus:bg-white font-medium">
                      <option value="A">A</option>
                      <option value="CNAME">CNAME</option>
                      <option value="TXT">TXT</option>
                      <option value="MX">MX</option>
                    </select>
                  </div>
                  <div className="w-48">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Name</label>
                    <input type="text" value={newDnsName} onChange={(e) => setNewDnsName(e.target.value)}
                      placeholder="@ or www" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium" />
                  </div>
                  <div className="flex-1">
                    <label className="block text-xs font-semibold text-slate-600 mb-1">Value</label>
                    <input type="text" value={newDnsValue} onChange={(e) => setNewDnsValue(e.target.value)}
                      placeholder="e.g. 192.168.1.1" className="w-full p-2.5 border border-slate-300 rounded-lg text-sm font-medium" />
                  </div>
                  <button type="submit" disabled={isAddingDns || !newDnsValue}
                    className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-semibold py-2.5 px-6 rounded-lg text-sm transition-colors flex-shrink-0">
                    {isAddingDns ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Record"}
                  </button>
                </form>
              </div>

              <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                {isLoadingDns ? (
                  <div className="p-12 flex justify-center"><Loader2 className="w-6 h-6 animate-spin text-indigo-600" /></div>
                ) : dnsRecords.length === 0 ? (
                  <div className="p-8 text-center text-slate-500 text-sm font-medium">No custom DNS records found.</div>
                ) : (
                  <table className="w-full text-left text-sm">
                    <thead className="bg-slate-50 border-b border-slate-200 text-slate-500">
                      <tr>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Type</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Name</th>
                        <th className="px-5 py-3 font-semibold uppercase tracking-wider text-xs">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {dnsRecords.map((rec, i) => (
                        <tr key={i} className="hover:bg-slate-50/50">
                          <td className="px-5 py-3"><span className="font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">{rec.type}</span></td>
                          <td className="px-5 py-3 font-medium text-slate-900">{rec.name}</td>
                          <td className="px-5 py-3 text-slate-600 font-mono text-xs">{rec.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DomainDashboard;
