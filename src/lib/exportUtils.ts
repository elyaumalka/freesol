// Export utilities for admin pages
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Helper function to reverse Hebrew text for PDF (jsPDF doesn't support RTL natively)
function reverseHebrewText(text: string): string {
  // Check if string contains Hebrew characters
  if (/[\u0590-\u05FF]/.test(text)) {
    // Reverse the entire string for Hebrew
    return text.split('').reverse().join('');
  }
  return text;
}

export function exportToCSV<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[]
) {
  if (!data || data.length === 0) {
    return;
  }

  // Create CSV header
  const header = columns.map(col => col.label).join(',');
  
  // Create CSV rows
  const rows = data.map(item => 
    columns.map(col => {
      const value = item[col.key];
      // Handle different value types
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value);
      // Escape commas and quotes
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    }).join(',')
  );

  // Combine header and rows
  const csv = [header, ...rows].join('\n');
  
  // Add BOM for Hebrew support
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
  
  // Create download link
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToJSON<T>(data: T[], filename: string) {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.json`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

export function exportToPDF<T extends Record<string, unknown>>(
  data: T[],
  filename: string,
  columns: { key: keyof T; label: string }[],
  title?: string
) {
  if (!data || data.length === 0) {
    return;
  }

  // Create HTML table for PDF generation
  const tableHtml = createHTMLTable(data, columns, title, filename);
  
  // Open print window with the table
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: download as HTML file
    const blob = new Blob([tableHtml], { type: 'text/html;charset=utf-8' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}_${new Date().toISOString().split('T')[0]}.html`;
    link.click();
    return;
  }

  printWindow.document.write(tableHtml);
  printWindow.document.close();
  
  // Wait for content to load then trigger print
  printWindow.onload = () => {
    printWindow.print();
  };
}

function createHTMLTable<T extends Record<string, unknown>>(
  data: T[],
  columns: { key: keyof T; label: string }[],
  title?: string,
  filename?: string
): string {
  const rows = data.map(item =>
    columns.map(col => {
      const value = item[col.key];
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'כן' : 'לא';
      if (typeof value === 'object') return JSON.stringify(value);
      return String(value);
    })
  );

  const tableRows = rows.map(row => 
    `<tr>${row.map(cell => `<td style="border: 1px solid #ddd; padding: 8px; text-align: center;">${cell}</td>`).join('')}</tr>`
  ).join('');

  const headerCells = columns.map(col => 
    `<th style="border: 1px solid #742551; padding: 12px; text-align: center; background-color: #742551; color: white; font-weight: bold;">${col.label}</th>`
  ).join('');

  return `
    <!DOCTYPE html>
    <html lang="he" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${title || filename || 'Export'}</title>
      <style>
        @import url('https://fonts.googleapis.com/css2?family=Heebo:wght@400;700&display=swap');
        
        * {
          font-family: 'Heebo', Arial, sans-serif;
        }
        
        body {
          direction: rtl;
          text-align: right;
          padding: 20px;
          background: white;
        }
        
        h1 {
          text-align: center;
          color: #742551;
          margin-bottom: 20px;
        }
        
        table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 20px;
        }
        
        tr:nth-child(even) {
          background-color: #f7f7f7;
        }
        
        @media print {
          body {
            padding: 0;
          }
          
          @page {
            size: A4 landscape;
            margin: 1cm;
          }
        }
      </style>
    </head>
    <body>
      <h1>${title || filename || 'Export'}</h1>
      <table>
        <thead>
          <tr>${headerCells}</tr>
        </thead>
        <tbody>
          ${tableRows}
        </tbody>
      </table>
      <script>
        // Auto-close after print
        window.onafterprint = function() {
          window.close();
        };
      </script>
    </body>
    </html>
  `;
}
