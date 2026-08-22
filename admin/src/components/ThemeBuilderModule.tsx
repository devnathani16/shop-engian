import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Save, Plus, Trash2, ArrowUp, ArrowDown, Type, Palette, LayoutTemplate, Monitor, Smartphone, Maximize2 } from 'lucide-react';

export default function ThemeBuilderModule({ id }: { id: string }) {
  const [theme, setTheme] = useState<any>({ global: { colors: {}, typography: {} }, pages: { home: [] } });
  const [activeTab, setActiveTab] = useState<'global' | 'sections'>('sections');
  const [editingPage, setEditingPage] = useState<'home' | 'products' | 'about' | 'checkout'>('home');
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop');
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showAiModal, setShowAiModal] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');
  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    const token = localStorage.getItem('token');
    
    // Fetch shop subdomain for the iframe URL
    axios.get(`http://localhost:8080/api/shops/${id}/analytics`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      setSubdomain(res.data.subdomain);
    }).catch(console.error);

    // Fetch theme
    axios.get(`http://localhost:8080/api/shops/${id}/theme`, {
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(res => {
      if (res.data.config) {
        let conf = res.data.config;
        if (!conf.pages && conf.sections) {
          conf.pages = { home: conf.sections, products: [], about: [], checkout: [] };
          delete conf.sections;
        }
        setTheme(conf);
      }
    }).catch(console.error);
  }, [id]);

  // Sync with iframe whenever theme changes
  useEffect(() => {
    if (iframeRef.current && iframeRef.current.contentWindow) {
      iframeRef.current.contentWindow.postMessage({ type: 'UPDATE_THEME', payload: theme }, '*');
    }
  }, [theme]);

  const handleSave = async () => {
    setIsSaving(true);
    const token = localStorage.getItem('token');
    try {
      await axios.put(`http://localhost:8080/api/shops/${id}/theme`, { config: theme }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      alert('Theme saved successfully!');
    } catch (e) {
      alert('Failed to save theme');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAiGenerate = async () => {
    if (!aiPrompt) return;
    setIsGenerating(true);
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/theme/generate`, { prompt: aiPrompt }, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.data.config) {
        let conf = res.data.config;
        if (!conf.pages && conf.sections) {
          conf.pages = { home: conf.sections, products: [], about: [], checkout: [] };
          delete conf.sections;
        }
        setTheme(conf);
        setShowAiModal(false);
        alert('Theme generated successfully! Save to apply it permanently.');
      }
    } catch (e) {
      alert('Failed to generate theme. Make sure the AI backend is running.');
    } finally {
      setIsGenerating(false);
    }
  };

  const updateGlobalColor = (key: string, value: string) => {
    setTheme((prev: any) => ({
      ...prev,
      global: {
        ...prev.global,
        colors: {
          ...prev.global?.colors,
          [key]: value
        }
      }
    }));
  };

  const getActiveSections = () => theme.pages?.[editingPage] || [];

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>, sectionId: string, key: string) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsSaving(true);
    const formData = new FormData();
    formData.append('file', file);
    
    const token = localStorage.getItem('token');
    try {
      const res = await axios.post(`http://localhost:8080/api/shops/${id}/media/upload`, formData, {
        headers: { 
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      if (res.data.media && res.data.media.url) {
        updateSectionSetting(sectionId, key, res.data.media.url);
      }
    } catch (err) {
      alert('Failed to upload image');
    } finally {
      setIsSaving(false);
    }
  };

  const updateSectionSetting = (sectionId: string, key: string, value: string) => {
    setTheme((prev: any) => ({
      ...prev,
      pages: {
        ...prev.pages,
        [editingPage]: getActiveSections().map((s: any) => 
          s.id === sectionId 
            ? { ...s, settings: { ...s.settings, [key]: value } } 
            : s
        )
      }
    }));
  };

  const moveSection = (index: number, direction: -1 | 1) => {
    const newSections = [...getActiveSections()];
    if (index + direction < 0 || index + direction >= newSections.length) return;
    const temp = newSections[index];
    newSections[index] = newSections[index + direction];
    newSections[index + direction] = temp;
    setTheme({ ...theme, pages: { ...theme.pages, [editingPage]: newSections } });
  };

  const deleteSection = (index: number) => {
    setTheme({ ...theme, pages: { ...theme.pages, [editingPage]: getActiveSections().filter((_: any, i: number) => i !== index) } });
  };

  const addSection = (type: string) => {
    const newSection = {
      id: `${type}_${Date.now()}`,
      type: type,
      settings: { title: `New ${type}` }
    };
    setTheme({ ...theme, pages: { ...theme.pages, [editingPage]: [...getActiveSections(), newSection] } });
  };

  return (
    <div className="flex h-[calc(100vh-140px)] bg-slate-50 border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
      
      {/* Left Sidebar - Controls */}
      <div className="w-96 bg-white border-r border-slate-200 flex flex-col h-full z-10">
        
        {/* Tabs */}
        <div className="flex border-b border-slate-200 p-2 gap-2 shrink-0">
          <button 
            onClick={() => setActiveTab('sections')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center ${activeTab === 'sections' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <LayoutTemplate className="w-4 h-4 mr-2" /> Sections
          </button>
          <button 
            onClick={() => setActiveTab('global')}
            className={`flex-1 py-2 text-sm font-bold rounded-lg transition-colors flex items-center justify-center ${activeTab === 'global' ? 'bg-slate-100 text-slate-900' : 'text-slate-500 hover:bg-slate-50'}`}
          >
            <Palette className="w-4 h-4 mr-2" /> Theme Settings
          </button>
        </div>
        
        {/* AI Magic Button (Global) */}
        <div className="px-4 pt-4 shrink-0">
          <button 
            onClick={() => setShowAiModal(true)}
            className="w-full flex items-center justify-center px-4 py-2 bg-gradient-to-r from-purple-500 to-indigo-600 text-white font-bold rounded-lg hover:from-purple-600 hover:to-indigo-700 transition-colors shadow-sm text-sm"
          >
            ✨ AI Magic Generator
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4">
          
          {activeTab === 'global' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
                  <Palette className="w-4 h-4 mr-2 text-primary" /> Colors
                </h3>
                <div className="space-y-4 bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Primary Color</label>
                    <div className="flex items-center">
                      <input 
                        type="color" 
                        value={theme?.global?.colors?.primary || '#000000'}
                        onChange={(e) => updateGlobalColor('primary', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 mr-2" 
                      />
                      <span className="text-xs font-mono text-slate-500 w-16">{theme?.global?.colors?.primary || '#000000'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Background</label>
                    <div className="flex items-center">
                      <input 
                        type="color" 
                        value={theme?.global?.colors?.background || '#ffffff'}
                        onChange={(e) => updateGlobalColor('background', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 mr-2" 
                      />
                      <span className="text-xs font-mono text-slate-500 w-16">{theme?.global?.colors?.background || '#ffffff'}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="text-sm font-medium text-slate-700">Text Color</label>
                    <div className="flex items-center">
                      <input 
                        type="color" 
                        value={theme?.global?.colors?.text || '#1a1a1a'}
                        onChange={(e) => updateGlobalColor('text', e.target.value)}
                        className="w-8 h-8 rounded cursor-pointer border-0 p-0 mr-2" 
                      />
                      <span className="text-xs font-mono text-slate-500 w-16">{theme?.global?.colors?.text || '#1a1a1a'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-4 flex items-center">
                  <Type className="w-4 h-4 mr-2 text-primary" /> Typography
                </h3>
                <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                  <label className="block text-sm font-medium text-slate-700 mb-2">Base Font</label>
                  <select 
                    className="w-full rounded-lg border-slate-200 text-sm focus:border-primary focus:ring-primary"
                    value={theme?.global?.typography?.fontFamily || 'Inter, sans-serif'}
                    onChange={(e) => setTheme({ ...theme, global: { ...theme.global, typography: { fontFamily: e.target.value } } })}
                  >
                    <option value="Inter, sans-serif">Inter (Sans-serif)</option>
                    <option value="Roboto, sans-serif">Roboto (Sans-serif)</option>
                    <option value="Merriweather, serif">Merriweather (Serif)</option>
                    <option value="Courier New, monospace">Courier (Monospace)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'sections' && (
            <div className="space-y-4">
              <div className="mb-4">
                <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Editing Page</label>
                <select 
                  className="w-full text-sm font-medium border-slate-200 rounded-lg focus:border-primary focus:ring-primary py-2"
                  value={editingPage}
                  onChange={(e) => setEditingPage(e.target.value as any)}
                >
                  <option value="home">Home Page</option>
                  <option value="products">Products Page</option>
                  <option value="about">About Page</option>
                  <option value="checkout">Checkout Page</option>
                </select>
              </div>

              {getActiveSections().length === 0 && (
                <div className="text-center py-8 bg-slate-50 border border-slate-100 rounded-xl text-slate-400 text-sm">
                  This page has no sections. Add one below!
                </div>
              )}

              {getActiveSections().map((section: any, idx: number) => (
                <div key={section.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm group">
                  <div className="bg-slate-50 px-3 py-2 border-b border-slate-200 flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">{section.type.replace('_', ' ')}</span>
                    <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"><ArrowUp className="w-3 h-3" /></button>
                      <button onClick={() => moveSection(idx, 1)} disabled={idx === getActiveSections().length - 1} className="p-1 text-slate-400 hover:text-slate-900 disabled:opacity-30"><ArrowDown className="w-3 h-3" /></button>
                      <button onClick={() => deleteSection(idx)} className="p-1 text-red-400 hover:text-red-600 ml-2"><Trash2 className="w-3 h-3" /></button>
                    </div>
                  </div>
                  <div className="p-4 space-y-3">
                    {/* Dynamic Fields based on section type */}
                    {Object.keys(section.settings || {}).map(key => (
                      <div key={key}>
                        <label className="block text-xs font-medium text-slate-500 mb-1 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</label>
                        
                        {(key.toLowerCase().includes('image') || key.toLowerCase().includes('url')) ? (
                          <div className="flex space-x-2">
                            <input 
                              type="text" 
                              value={section.settings[key]} 
                              onChange={(e) => updateSectionSetting(section.id, key, e.target.value)}
                              className="w-full text-sm border-slate-200 rounded-lg focus:border-primary focus:ring-primary px-3 py-1.5" 
                              placeholder="https://..."
                            />
                            <label className="flex-shrink-0 cursor-pointer bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-medium px-3 py-1.5 rounded-lg border border-slate-200 transition-colors flex items-center justify-center">
                              <Plus className="w-3 h-3 mr-1" /> Upload
                              <input 
                                type="file" 
                                className="hidden" 
                                accept="image/*" 
                                onChange={(e) => handleImageUpload(e, section.id, key)} 
                              />
                            </label>
                          </div>
                        ) : (
                          <input 
                            type="text" 
                            value={section.settings[key]} 
                            onChange={(e) => updateSectionSetting(section.id, key, e.target.value)}
                            className="w-full text-sm border-slate-200 rounded-lg focus:border-primary focus:ring-primary px-3 py-1.5" 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              <div className="pt-4 border-t border-slate-200">
                <p className="text-xs font-semibold text-slate-500 mb-2 uppercase tracking-wider">Add Section to {editingPage}</p>
                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => addSection('hero')} className="flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"><Plus className="w-3 h-3 mr-1" /> Hero</button>
                  <button onClick={() => addSection('category_grid')} className="flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"><Plus className="w-3 h-3 mr-1" /> Categories</button>
                  <button onClick={() => addSection('featured_products')} className="flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200 col-span-2"><Plus className="w-3 h-3 mr-1" /> Featured Products</button>
                  <button onClick={() => addSection('text_block')} className="flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"><Plus className="w-3 h-3 mr-1" /> Text Block</button>
                  <button onClick={() => addSection('text_image_block')} className="flex items-center justify-center px-3 py-2 text-xs font-medium bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-lg transition-colors border border-slate-200"><Plus className="w-3 h-3 mr-1" /> Text & Image</button>
                </div>
              </div>
            </div>
          )}

        </div>
        
        {/* Footer Actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 shrink-0">
          <button 
            onClick={handleSave} 
            disabled={isSaving}
            className="w-full flex items-center justify-center px-4 py-2.5 bg-primary text-white font-bold rounded-xl hover:bg-primary-dark transition-colors shadow-sm disabled:opacity-50"
          >
            {isSaving ? 'Saving...' : <><Save className="w-4 h-4 mr-2" /> Save Theme</>}
          </button>
        </div>
      </div>

      {/* Right Panel - Live Preview */}
      <div className="flex-1 flex flex-col bg-slate-100 relative overflow-hidden">
        
        {/* Preview Toolbar */}
        <div className="h-12 bg-white border-b border-slate-200 flex items-center justify-between px-4 shrink-0 shadow-sm z-10 relative">
          <div className="flex items-center bg-slate-100 p-1 rounded-lg">
            <button 
              onClick={() => setPreviewMode('desktop')} 
              className={`p-1.5 rounded-md transition-colors ${previewMode === 'desktop' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Monitor className="w-4 h-4" />
            </button>
            <button 
              onClick={() => setPreviewMode('mobile')} 
              className={`p-1.5 rounded-md transition-colors ${previewMode === 'mobile' ? 'bg-white shadow-sm text-primary' : 'text-slate-500 hover:text-slate-700'}`}
            >
              <Smartphone className="w-4 h-4" />
            </button>
          </div>
          
          <div className="flex items-center space-x-2 text-xs font-mono text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span>
            <span>Live Preview</span>
          </div>

          <a href={`http://${subdomain || 'store'}.localhost:5174`} target="_blank" rel="noreferrer" className="p-1.5 text-slate-500 hover:text-primary transition-colors bg-slate-50 hover:bg-slate-100 rounded-lg">
            <Maximize2 className="w-4 h-4" />
          </a>
        </div>

        {/* Iframe Container */}
        <div className="flex-1 flex items-center justify-center overflow-auto p-4 md:p-8 relative">
          {/* Subtle grid pattern background */}
          <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9IiNlMmU4ZjAiLz48L3N2Zz4=')] opacity-50"></div>
          
          <div className={`bg-white shadow-2xl transition-all duration-300 ease-in-out relative z-10 border border-slate-200 rounded-lg overflow-hidden flex flex-col ${previewMode === 'mobile' ? 'w-[375px] h-[812px]' : 'w-full h-full'}`}>
            {subdomain ? (
              <iframe 
                ref={iframeRef}
                src={`http://${subdomain}.localhost:5174${editingPage === 'home' ? '' : '/' + editingPage}?preview=true`}
                className="w-full h-full border-0 bg-white flex-1"
                title="Theme Preview"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-slate-400">Loading Preview...</div>
            )}
          </div>
        </div>
      </div>

      {/* AI Prompt Modal */}
      {showAiModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl w-[400px] p-6 shadow-xl">
            <h3 className="text-lg font-bold text-slate-900 mb-2">Generate Theme with AI</h3>
            <p className="text-sm text-slate-500 mb-4">Describe the vibe you want for your store.</p>
            <textarea
              className="w-full h-24 p-3 border border-slate-200 rounded-lg focus:border-indigo-500 focus:ring-indigo-500 text-sm mb-4"
              placeholder="e.g. A futuristic cyberpunk neon tech store, dark mode, hacker vibes"
              value={aiPrompt}
              onChange={(e) => setAiPrompt(e.target.value)}
            />
            <div className="flex justify-end space-x-2">
              <button 
                onClick={() => setShowAiModal(false)}
                className="px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                disabled={isGenerating}
              >
                Cancel
              </button>
              <button 
                onClick={handleAiGenerate}
                disabled={!aiPrompt || isGenerating}
                className="px-4 py-2 text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50 flex items-center"
              >
                {isGenerating ? (
                  <>
                    <svg className="animate-spin -ml-1 mr-2 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Generating Ultra ProMax Theme...
                  </>
                ) : (
                  'Generate Ultra ProMax Theme'
                )}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
