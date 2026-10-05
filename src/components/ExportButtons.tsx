import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileCode2,
  FileDown,
  FileJson,
  FileText,
  Loader2,
  RefreshCw,
} from 'lucide-react';
import type {
  DocumentationStyle,
  GeneratedDocumentation,
} from '../../backend/models/schemas.ts';
import { downloadDocumentationPdfWithHtml2Canvas } from '../services/pdf_service.ts';

interface ExportButtonsProps {
  documentation: GeneratedDocumentation;
  markdown: string;
  openApiYaml: string;
  openApiJson: string;
  selectedStyle: DocumentationStyle;
  onStyleChange: (style: DocumentationStyle) => void;
  onRegenerate: (style: DocumentationStyle) => void;
  isRegenerating: boolean;
  captureTargetId?: string;
}

const STYLES: DocumentationStyle[] = [
  'Developer Friendly',
  'Concise',
  'Detailed',
  'OpenAPI Style',
];

function triggerFileDownload(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  documentation,
  markdown,
  openApiYaml,
  selectedStyle,
  onStyleChange,
  onRegenerate,
  isRegenerating,
  captureTargetId = 'documentation-view-container',
}) => {
  const [copiedMarkdown, setCopiedMarkdown] = useState(false);
  const [isExportingPdf, setIsExportingPdf] = useState(false);
  const [exportedNotice, setExportedNotice] = useState<string | null>(null);

  const safeSlug =
    documentation.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'api-docs';

  const handleDownloadPdf = async () => {
    try {
      setIsExportingPdf(true);
      await downloadDocumentationPdfWithHtml2Canvas(captureTargetId, documentation);
      setExportedNotice('PDF downloaded');
      setTimeout(() => setExportedNotice(null), 2500);
    } catch (err: any) {
      console.error('PDF export failed:', err);
    } finally {
      setIsExportingPdf(false);
    }
  };

  const handleCopyMarkdown = async () => {
    await navigator.clipboard.writeText(markdown);
    setCopiedMarkdown(true);
    setTimeout(() => setCopiedMarkdown(false), 2000);
  };

  const handleDownloadMarkdown = () => {
    triggerFileDownload(markdown, `${safeSlug}.md`, 'text/markdown;charset=utf-8');
    setExportedNotice('Markdown downloaded');
    setTimeout(() => setExportedNotice(null), 2000);
  };

  const handleDownloadJson = () => {
    const jsonString = JSON.stringify(documentation, null, 2);
    triggerFileDownload(jsonString, `${safeSlug}.json`, 'application/json;charset=utf-8');
    setExportedNotice('JSON downloaded');
    setTimeout(() => setExportedNotice(null), 2000);
  };

  const handleExportOpenApi = () => {
    triggerFileDownload(openApiYaml, `${safeSlug}-openapi.yaml`, 'text/yaml;charset=utf-8');
    setExportedNotice('OpenAPI 3.0 YAML downloaded');
    setTimeout(() => setExportedNotice(null), 2000);
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 flex flex-col lg:flex-row items-stretch lg:items-center justify-between gap-4">
      {/* Left: Style Selector + Regenerate */}
      <div className="flex flex-wrap items-center gap-2.5">
        <label htmlFor="doc-style-select" className="text-xs font-medium text-[#6B7280]">
          Style:
        </label>
        <select
          id="doc-style-select"
          value={selectedStyle}
          disabled={isRegenerating}
          onChange={(e) => {
            const nextStyle = e.target.value as DocumentationStyle;
            onStyleChange(nextStyle);
          }}
          className="text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#E53935] cursor-pointer"
        >
          {STYLES.map((style) => (
            <option key={style} value={style}>
              {style}
            </option>
          ))}
        </select>

        <button
          type="button"
          onClick={() => onRegenerate(selectedStyle)}
          disabled={isRegenerating}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-lg transition-colors disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRegenerating ? 'animate-spin' : ''}`} />
          <span>{isRegenerating ? 'Regenerating...' : 'Regenerate'}</span>
        </button>

        {exportedNotice && (
          <span className="text-xs font-medium text-[#16A34A] flex items-center gap-1">
            <Check className="w-3.5 h-3.5" />
            {exportedNotice}
          </span>
        )}
      </div>

      {/* Right: Export Actions including PDF */}
      <div className="flex flex-wrap items-center gap-2">
        {/* PDF Download Button using jspdf + html2canvas */}
        <button
          id="download-pdf-button"
          type="button"
          onClick={handleDownloadPdf}
          disabled={isExportingPdf}
          title="Download formatted documentation as PDF using html2canvas & jsPDF"
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-50"
        >
          {isExportingPdf ? (
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

        <button
          type="button"
          onClick={handleCopyMarkdown}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          {copiedMarkdown ? (
            <>
              <Check className="w-3.5 h-3.5 text-[#16A34A]" />
              <span className="text-[#16A34A]">Copied Markdown</span>
            </>
          ) : (
            <>
              <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>Copy Markdown</span>
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleDownloadMarkdown}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <Download className="w-3.5 h-3.5 text-[#6B7280]" />
          <span>Download Markdown</span>
        </button>

        <button
          type="button"
          onClick={handleDownloadJson}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <FileJson className="w-3.5 h-3.5 text-[#6B7280]" />
          <span>Download JSON</span>
        </button>

        <button
          type="button"
          onClick={handleExportOpenApi}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
        >
          <FileCode2 className="w-3.5 h-3.5 text-[#E53935]" />
          <span>Export OpenAPI</span>
        </button>
      </div>
    </div>
  );
};

