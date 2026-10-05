import React from 'react';
import { FileText, Loader2 } from 'lucide-react';

export type ActivePage = 'home' | 'generator' | 'documentation' | 'about';

interface HeaderProps {
  activePage: ActivePage;
  hasGeneratedDocs: boolean;
  onNavigate: (page: ActivePage) => void;
  onStartGenerator: () => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  activePage,
  hasGeneratedDocs,
  onNavigate,
  onStartGenerator,
  onDownloadPdf,
  isDownloadingPdf = false,
}) => {
  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-sm border-b border-[#E5E7EB]">
      <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Zone 1: Single text element wordmark */}
        <button
          type="button"
          onClick={() => onNavigate('home')}
          className="text-lg font-bold tracking-tight text-[#1F2937] hover:text-[#E53935] transition-colors whitespace-nowrap focus-visible:outline-2 focus-visible:outline-[#E53935] rounded cursor-pointer"
        >
          DOCUAPI AI
        </button>

        {/* Zone 2: 4 clean text navigation links */}
        <nav aria-label="Main navigation" className="hidden md:flex items-center gap-8 text-sm font-medium">
          <button
            type="button"
            onClick={() => onNavigate('home')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activePage === 'home'
                ? 'text-[#E53935] border-[#E53935]'
                : 'text-[#6B7280] border-transparent hover:text-[#1F2937] hover:border-[#E5E7EB]'
            }`}
          >
            Home
          </button>
          <button
            type="button"
            onClick={() => onNavigate('generator')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activePage === 'generator'
                ? 'text-[#E53935] border-[#E53935]'
                : 'text-[#6B7280] border-transparent hover:text-[#1F2937] hover:border-[#E5E7EB]'
            }`}
          >
            Generator
          </button>
          <button
            type="button"
            onClick={() => onNavigate(hasGeneratedDocs ? 'documentation' : 'generator')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activePage === 'documentation'
                ? 'text-[#E53935] border-[#E53935]'
                : 'text-[#6B7280] border-transparent hover:text-[#1F2937] hover:border-[#E5E7EB]'
            }`}
          >
            Documentation
          </button>
          <button
            type="button"
            onClick={() => onNavigate('about')}
            className={`py-1 transition-colors whitespace-nowrap border-b-2 cursor-pointer ${
              activePage === 'about'
                ? 'text-[#E53935] border-[#E53935]'
                : 'text-[#6B7280] border-transparent hover:text-[#1F2937] hover:border-[#E5E7EB]'
            }`}
          >
            About
          </button>
        </nav>

        {/* Zone 3: Primary actions including Download PDF */}
        <div className="flex items-center gap-2.5">
          <div className="flex md:hidden items-center gap-3 mr-1 text-xs font-medium text-[#6B7280]">
            <button
              type="button"
              onClick={() => onNavigate('home')}
              className={activePage === 'home' ? 'text-[#E53935] font-semibold' : ''}
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => onNavigate(hasGeneratedDocs ? 'documentation' : 'generator')}
              className={
                activePage === 'generator' || activePage === 'documentation'
                  ? 'text-[#E53935] font-semibold'
                  : ''
              }
            >
              Docs
            </button>
            <button
              type="button"
              onClick={() => onNavigate('about')}
              className={activePage === 'about' ? 'text-[#E53935] font-semibold' : ''}
            >
              About
            </button>
          </div>

          {onDownloadPdf && (
            <button
              type="button"
              onClick={onDownloadPdf}
              disabled={isDownloadingPdf}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-lg transition-colors cursor-pointer whitespace-nowrap shadow-2xs disabled:opacity-50"
              title="Download API documentation in formatted PDF"
            >
              {isDownloadingPdf ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#E53935]" />
                  <span className="hidden sm:inline">Preparing PDF...</span>
                  <span className="sm:hidden">PDF...</span>
                </>
              ) : (
                <>
                  <FileText className="w-3.5 h-3.5 text-[#E53935]" />
                  <span className="hidden sm:inline">Download PDF</span>
                  <span className="sm:hidden">PDF</span>
                </>
              )}
            </button>
          )}

          <button
            type="button"
            onClick={onStartGenerator}
            className="px-3.5 sm:px-4 py-2 text-xs sm:text-sm font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-lg transition-colors whitespace-nowrap shrink-0 shadow-xs cursor-pointer"
          >
            Generate Documentation
          </button>
        </div>
      </div>
    </header>
  );
};
