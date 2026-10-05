import React, { useState } from 'react';
import {
  AlertCircle,
  Check,
  Code2,
  Copy,
  Edit3,
  FileCode,
  FileDown,
  FileText,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { CodeEditor } from '../components/CodeEditor.tsx';
import { FileUploader } from '../components/FileUploader.tsx';
import { GenerateButton } from '../components/GenerateButton.tsx';
import { EndpointSidebar } from '../components/EndpointSidebar.tsx';
import { EndpointDocumentation } from '../components/EndpointDocumentation.tsx';
import { QualityScore } from '../components/QualityScore.tsx';
import { ExportButtons } from '../components/ExportButtons.tsx';
import { generateDocumentationPdf, downloadDocumentationPdfWithHtml2Canvas } from '../services/pdf_service.ts';
import {
  generateDocumentationApi,
  SAMPLE_API_PRESETS,
  type DocumentationStyle,
  type GenerateResponse,
  type SampleApiPreset,
  type SupportedLanguage,
} from '../services/api.ts';

interface GeneratorProps {
  sourceCode: string;
  onSourceCodeChange: (code: string) => void;
  language: SupportedLanguage;
  onLanguageChange: (lang: SupportedLanguage) => void;
  selectedFile: { name: string; size: number } | null;
  onFileLoaded: (content: string, filename: string, lang: SupportedLanguage) => void;
  onClearFile: () => void;
  style: DocumentationStyle;
  onStyleChange: (style: DocumentationStyle) => void;
  isGenerating: boolean;
  activeStepIndex: number;
  error: string | null;
  onError: (msg: string | null) => void;
  result: GenerateResponse | null;
  onGenerate: (overrideStyle?: DocumentationStyle) => void;
  onTryPrimaryExample: () => void;
  onSelectPreset: (preset: SampleApiPreset) => void;
  activeViewTab: 'documentation' | 'code' | 'openapi';
  onViewTabChange: (tab: 'documentation' | 'code' | 'openapi') => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export const Generator: React.FC<GeneratorProps> = ({
  sourceCode,
  onSourceCodeChange,
  language,
  onLanguageChange,
  selectedFile,
  onFileLoaded,
  onClearFile,
  style,
  onStyleChange,
  isGenerating,
  activeStepIndex,
  error,
  onError,
  result,
  onGenerate,
  onTryPrimaryExample,
  onSelectPreset,
  activeViewTab,
  onViewTabChange,
  onDownloadPdf,
  isDownloadingPdf: parentIsDownloadingPdf = false,
}) => {
  const [selectedEndpointId, setSelectedEndpointId] = useState<string>('');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isEditingInput, setIsEditingInput] = useState<boolean>(false);
  const [openApiFormat, setOpenApiFormat] = useState<'yaml' | 'json'>('yaml');
  const [copiedOpenApi, setCopiedOpenApi] = useState(false);
  const [internalDownloadingPdf, setInternalDownloadingPdf] = useState(false);

  const isDownloadingPdf = internalDownloadingPdf || parentIsDownloadingPdf;
  const endpoints = result?.documentation.endpoints || [];
  const activeEndpoint =
    endpoints.find((ep) => ep.id === selectedEndpointId) || endpoints[0] || null;

  const showInputPanel = !result || isEditingInput;

  const handleCopyOpenApi = async () => {
    if (!result) return;
    const text =
      openApiFormat === 'yaml' ? result.exports.openApiYaml : result.exports.openApiJson;
    await navigator.clipboard.writeText(text);
    setCopiedOpenApi(true);
    setTimeout(() => setCopiedOpenApi(false), 1800);
  };

  const handleUniversalDownloadPdf = async () => {
    if (onDownloadPdf) {
      onDownloadPdf();
      return;
    }

    try {
      setInternalDownloadingPdf(true);
      if (result) {
        if (activeViewTab === 'documentation' && !isEditingInput) {
          await downloadDocumentationPdfWithHtml2Canvas('documentation-view-container', result.documentation);
        } else {
          generateDocumentationPdf(result.documentation);
        }
      } else {
        if (!sourceCode.trim()) {
          onError('Please paste or upload API source code before generating PDF documentation.');
          return;
        }
        const response = await generateDocumentationApi({
          sourceCode,
          language,
          filename: selectedFile?.name,
          style,
        });
        generateDocumentationPdf(response.documentation);
      }
    } catch (err: any) {
      console.error('PDF export failed:', err);
      onError(err?.message || 'Failed to generate PDF documentation.');
    } finally {
      setInternalDownloadingPdf(false);
    }
  };

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Page Title & Action Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#1F2937]">
            {result && !isEditingInput
              ? result.documentation.projectName
              : 'API Documentation Generator'}
          </h1>
          <p className="text-xs sm:text-sm text-[#6B7280]">
            {result && !isEditingInput
              ? result.documentation.description
              : 'Step 1: Paste your API source code, upload a file, or load a sample API to generate verified documentation.'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* Universal Download Document as PDF button - ALWAYS visible right from the start */}
          <button
            id="download-pdf-button"
            type="button"
            onClick={handleUniversalDownloadPdf}
            disabled={isDownloadingPdf || isGenerating}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-50"
            title="Download full API documentation in formatted PDF"
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

          {/* Primary Try Example API button */}
          <button
            type="button"
            onClick={() => {
              onTryPrimaryExample();
              setIsEditingInput(true);
            }}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#E53935] bg-white hover:bg-[#E53935]/[0.04] border border-[#E53935]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap"
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>Try Example API</span>
          </button>

          {/* Additional Sample API Presets for Multi-Language Demo */}
          <select
            aria-label="Load additional API sample"
            value=""
            onChange={(e) => {
              const preset = SAMPLE_API_PRESETS.find((p) => p.id === e.target.value);
              if (preset) {
                onSelectPreset(preset);
                setIsEditingInput(true);
              }
            }}
            className="text-xs font-medium text-[#1F2937] bg-white border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:border-[#E53935] cursor-pointer"
          >
            <option value="" disabled>
              More Sample APIs...
            </option>
            {SAMPLE_API_PRESETS.map((preset) => (
              <option key={preset.id} value={preset.id}>
                {preset.title} ({preset.language.toUpperCase()})
              </option>
            ))}
          </select>

          {result && (
            <button
              type="button"
              onClick={() => setIsEditingInput(!isEditingInput)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#1F2937] bg-white hover:bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer whitespace-nowrap"
            >
              <Edit3 className="w-3.5 h-3.5 text-[#6B7280]" />
              <span>{isEditingInput ? 'Hide Input Editor' : 'Edit & Regenerate'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Error Message Banner */}
      {error && (
        <div
          role="alert"
          className="p-4 bg-red-50 border border-[#DC2626]/30 rounded-xl flex items-start justify-between gap-3"
        >
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-[#DC2626]">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold">Analysis Error: </span>
              <span>{error}</span>
            </div>
          </div>
          <button
            type="button"
            onClick={() => onError(null)}
            className="text-xs font-semibold text-[#DC2626] hover:underline shrink-0 cursor-pointer"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* STEP 1 — INPUT WORKSPACE */}
      {showInputPanel && (
        <section className="space-y-5 bg-white border border-[#E5E7EB] rounded-xl p-5 sm:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-semibold text-[#1F2937]">
                Step 1 — Provide API Source Code or Specification
              </h2>
              <p className="text-xs text-[#6B7280]">
                Paste source code below, drag and drop a source file, or import from GitHub.
              </p>
            </div>
            <div className="text-xs text-[#6B7280]">
              Supports Python · JavaScript · TypeScript · Java · JSON · YAML
            </div>
          </div>

          <CodeEditor
            value={sourceCode}
            onChange={(val) => {
              onSourceCodeChange(val);
              if (error) onError(null);
            }}
            language={language}
            onLanguageChange={onLanguageChange}
            placeholder="Paste your API code here..."
          />

          <FileUploader
            selectedFile={selectedFile}
            onFileLoaded={(content, filename, detectedLang) => {
              onFileLoaded(content, filename, detectedLang);
              if (error) onError(null);
            }}
            onClearFile={onClearFile}
            onError={(msg) => onError(msg)}
            onDownloadPdf={handleUniversalDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
          />

          <GenerateButton
            onClick={() => {
              onGenerate(style);
              setIsEditingInput(false);
            }}
            isLoading={isGenerating}
            activeStepIndex={activeStepIndex}
            onDownloadPdf={handleUniversalDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
          />
        </section>
      )}

      {!showInputPanel && isGenerating && (
        <GenerateButton
          onClick={() => onGenerate(style)}
          isLoading={isGenerating}
          activeStepIndex={activeStepIndex}
          onDownloadPdf={handleUniversalDownloadPdf}
          isDownloadingPdf={isDownloadingPdf}
        />
      )}

      {/* STEP 2 — DOCUMENTATION VIEWER */}
      {result && (
        <section className="space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white border border-[#E5E7EB] rounded-xl p-4">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#6B7280]">
              <span className="font-semibold text-[#1F2937]">{result.documentation.framework}</span>
              <span aria-hidden="true">·</span>
              <span className="uppercase font-mono">{result.documentation.language}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums">
                {result.documentation.endpoints.length}{' '}
                {result.documentation.endpoints.length === 1 ? 'endpoint' : 'endpoints'} detected
              </span>
              <span aria-hidden="true">·</span>
              <span>Style: {result.documentation.style}</span>
            </div>

            <div className="flex items-center gap-1 p-1 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg self-start sm:self-auto">
              <button
                type="button"
                onClick={() => onViewTabChange('documentation')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeViewTab === 'documentation'
                    ? 'bg-white text-[#1F2937] shadow-2xs border border-[#E5E7EB]'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <FileText className="w-3.5 h-3.5 text-[#E53935]" />
                <span>Documentation</span>
              </button>

              <button
                type="button"
                onClick={() => onViewTabChange('code')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeViewTab === 'code'
                    ? 'bg-white text-[#1F2937] shadow-2xs border border-[#E5E7EB]'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <Code2 className="w-3.5 h-3.5" />
                <span>Code</span>
              </button>

              <button
                type="button"
                onClick={() => onViewTabChange('openapi')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                  activeViewTab === 'openapi'
                    ? 'bg-white text-[#1F2937] shadow-2xs border border-[#E5E7EB]'
                    : 'text-[#6B7280] hover:text-[#1F2937]'
                }`}
              >
                <FileCode className="w-3.5 h-3.5" />
                <span>OpenAPI Spec</span>
              </button>
            </div>
          </div>

          <QualityScore
            score={result.documentation.qualityScore}
            audit={result.documentation.validationAudit}
          />

          <ExportButtons
            documentation={result.documentation}
            markdown={result.exports.markdown}
            openApiYaml={result.exports.openApiYaml}
            openApiJson={result.exports.openApiJson}
            selectedStyle={style}
            onStyleChange={onStyleChange}
            onRegenerate={(chosenStyle) => onGenerate(chosenStyle)}
            isRegenerating={isGenerating}
          />

          {activeViewTab === 'documentation' && (
            <div id="documentation-view-container" className="flex flex-col lg:flex-row items-start gap-6 bg-white p-2 rounded-xl">
              <EndpointSidebar
                endpoints={endpoints}
                selectedEndpointId={activeEndpoint?.id || ''}
                onSelectEndpoint={(id) => setSelectedEndpointId(id)}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              />

              <div className="flex-1 w-full min-w-0">
                {activeEndpoint ? (
                  <EndpointDocumentation
                    endpoint={activeEndpoint}
                    onViewSourceCode={() => onViewTabChange('code')}
                  />
                ) : (
                  <div className="bg-white border border-[#E5E7EB] rounded-xl p-12 text-center space-y-2">
                    <p className="text-sm font-semibold text-[#1F2937]">No Endpoint Selected</p>
                    <p className="text-xs text-[#6B7280]">
                      Select an endpoint from the left navigation panel to view full documentation.
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {activeViewTab === 'code' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#E53935]" />
                  <span className="text-xs font-bold text-[#1F2937]">SOURCE CODE REFERENCE</span>
                </div>
                <span className="text-xs font-mono text-[#6B7280]">
                  {selectedFile?.name || 'source_code'} ({language.toUpperCase()})
                </span>
              </div>
              <pre className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg font-mono text-xs text-[#1F2937] overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">
                <code>{sourceCode}</code>
              </pre>
            </div>
          )}

          {activeViewTab === 'openapi' && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <FileCode className="w-4 h-4 text-[#E53935]" />
                  <span className="text-xs font-bold text-[#1F2937]">
                    OPENAPI 3.0.3 SPECIFICATION
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center bg-[#F8F9FA] border border-[#E5E7EB] rounded-md p-0.5">
                    <button
                      type="button"
                      onClick={() => setOpenApiFormat('yaml')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded ${
                        openApiFormat === 'yaml'
                          ? 'bg-white text-[#1F2937] shadow-2xs'
                          : 'text-[#6B7280]'
                      }`}
                    >
                      YAML
                    </button>
                    <button
                      type="button"
                      onClick={() => setOpenApiFormat('json')}
                      className={`px-2.5 py-1 text-xs font-semibold rounded ${
                        openApiFormat === 'json'
                          ? 'bg-white text-[#1F2937] shadow-2xs'
                          : 'text-[#6B7280]'
                      }`}
                    >
                      JSON
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleCopyOpenApi}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-lg transition-colors cursor-pointer"
                  >
                    {copiedOpenApi ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                        <span className="text-[#16A34A]">Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                        <span>Copy Spec</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              <pre className="p-4 bg-[#F8F9FA] border border-[#E5E7EB] rounded-lg font-mono text-xs text-[#1F2937] overflow-x-auto leading-relaxed max-h-[600px] overflow-y-auto">
                <code>
                  {openApiFormat === 'yaml' ? result.exports.openApiYaml : result.exports.openApiJson}
                </code>
              </pre>
            </div>
          )}
        </section>
      )}
    </div>
  );
};
