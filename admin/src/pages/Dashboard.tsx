import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { Plus, Store, ExternalLink, Loader2, LogOut, UserCircle, X, Settings, Globe } from 'lucide-react';
import toast from 'react-hot-toast';
import { Link } from 'react-router-dom';

interface Shop {
  id: string;
  name: string;
  subdomain: string;
  db_name: string;
  created_at: string;
}

const Dashboard: React.FC = () => {
  const { user, logout } = useAuth();
  const [shops, setShops] = useState<Shop[]>([]);
  const [isLoadingShops, setIsLoadingShops] = useState(true);

  const [invites, setInvites] = useState<any[]>([]);

  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newShopName, setNewShopName] = useState('');
  const [newShopSubdomain, setNewShopSubdomain] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  useEffect(() => {
    fetchShops();
    fetchInvites();
  }, []);

  const fetchInvites = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/user/invites');
      setInvites(response.data.invites || []);
    } catch (error) {
      console.error('Failed to fetch invites', error);
    }
  };

  const handleAcceptInvite = async (inviteId: number) => {
    try {
      await axios.post(`http://localhost:8080/api/user/invites/${inviteId}/accept`);
      toast.success('Successfully joined the shop!');
      fetchInvites();
      fetchShops();
    } catch (error) {
      toast.error('Failed to accept invite');
    }
  };

  const handleRejectInvite = async (inviteId: number) => {
    try {
      await axios.post(`http://localhost:8080/api/user/invites/${inviteId}/reject`);
      toast.success('Invite rejected');
      fetchInvites();
    } catch (error) {
      toast.error('Failed to reject invite');
    }
  };


  const fetchShops = async () => {
    try {
      const response = await axios.get('http://localhost:8080/api/shops');
      setShops(response.data.shops || []);
    } catch (error) {
      toast.error('Failed to load your stores.');
    } finally {
      setIsLoadingShops(false);
    }
  };

  const handleCreateShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newShopName || !newShopSubdomain) return;
    
    setIsCreating(true);
    try {
      const response = await axios.post('http://localhost:8080/api/shops', {
        name: newShopName,
        subdomain: newShopSubdomain.toLowerCase().replace(/[^a-z0-9-]/g, '') // Sanitize
      });
      
      toast.success('Store created successfully! Database provisioned.');
      setShops([...shops, response.data.shop]);
      setIsModalOpen(false);
      setNewShopName('');
      setNewShopSubdomain('');
    } catch (error: any) {
      toast.error(error.response?.data?.error || 'Failed to create store.');
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-50/40 via-slate-50 to-slate-100 flex flex-col">
      {/* Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 max-w-7xl mx-auto w-full bg-white/60 backdrop-blur-lg border-b border-white/40 shadow-[0_4px_30px_rgba(0,0,0,0.03)] sticky top-0 z-40 rounded-b-3xl mb-8">
        <Link to="/" className="flex items-center space-x-2">
          <div className="w-8 h-8 bg-primary rounded-xl flex items-center justify-center text-white font-bold">
            e
          </div>
          <span className="text-2xl font-bold tracking-tight text-slate-900">eaas</span>
        </Link>
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <UserCircle className="w-8 h-8 text-primary" />
            <span className="text-sm font-medium text-slate-900 hidden sm:block">{user?.email}</span>
            <button onClick={logout} className="ml-2 text-slate-400 hover:text-red-500 transition-colors" title="Log out">
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </nav>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl mx-auto w-full px-8 py-12">
        
        {/* Global Navigation */}
        <div className="flex items-center space-x-4 mb-8 pb-4 border-b border-slate-200">
          <button className="px-4 py-2 font-semibold text-primary border-b-2 border-primary">
            My Stores
          </button>
          <Link to="/domains" className="px-4 py-2 font-medium text-slate-500 hover:text-slate-800 transition-colors flex items-center">
            <Globe className="w-4 h-4 mr-2" />
            My Domains
          </Link>
        </div>

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-slate-900">Your Stores</h1>
            <p className="text-slate-500 mt-1">Manage your merchant storefronts</p>
          </div>
          <button 
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-2 bg-primary text-white px-5 py-2.5 rounded-full hover:bg-blue-700 transition-all shadow-sm hover:shadow-md"
          >
            <Plus className="w-5 h-5" />
            <span className="font-medium">Create New Store</span>
          </button>
        </div>

        {isLoadingShops ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 text-primary animate-spin" />
          </div>
        ) : shops.length === 0 ? (
          <div className="bg-white/70 backdrop-blur-xl rounded-3xl p-12 text-center border border-white/80 shadow-[0_8px_30px_rgba(0,0,0,0.04)]">
            <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-6">
              <Store className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900 mb-2">No stores yet</h3>
            <p className="text-slate-500 max-w-md mx-auto mb-8">
              You haven't created any stores yet. Create your first store to instantly provision an isolated database and launch your storefront.
            </p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-slate-900 text-white px-6 py-3 rounded-full font-medium hover:bg-slate-800 transition-colors"
            >
              Create your first store
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {shops.map(shop => (
              <div key={shop.id} className="bg-white/70 backdrop-blur-xl rounded-3xl p-6 border border-white/80 shadow-[0_4px_20px_rgba(0,0,0,0.03)] hover:shadow-[0_12px_40px_rgba(0,0,0,0.08)] hover:-translate-y-1 transition-all duration-300 group flex flex-col h-full relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-bl-[100px] -z-10 transition-transform group-hover:scale-110"></div>
                
                <div className="flex items-start justify-between mb-5">
                  <div className="w-14 h-14 bg-primary/10 text-primary rounded-2xl flex items-center justify-center">
                    <Store className="w-7 h-7" />
                  </div>
                  <Link 
                    to={`/shop/${shop.id}/dashboard`}
                    className="text-slate-400 hover:text-primary transition-colors p-2 bg-slate-50 hover:bg-primary/5 rounded-xl border border-slate-100"
                    title="Manage Store Settings"
                  >
                    <Settings className="w-5 h-5" />
                  </Link>
                </div>
                
                <h3 className="text-xl font-extrabold text-slate-900 mb-2">{shop.name}</h3>
                
                <a 
                  href={`http://${shop.subdomain}.localhost:5174`}
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center text-sm font-medium text-slate-500 hover:text-primary transition-colors mb-8 group/link w-fit"
                >
                  <Globe className="w-4 h-4 mr-2 opacity-70 group-hover/link:opacity-100" />
                  {shop.subdomain}.localhost:5174
                  <ExternalLink className="w-3 h-3 ml-1.5 opacity-0 group-hover/link:opacity-100 -translate-x-2 group-hover/link:translate-x-0 transition-all" />
                </a>
                
                <div className="mt-auto pt-4 border-t border-slate-100">
                  <Link 
                    to={`/shop/${shop.id}/dashboard`}
                    className="w-full flex items-center justify-center py-3 bg-slate-900 text-white hover:bg-primary rounded-xl font-medium transition-colors text-sm shadow-sm hover:shadow"
                  >
                    Manage Store Dashboard
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Create Shop Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-md p-8 shadow-2xl relative">
            <button 
              onClick={() => setIsModalOpen(false)}
              className="absolute top-6 right-6 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
            
            <h2 className="text-2xl font-bold text-slate-900 mb-6">Create New Store</h2>
            
            <form onSubmit={handleCreateShop}>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Store Name</label>
                  <input
                    type="text"
                    required
                    value={newShopName}
                    onChange={(e) => setNewShopName(e.target.value)}
                    placeholder="e.g. My Awesome Store"
                    className="w-full px-4 py-3 rounded-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">Subdomain</label>
                  <div className="flex items-center">
                    <input
                      type="text"
                      required
                      value={newShopSubdomain}
                      onChange={(e) => setNewShopSubdomain(e.target.value)}
                      placeholder="awesome-store"
                      className="w-full px-4 py-3 rounded-l-xl border border-slate-200 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-right"
                    />
                    <div className="px-4 py-3 bg-slate-50 border border-l-0 border-slate-200 rounded-r-xl text-slate-500 font-medium">
                      .yourdomain.com
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">Only letters, numbers, and hyphens are allowed.</p>
                </div>
              </div>
              
              <button
                type="submit"
                disabled={isCreating}
                className="w-full bg-primary text-white py-3 rounded-xl font-medium hover:bg-blue-700 transition-colors mt-8 flex items-center justify-center disabled:opacity-70"
              >
                {isCreating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    Provisioning Database...
                  </>
                ) : (
                  'Create Store'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
