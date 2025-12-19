/**
 * Single onboarding slide component
 * Only renders title and image - description is in the carousel footer
 */

interface OnboardingSlideProps {
  title: string;
  imageUrl?: string;
}

export default function OnboardingSlide({ title, imageUrl }: OnboardingSlideProps) {
  return (
    <div className="flex flex-col h-full px-6 gap-12">
      {/* Title */}
      <h1 className="text-[40px] font-normal text-[#1C8376] leading-[1.2]">
        {title}
      </h1>
      
      {/* Image container - centers the square image in available space */}
      <div className="flex-1 flex items-center justify-center">
        {/* Square image - full width, min 180px on small screens */}
        <div 
          className="w-full aspect-square bg-slate-200 rounded-lg flex items-center justify-center"
          style={{ minWidth: '180px', minHeight: '180px' }}
        >
          {imageUrl ? (
            <img src={imageUrl} alt="" className="w-full h-full object-cover rounded-lg" />
          ) : (
            <span className="text-slate-400 text-sm">Image goes here</span>
          )}
        </div>
      </div>
    </div>
  );
}
