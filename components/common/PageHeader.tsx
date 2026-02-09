import React from 'react';

interface PageHeaderProps {
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export const PageHeader: React.FC<PageHeaderProps> = ({ title, subtitle, actionButton }) => {
  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">{title}</h1>
          {subtitle && (
            <p className="text-sm text-gray-600 mt-1">{subtitle}</p>
          )}
        </div>
        {actionButton && <div>{actionButton}</div>}
      </div>
    </div>
  );
};