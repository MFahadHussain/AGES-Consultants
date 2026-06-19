import React from 'react';

interface ReportHeaderProps {
  title: string;
  subtitle?: string;
  dateRange?: { from: string; to: string };
  fiscalYear?: string;
  generatedBy?: string;
}

export function ReportHeader({
  title,
  subtitle,
  dateRange,
  fiscalYear,
  generatedBy,
}: ReportHeaderProps) {
  return (
    <div className="report-header">
      <div className="flex items-start justify-between mb-4 pb-3 border-b-2 border-gray-800">
        <div className="flex items-center gap-3">
          <img
            src="/images/ages-logo.png"
            alt="AGES Consultants"
            className="h-12 w-auto object-contain print:h-10"
          />
          <div className="text-left">
            <h1 className="text-lg font-bold text-gray-900">AGES Consultants</h1>
            <p className="text-xs text-gray-600">
              Accounting & Financial Management System
            </p>
          </div>
        </div>
        <div className="text-right">
          <h2 className="text-xl font-bold text-gray-900">{title}</h2>
          {subtitle && <p className="text-sm text-gray-600">{subtitle}</p>}
          {fiscalYear && <p className="text-sm text-gray-600">FY: {fiscalYear}</p>}
          {dateRange && (
            <p className="text-sm text-gray-600 font-mono">
              {dateRange.from} — {dateRange.to}
            </p>
          )}
        </div>
      </div>
      <div className="flex justify-between text-xs text-gray-400 mb-4">
        <span>Generated: {new Date().toLocaleString('en-PK')}</span>
        {generatedBy && <span>By: {generatedBy}</span>}
        <span>AGES Consultants ERP v1.0.0</span>
      </div>
    </div>
  );
}
