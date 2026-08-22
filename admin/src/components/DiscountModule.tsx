import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Plus, Tag, Trash2, CheckCircle, XCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import axios from 'axios';

interface DiscountCode {
  id: number;
  code: string;
  type: string;
  value: number;
  min_purchase_amount: number;
  usage_limit: number | null;
  uses: number;
  is_active: boolean;
  valid_from: string | null;
  valid_until: string | null;
}

const DiscountModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  
  const [discounts, setDiscounts] = useState<DiscountCode[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    code: '',
    type: 'percentage',
    value: '',
    min_purchase_amount: '',
    usage_limit: '',
    is_active: true
  });

  const fetchDiscounts = async () => {
    try {
      const res = await axios.get(`http://localhost:8080/api/shops/${id}/discounts`, {
        withCredentials: true,
      });
      setDiscounts(res.data.discounts || []);
    } catch (e) {
      toast.error('Failed to load discounts');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDiscounts();
  }, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        code: formData.code,
        type: formData.type,
        value: parseFloat(formData.value) || 0,
        min_purchase_amount: parseFloat(formData.min_purchase_amount) || 0,
        usage_limit: formData.usage_limit ? parseInt(formData.usage_limit) : null,
        is_active: formData.is_active
      };

      await axios.post(`http://localhost:8080/api/shops/${id}/discounts`, payload, {
        withCredentials: true,
      });
      
      toast.success('Discount created');
      setIsModalOpen(false);
      setFormData({
        code: '', type: 'percentage', value: '', min_purchase_amount: '', usage_limit: '', is_active: true
      });
      fetchDiscounts();
    } catch (e: any) {
      toast.error(e.response?.data?.error || 'Failed to create discount');
    }
  };

  const handleDelete = async (discountId: number) => {
    if (!confirm('Delete this discount code?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/discounts/${discountId}`, {
        withCredentials: true,
      });
      toast.success('Discount deleted');
      fetchDiscounts();
    } catch (e) {
      toast.error('Failed to delete');
    }
  };

  const toggleActive = async (discount: DiscountCode) => {
    try {
      await axios.put(`http://localhost:8080/api/shops/${id}/discounts/${discount.id}`, 
        { is_active: !discount.is_active }, 
        { withCredentials: true }
      );
      toast.success('Discount updated');
      fetchDiscounts();
    } catch (e) {
      toast.error('Failed to update discount');
    }
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-200">
      <div className="p-6 border-b border-slate-200 flex justify-between items-center bg-slate-50/50 rounded-t-2xl">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Discount Codes</h2>
          <p className="text-sm text-slate-500 mt-1">Manage promotions and coupons for your store.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="bg-primary text-white px-5 py-2.5 rounded-xl font-medium shadow-sm hover:bg-blue-700 transition-colors flex items-center"
        >
          <Plus className="w-5 h-5 mr-2" />
          Create Discount
        </button>
      </div>

      <div className="p-0">
        {isLoading ? (
          <div className="p-12 text-center text-slate-500">Loading discounts...</div>
        ) : discounts.length === 0 ? (
          <div className="p-16 text-center">
            <div className="w-16 h-16 bg-blue-50 text-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Tag className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-900 mb-2">No discounts yet</h3>
            <p className="text-slate-500 max-w-sm mx-auto mb-6">Offer your customers percentage or fixed amount discounts to boost sales.</p>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="text-primary font-medium hover:text-blue-700"
            >
              Create your first discount code →
            </button>
          </div>
        ) : (
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-slate-200">
              <tr>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Code</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type / Value</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Uses</th>
                <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {discounts.map(d => (
                <tr key={d.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-bold text-slate-900 bg-slate-100 inline-block px-2 py-1 rounded border border-slate-200">{d.code}</div>
                    {d.min_purchase_amount > 0 && <div className="text-xs text-slate-500 mt-1">Min purchase: {d.min_purchase_amount}</div>}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="capitalize text-slate-700 font-medium">
                      {d.type.replace('_', ' ')}
                    </span>
                    <div className="text-sm text-slate-500">
                      {d.type === 'percentage' ? `${d.value}% OFF` : d.type === 'flat' ? `Amount: ${d.value}` : ''}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                    {d.uses} {d.usage_limit ? `/ ${d.usage_limit}` : ''}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <button onClick={() => toggleActive(d)} className="flex items-center text-sm font-medium focus:outline-none">
                      {d.is_active ? (
                        <span className="flex items-center text-green-600 bg-green-50 px-2.5 py-1 rounded-full border border-green-100"><CheckCircle className="w-4 h-4 mr-1"/> Active</span>
                      ) : (
                        <span className="flex items-center text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full"><XCircle className="w-4 h-4 mr-1"/> Inactive</span>
                      )}
                    </button>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <button onClick={() => handleDelete(d.id)} className="text-slate-400 hover:text-red-600 transition-colors">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900">Create Discount Code</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600"><XCircle className="w-6 h-6"/></button>
            </div>
            
            <form onSubmit={handleCreate} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-1">Discount Code</label>
                <input 
                  type="text" 
                  value={formData.code} 
                  onChange={(e) => setFormData({...formData, code: e.target.value.toUpperCase()})}
                  placeholder="e.g. SUMMER20"
                  className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none uppercase font-bold"
                  required 
                />
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Type</label>
                  <select 
                    value={formData.type}
                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="flat">Fixed Amount</option>
                    <option value="free_shipping">Free Shipping</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Discount Value</label>
                  <input 
                    type="number" 
                    step="0.01"
                    min="0"
                    value={formData.value}
                    onChange={(e) => setFormData({...formData, value: e.target.value})}
                    placeholder={formData.type === 'percentage' ? "20" : "50.00"}
                    disabled={formData.type === 'free_shipping'}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none disabled:opacity-50"
                    required={formData.type !== 'free_shipping'}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Minimum Purchase (Optional)</label>
                  <input 
                    type="number" 
                    min="0"
                    value={formData.min_purchase_amount}
                    onChange={(e) => setFormData({...formData, min_purchase_amount: e.target.value})}
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-1">Usage Limit (Optional)</label>
                  <input 
                    type="number" 
                    min="1"
                    value={formData.usage_limit}
                    onChange={(e) => setFormData({...formData, usage_limit: e.target.value})}
                    placeholder="Unlimited"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none"
                  />
                </div>
              </div>

              <div className="flex justify-end pt-4 space-x-3">
                <button type="button" onClick={() => setIsModalOpen(false)} className="px-5 py-2.5 text-slate-600 font-medium hover:bg-slate-100 rounded-xl">Cancel</button>
                <button type="submit" className="px-5 py-2.5 bg-primary text-white font-medium rounded-xl shadow-sm hover:bg-blue-700">Save Discount</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default DiscountModule;
