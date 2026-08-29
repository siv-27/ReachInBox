import React, { type ChangeEvent } from 'react';
import { Upload } from 'lucide-react';

export interface FileInputProps {
  label?: string;
  accept?: string;
  fileDetails?: string | null;
  validCount?: number;
  invalidCount?: number;
  onChange: (e: ChangeEvent<HTMLInputElement>) => void;
}

export const FileInput: React.FC<FileInputProps> = ({
  label = 'Recipient Emails File (.csv, .txt)',
  accept = '.csv,.txt',
  fileDetails,
  validCount,
  invalidCount,
  onChange,
}) => {
  return (
    <div className="flex flex-col gap-1.5 w-full text-left">
      {label && <label className="text-sm font-bold text-[#292524]">{label}</label>}
      <div className="border border-dashed border-[#D6CEC5] bg-[#FFFCF8] hover:bg-[#FFF7ED] rounded-lg p-5 text-center transition-all cursor-pointer relative">
        <input
          type="file"
          accept={accept}
          onChange={onChange}
          className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
        />
        <div className="space-y-1">
          <Upload className="w-8 h-8 text-[#A8A29E] mx-auto" />
          <p className="text-sm font-bold text-[#292524]">
            {fileDetails ? fileDetails : 'Click to select CSV/TXT file'}
          </p>
          <p className="text-xs text-[#78716C]">
            Upload lists containing email addresses (one per line or separated by comma)
          </p>
        </div>
      </div>

      {validCount !== undefined && validCount > 0 && (
        <div className="bg-[#FFF7ED] border border-[#FFEDD5] p-3 rounded-lg flex justify-between text-xs text-[#78716C]">
          <span className="font-semibold text-[#7A8450]">
            {validCount} email addresses parsed successfully.
          </span>
          {invalidCount !== undefined && invalidCount > 0 && (
            <span className="font-semibold text-[#B91C1C]">
              {invalidCount} invalid lines skipped.
            </span>
          )}
        </div>
      )}
    </div>
  );
};
