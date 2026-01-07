import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { uploadUserAvatar, deleteUserAvatar, clearUserAvatarCache } from '../lib/userAvatars';
import UserAvatar from '../components/UserAvatar';
import { PageHeader } from '../components/PageHeader';
import { supabase } from '../lib/supabase';

export default function EditAvatarPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [hasCustomAvatar, setHasCustomAvatar] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Redirect if not logged in
  useEffect(() => {
    if (!user?.id) {
      navigate('/profile');
    }
  }, [user, navigate]);

  // Check if user has a custom avatar (avatar_url in database AND file exists in storage)
  useEffect(() => {
    const checkAvatar = async () => {
      if (!user?.id) return;
      
      try {
        const { data, error } = await supabase
          .from('users')
          .select('avatar_url')
          .eq('id', user.id)
          .maybeSingle();
        
        if (error) {
          console.warn('[EditAvatar] Error checking avatar:', error);
          setHasCustomAvatar(false);
          return;
        }
        
        // If no avatar_url, definitely not custom
        if (!data?.avatar_url) {
          setHasCustomAvatar(false);
          return;
        }
        
        // Check if the file actually exists in storage
        // Extract file path from URL: https://...supabase.co/storage/v1/object/public/user-avatars/{userId}/avatar.png
        const avatarUrl = data.avatar_url;
        const urlMatch = avatarUrl.match(/user-avatars\/([^\/]+)\/([^\/]+)/);
        
        if (!urlMatch) {
          // URL format doesn't match expected pattern, assume not custom
          setHasCustomAvatar(false);
          return;
        }
        
        const [, userIdFromUrl, fileName] = urlMatch;
        
        // Check if file exists in storage and get metadata
        const { data: fileData, error: fileError } = await supabase.storage
          .from('user-avatars')
          .list(userIdFromUrl, {
            search: fileName,
          });
        
        if (fileError || !fileData || fileData.length === 0) {
          // File doesn't exist, definitely not custom
          setHasCustomAvatar(false);
          return;
        }
        
        // File exists - check if it was manually uploaded by checking localStorage
        // We track when a user manually uploads via the EditAvatar page
        const lastManualUpload = localStorage.getItem(`avatar_uploaded_${user.id}`);
        
        // Only consider it custom if user has manually uploaded (tracked in localStorage)
        // If no localStorage entry, assume it's auto-generated default
        const customAvatar = !!lastManualUpload;
        setHasCustomAvatar(customAvatar);
      } catch (err) {
        console.warn('[EditAvatar] Error checking avatar:', err);
        setHasCustomAvatar(false);
      }
    };
    
    checkAvatar();
  }, [user?.id]);

  const createImage = (url: string): Promise<HTMLImageElement> => {
    return new Promise((resolve, reject) => {
      const image = new Image();
      image.addEventListener('load', () => resolve(image));
      image.addEventListener('error', (error) => reject(error));
      image.src = url;
    });
  };

  const getCroppedImg = async (imageSrc: string, pixelCrop: Area): Promise<Blob> => {
    const image = await createImage(imageSrc);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    if (!ctx) throw new Error('No 2d context');

    canvas.width = pixelCrop.width;
    canvas.height = pixelCrop.height;

    ctx.drawImage(
      image,
      pixelCrop.x,
      pixelCrop.y,
      pixelCrop.width,
      pixelCrop.height,
      0,
      0,
      pixelCrop.width,
      pixelCrop.height
    );

    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error('Canvas is empty'));
          return;
        }
        resolve(blob);
      }, 'image/png', 0.9);
    });
  };

  const handleFileSelect = useCallback((file: File) => {
    if (!user?.id) {
      setError("You must be logged in to upload an avatar.");
      return;
    }

    const allowedTypes = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]);
    if (!allowedTypes.has(file.type)) {
      setError("Please upload a PNG, JPG, or WebP image.");
      return;
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      setError("Please choose an image smaller than 20MB.");
      return;
    }

    setError(null);
    setSuccess(false);
    
    // Pre-compress large images before showing crop UI
    if (file.size > 5 * 1024 * 1024) {
      imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        initialQuality: 0.7,
      }).then((compressed) => {
        const reader = new FileReader();
        reader.onload = () => {
          setCropImage(reader.result as string);
        };
        reader.readAsDataURL(compressed);
      }).catch(() => {
        setError("Failed to process image. Please try a smaller file.");
      });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, [user?.id]);

  const onCropComplete = useCallback(async (_croppedArea: Area, croppedAreaPixels: Area) => {
    setCroppedAreaPixels(croppedAreaPixels);
    
    if (cropImage) {
      try {
        const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
        const preview = URL.createObjectURL(croppedBlob);
        setPreviewUrl(preview);
      } catch (error) {
        // Error creating preview (non-critical)
      }
    }
  }, [cropImage]);

  const handleCropAndUpload = useCallback(async () => {
    if (!cropImage || !croppedAreaPixels || !user?.id) {
      return;
    }

    setError(null);
    setSuccess(false);
    setUploading(true);

    try {
      // Get cropped image as blob
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      
      // Convert blob to file
      const croppedFile = new File([croppedBlob], 'avatar.png', { type: 'image/png' });

      // Upload using userAvatars utility
      await uploadUserAvatar(user.id, croppedFile);
      
      // Clear cache to force fresh fetch
      clearUserAvatarCache(user.id);
      
      // Mark as manually uploaded in localStorage
      localStorage.setItem(`avatar_uploaded_${user.id}`, Date.now().toString());
      
      // Update state to show remove button
      setHasCustomAvatar(true);
      setSuccess(true);
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      
      // Navigate back after a short delay to show success message
      setTimeout(() => {
        navigate('/profile');
        // Dispatch event AFTER navigation to ensure components are mounted
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('userAvatarUpdated', { detail: { userId: user.id } }));
        }, 200);
      }, 1000);
    } catch (error: any) {
      setError(error?.message ?? "Failed to upload avatar. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [cropImage, croppedAreaPixels, user?.id, previewUrl, navigate]);

  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    setSuccess(false);
    setUploading(true);
    try {
      await deleteUserAvatar(user.id);
      
      // Clear cache to force fresh fetch
      clearUserAvatarCache(user.id);
      
      // Remove manual upload flag from localStorage
      localStorage.removeItem(`avatar_uploaded_${user.id}`);
      
      // Update state to hide remove button
      setHasCustomAvatar(false);
      setSuccess(true);
      setTimeout(() => {
        navigate('/profile');
        // Dispatch event AFTER navigation to ensure components are mounted
        setTimeout(() => {
          window.dispatchEvent(new CustomEvent('userAvatarUpdated', { detail: { userId: user.id } }));
        }, 200);
      }, 1000);
    } catch (error: any) {
      setError(error?.message ?? "Failed to remove avatar. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [user?.id, navigate]);

  const handleCancel = useCallback(() => {
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setCropImage(null);
    setPreviewUrl(null);
    setError(null);
    setSuccess(false);
    navigate('/profile');
  }, [previewUrl, navigate]);

  if (!user?.id) {
    return null;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-2xl mx-auto px-4 py-6">
        <PageHeader title="Edit Avatar" as="h1" className="mb-6" />

        <div className="bg-white rounded-2xl shadow-lg p-4 sm:p-6">
          {!cropImage ? (
            <>
              {/* Current avatar preview */}
              <div className="mb-6">
                <div className="text-xs text-slate-600 mb-2 font-medium">Current Avatar:</div>
                <div className="flex items-center gap-3">
                  <div className="w-16 h-16 rounded-full overflow-hidden bg-slate-100 flex items-center justify-center border-2 border-slate-200">
                    <UserAvatar
                      userId={user.id}
                      name={user.user_metadata?.display_name || user.email || undefined}
                      size={64}
                    />
                  </div>
                </div>
              </div>

              {/* Upload section */}
              <div className="space-y-3">
                <div>
                  <label className="block text-xs font-medium text-slate-700 mb-2">
                    Choose Image
                  </label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) {
                        handleFileSelect(file);
                      }
                    }}
                    disabled={uploading}
                    className="hidden"
                    id="avatar-upload-input"
                  />
                  <label
                    htmlFor="avatar-upload-input"
                    className="block w-full border-2 border-dashed border-slate-300 rounded-lg p-6 text-center active:bg-slate-50 active:border-[#1C8376] touch-manipulation cursor-pointer"
                  >
                    <div className="flex flex-col items-center gap-2">
                      <svg className="w-10 h-10 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      <div className="text-sm">
                        <span className="text-[#1C8376] font-semibold">Tap to choose image</span>
                      </div>
                      <p className="text-xs text-slate-500">
                        PNG, JPG, or WebP (up to 20MB - will be optimized automatically)
                      </p>
                    </div>
                  </label>
                </div>

                {/* Upload progress */}
                {uploading && (
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-[#1C8376]"></div>
                    <span>Processing and uploading...</span>
                  </div>
                )}

                {/* Success message */}
                {success && (
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800">
                    ✓ Avatar uploaded successfully!
                  </div>
                )}

                {/* Error message */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                    {error}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="mt-6 flex gap-3">
                <button
                  onClick={handleCancel}
                  disabled={uploading}
                  className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium disabled:opacity-50"
                >
                  Cancel
                </button>
                {user && hasCustomAvatar && (
                  <button
                    onClick={handleRemoveAvatar}
                    disabled={uploading}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg font-medium disabled:opacity-50"
                  >
                    Remove Avatar
                  </button>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Crop view */}
              <div className="space-y-3">
                <div className="text-xs text-slate-600">
                  <p className="font-medium">Position your image</p>
                  <p className="text-xs text-slate-500">Drag to position, use slider to zoom</p>
                </div>
                
                <div className="relative w-full" style={{ height: '280px' }}>
                  <Cropper
                    image={cropImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    cropShape="round"
                    showGrid={false}
                    onCropChange={setCrop}
                    onZoomChange={setZoom}
                    onCropComplete={onCropComplete}
                    style={{
                      containerStyle: {
                        width: '100%',
                        height: '100%',
                        position: 'relative',
                      },
                    }}
                  />
                </div>

                {/* Zoom control and Preview in one row */}
                <div className="flex items-center gap-4">
                  <div className="flex-1 space-y-1">
                    <label className="block text-xs font-medium text-slate-700">
                      Zoom: {Math.round(zoom * 100)}%
                    </label>
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#1C8376] touch-manipulation"
                      style={{ WebkitTapHighlightColor: 'transparent' }}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="text-xs font-medium text-slate-700">Preview:</div>
                    <div className="w-12 h-12 rounded-full overflow-hidden bg-slate-100 border-2 border-slate-300 flex items-center justify-center flex-shrink-0">
                      {previewUrl ? (
                        <img
                          src={previewUrl}
                          alt="Preview"
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full bg-slate-200" />
                      )}
                    </div>
                  </div>
                </div>

                {/* Error message */}
                {error && (
                  <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-xs text-red-800">
                    {error}
                  </div>
                )}

                {/* Action buttons */}
                <div className="flex gap-2 pt-2">
                  <button
                    onClick={() => {
                      setCropImage(null);
                      if (previewUrl) {
                        URL.revokeObjectURL(previewUrl);
                      }
                      setPreviewUrl(null);
                      setError(null);
                    }}
                    disabled={uploading}
                    className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium disabled:opacity-50"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleCropAndUpload}
                    disabled={uploading || !croppedAreaPixels}
                    className="flex-1 px-4 py-2 bg-[#1C8376] text-white rounded-lg font-medium disabled:opacity-50"
                  >
                    {uploading ? 'Uploading...' : 'Save Avatar'}
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

