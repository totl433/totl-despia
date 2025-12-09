import React from 'react';

export interface PageHeaderProps {
  title: string;
  as?: 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6';
  className?: string;
}

/**
 * Shared PageHeader component for consistent styling across all pages
 * Uses Video Bold font, text-2xl, uppercase, black
 */
export const PageHeader = React.memo(function PageHeader({
  title,
  as: Component = 'h1',
  className = '',
}: PageHeaderProps) {
  const baseClasses = 'text-2xl font-medium text-slate-900 uppercase tracking-wide';
  const combinedClasses = `${baseClasses} ${className}`.trim();
  
  return (
    <Component 
      className={combinedClasses}
      style={{ fontFamily: '"video", serif', fontWeight: 700 }}
    >
      {title}
    </Component>
  );
});

