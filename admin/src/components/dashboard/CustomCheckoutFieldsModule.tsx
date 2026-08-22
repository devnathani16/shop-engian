import { useState, useEffect } from 'react';
import { Plus, Trash2, Save, Loader2, Link as LinkIcon } from 'lucide-react';
import axios from 'axios';

export default function CustomCheckoutFieldsModule({ id }: { id: string }) {
  const [customFields, setCustomFields] = useState<any[]>([]);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    fetchShop();
  }, [id]);

  const fetchShop = async () => {
    try {
      const res = await axios.get('http://localhost:8080/api/shops', { withCredentials: true });
      const currentShop = res.data.shops.find((s: any) => s.id === id);
      if (currentShop && currentShop.custom_checkout_fields) {
        try {
          setCustomFields(JSON.parse(currentShop.custom_checkout_fields));
        } catch (e) {
          setCustomFields([]);
        }
      }
    } catch (err) {
      console.error('Failed to load shop details', err);
    } finally {
      setIsLoading(false);
    }
  };

  const addField = () => {
    setCustomFields([...customFields, { name: '', required: false }]);
  };

  const removeField = (index: number) => {
    const newFields = [...customFields];
    newFields.splice(index, 1);
    setCustomFields(newFields);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const payload = {
        custom_checkout_fields: JSON.stringify(customFields.filter(f => f.name.trim() !== ''))
      };

      const token = localStorage.getItem('token');
      await axios.put(`http://localhost:8080/api/shops/${id}`, payload, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      alert('Custom fields saved successfully!');
    } catch (err) {
      console.error(err);
      alert('Error saving custom fields');
    }
    setIsSaving(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-indigo-600 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <h2 className="text-2xl font-bold text-zinc-900 mb-2">Custom Checkout Fields</h2>
        <p className="text-zinc-500">Collect additional information during checkout by adding custom fields to the order form.</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-zinc-100 overflow-hidden">
        <div className="p-6 border-b border-zinc-100 bg-zinc-50/50 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-100 text-emerald-600 rounded-lg">
              <LinkIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-zinc-900">Fields Configuration</h3>
            </div>
          </div>
          <button 
            onClick={addField}
            className="flex items-center space-x-2 text-sm font-medium text-zinc-900 bg-white border border-zinc-200 px-4 py-2 rounded-lg hover:bg-zinc-50 transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span>Add Field</span>
          </button>
        </div>
        <div className="p-6">
          {customFields.length === 0 ? (
            <div className="text-center py-8 text-zinc-500 bg-zinc-50/50 rounded-xl border border-dashed border-zinc-200">
              No custom fields configured. Click "Add Field" to create one.
            </div>
          ) : (
            <div className="space-y-4">
              {customFields.map((field, idx) => (
                <div key={idx} className="flex items-center space-x-4 bg-zinc-50 p-4 rounded-xl border border-zinc-200 transition-all hover:border-zinc-300">
                  <div className="flex-1">
                    <label className="block text-xs font-medium text-zinc-500 mb-1">Field Name (e.g. GST Number, Gift Message)</label>
                    <input
                      type="text"
                      value={field.name}
                      onChange={(e) => {
                        const newFields = [...customFields];
                        newFields[idx].name = e.target.value;
                        setCustomFields(newFields);
                      }}
                      className="w-full px-3 py-2 bg-white border border-zinc-300 rounded-lg focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                      placeholder="Field Name"
                    />
                  </div>
                  <div className="flex items-center space-x-2 mt-5">
                    <input
                      type="checkbox"
                      id={`req-${idx}`}
                      checked={field.required}
                      onChange={(e) => {
                        const newFields = [...customFields];
                        newFields[idx].required = e.target.checked;
                        setCustomFields(newFields);
                      }}
                      className="w-4 h-4 text-emerald-600 rounded border-zinc-300 focus:ring-emerald-600"
                    />
                    <label htmlFor={`req-${idx}`} className="text-sm font-medium text-zinc-700 cursor-pointer">Required</label>
                  </div>
                  <button 
                    onClick={() => removeField(idx)}
                    className="mt-5 p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                    title="Remove Field"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <button
          onClick={handleSave}
          disabled={isSaving}
          className="flex items-center px-6 py-3 bg-emerald-600 text-white font-medium rounded-xl hover:bg-emerald-700 transition-colors disabled:opacity-50 shadow-sm shadow-emerald-600/20"
        >
          {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
          Save Fields
        </button>
      </div>
    </div>
  );
}
