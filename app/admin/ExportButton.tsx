'use client';

import { useState } from 'react';

export function ExportButton() {
  const [isExporting, setIsExporting] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch('/api/admin/export-csv');

      if (!response.ok) {
        throw new Error('Export failed');
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'export.csv';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Export error:', error);
      alert('Export failed. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <button
      onClick={handleExport}
      disabled={isExporting}
      className="border border-zinc-700 bg-zinc-900 text-zinc-300 hover:bg-zinc-800 rounded-lg px-3 py-1.5 text-xs cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {isExporting ? 'Exporting…' : '↓ Export CSV'}
    </button>
  );
}