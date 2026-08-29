import { type ReactNode } from 'react';

export interface Column<T> {
  key: string;
  header: string;
  render?: (item: T) => ReactNode;
}

export interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  isLoading?: boolean;
  emptyText?: string;
}

export function Table<T>({
  columns,
  data,
  keyExtractor,
  isLoading = false,
  emptyText = 'No records available.',
}: TableProps<T>) {
  if (isLoading) {
    return (
      <div className="py-12 text-center text-sm text-[#A8A29E] bg-white border border-[#E7E0D8] rounded-lg">
        Loading outreach logs...
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="py-12 text-center text-sm text-[#A8A29E] border border-dashed border-[#E7E0D8] rounded-lg bg-white">
        {emptyText}
      </div>
    );
  }

  return (
    <div className="overflow-x-auto border border-[#E7E0D8] rounded-lg bg-white">
      <table className="min-w-full divide-y divide-[#E7E0D8] text-sm text-left">
        <thead className="bg-[#FFFCF8]">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                className="px-4 py-3 text-left text-xs font-bold text-[#78716C] uppercase tracking-wider"
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-[#E7E0D8] bg-white">
          {data.map((item) => (
            <tr key={keyExtractor(item)} className="hover:bg-[#FFF7ED] transition-colors">
              {columns.map((col) => (
                <td key={col.key} className="px-4 py-3">
                  {col.render ? col.render(item) : (item as any)[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
