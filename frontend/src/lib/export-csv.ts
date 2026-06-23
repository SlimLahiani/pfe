export interface ExportColumn {
  header: string;
  key: string;
  transform?: (value: any, item: any) => any;
}

export function exportToCSV(data: any[], columns: ExportColumn[], filename: string) {
  // 1. Create CSV header row
  const headers = columns.map((col) => `"${col.header.replace(/"/g, '""')}"`).join(',');

  // 2. Map data rows
  const rows = data.map((item) => {
    return columns
      .map((col) => {
        // Access value, supporting nested keys like 'client.companyName'
        let value = item;
        const keys = col.key.split('.');
        for (const k of keys) {
          if (value === null || value === undefined) {
            value = '';
            break;
          }
          value = value[k];
        }

        // Apply transform if exists
        if (col.transform) {
          value = col.transform(value, item);
        }

        // Format for CSV
        if (value === null || value === undefined) {
          return '""';
        }
        const stringValue = String(value).replace(/"/g, '""');
        return `"${stringValue}"`;
      })
      .join(',');
  });

  // 3. Combine header and rows with UTF-8 BOM for Excel compatibility
  const csvContent = '\uFEFF' + [headers, ...rows].join('\n');

  // 4. Download file
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
