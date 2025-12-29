import React from 'react';
import { NotificationToggle } from './NotificationToggle';

export interface NotificationOption {
  id: string;
  label: string;
  description?: string;
  enabled: boolean;
  disabled?: boolean;
}

export interface NotificationSectionProps {
  title: string;
  description?: string;
  options: NotificationOption[];
  onToggle: (id: string, enabled: boolean) => void;
}

export const NotificationSection = React.memo(function NotificationSection({
  title,
  description,
  options,
  onToggle,
}: NotificationSectionProps) {
  return (
    <div className="bg-white rounded-xl shadow-md p-6">
      <h3 className="text-lg font-bold text-slate-800 mb-1">{title}</h3>
      {description && (
        <p className="text-sm text-slate-600 mb-4">{description}</p>
      )}
      <div className="space-y-0 border-t border-slate-200">
        {options.map((option) => (
          <NotificationToggle
            key={option.id}
            id={option.id}
            label={option.label}
            description={option.description}
            enabled={option.enabled}
            onChange={(enabled) => onToggle(option.id, enabled)}
            disabled={option.disabled}
          />
        ))}
      </div>
    </div>
  );
});

