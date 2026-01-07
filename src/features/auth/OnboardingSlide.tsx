import { useState } from 'react';
/**
 * Single onboarding slide component
 * Only renders title and image - description is in the carousel footer
 */

interface OnboardingSlideProps {
  title: string;
  imageUrl?: string;
}

export default function OnboardingSlide({ title, imageUrl }: OnboardingSlideProps) {
  const [imageFailed, setImageFailed] = useState(false);

  return (
    <div className="flex flex-col h-full px-6 gap-12">
      {/* Title */}
      <h1 className="text-4xl font-normal text-[#1C8376] leading-[1.2]">
        {title}
      </h1>
      
      {/* Image container - centers the square image in available space */}
      <div className="flex flex-none items-center justify-center">
        {/* Responsive image area - keeps aspect ratio, avoids clipping */}
        <div 
          className="w-full bg-white rounded-lg flex items-center justify-center"
          style={{ minWidth: '180px', minHeight: '180px', maxHeight: '320px' }}
        >
          {imageUrl && !imageFailed ? (
            <img 
              src={imageUrl} 
              alt={title} 
              className="max-h-[320px] w-full h-auto object-contain rounded-lg" 
              onError={() => setImageFailed(true)}
              loading="lazy"
            />
          ) : (
            <span className="text-slate-400 text-sm">Image goes here</span>
          )}
        </div>
      </div>
    </div>
  );
}
