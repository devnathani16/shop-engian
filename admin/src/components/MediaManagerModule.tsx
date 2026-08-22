import React, { useState, useEffect, useRef } from 'react';
import { useParams } from 'react-router-dom';
import axios from 'axios';
import { UploadCloud, Image as ImageIcon, Trash2, ExternalLink, Loader2, Copy, CheckCircle2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface MediaItem {
  id: number;
  file_name: string;
  url: string;
  file_id: string;
  created_at: string;
}

const MediaManagerModule: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [mediaList, setMediaList] = useState<MediaItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchMedia();
  }, [id]);

  const fetchMedia = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get(`http://localhost:8080/api/shops/${id}/media`);
      setMediaList(response.data.media || []);
    } catch (err) {
      toast.error('Failed to load media files');
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleUpload = async (files: FileList | File[]) => {
    const validFiles = Array.from(files).filter(file => file.type.startsWith('image/'));
    
    if (validFiles.length === 0) {
      toast.error('Only image files are allowed');
      return;
    }

    setIsUploading(true);
    let successfulUploads = 0;
    const newMediaList: MediaItem[] = [];

    // Get Upload Auth Ticket
    let authData;
    try {
      const authRes = await axios.get(`http://localhost:8080/api/shops/${id}/media/auth`, { withCredentials: true });
      authData = authRes.data;
    } catch (err) {
      toast.error('Failed to get upload signature');
      setIsUploading(false);
      return;
    }

    // Upload files concurrently directly to ImageKit
    await Promise.all(validFiles.map(async (file) => {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('publicKey', authData.publicKey);
      formData.append('signature', authData.signature);
      formData.append('expire', authData.expire.toString());
      formData.append('token', authData.token);
      formData.append('folder', `/eaas-media/${id}`);
      formData.append('fileName', file.name);
      formData.append('useUniqueFileName', 'true');

      try {
        // Direct upload to ImageKit CDN
        const response = await axios.post('https://upload.imagekit.io/api/v1/files/upload', formData);
        
        // Tell Go backend to save the record
        const recordRes = await axios.post(`http://localhost:8080/api/shops/${id}/media/record`, {
          file_name: response.data.name,
          url: response.data.url,
          file_id: response.data.fileId
        }, {
          withCredentials: true
        });

        newMediaList.push(recordRes.data.media);
        successfulUploads++;
      } catch (err) {
        console.error("Upload error", err);
      }
    }));

    setIsUploading(false);

    if (successfulUploads > 0) {
      toast.success(`Successfully uploaded ${successfulUploads} image${successfulUploads > 1 ? 's' : ''}`);
      setMediaList(prevList => [...newMediaList, ...prevList]);
    }
    
    if (successfulUploads < validFiles.length) {
      toast.error(`Failed to upload ${validFiles.length - successfulUploads} image(s)`);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files.length > 0) {
      handleUpload(e.target.files);
    }
    // Reset input value so the same files can be selected again if needed
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDelete = async (mediaId: number) => {
    if (!window.confirm('Are you sure you want to delete this image?')) return;
    
    try {
      await axios.delete(`http://localhost:8080/api/shops/${id}/media/${mediaId}`);
      toast.success('Image deleted');
      setMediaList(mediaList.filter(m => m.id !== mediaId));
    } catch (err) {
      toast.error('Failed to delete image');
    }
  };

  const copyToClipboard = (url: string) => {
    navigator.clipboard.writeText(url);
    setCopiedUrl(url);
    toast.success('URL copied to clipboard');
    setTimeout(() => setCopiedUrl(null), 2000);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden flex flex-col h-full max-h-[800px]">
      <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center">
            <ImageIcon className="w-6 h-6 mr-3 text-indigo-600" />
            Media Library
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage your store's images and assets via ImageKit CDN</p>
        </div>
        <div className="flex flex-col items-end space-y-3">
          <div className="bg-indigo-50 px-3 py-1.5 rounded-full border border-indigo-100 flex items-center">
             <div className="w-2 h-2 rounded-full bg-green-500 mr-2"></div>
             <span className="text-xs font-semibold text-indigo-900 uppercase tracking-wider">ImageKit Connected</span>
          </div>
          
          <div>
            <input 
              type="file" 
              ref={fileInputRef} 
              onChange={handleChange} 
              accept="image/*" 
              className="hidden" 
              multiple
            />
            <button
              onClick={() => !isUploading && fileInputRef.current?.click()}
              disabled={isUploading}
              className={`flex items-center space-x-2 px-5 py-2.5 rounded-lg font-medium text-white shadow-sm transition-all ${
                isUploading ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-md'
              }`}
            >
              {isUploading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  <span>Uploading...</span>
                </>
              ) : (
                <>
                  <UploadCloud className="w-5 h-5" />
                  <span>Upload Images</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Media Grid */}
      <div className="flex-1 overflow-y-auto p-6 bg-slate-50 border-t border-slate-100">
        {isLoading ? (
          <div className="flex justify-center items-center h-32">
            <Loader2 className="w-8 h-8 text-indigo-500 animate-spin" />
          </div>
        ) : mediaList.length === 0 ? (
          <div className="text-center py-12">
            <ImageIcon className="w-16 h-16 text-slate-300 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-slate-900">No media uploaded yet</h3>
            <p className="text-slate-500 mt-1">Upload your first image above.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {mediaList.map((media) => (
              <div key={media.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden group relative">
                {/* Image Thumbnail with Auto Transformation from ImageKit (e.g. tr=h-300,w-400) */}
                <div className="aspect-[4/3] bg-slate-100 relative overflow-hidden">
                  <img 
                    src={`${media.url}?tr=w-400,h-300,fo-auto`} 
                    alt={media.file_name} 
                    className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                  />
                  {/* Actions overlay */}
                  <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center space-x-2">
                    <a 
                      href={media.url} 
                      target="_blank" 
                      rel="noreferrer"
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                      title="View original"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button 
                      onClick={(e) => { e.stopPropagation(); copyToClipboard(media.url); }}
                      className="p-2 bg-white/20 hover:bg-white/40 rounded-full text-white backdrop-blur-sm transition-colors"
                      title="Copy URL"
                    >
                      {copiedUrl === media.url ? <CheckCircle2 className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                    </button>
                    <button 
                      onClick={(e) => { e.stopPropagation(); handleDelete(media.id); }}
                      className="p-2 bg-red-500/80 hover:bg-red-500 rounded-full text-white backdrop-blur-sm transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                <div className="p-3">
                  <p className="text-xs font-medium text-slate-800 truncate" title={media.file_name}>
                    {media.file_name}
                  </p>
                  <p className="text-[10px] text-slate-500 mt-0.5">
                    {new Date(media.created_at).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default MediaManagerModule;
