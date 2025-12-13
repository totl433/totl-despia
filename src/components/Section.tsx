import { useState } from 'react';
import InfoSheet from './InfoSheet';

export type SectionProps = {
  id?: string;  // Required for collapsible sections
  title: string;
  subtitle?: React.ReactNode;
  headerRight?: React.ReactNode;
  className?: string;
  icon?: string | React.ReactNode;  // String for emoji, ReactNode for custom icon
  collapsible?: boolean;  // If true, make it collapsible (like HowToPlay)
  defaultOpen?: boolean;  // For collapsible sections
  children?: React.ReactNode;
  onToggle?: (isOpen: boolean) => void;  // Callback for collapsible sections
  infoTitle?: string;  // Title for info sheet
  infoDescription?: string;  // Description for info sheet
  showInfoIcon?: boolean;  // Show info icon (default: true if infoTitle/infoDescription provided, false otherwise)
};

/**
 * Section component - can be used as a simple section header or collapsible section
 * 
 * Simple mode: Just a header with content
 * Collapsible mode: Accordion-style collapsible section (like HowToPlay)
 */
export default function Section({
  id,
  title,
  subtitle,
  headerRight,
  className,
  icon,
  collapsible = false,
  defaultOpen = false,
  children,
  onToggle,
  infoTitle,
  infoDescription,
  showInfoIcon,
}: SectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);
  const [isInfoOpen, setIsInfoOpen] = useState(false);

  // Collapsible mode (like HowToPlay)
  if (collapsible && id) {
    const handleToggle = () => {
      const newState = !isOpen;
      setIsOpen(newState);
      onToggle?.(newState);
    };

    const iconElement = typeof icon === 'string' ? (
      <span className="text-2xl">{icon}</span>
    ) : icon;

    return (
      <div className={`border border-slate-200 rounded-xl overflow-hidden bg-white shadow-sm ${className ?? ""}`}>
        <button
          onClick={handleToggle}
          className="w-full px-6 py-4 text-left bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-200 transition-colors border-b border-slate-200"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {iconElement}
              <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            </div>
            <svg
              className={`w-5 h-5 text-slate-600 transition-transform ${isOpen ? 'rotate-180' : ''}`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        
        {isOpen && (
          <div className="px-6 py-4 text-slate-700">
            {children}
          </div>
        )}
      </div>
    );
  }

  // Simple mode (like Home page)
  return (
    <>
      <section className={className ?? ""}>
        <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-medium text-slate-900 uppercase tracking-wide" style={{ fontFamily: '"Gramatika", sans-serif', fontWeight: 700 }}>
            {title}
          </h2>
          {(showInfoIcon !== false && (infoTitle && infoDescription || showInfoIcon === true)) && (
            <div 
              className={`w-4 h-4 rounded-full border border-slate-400 flex items-center justify-center ${infoTitle && infoDescription ? 'hover:bg-slate-50 transition-colors cursor-pointer' : ''}`}
              onClick={infoTitle && infoDescription ? () => setIsInfoOpen(true) : undefined}
              role={infoTitle && infoDescription ? 'button' : undefined}
              aria-label={infoTitle && infoDescription ? `Information about ${title}` : undefined}
            >
              <span className="text-[10px] text-slate-500 font-bold">i</span>
            </div>
          )}
        </div>
          {headerRight && <div>{headerRight}</div>}
        </div>
        {subtitle && (
          <div className="mt-1 text-sm text-slate-500">{subtitle}</div>
        )}
        <div className="mt-3">{children}</div>
      </section>
      
      {infoTitle && infoDescription && (
        <InfoSheet
          isOpen={isInfoOpen}
          onClose={() => setIsInfoOpen(false)}
          title={infoTitle}
          description={infoDescription}
        />
      )}
    </>
  );
}


