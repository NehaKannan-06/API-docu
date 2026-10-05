import React from 'react';
import { Check, FileText, Loader2, Play } from 'lucide-react';

export const PIPELINE_STEPS = [
  'Detecting endpoints',
  'Extracting parameters',
  'Understanding request/response schemas',
  'Generating descriptions',
  'Validating documentation',
];

interface GenerateButtonProps {
  onClick: () => void;
  isLoading: boolean;
  activeStepIndex: number;
  disabled?: boolean;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export const GenerateButton: React.FC<GenerateButtonProps> = ({
  onClick,
  isLoading,
  activeStepIndex,
  disabled = false,
  onDownloadPdf,
  isDownloadingPdf = false,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
        <div className="text-xs text-[#6B7280]">
          Extracts technical route facts first, generates structured descriptions via Gemini AI, and validates every parameter against your source code.
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isLoading || isDownloadingPdf || disabled}
              className="inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-xl transition-colors shadow-2xs disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
              title="Download API documentation in formatted PDF"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-[#E53935]" />
                  <span>Preparing PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-4 h-4 text-[#E53935]" />
                  <span>Download PDF</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onClick}
            disabled={isLoading || isDownloadingPdf || disabled}
            className="inline-flex items-center justify-center gap-2.5 px-6 py-3 text-sm font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-xl transition-colors shadow-xs disabled:opacity-50 cursor-pointer whitespace-nowrap shrink-0"
          >
            {isLoading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Analyzing source code...</span>
              </>
            ) : (
              <>
                <Play className="w-4 h-4 fill-current" />
                <span>Generate Documentation</span>
              </>
            )}
          </button>
        </div>
      </div>

      {isLoading && (
        <div
          role="status"
          aria-live="polite"
          className="p-5 bg-white border border-[#E5E7EB] rounded-xl space-y-3"
        >
          <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-2.5">
            <span className="text-xs font-semibold text-[#1F2937]">
              Analyzing source code...
            </span>
            <span className="text-xs font-mono tabular-nums text-[#6B7280]">
              Step {Math.min(activeStepIndex + 1, PIPELINE_STEPS.length)} of {PIPELINE_STEPS.length}
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5 pt-1">
            {PIPELINE_STEPS.map((stepLabel, idx) => {
              const isCompleted = idx < activeStepIndex;
              const isCurrent = idx === activeStepIndex;

              return (
                <div
                  key={stepLabel}
                  className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs transition-colors ${
                    isCompleted
                      ? 'bg-[#16A34A]/[0.04] border-[#16A34A]/25 text-[#1F2937]'
                      : isCurrent
                      ? 'bg-[#E53935]/[0.04] border-[#E53935]/40 text-[#1F2937] font-medium'
                      : 'bg-[#F8F9FA] border-[#E5E7EB] text-[#6B7280]'
                  }`}
                >
                  {isCompleted ? (
                    <Check className="w-4 h-4 text-[#16A34A] shrink-0" />
                  ) : isCurrent ? (
                    <Loader2 className="w-4 h-4 text-[#E53935] animate-spin shrink-0" />
                  ) : (
                    <span className="w-4 h-4 rounded-full border border-[#E5E7EB] shrink-0" />
                  )}
                  <span className="leading-snug">{stepLabel}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
