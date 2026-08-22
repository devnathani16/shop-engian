import React, { useState } from 'react';
import { X, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import axios from 'axios';

interface AbandonedCartRecoveryModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopId: string;
  cart: any;
  currency: string;
  onSuccess: () => void;
}

const templates = [
  {
    id: 'minimalist',
    name: 'Minimalist',
    description: 'A clean, modern reminder about their cart.',
    preview: 'Hi {name},\nWe noticed you left some great items in your cart. They are still waiting for you, but they might sell out soon!'
  },
  {
    id: 'fomo',
    name: 'Urgency / FOMO',
    description: 'High contrast reminder that items might expire.',
    preview: '⏳ Don\'t Miss Out!\nThe items in your cart are in high demand and we can\'t guarantee they will stay in stock much longer.'
  },
  {
    id: 'discount',
    name: '10% Discount Offer',
    description: 'Offers a 10% discount code (COMEBACK10).',
    preview: 'Let\'s make it a deal, {name}.\nWe\'d love to see you complete your order. Use the code COMEBACK10 at checkout to get 10% OFF.'
  }
];

const AbandonedCartRecoveryModal: React.FC<AbandonedCartRecoveryModalProps> = ({ isOpen, onClose, shopId, cart, currency, onSuccess }) => {
  const [selectedTemplate, setSelectedTemplate] = useState('minimalist');
  const [isSending, setIsSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  if (!isOpen || !cart) return null;

  const handleSend = async () => {
    setIsSending(true);
    setError(null);
    try {
      const token = localStorage.getItem('token');
      await axios.post(`http://localhost:8080/api/shops/${shopId}/abandoned-carts/${cart.id}/recover`, {
        template_id: selectedTemplate
      }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        onSuccess();
        onClose();
      }, 2000);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to send recovery email');
    } finally {
      setIsSending(false);
    }
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(value);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Recover Abandoned Cart</h2>
            <p className="text-sm text-slate-500">Sending to <span className="font-semibold text-slate-700">{cart.customer_email}</span></p>
          </div>
          <button onClick={onClose} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto flex-1">
          <div className="mb-6 bg-amber-50 border border-amber-100 rounded-xl p-4 flex items-start">
            <AlertCircle className="w-5 h-5 text-amber-500 mr-3 shrink-0 mt-0.5" />
            <div>
              <h4 className="text-sm font-bold text-amber-800">Cart Value: {formatCurrency(cart.value)}</h4>
              <p className="text-xs text-amber-700 mt-1">This customer abandoned their cart. Send a beautifully formatted recovery email to bring them back.</p>
            </div>
          </div>

          <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4">Select Template</h3>
          <div className="space-y-4">
            {templates.map(t => (
              <label 
                key={t.id} 
                className={`flex items-start p-4 rounded-xl border-2 cursor-pointer transition-all ${selectedTemplate === t.id ? 'border-primary bg-primary/5' : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'}`}
              >
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{t.name}</span>
                    <input 
                      type="radio" 
                      name="template" 
                      value={t.id} 
                      checked={selectedTemplate === t.id} 
                      onChange={() => setSelectedTemplate(t.id)}
                      className="w-4 h-4 text-primary focus:ring-primary border-slate-300"
                    />
                  </div>
                  <p className="text-sm text-slate-500 mb-3">{t.description}</p>
                  <div className="bg-white p-3 rounded-lg border border-slate-200 text-xs text-slate-600 whitespace-pre-wrap font-mono leading-relaxed">
                    {t.preview}
                  </div>
                </div>
              </label>
            ))}
          </div>

          {error && (
            <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg border border-red-100">
              {error}
            </div>
          )}
          {success && (
            <div className="mt-4 p-3 bg-green-50 text-green-700 text-sm rounded-lg border border-green-100 flex items-center">
              <CheckCircle2 className="w-5 h-5 mr-2" />
              Email queued for delivery successfully!
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50 flex justify-end space-x-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-200 bg-slate-100 rounded-lg transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSend}
            disabled={isSending || success}
            className="flex items-center px-6 py-2 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSending ? (
              <span className="flex items-center">Sending...</span>
            ) : success ? (
              <span className="flex items-center"><CheckCircle2 className="w-4 h-4 mr-2" /> Sent</span>
            ) : (
              <span className="flex items-center"><Send className="w-4 h-4 mr-2" /> Send Email</span>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AbandonedCartRecoveryModal;
