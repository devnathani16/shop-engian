import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Edit2, Loader2, Package, X, Image as ImageIcon, Wand2, Eraser } from 'lucide-react';



interface Category {
  id: number;
  name: string;
}

interface ProductOption {
  id?: number;
  name: string;
  values: string;
}

interface ProductVariant {
  id?: number;
  title: string;
  option1: string;
  option2: string;
  option3: string;
  option4: string;
  option5: string;
  sku: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  weight: number;
  image_url?: string;
}

interface Product {
  id: number;
  title: string;
  description: string;
  price: number;
  compare_at_price?: number;
  stock_quantity: number;
  weight: number;
  length: number;
  width: number;
  height: number;
  image_url: string;
  category_id: number | null;
  tax_category_id?: number | null;
  options?: ProductOption[];
  variants?: ProductVariant[];
}

const ProductManagerModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [currencySymbol, setCurrencySymbol] = useState('$');
  
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [compareAtPrice, setCompareAtPrice] = useState('');
  const [stock, setStock] = useState('0');
  const [weight, setWeight] = useState('0.5');
  const [length, setLength] = useState('10');
  const [width, setWidth] = useState('10');
  const [height, setHeight] = useState('10');
  const [imageUrl, setImageUrl] = useState('');
  const [categoryId, setCategoryId] = useState<string>('');
  const [taxCategoryId, setTaxCategoryId] = useState<string>('');
  const [taxCategories, setTaxCategories] = useState<{id: number, name: string}[]>([]);
  const [options, setOptions] = useState<ProductOption[]>([]);
  const [variants, setVariants] = useState<ProductVariant[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingProductId, setEditingProductId] = useState<number | null>(null);

  // AI Feature States
  const [isGeneratingDesc, setIsGeneratingDesc] = useState(false);
  const [showAiDescInput, setShowAiDescInput] = useState(false);
  const [aiKeywords, setAiKeywords] = useState('');
  const [isRemovingBg, setIsRemovingBg] = useState(false);

  const handleGenerateDescription = async () => {
    if (!title) {
      alert("Please enter a product title first.");
      return;
    }
    setIsGeneratingDesc(true);
    try {
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/ai/generate-description`, {
        title,
        keywords: aiKeywords
      }, { withCredentials: true });
      setDescription(res.data.description);
      setShowAiDescInput(false);
      setAiKeywords('');
    } catch (err) {
      console.error('Failed to generate description', err);
      alert('Failed to generate description');
    } finally {
      setIsGeneratingDesc(false);
    }
  };

  const handleRemoveBackground = async (file: File) => {
    setIsRemovingBg(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/ai/process-image`, formData, { withCredentials: true });
      setImageUrl(res.data.media.url);
    } catch (err) {
      console.error('Failed to remove background', err);
      alert('Failed to remove background');
    } finally {
      setIsRemovingBg(false);
    }
  };

  const [isMediaBrowserOpen, setIsMediaBrowserOpen] = useState(false);
  const [mediaItems, setMediaItems] = useState<any[]>([]);
  const [mediaCallback, setMediaCallback] = useState<((url: string) => void) | null>(null);

  const openMediaBrowser = async (callback: (url: string) => void) => {
    setMediaCallback(() => callback);
    setIsMediaBrowserOpen(true);
    try {
      const res = await axios.get(`http://localhost:8080/api/shops/${id}/media`, { withCredentials: true });
      setMediaItems(res.data.media || []);
    } catch (err) {
      console.error('Failed to fetch media', err);
    }
  };

  const fetchData = async () => {
    try {
      const [catRes, shopRes, prodRes, taxCatRes] = await Promise.all([
        axios.get(`http://localhost:8080/api/shops/${id}/categories`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops/${id}/products`, { withCredentials: true }),
        axios.get(`http://localhost:8080/api/shops/${id}/tax-categories`, { withCredentials: true })
      ]);
      setCategories(catRes.data.categories || []);
      setProducts(prodRes.data.products || []);
      setTaxCategories(taxCatRes.data || []);
      
      const shop = shopRes.data.shops?.find((s: any) => s.id === id);
      if (shop?.currency) {
        switch(shop.currency) {
          case 'EUR': setCurrencySymbol('€'); break;
          case 'GBP': setCurrencySymbol('£'); break;
          case 'JPY': setCurrencySymbol('¥'); break;
          case 'INR': setCurrencySymbol('₹'); break;
          default: setCurrencySymbol('$'); break;
        }
      }
    } catch (error) {
      console.error('Failed to fetch data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const payload = {
        title,
        description,
        price: parseFloat(price),
        compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : 0,
        stock_quantity: parseInt(stock, 10) || 0,
        weight: parseFloat(weight) || 0,
        length: parseFloat(length) || 0,
        width: parseFloat(width) || 0,
        height: parseFloat(height) || 0,
        image_url: imageUrl,
        category_id: categoryId ? parseInt(categoryId) : null,
        tax_category_id: taxCategoryId ? parseInt(taxCategoryId) : null,
        options,
        variants
      };
      
      if (editingProductId) {
        await axios.put(`http://localhost:8080/api/shops/${id}/products/${editingProductId}`, payload, { withCredentials: true });
      } else {
        await axios.post(`http://localhost:8080/api/shops/${id}/products`, payload, { withCredentials: true });
      }
      
      setTitle('');
      setDescription('');
      setPrice('');
      setCompareAtPrice('');
      setStock('0');
      setWeight('0.5');
      setLength('10');
      setWidth('10');
      setHeight('10');
      setImageUrl('');
      setCategoryId('');
      setTaxCategoryId('');
      setOptions([]);
      setVariants([]);
      setEditingProductId(null);
      setIsAdding(false);
      fetchData();
    } catch (error) {
      console.error('Failed to create product:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (productId: number) => {
    if (!window.confirm('Are you sure you want to delete this product?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/products/${productId}`, { withCredentials: true });
      fetchData();
    } catch (error) {
      console.error('Failed to delete product:', error);
    }
  };

  const handleEditClick = (product: Product) => {
    setEditingProductId(product.id);
    setTitle(product.title);
    setDescription(product.description || '');
    setPrice(product.price.toString());
    setCompareAtPrice(product.compare_at_price ? product.compare_at_price.toString() : '');
    setStock(product.stock_quantity.toString());
    setWeight(product.weight ? product.weight.toString() : '0');
    setLength(product.length ? product.length.toString() : '0');
    setWidth(product.width?.toString() || '0');
    setHeight(product.height?.toString() || '0');
    setImageUrl(product.image_url || '');
    setCategoryId(product.category_id?.toString() || '');
    setTaxCategoryId(product.tax_category_id?.toString() || '');
    setOptions(product.options || []);
    setVariants(product.variants || []);
    setIsAdding(true);
  };

  const openAddForm = () => {
    setTitle('');
    setDescription('');
    setPrice('');
    setCompareAtPrice('');
    setStock('0');
    setWeight('0.5');
    setLength('10');
    setWidth('10');
    setHeight('10');
    setImageUrl('');
    setCategoryId('');
    setTaxCategoryId('');
    setOptions([]);
    setVariants([]);
    setEditingProductId(null);
    setIsAdding(true);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-surface">
      <div className="max-w-6xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Products</h1>
            <p className="text-sm text-slate-500 mt-2">Manage your catalog, pricing, and inventory.</p>
          </div>
          <button 
            onClick={openAddForm}
            className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Add Product</span>
          </button>
        </div>

        {/* Backdrop */}
        {isAdding && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => setIsAdding(false)}
          />
        )}

        {/* Sliding Side Drawer Form */}
        <div className={`fixed inset-y-0 right-0 w-full max-w-3xl bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isAdding ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">{editingProductId ? 'Edit Product' : 'New Product'}</h2>
            <button onClick={() => setIsAdding(false)} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <form id="product-form" onSubmit={handleCreate} className="space-y-6">
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Product Title</label>
                <input 
                  type="text" required value={title} onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Premium Leather Jacket"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm"
                />
              </div>
              
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Description</label>
                  <button 
                    type="button" 
                    onClick={() => setShowAiDescInput(!showAiDescInput)}
                    className="flex items-center space-x-1 text-xs font-semibold text-violet-600 bg-violet-50 hover:bg-violet-100 px-3 py-1.5 rounded-lg transition-colors"
                  >
                    <Wand2 className="w-3.5 h-3.5" />
                    <span>Generate with AI</span>
                  </button>
                </div>
                
                {showAiDescInput && (
                  <div className="mb-3 p-4 bg-violet-50 border border-violet-100 rounded-xl flex items-start space-x-3">
                    <div className="flex-1">
                      <input 
                        type="text" 
                        value={aiKeywords} 
                        onChange={(e) => setAiKeywords(e.target.value)}
                        placeholder="Any specific keywords or tone? (e.g., waterproof, luxury, casual)"
                        className="w-full px-3 py-2 text-sm bg-white border border-violet-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-500 transition-all"
                      />
                    </div>
                    <button 
                      type="button"
                      disabled={isGeneratingDesc}
                      onClick={handleGenerateDescription}
                      className="px-4 py-2 bg-violet-600 text-white text-sm font-semibold rounded-lg hover:bg-violet-700 transition-colors shadow-sm disabled:opacity-50 flex items-center"
                    >
                      {isGeneratingDesc ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1.5" />}
                      Generate
                    </button>
                  </div>
                )}

                <textarea 
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  placeholder="Brief description of the product..."
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm resize-y"
                ></textarea>
              </div>

              <div className="grid grid-cols-4 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Price ($)</label>
                  <input 
                    type="number" step="0.01" required value={price} onChange={(e) => setPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Compare ($)</label>
                  <input 
                    type="number" step="0.01" value={compareAtPrice} onChange={(e) => setCompareAtPrice(e.target.value)}
                    placeholder="0.00"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm line-through text-slate-500"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Stock</label>
                  <input type="number" value={stock} onChange={e => setStock(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Weight (kg)</label>
                  <input type="number" step="0.1" value={weight} onChange={e => setWeight(e.target.value)} placeholder="0.5" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Length (cm)</label>
                  <input type="number" step="0.1" value={length} onChange={e => setLength(e.target.value)} placeholder="10" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Width (cm)</label>
                  <input type="number" step="0.1" value={width} onChange={e => setWidth(e.target.value)} placeholder="10" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all" />
                </div>
                <div className="space-y-1">
                  <label className="text-sm font-medium text-slate-700">Height (cm)</label>
                  <input type="number" step="0.1" value={height} onChange={e => setHeight(e.target.value)} placeholder="10" className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-sm focus:ring-2 focus:ring-slate-900 focus:border-slate-900 transition-all" />
                </div>
              </div>

              {/* Options Builder */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-semibold text-slate-700">Options (Up to 5)</label>
                  <button type="button" disabled={options.length >= 5} onClick={() => setOptions([...options, { name: '', values: '' }])} className="text-xs font-medium text-slate-900 bg-slate-100 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50">
                    + Add Option
                  </button>
                </div>
                
                {options.map((opt, i) => (
                  <div key={i} className="flex space-x-2 mb-3">
                    <input 
                      type="text" placeholder="e.g. Color" value={opt.name} 
                      onChange={e => { const no = [...options]; no[i].name = e.target.value; setOptions(no); }} 
                      className="w-1/3 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" 
                    />
                    <input 
                      type="text" placeholder="e.g. Red, Blue, Green (comma separated)" value={opt.values} 
                      onChange={e => { const no = [...options]; no[i].values = e.target.value; setOptions(no); }} 
                      className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20" 
                    />
                    <button type="button" onClick={() => setOptions(options.filter((_, idx) => idx !== i))} className="p-2 text-slate-400 hover:text-rose-500 rounded-lg">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}

                {options.length > 0 && (
                  <button 
                    type="button" 
                    onClick={() => {
                      const parsedOptions = options.map(o => ({
                        name: o.name,
                        values: o.values.split(',').map(v => v.trim()).filter(v => v)
                      })).filter(o => o.values.length > 0);

                      if (parsedOptions.length === 0) return;

                      const cartesian = (arrays: any[][]) => arrays.reduce((a, b) => a.flatMap(d => b.map(e => [d, e].flat())));
                      const valueArrays = parsedOptions.map(o => o.values);
                      const combinations = valueArrays.length === 1 ? valueArrays[0].map(v => [v]) : cartesian(valueArrays);

                      const newVariants = combinations.map(combo => ({
                        title: combo.join(' / '),
                        option1: combo[0] || '',
                        option2: combo[1] || '',
                        option3: combo[2] || '',
                        option4: combo[3] || '',
                        option5: combo[4] || '',
                        sku: '',
                        price: parseFloat(price) || 0,
                        compare_at_price: compareAtPrice ? parseFloat(compareAtPrice) : 0,
                        stock_quantity: 0,
                        weight: parseFloat(weight) || 0,
                        image_url: ''
                      }));
                      setVariants(newVariants);
                    }}
                    className="w-full mt-3 py-2 text-sm font-semibold bg-slate-900 text-white rounded-lg hover:bg-slate-800 transition-colors"
                  >
                    Generate {variants.length > 0 ? 'New ' : ''}Variants
                  </button>
                )}
              </div>

              {/* Variants Grid */}
              {variants.length > 0 && (
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Variants Generated ({variants.length})</label>
                  <table className="w-full text-left">
                    <thead>
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Img</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Title</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">SKU</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Price</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Stock</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold text-slate-500 tracking-wider">Weight (kg)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {variants.map((v, idx) => (
                        <tr key={idx} className="border-b border-slate-100">
                          <td className="px-4 py-3">
                            <button type="button" onClick={() => openMediaBrowser((url) => { const nv = [...variants]; nv[idx].image_url = url; setVariants(nv); })} className="w-10 h-10 bg-slate-50 border rounded-lg flex items-center justify-center">
                              {v.image_url ? <img src={v.image_url} className="w-full h-full object-cover rounded-lg" /> : <ImageIcon className="w-4 h-4 text-slate-400" />}
                            </button>
                          </td>
                          <td className="px-4 py-3 text-sm">{v.title}</td>
                          <td className="px-4 py-3"><input type="text" value={v.sku} onChange={e => { const nv = [...variants]; nv[idx].sku = e.target.value; setVariants(nv); }} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></td>
                          <td className="px-4 py-3"><input type="number" step="0.01" value={v.price} onChange={e => { const nv = [...variants]; nv[idx].price = parseFloat(e.target.value); setVariants(nv); }} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm" /></td>
                          <td className="px-4 py-3">
                            <input type="number" value={v.stock_quantity} onChange={e => {
                              const newVariants = [...variants];
                              newVariants[idx].stock_quantity = parseInt(e.target.value) || 0;
                              setVariants(newVariants);
                            }} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm" />
                          </td>
                          <td className="px-4 py-3">
                            <input type="number" step="0.1" value={v.weight} onChange={e => {
                              const newVariants = [...variants];
                              newVariants[idx].weight = parseFloat(e.target.value) || 0;
                              setVariants(newVariants);
                            }} className="w-24 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-sm" placeholder="0.5" />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Category</label>
                  <select 
                    value={categoryId} onChange={(e) => setCategoryId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm appearance-none"
                  >
                    <option value="">Uncategorized</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-2">Tax Category</label>
                  <select 
                    value={taxCategoryId} onChange={(e) => setTaxCategoryId(e.target.value)}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm appearance-none"
                  >
                    <option value="">Default Shop Tax</option>
                    {taxCategories.map(tc => <option key={tc.id} value={tc.id}>{tc.name}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Product Image</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors relative group">
                  <div className="space-y-1 text-center w-full relative">
                    {isRemovingBg && (
                      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-white/80 backdrop-blur-sm rounded-lg">
                        <Loader2 className="w-8 h-8 text-violet-600 animate-spin mb-2" />
                        <span className="text-sm font-semibold text-violet-700">Removing Background...</span>
                      </div>
                    )}
                    {imageUrl ? (
                      <div className="relative inline-block">
                        <img src={imageUrl} alt="Preview" className="mx-auto h-32 w-32 object-cover rounded-lg shadow-sm mb-4" />
                      </div>
                    ) : (
                      <ImageIcon className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    )}
                    <div className="flex flex-col items-center space-y-3">
                      <div className="flex items-center text-sm text-slate-600 justify-center space-x-2">
                        <label className="relative cursor-pointer rounded-md bg-transparent font-semibold text-slate-900 hover:text-slate-700 focus-within:outline-none">
                          <span>Upload new</span>
                          <input 
                            type="file" accept="image/*" className="sr-only"
                            onChange={async (e) => {
                              if (e.target.files && e.target.files[0]) {
                                const file = e.target.files[0];
                                const formData = new FormData();
                                formData.append('file', file);
                                try {
                                  const res = await axios.post(`http://localhost:8080/api/shops/${id}/media`, formData, { withCredentials: true });
                                  setImageUrl(res.data.media.url);
                                } catch (err) {
                                  console.error('Failed to upload image', err);
                                  alert('Failed to upload image');
                                }
                              }
                            }}
                          />
                        </label>
                        <span>or</span>
                        <button 
                          type="button" 
                          onClick={() => openMediaBrowser(setImageUrl)}
                          className="font-semibold text-slate-900 hover:text-slate-700"
                        >
                          Browse media
                        </button>
                      </div>
                      
                      <div className="w-full h-px bg-slate-200/60 my-2"></div>
                      
                      <label className="relative cursor-pointer flex items-center justify-center space-x-1.5 w-full bg-violet-50 hover:bg-violet-100 text-violet-700 py-2 rounded-lg transition-colors border border-violet-200/50">
                        <Eraser className="w-4 h-4" />
                        <span className="text-sm font-semibold">Upload & Remove Background</span>
                        <input 
                          type="file" accept="image/*" className="sr-only"
                          onChange={async (e) => {
                            if (e.target.files && e.target.files[0]) {
                              handleRemoveBackground(e.target.files[0]);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <p className="text-xs text-slate-500 mt-3 pt-2">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
                <input 
                  type="url" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full mt-3 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm"
                />
              </div>
            </form>
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <button disabled={isSubmitting} type="submit" form="product-form" className="w-full bg-slate-900 text-white px-6 py-3 rounded-xl font-semibold hover:bg-slate-800 transition-colors flex items-center justify-center shadow-md hover:shadow-lg disabled:opacity-50">
              {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              {editingProductId ? 'Save Changes' : 'Create Product'}
            </button>
          </div>
        </div>

        {/* Products List */}
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-xs uppercase tracking-wider text-slate-500 font-semibold">
                <th className="px-6 py-4">Product Details</th>
                <th className="px-6 py-4">Price</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Manage</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {products.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-6 py-16 text-center">
                    <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto mb-4 border border-slate-100">
                      <Package className="w-8 h-8 text-slate-300" />
                    </div>
                    <h3 className="text-lg font-semibold text-slate-900">Your catalog is empty</h3>
                    <p className="text-slate-500 mt-1 mb-4 max-w-sm mx-auto">Get started by adding your first product to the store.</p>
                    <button onClick={() => setIsAdding(true)} className="text-slate-900 font-medium hover:underline inline-flex items-center">
                      <Plus className="w-4 h-4 mr-1" /> Add Product
                    </button>
                  </td>
                </tr>
              ) : (
                products.map(product => (
                  <tr key={product.id} className="hover:bg-slate-50/80 transition-colors group">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-4">
                        <div className="w-14 h-14 bg-slate-100 rounded-xl overflow-hidden shrink-0 border border-slate-200/50 shadow-sm">
                          {product.image_url ? (
                            <img src={product.image_url} alt={product.title} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-6 h-6 text-slate-300 m-4" />
                          )}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-900 text-sm mb-0.5">{product.title}</div>
                          <div className="text-xs text-slate-500 truncate max-w-[250px]">{product.description?.replace(/<[^>]*>?/gm, '') || 'No description provided.'}</div>
                          {product.variants && product.variants.length > 0 && (
                            <div className="text-xs font-medium text-slate-400 mt-1">{product.variants.length} Variant(s)</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 font-semibold text-slate-900 text-sm">
                      {product.variants && product.variants.length > 0 ? (
                        (() => {
                          const prices = product.variants.map(v => v.price);
                          const min = Math.min(...prices);
                          const max = Math.max(...prices);
                          return min === max ? `${currencySymbol}${min.toFixed(2)}` : `${currencySymbol}${min.toFixed(2)} - ${currencySymbol}${max.toFixed(2)}`;
                        })()
                      ) : (
                        `${currencySymbol}${product.price.toFixed(2)}`
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center px-2.5 py-1 rounded-md text-xs font-semibold ${
                        product.stock_quantity > 0 ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/50' : 'bg-rose-50 text-rose-700 border border-rose-200/50'
                      }`}>
                        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${product.stock_quantity > 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}></span>
                        {product.stock_quantity} in stock
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => handleEditClick(product)}
                          className="text-slate-400 hover:text-slate-700 hover:bg-slate-100 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Edit product"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button 
                          onClick={() => handleDelete(product.id)}
                          className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-2 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                          title="Delete product"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

      </div>

      {/* Media Browser Modal */}
      {isMediaBrowserOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setIsMediaBrowserOpen(false)}></div>
          <div className="relative bg-white rounded-2xl w-full max-w-3xl max-h-[80vh] flex flex-col shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between p-6 border-b border-slate-100 bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-900">Browse Media</h3>
              <button onClick={() => setIsMediaBrowserOpen(false)} className="text-slate-400 hover:text-slate-600 p-2 rounded-full hover:bg-slate-200 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              {mediaItems.length === 0 ? (
                <div className="text-center py-12 text-slate-500">No media uploaded yet.</div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-4">
                  {mediaItems.map(media => (
                    <div 
                      key={media.id} 
                      className="aspect-square rounded-xl overflow-hidden border-2 border-transparent hover:border-slate-900 cursor-pointer transition-all shadow-sm group relative"
                      onClick={() => {
                        if (mediaCallback) mediaCallback(media.url);
                        setIsMediaBrowserOpen(false);
                      }}
                    >
                      <img src={media.url} alt={media.file_name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors"></div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
};

export default ProductManagerModule;
