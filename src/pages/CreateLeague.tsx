import { useState, useCallback, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { supabase } from '../lib/supabase';
import { PageHeader } from '../components/PageHeader';
import imageCompression from 'browser-image-compression';
import Cropper from 'react-easy-crop';
import type { Area } from 'react-easy-crop';
import { getDeterministicLeagueAvatar } from '../lib/leagueAvatars';
import { VOLLEY_USER_ID } from '../lib/volley';
import { fetchUserLeagues } from '../services/userLeagues';

export default function CreateLeaguePage() {
  // Track hook call count for debugging - must be first hook
  const hookCallCountRef = useRef(0);
  hookCallCountRef.current = 0;
  
  const { user } = useAuth();
  hookCallCountRef.current++;
  const navigate = useNavigate();
  hookCallCountRef.current++;
  const [leagueName, setLeagueName] = useState('');
  hookCallCountRef.current++;
  const [creating, setCreating] = useState(false);
  hookCallCountRef.current++;
  const [error, setError] = useState<string | null>(null);
  hookCallCountRef.current++;
  
  // Avatar upload state
  const [cropImage, setCropImage] = useState<string | null>(null);
  hookCallCountRef.current++;
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  hookCallCountRef.current++;
  const [zoom, setZoom] = useState(1);
  hookCallCountRef.current++;
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<Area | null>(null);
  hookCallCountRef.current++;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  hookCallCountRef.current++;
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  hookCallCountRef.current++;
  const [avatarError, setAvatarError] = useState<string | null>(null);
  hookCallCountRef.current++;
  const fileInputRef = useRef<HTMLInputElement>(null);
  hookCallCountRef.current++;
  const isMountedRef = useRef(true);
  hookCallCountRef.current++;
  
  // #region agent log
  useEffect(() => {
    const mountTimestamp = Date.now();
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:after-all-hooks',message:'All hooks called',data:{mountTimestamp,hookCallCount:hookCallCountRef.current,hasUser:!!user},timestamp:mountTimestamp,sessionId:'debug-session',runId:'run2',hypothesisId:'H1'})}).catch(()=>{});
  }, [user]);
  
  // Track state updates
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:state-creating',message:'creating state changed',data:{creating},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H2'})}).catch(()=>{});
  }, [creating]);
  
  useEffect(() => {
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:state-uploadingAvatar',message:'uploadingAvatar state changed',data:{uploadingAvatar},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H2'})}).catch(()=>{});
  }, [uploadingAvatar]);
  // #endregion
  
  useEffect(() => {
    isMountedRef.current = true;
    
    // #region agent log
    // Catch uncaught errors
    const handleError = (event: ErrorEvent) => {
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:window-error',message:'Uncaught error',data:{errorMessage:event.message,errorFilename:event.filename,errorLineno:event.lineno,errorColno:event.colno,errorStack:event.error?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H5'})}).catch(()=>{});
    };
    window.addEventListener('error', handleError);
    
    // Catch unhandled promise rejections
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:unhandled-rejection',message:'Unhandled promise rejection',data:{reason:event.reason,errorMessage:event.reason?.message,errorStack:event.reason?.stack},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H5'})}).catch(()=>{});
    };
    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    // #endregion
    
    return () => {
      isMountedRef.current = false;
      // #region agent log
      const unmountTimestamp = Date.now();
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:useEffect-unmount',message:'Component unmounting',data:{unmountTimestamp,hookCallCount:hookCallCountRef.current},timestamp:unmountTimestamp,sessionId:'debug-session',runId:'run2',hypothesisId:'H1'})}).catch(()=>{});
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
      // #endregion
    };
  }, []); // Empty deps - only run on mount/unmount

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
      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Canvas is empty'));
            return;
          }
          resolve(blob);
        },
        'image/jpeg',
        0.9
      );
    });
  };

  const handleFileSelect = useCallback((file: File) => {
    const allowedTypes = new Set(['image/png', 'image/jpeg', 'image/jpg', 'image/webp']);
    if (!allowedTypes.has(file.type)) {
      setAvatarError('Please upload a PNG, JPG, or WebP image.');
      return;
    }

    const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB
    if (file.size > MAX_FILE_SIZE) {
      setAvatarError('Please choose an image smaller than 20MB.');
      return;
    }

    setAvatarError(null);

    // For very large files, pre-compress before showing crop UI for better performance
    if (file.size > 5 * 1024 * 1024) {
      imageCompression(file, {
        maxSizeMB: 2,
        maxWidthOrHeight: 1024,
        useWebWorker: true,
        initialQuality: 0.7,
      })
        .then((compressed) => {
          const reader = new FileReader();
          reader.onload = () => {
            setCropImage(reader.result as string);
          };
          reader.readAsDataURL(compressed);
        })
        .catch(() => {
          setAvatarError('Failed to process image. Please try a smaller file.');
        });
    } else {
      const reader = new FileReader();
      reader.onload = () => {
        setCropImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  }, []);

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

  const uploadAvatar = async (leagueId: string): Promise<string | null> => {
    if (!cropImage || !croppedAreaPixels) {
      return null;
    }

    try {
      const croppedBlob = await getCroppedImg(cropImage, croppedAreaPixels);
      const croppedFile = new File([croppedBlob], 'avatar.jpg', { type: 'image/jpeg' });

      const compressed = await imageCompression(croppedFile, {
        maxSizeMB: 0.02,
        maxWidthOrHeight: 256,
        useWebWorker: true,
        initialQuality: 0.8,
      });

      if (compressed.size > 20 * 1024) {
        throw new Error('Compressed image is still larger than 20KB. Try a smaller image.');
      }

      const fileName = `${leagueId}-${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('league-avatars')
        .upload(fileName, compressed, {
          cacheControl: '3600',
          upsert: true,
          contentType: compressed.type,
        });

      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage
        .from('league-avatars')
        .getPublicUrl(fileName);

      return publicUrlData?.publicUrl || null;
    } catch (error: any) {
      setAvatarError(error?.message ?? 'Failed to upload avatar. Please try again.');
      return null;
    }
  };

  const handleCreate = useCallback(async () => {
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-entry',message:'handleCreate called',data:{leagueName,hasUser:!!user,userId:user?.id,hasCropImage:!!cropImage,hasCroppedArea:!!croppedAreaPixels,isMounted:isMountedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H2'})}).catch(()=>{});
    // #endregion
    if (!leagueName.trim() || !user?.id) return;

    if (!isMountedRef.current) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-unmounted',message:'Component already unmounted, aborting',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      return;
    }

    setCreating(true);
    setError(null);
    setAvatarError(null);

    try {
      // Check for duplicate league name (case-insensitive)
      const userLeagues = await fetchUserLeagues(user.id);
      const duplicateLeague = userLeagues.find(
        league => league.name.toLowerCase() === leagueName.trim().toLowerCase()
      );
      if (duplicateLeague) {
        setError("You're already in a mini-league with this name. Please choose a different name.");
        setCreating(false);
        return;
      }

      // Generate code
      const code = Math.random().toString(36).substring(2, 7).toUpperCase();

      // Create league
      const { data: league, error: leagueError } = await supabase
        .from('leagues')
        .insert({ name: leagueName.trim(), code })
        .select('id, code')
        .single();

      if (leagueError) throw leagueError;
      if (!league) throw new Error('Failed to create league');

      // Upload avatar if provided
      let avatarUrl: string | null = null;
      if (cropImage && croppedAreaPixels) {
        if (!isMountedRef.current) {
          // #region agent log
          fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-unmounted-before-avatar',message:'Component unmounted before avatar upload',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
          // #endregion
          return;
        }
        setUploadingAvatar(true);
        avatarUrl = await uploadAvatar(league.id);
        if (isMountedRef.current) {
          setUploadingAvatar(false);
        }

        // If avatar upload fails but league was created, continue with default avatar
        if (!avatarUrl) {
          // Use deterministic avatar as fallback
          avatarUrl = getDeterministicLeagueAvatar(league.id);
        }
      } else {
        // Use deterministic avatar if no custom avatar
        avatarUrl = getDeterministicLeagueAvatar(league.id);
      }

      if (!isMountedRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-unmounted-before-updates',message:'Component unmounted before league updates',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return;
      }

      // Update league with avatar
      if (avatarUrl) {
        await supabase
          .from('leagues')
          .update({ avatar: avatarUrl })
          .eq('id', league.id);
      }

      // Add user as member
      const { error: memberError } = await supabase
        .from('league_members')
        .insert({ league_id: league.id, user_id: user.id });

      if (memberError) throw memberError;
      
      if (!isMountedRef.current) {
        // #region agent log
        fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-unmounted-before-message',message:'Component unmounted before message insert',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run1',hypothesisId:'H1'})}).catch(()=>{});
        // #endregion
        return;
      }

      // Send Volley's welcome message
      try {
        const welcomeMessages = [
          "Hello 👋 I'm Volley. I'll let you know who wins and when new Gameweeks are ready to play.",
          "Hi — I'm Volley 🦄 I'll share results and let you know when new Gameweeks are ready.",
          "I'm Volley. I'll handle the scoring and tell you when new Gameweeks are ready to play.",
          "I'm Volley 🦄 I'll let you know who wins, plus when new Gameweeks are ready.",
          "Hello, I'm Volley. I'll keep track of results and new Gameweeks for you.",
        ];
        const randomMessage = welcomeMessages[Math.floor(Math.random() * welcomeMessages.length)];

        await supabase.from('league_messages').insert({
          league_id: league.id,
          user_id: VOLLEY_USER_ID,
          content: randomMessage,
        });
      } catch (error) {
        // Non-critical - don't fail league creation if message insert fails
        console.error('[CreateLeague] Failed to insert Volley welcome message:', error);
      }

      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-before-reset',message:'About to reset state',data:{leagueCode:league.code,isMounted:isMountedRef.current,creating,uploadingAvatar,hookCallCount:hookCallCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      
      // Reset state before navigation to prevent state updates during unmount
      // This prevents hook violations during React.StrictMode double-mounting transitions
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-before-setCreating',message:'About to call setCreating(false)',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setCreating(false);
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-after-setCreating',message:'Called setCreating(false)',data:{timestamp:Date.now()},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H3'})}).catch(()=>{});
      // #endregion
      setUploadingAvatar(false);
      setError(null);
      setAvatarError(null);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-before-navigate',message:'About to navigate',data:{leagueCode:league.code,isMounted:isMountedRef.current,hookCallCount:hookCallCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
      
      // Navigate synchronously - don't use setTimeout as it can cause timing issues
      // React Router handles the transition properly
      navigate(`/league/${league.code}`);
      
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-after-navigate',message:'Navigate called',data:{leagueCode:league.code,isMounted:isMountedRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H4'})}).catch(()=>{});
      // #endregion
    } catch (error: any) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/8bc20b5f-9829-459c-9363-d6e04fa799c7',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'CreateLeague.tsx:handleCreate-error',message:'Error in handleCreate',data:{errorMessage:error?.message,errorStack:error?.stack,isMounted:isMountedRef.current,hookCallCount:hookCallCountRef.current},timestamp:Date.now(),sessionId:'debug-session',runId:'run2',hypothesisId:'H1'})}).catch(()=>{});
      // #endregion
      if (isMountedRef.current) {
        setError(error?.message ?? 'Failed to create league. Please try again.');
        setCreating(false);
        setUploadingAvatar(false);
      }
    }
  }, [leagueName, user?.id, cropImage, croppedAreaPixels, navigate]);

  const handleCancelCrop = () => {
    setCropImage(null);
    setCroppedAreaPixels(null);
    if (previewUrl) {
      URL.revokeObjectURL(previewUrl);
      setPreviewUrl(null);
    }
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="max-w-4xl mx-auto px-4 py-10">
          <PageHeader title="Create League" as="h1" />
          <p className="mt-4 text-slate-600">Please sign in to create a league.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-4xl mx-auto px-4 py-10">
        <PageHeader title="Create League" as="h1" />
        <p className="mt-2 mb-6 text-slate-600">Choose a name and upload an avatar for your mini-league.</p>

        {error && (
          <div className="mb-4 rounded border border-red-200 bg-red-50 text-red-700 px-3 py-2 text-sm">
            {error}
          </div>
        )}

        <div className="space-y-6">
          {/* League Name */}
          <div>
            <label htmlFor="league-name" className="block text-sm font-medium text-slate-900 mb-2">
              League Name
            </label>
            <input
              id="league-name"
              type="text"
              className="w-full border rounded-lg px-3 py-2 bg-white"
              placeholder="Enter league name"
              value={leagueName}
              onChange={(e) => setLeagueName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !creating && leagueName.trim() && !cropImage) {
                  handleCreate();
                }
              }}
              maxLength={20}
            />
          </div>

          {/* Avatar Upload */}
          <div>
            <label className="block text-sm font-medium text-slate-900 mb-2">League Avatar (Optional)</label>
            
            {!cropImage ? (
              <div>
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
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-50 transition-colors"
                >
                  Choose Image
                </button>
                <p className="mt-2 text-xs text-slate-500">
                  PNG, JPG, or WebP. Max 20MB. If you don't upload one, we'll assign a default avatar.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Crop UI */}
                <div className="relative w-full h-64 bg-slate-100 rounded-lg overflow-hidden">
                  <Cropper
                    image={cropImage}
                    crop={crop}
                    zoom={zoom}
                    aspect={1}
                    onCropChange={setCrop}
                    onCropComplete={onCropComplete}
                    onZoomChange={setZoom}
                  />
                </div>

                {/* Preview */}
                {previewUrl && (
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 rounded-full overflow-hidden border-2 border-slate-300">
                      <img src={previewUrl} alt="Preview" className="w-full h-full object-cover" />
                    </div>
                    <p className="text-sm text-slate-600">Preview</p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={handleCancelCrop}
                    className="px-4 py-2 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium hover:bg-slate-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {avatarError && (
              <div className="mt-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded px-3 py-2">
                {avatarError}
              </div>
            )}
          </div>

          {/* Create Button */}
          <div>
            <button
              onClick={handleCreate}
              disabled={creating || uploadingAvatar || !leagueName.trim()}
              className="w-full px-4 py-3 bg-slate-900 text-white font-semibold rounded-lg disabled:opacity-50 disabled:cursor-not-allowed hover:bg-slate-800 transition-colors"
            >
              {creating || uploadingAvatar
                ? uploadingAvatar
                  ? 'Uploading avatar...'
                  : 'Creating...'
                : 'Create League'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
