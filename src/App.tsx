import React, { useEffect, useRef, useState } from 'react';
import { Header, type ActivePage } from './components/Header.tsx';
import { PIPELINE_STEPS } from './components/GenerateButton.tsx';
import { Home } from './pages/Home.tsx';
import { Generator } from './pages/Generator.tsx';
import { About } from './pages/About.tsx';
import { generateDocumentationPdf } from './services/pdf_service.ts';
import {
  generateDocumentationApi,
  PRIMARY_FASTAPI_EXAMPLE,
  type DocumentationStyle,
  type GenerateResponse,
  type SampleApiPreset,
  type SupportedLanguage,
} from './services/api.ts';

export function App() {
  const [activePage, setActivePage] = useState<ActivePage>('home');
  const [sourceCode, setSourceCode] = useState<string>(PRIMARY_FASTAPI_EXAMPLE);
  const [language, setLanguage] = useState<SupportedLanguage>('python');
  const [selectedFile, setSelectedFile] = useState<{ name: string; size: number } | null>({
    name: 'main.py',
    size: new Blob([PRIMARY_FASTAPI_EXAMPLE]).size,
  });
  const [style, setStyle] = useState<DocumentationStyle>('Developer Friendly');
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [activeStepIndex, setActiveStepIndex] = useState<number>(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GenerateResponse | null>(null);
  const [activeViewTab, setActiveViewTab] = useState<'documentation' | 'code' | 'openapi'>(
    'documentation'
  );
  const [isDownloadingPdf, setIsDownloadingPdf] = useState(false);

  const stepTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (stepTimerRef.current) window.clearInterval(stepTimerRef.current);
    };
  }, []);

  const handleLoadPrimaryExample = () => {
    setSourceCode(PRIMARY_FASTAPI_EXAMPLE);
    setLanguage('python');
    setSelectedFile({
      name: 'main.py',
      size: new Blob([PRIMARY_FASTAPI_EXAMPLE]).size,
    });
    setError(null);
  };

  const handleSelectPreset = (preset: SampleApiPreset) => {
    setSourceCode(preset.code);
    setLanguage(preset.language);
    setSelectedFile({
      name: preset.filename,
      size: new Blob([preset.code]).size,
    });
    setError(null);
  };

  const handleFileLoaded = (
    content: string,
    filename: string,
    detectedLang: SupportedLanguage
  ) => {
    setSourceCode(content);
    setLanguage(detectedLang);
    setSelectedFile({
      name: filename,
      size: new Blob([content]).size,
    });
    setError(null);
  };

  const handleGenerate = async (overrideStyle?: DocumentationStyle) => {
    if (!sourceCode.trim()) {
      setError('Please paste API source code or upload a file before generating documentation.');
      return;
    }

    const chosenStyle = overrideStyle || style;
    setError(null);
    setIsGenerating(true);
    setActiveStepIndex(0);

    if (stepTimerRef.current) window.clearInterval(stepTimerRef.current);
    stepTimerRef.current = window.setInterval(() => {
      setActiveStepIndex((prev) => (prev < PIPELINE_STEPS.length - 1 ? prev + 1 : prev));
    }, 320);

    try {
      const response = await generateDocumentationApi({
        sourceCode,
        language,
        filename: selectedFile?.name,
        style: chosenStyle,
      });

      setActiveStepIndex(PIPELINE_STEPS.length);
      setResult(response);
      setActiveViewTab('documentation');
      setActivePage('documentation');
    } catch (err: any) {
      setError(
        err?.message ||
          'No API endpoints were detected in this file. Please provide source code containing API routes.'
      );
    } finally {
      if (stepTimerRef.current) {
        window.clearInterval(stepTimerRef.current);
        stepTimerRef.current = null;
      }
      setIsGenerating(false);
    }
  };

  const handleDownloadPdf = async () => {
    try {
      setIsDownloadingPdf(true);
      setError(null);

      if (result) {
        generateDocumentationPdf(result.documentation);
        return;
      }

      // If docs are not generated yet, generate them first from current code!
      if (!sourceCode.trim()) {
        setError('Please paste or select API source code before downloading PDF documentation.');
        setActivePage('generator');
        return;
      }

      const response = await generateDocumentationApi({
        sourceCode,
        language,
        filename: selectedFile?.name,
        style,
      });

      setResult(response);
      generateDocumentationPdf(response.documentation);
    } catch (err: any) {
      console.error('PDF export failed:', err);
      setError(err?.message || 'Failed to generate PDF documentation.');
    } finally {
      setIsDownloadingPdf(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9FA] text-[#1F2937]">
      <Header
        activePage={activePage}
        hasGeneratedDocs={Boolean(result)}
        onNavigate={(page) => setActivePage(page)}
        onStartGenerator={() => setActivePage('generator')}
        onDownloadPdf={handleDownloadPdf}
        isDownloadingPdf={isDownloadingPdf}
      />

      <main className="flex-1">
        {activePage === 'home' && (
          <Home
            onStartGenerator={() => setActivePage('generator')}
            onTryExample={() => {
              handleLoadPrimaryExample();
              setActivePage('generator');
            }}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
          />
        )}

        {(activePage === 'generator' || activePage === 'documentation') && (
          <Generator
            sourceCode={sourceCode}
            onSourceCodeChange={(code) => {
              setSourceCode(code);
              if (selectedFile) {
                setSelectedFile({
                  ...selectedFile,
                  size: new Blob([code]).size,
                });
              }
            }}
            language={language}
            onLanguageChange={setLanguage}
            selectedFile={selectedFile}
            onFileLoaded={handleFileLoaded}
            onClearFile={() => setSelectedFile(null)}
            style={style}
            onStyleChange={setStyle}
            isGenerating={isGenerating}
            activeStepIndex={activeStepIndex}
            error={error}
            onError={setError}
            result={result}
            onGenerate={handleGenerate}
            onTryPrimaryExample={handleLoadPrimaryExample}
            onSelectPreset={handleSelectPreset}
            activeViewTab={activeViewTab}
            onViewTabChange={setActiveViewTab}
            onDownloadPdf={handleDownloadPdf}
            isDownloadingPdf={isDownloadingPdf}
          />
        )}

        {activePage === 'about' && (
          <About
            onStartGenerator={() => setActivePage('generator')}
            onTryExample={() => {
              handleLoadPrimaryExample();
              setActivePage('generator');
            }}
          />
        )}
      </main>

      <footer className="bg-white border-t border-[#E5E7EB] py-6 mt-12">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#6B7280]">
          <div className="flex items-center gap-2">
            <span className="font-bold text-[#1F2937]">DOCUAPI AI</span>
            <span aria-hidden="true">·</span>
            <span>Automated API Documentation & PDF Generation Platform</span>
          </div>
          <div className="flex items-center gap-6">
            <button
              type="button"
              onClick={() => setActivePage('home')}
              className="hover:text-[#1F2937] transition-colors cursor-pointer"
            >
              Home
            </button>
            <button
              type="button"
              onClick={() => setActivePage('generator')}
              className="hover:text-[#1F2937] transition-colors cursor-pointer"
            >
              Generator
            </button>
            <button
              type="button"
              onClick={() => setActivePage('about')}
              className="hover:text-[#1F2937] transition-colors cursor-pointer"
            >
              Architecture
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;
