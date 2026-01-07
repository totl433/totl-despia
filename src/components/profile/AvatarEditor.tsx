import { useState, useCallback, useRef } from 'react';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import imageCompression from 'browser-image-compression';
import { uploadUserAvatar, deleteUserAvatar } from '../../lib/userAvatars';
import { useAuth } from '../../context/AuthContext';

export interface AvatarEditorProps {
  currentAvatarUrl: string | null;
  userName: string | null | undefined;
  onAvatarUpdated: (newAvatarUrl: string | null) => void;
  onClose: () => void;
}

/**
 * AvatarEditor - Component for uploading/editing user avatars
 * Similar to league avatar editor but for user profiles
 */
export default function AvatarEditor({
  currentAvatarUrl,
  userName: _userName,
  onAvatarUpdated,
  onClose,
}: AvatarEditorProps) {
  const { user } = useAuth();
  const [cropImage, setCropImage] = useState<string | null>(null);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_FILE_SIZE) {
      setError("Please choose an image smaller than 10MB.");
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
      const avatarUrl = await uploadUserAvatar(user.id, croppedFile);
      
      onAvatarUpdated(avatarUrl);
      setSuccess(true);
      
      if (previewUrl) {
        URL.revokeObjectURL(previewUrl);
      }
      setCropImage(null);
      setPreviewUrl(null);
      
      // Close after a short delay to show success message
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      setError(error?.message ?? "Failed to upload avatar. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [cropImage, croppedAreaPixels, user?.id, previewUrl, onAvatarUpdated, onClose]);

  const handleRemoveAvatar = useCallback(async () => {
    if (!user?.id) return;
    setError(null);
    setSuccess(false);
    setUploading(true);
    try {
      await deleteUserAvatar(user.id);
      onAvatarUpdated(null);
      setSuccess(true);
      setTimeout(() => {
        onClose();
      }, 1000);
    } catch (error: any) {
      setError(error?.message ?? "Failed to remove avatar. Please try again.");
    } finally {
      setUploading(false);
    }
  }, [user?.id, onAvatarUpdated, onClose]);


  if (cropImage) {
    return (
      <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto">
          <h3 className="text-xl font-bold mb-4">Crop Your Avatar</h3>
          
          <div className="relative w-full h-64 mb-4">
            <Cropper
              image={cropImage}
              crop={{ x: 0, y: 0 }}
              zoom={1}
              aspect={1}
              onCropChange={() => {}}
              onZoomChange={() => {}}
              onCropComplete={onCropComplete}
            />
          </div>

          {previewUrl && (
            <div className="mb-4 flex justify-center">
              <img
                src={previewUrl}
                alt="Preview"
                className="w-20 h-20 rounded-full object-cover"
              />
            </div>
          )}

          {error && (
            <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
              Avatar updated successfully!
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => {
                setCropImage(null);
                setPreviewUrl(null);
                setError(null);
              }}
              className="flex-1 px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium"
              disabled={uploading}
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
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl p-6 max-w-md w-full">
        <h3 className="text-xl font-bold mb-4">Edit Avatar</h3>

        {error && (
          <div className="mb-4 p-3 bg-red-50 text-red-700 rounded-lg text-sm">
            {error}
          </div>
        )}

        {success && (
          <div className="mb-4 p-3 bg-green-50 text-green-700 rounded-lg text-sm">
            Avatar updated successfully!
          </div>
        )}

        <div className="space-y-3">
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
            className="hidden"
          />

          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="w-full px-4 py-3 bg-[#1C8376] text-white rounded-lg font-medium disabled:opacity-50"
          >
            Upload New Avatar
          </button>

          {currentAvatarUrl && (
            <button
              onClick={handleRemoveAvatar}
              disabled={uploading}
              className="w-full px-4 py-3 border border-red-300 text-red-700 rounded-lg font-medium disabled:opacity-50"
            >
              Remove Avatar
            </button>
          )}

          <button
            onClick={onClose}
            disabled={uploading}
            className="w-full px-4 py-3 border border-slate-300 text-slate-700 rounded-lg font-medium disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}


