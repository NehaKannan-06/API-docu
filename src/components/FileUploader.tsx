import React, { useRef, useState } from 'react';
import { FileCode, FileText, FolderUp, Globe, Loader2, X } from 'lucide-react';
import { importFromGitHubUrl, type SupportedLanguage } from '../services/api.ts';

interface FileUploaderProps {
  selectedFile: { name: string; size: number } | null;
  onFileLoaded: (content: string, filename: string, detectedLanguage: SupportedLanguage) => void;
  onClearFile: () => void;
  onError: (message: string) => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

const ALLOWED_EXTENSIONS: Record<string, SupportedLanguage> = {
  '.py': 'python',
  '.js': 'javascript',
  '.ts': 'typescript',
  '.java': 'java',
  '.json': 'json',
  '.yaml': 'yaml',
  '.yml': 'yaml',
};

const MAX_FILE_BYTES = 500 * 1024;

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  if (kb < 1024) return `${kb.toFixed(1)} KB`;
  return `${(kb / 1024).toFixed(2)} MB`;
}

export const FileUploader: React.FC<FileUploaderProps> = ({
  selectedFile,
  onFileLoaded,
  onClearFile,
  onError,
  onDownloadPdf,
  isDownloadingPdf = false,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [githubUrl, setGithubUrl] = useState('');
  const [isImportingGithub, setIsImportingGithub] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = (file: File) => {
    const lowerName = file.name.toLowerCase();
    const matchedExt = Object.keys(ALLOWED_EXTENSIONS).find((ext) => lowerName.endsWith(ext));

    if (!matchedExt) {
      onError(
        `Unsupported file type ("${file.name}"). Supported formats: .py, .js, .ts, .java, .json, .yaml, .yml.`
      );
      return;
    }

    if (file.size > MAX_FILE_BYTES) {
      onError(
        `File "${file.name}" (${formatFileSize(file.size)}) exceeds the 500 KB maximum file size limit.`
      );
      return;
    }

    if (file.size === 0) {
      onError(`File "${file.name}" is empty. Please select a file containing API routes.`);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const text = String(e.target?.result || '');
      onFileLoaded(text, file.name, ALLOWED_EXTENSIONS[matchedExt]);
    };
    reader.onerror = () => {
      onError(`Could not read file "${file.name}". Please try again.`);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) processFile(file);
  };

  const handleGitHubImport = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!githubUrl.trim()) {
      onError('Please enter a GitHub file URL to import.');
      return;
    }
    setIsImportingGithub(true);
    try {
      const { filename, sourceCode } = await importFromGitHubUrl(githubUrl.trim());
      const lower = filename.toLowerCase();
      const matchedExt =
        Object.keys(ALLOWED_EXTENSIONS).find((ext) => lower.endsWith(ext)) || '.py';
      onFileLoaded(sourceCode, filename, ALLOWED_EXTENSIONS[matchedExt]);
      setGithubUrl('');
    } catch (err: any) {
      onError(err?.message || 'Failed to import file from GitHub.');
    } finally {
      setIsImportingGithub(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Drag & Drop File Zone */}
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setIsDragging(true);
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInputRef.current?.click();
          }
        }}
        className={`p-5 rounded-xl border-2 border-dashed transition-colors cursor-pointer bg-white flex flex-col sm:flex-row items-center justify-between gap-4 ${
          isDragging
            ? 'border-[#E53935] bg-[#E53935]/[0.03]'
            : 'border-[#E5E7EB] hover:border-[#E53935]/60'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".py,.js,.ts,.java,.json,.yaml,.yml"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = '';
          }}
          className="hidden"
        />

        <div className="flex items-center gap-3.5 text-center sm:text-left">
          <div className="w-10 h-10 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] flex items-center justify-center shrink-0 text-[#E53935]">
            <FolderUp className="w-5 h-5" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#1F2937]">
              Drag & drop an API file here, or <span className="text-[#E53935] underline">browse</span>
            </p>
            <p className="text-xs text-[#6B7280] mt-0.5">
              Supported: .py · .js · .ts · .java · .json · .yaml · .yml (up to 500 KB)
            </p>
          </div>
        </div>

        {selectedFile && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex items-center gap-2.5 px-3 py-1.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg text-xs"
          >
            <FileCode className="w-4 h-4 text-[#16A34A] shrink-0" />
            <div className="text-left">
              <span className="font-semibold text-[#1F2937] block truncate max-w-[180px]">
                {selectedFile.name}
              </span>
              <span className="text-[#6B7280] tabular-nums">
                {formatFileSize(selectedFile.size)}
              </span>
            </div>
            <button
              type="button"
              onClick={onClearFile}
              title="Remove uploaded file"
              className="p-1 text-[#6B7280] hover:text-[#DC2626] rounded cursor-pointer"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>

      {/* GitHub URL Import */}
      <form
        onSubmit={handleGitHubImport}
        className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 bg-white border border-[#E5E7EB] rounded-xl p-3"
      >
        <div className="flex items-center gap-2 flex-1">
          <Globe className="w-4 h-4 text-[#6B7280] shrink-0 ml-1" />
          <input
            type="url"
            value={githubUrl}
            onChange={(e) => setGithubUrl(e.target.value)}
            placeholder="Or import from GitHub URL (e.g. https://github.com/owner/repo/blob/main/app.py)"
            className="w-full text-xs text-[#1F2937] placeholder:text-[#6B7280] bg-transparent focus:outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={isImportingGithub || !githubUrl.trim()}
          className="px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
        >
          {isImportingGithub ? 'Importing...' : 'Import from GitHub'}
        </button>
      </form>

      {/* Starting Quick Action for PDF Export */}
      {onDownloadPdf && (
        <div className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl text-xs">
          <div className="flex items-center gap-2 text-[#6B7280]">
            <FileText className="w-4 h-4 text-[#E53935] shrink-0" />
            <span>
              <strong className="text-[#1F2937] font-semibold">Instant PDF Export:</strong> Generate and download formatted documentation in PDF with all routes, parameters, and examples clearly mentioned.
            </span>
          </div>
          <button
            type="button"
            onClick={onDownloadPdf}
            disabled={isDownloadingPdf}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 font-semibold text-xs text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-white border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-50"
          >
            {isDownloadingPdf ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E53935]" />
                <span>Preparing PDF...</span>
              </>
            ) : (
              <>
                <FileText className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Download PDF</span>
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
};
