import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { Plus, Trash2, Edit2, Loader2, Folder, X, Image as ImageIcon } from 'lucide-react';

interface Category {
  id: number;
  name: string;
  image_url: string;
}

const CategoryManagerModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [categories, setCategories] = useState<Category[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [name, setName] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fetchCategories = async () => {
    try {
      const res = await axios.get(`http://localhost:8080/api/shops/${id}/categories`, { withCredentials: true });
      setCategories(res.data.categories || []);
    } catch (error) {
      console.error('Failed to fetch categories:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, [id]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      if (editingId) {
        await axios.put(`http://localhost:8080/api/shops/${id}/categories/${editingId}`, {
          name,
          image_url: imageUrl
        }, { withCredentials: true });
      } else {
        await axios.post(`http://localhost:8080/api/shops/${id}/categories`, {
          name,
          image_url: imageUrl
        }, { withCredentials: true });
      }
      setName('');
      setImageUrl('');
      setIsAdding(false);
      setEditingId(null);
      fetchCategories();
    } catch (error) {
      console.error('Failed to save category:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (categoryId: number) => {
    if (!window.confirm('Are you sure you want to delete this category?')) return;
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/categories/${categoryId}`, { withCredentials: true });
      fetchCategories();
    } catch (error) {
      console.error('Failed to delete category:', error);
    }
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center p-8 bg-surface">
        <Loader2 className="w-8 h-8 text-primary animate-spin" />
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto p-4 lg:p-8 bg-surface">
      <div className="max-w-5xl mx-auto space-y-8">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-slate-900 tracking-tight">Categories</h1>
            <p className="text-sm text-slate-500 mt-2">Manage your storefront categories.</p>
          </div>
          <button 
            onClick={() => { setEditingId(null); setName(''); setImageUrl(''); setIsAdding(true); }}
            className="flex items-center space-x-2 bg-slate-900 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-slate-800 transition-all shadow-md hover:shadow-lg hover:-translate-y-0.5"
          >
            <Plus className="w-5 h-5" />
            <span>Add Category</span>
          </button>
        </div>

        {/* Backdrop */}
        {isAdding && (
          <div 
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-40 transition-opacity"
            onClick={() => { setIsAdding(false); setEditingId(null); setName(''); setImageUrl(''); }}
          />
        )}

        {/* Sliding Side Drawer Form */}
        <div className={`fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 transform transition-transform duration-300 ease-in-out flex flex-col ${isAdding ? 'translate-x-0' : 'translate-x-full'}`}>
          <div className="px-6 py-5 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
            <h2 className="text-xl font-bold text-slate-900">{editingId ? 'Edit Category' : 'New Category'}</h2>
            <button onClick={() => { setIsAdding(false); setEditingId(null); setName(''); setImageUrl(''); }} className="p-2 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>
          
          <div className="flex-1 overflow-y-auto p-6">
            <form id="category-form" onSubmit={handleCreate} className="space-y-6">
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Category Name</label>
                <input 
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Summer Collection"
                  className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm"
                />
              </div>
              
              <div>
                <label className="block text-sm font-semibold text-slate-700 mb-2">Cover Image</label>
                <div className="mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-slate-200 border-dashed rounded-xl bg-slate-50 hover:bg-slate-100 transition-colors relative group">
                  <div className="space-y-1 text-center">
                    {imageUrl ? (
                       <img src={imageUrl} alt="Preview" className="mx-auto h-32 w-48 object-cover rounded-lg shadow-sm mb-4" />
                    ) : (
                      <ImageIcon className="mx-auto h-10 w-10 text-slate-300 mb-3" />
                    )}
                    <div className="flex text-sm text-slate-600 justify-center">
                      <label className="relative cursor-pointer rounded-md bg-transparent font-semibold text-slate-900 hover:text-slate-700 focus-within:outline-none">
                        <span>Upload a file</span>
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
                      <p className="pl-1">or paste URL below</p>
                    </div>
                    <p className="text-xs text-slate-500">PNG, JPG, GIF up to 10MB</p>
                  </div>
                </div>
                <input 
                  type="url"
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full mt-3 px-4 py-2 text-sm bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/20 focus:border-slate-900 transition-all shadow-sm"
                />
              </div>
            </form>
          </div>
          
          <div className="p-6 border-t border-slate-100 bg-slate-50">
            <button 
              form="category-form" type="submit" disabled={isSubmitting}
              className="w-full bg-slate-900 text-white px-6 py-3 rounded-xl font-medium hover:bg-slate-800 transition-colors disabled:opacity-50 flex items-center justify-center shadow-md hover:shadow-lg"
            >
              {isSubmitting ? <Loader2 className="w-5 h-5 mr-2 animate-spin" /> : null}
              Save Category
            </button>
          </div>
        </div>

        {/* Categories List */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {categories.length === 0 ? (
            <div className="col-span-full bg-slate-50 p-16 text-center rounded-3xl border border-slate-200/60 border-dashed">
              <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center mx-auto mb-4 shadow-sm border border-slate-100">
                <Folder className="w-10 h-10 text-slate-300" />
              </div>
              <h3 className="text-xl font-semibold text-slate-900">No categories found</h3>
              <p className="text-slate-500 mt-2 mb-6 max-w-sm mx-auto">Create your first category to start organizing your products.</p>
              <button onClick={() => { setEditingId(null); setName(''); setImageUrl(''); setIsAdding(true); }} className="text-slate-900 font-medium hover:underline inline-flex items-center">
                <Plus className="w-4 h-4 mr-1" /> Add Category
              </button>
            </div>
          ) : (
            categories.map(cat => (
              <div key={cat.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:shadow-md transition-all group flex flex-col relative">
                
                {/* Action Buttons (Visible on Hover) */}
                <div className="absolute top-3 right-3 z-10 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button 
                    onClick={() => {
                      setEditingId(cat.id);
                      setName(cat.name);
                      setImageUrl(cat.image_url || '');
                      setIsAdding(true);
                    }}
                    className="bg-white/90 backdrop-blur-sm text-blue-600 p-2 rounded-lg hover:bg-blue-50 hover:text-blue-700 transition-colors shadow-sm"
                    title="Edit category"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(cat.id)}
                    className="bg-white/90 backdrop-blur-sm text-rose-600 p-2 rounded-lg hover:bg-rose-50 hover:text-rose-700 transition-colors shadow-sm"
                    title="Delete category"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  {cat.image_url ? (
                    <>
                      <img src={cat.image_url} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900/60 to-transparent"></div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-50">
                      <Folder className="w-16 h-16 text-slate-200" />
                    </div>
                  )}
                  
                  <div className="absolute bottom-4 left-4 right-4">
                    <h3 className={`font-bold text-xl ${cat.image_url ? 'text-white' : 'text-slate-900'} drop-shadow-sm`}>{cat.name}</h3>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

      </div>
    </div>
  );
};

export default CategoryManagerModule;
