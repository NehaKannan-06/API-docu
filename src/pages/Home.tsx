import React from 'react';
import { ArrowRight, Code2, Cpu, FileDown, FileText, Layers, Loader2, ShieldCheck } from 'lucide-react';

interface HomeProps {
  onStartGenerator: () => void;
  onTryExample: () => void;
  onDownloadPdf?: () => void;
  isDownloadingPdf?: boolean;
}

export const Home: React.FC<HomeProps> = ({
  onStartGenerator,
  onTryExample,
  onDownloadPdf,
  isDownloadingPdf = false,
}) => {
  const features = [
    {
      num: '01',
      title: 'AI-Powered Analysis',
      description:
        'Automatically understand API behavior, route handlers, and data structures using structured Gemini intelligence grounded in your code.',
    },
    {
      num: '02',
      title: 'Automatic Endpoint Detection',
      description:
        'Extract HTTP methods, route paths, path variables, query parameters, headers, and status codes directly from source files.',
    },
    {
      num: '03',
      title: 'Request & Response Examples',
      description:
        'Generate realistic, ready-to-run cURL requests and JSON response payloads inferred directly from your return statements and models.',
    },
    {
      num: '04',
      title: 'Documentation Validation',
      description:
        'Verify every generated endpoint, parameter, and authentication claim against extracted source-code facts to prevent hallucinations.',
    },
    {
      num: '05',
      title: 'Multiple Input Formats',
      description:
        'Support Python (FastAPI, Flask), JavaScript/TypeScript (Express, NestJS), Java (Spring Boot), and JSON/YAML OpenAPI definitions.',
    },
    {
      num: '06',
      title: 'Export to PDF, Markdown & OpenAPI',
      description:
        'Download complete human-readable PDF documents, clean Markdown, structured JSON schemas, and standard-compliant OpenAPI 3.0 specs.',
    },
  ];

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Section */}
      <section className="bg-white border-b border-[#E5E7EB] pt-12 pb-16">
        <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center space-y-6">
            <p className="text-xs font-semibold tracking-wide text-[#E53935]">
              Automated Developer Documentation Engine · Grounded Source Analysis
            </p>

            <h1
              className="text-3xl sm:text-5xl font-bold tracking-tight text-[#1F2937] leading-[1.15]"
              style={{ textWrap: 'balance' }}
            >
              Turn API Code Into Beautiful Documentation
            </h1>

            <p className="text-base sm:text-lg text-[#6B7280] leading-relaxed max-w-2xl mx-auto">
              DocuAPI AI analyzes your API source code and generates clear, structured,
              developer-friendly documentation in seconds.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-3.5 pt-2">
              <button
                type="button"
                onClick={onStartGenerator}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-xl transition-colors shadow-xs cursor-pointer whitespace-nowrap"
              >
                <span>Generate Documentation</span>
                <ArrowRight className="w-4 h-4" />
              </button>

              <button
                type="button"
                onClick={onTryExample}
                className="inline-flex items-center gap-2 px-6 py-3 text-sm font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Try Example API</span>
              </button>

              {onDownloadPdf && (
                <button
                  id="download-pdf-button"
                  type="button"
                  onClick={onDownloadPdf}
                  disabled={isDownloadingPdf}
                  className="inline-flex items-center gap-2 px-5 py-3 text-sm font-semibold text-[#1F2937] hover:text-[#E53935] bg-transparent hover:bg-[#F8F9FA] border border-[#E5E7EB] hover:border-[#E53935]/40 rounded-xl transition-colors shadow-2xs cursor-pointer whitespace-nowrap disabled:opacity-50"
                  title="Download verified API documentation in formatted PDF"
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
            </div>
          </div>

          {/* Visual: CODE -> AI ANALYSIS -> DOCUMENTATION */}
          <div className="mt-12 grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
            <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-[#E53935]" />
                  <span className="text-xs font-bold text-[#1F2937]">1. SOURCE CODE</span>
                </div>
                <span className="text-xs font-mono text-[#6B7280]">main.py</span>
              </div>
              <pre className="text-xs font-mono text-[#1F2937] bg-white p-3.5 rounded-lg border border-[#E5E7EB] overflow-x-auto leading-relaxed">
{`@app.get("/users/{user_id}")
def get_user(user_id: int):
    return {
        "id": user_id,
        "name": "John",
        "email": "john@example.com"
    }`}
              </pre>
              <p className="text-xs text-[#6B7280]">
                Paste raw source code or upload Python, JS/TS, Java, JSON, or YAML files.
              </p>
            </div>

            <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-[#E53935]" />
                  <span className="text-xs font-bold text-[#1F2937]">
                    2. AI ANALYSIS & VALIDATION
                  </span>
                </div>
                <span className="text-xs font-mono text-[#16A34A]">AST Grounded</span>
              </div>
              <pre className="text-xs font-mono text-[#1F2937] bg-white p-3.5 rounded-lg border border-[#E5E7EB] overflow-x-auto leading-relaxed">
{`{
  "method": "GET",
  "path": "/users/{user_id}",
  "parameters": [{
    "name": "user_id",
    "location": "path",
    "type": "integer",
    "required": true
  }]
}`}
              </pre>
              <p className="text-xs text-[#6B7280]">
                Extracts technical facts first, generates AI descriptions, and blocks hallucinations.
              </p>
            </div>

            <div className="bg-[#F8F9FA] border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between space-y-4">
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-[#E53935]" />
                  <span className="text-xs font-bold text-[#1F2937]">3. DOCUMENTATION & PDF</span>
                </div>
                <span className="text-xs font-mono text-[#16A34A] tabular-nums">96% Quality</span>
              </div>
              <div className="bg-white p-3.5 rounded-lg border border-[#E5E7EB] space-y-2.5 text-xs">
                <div className="flex items-center gap-2">
                  <span className="px-1.5 py-0.5 font-mono font-semibold text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded">
                    GET
                  </span>
                  <span className="font-mono font-semibold text-[#1F2937]">
                    /users/&#123;user_id&#125;
                  </span>
                </div>
                <p className="font-semibold text-[#1F2937]">Retrieve User</p>
                <p className="text-[#6B7280]">
                  Retrieves profile details for a specific user by integer ID.
                </p>
                <div className="pt-1 border-t border-[#E5E7EB] flex items-center justify-between font-mono text-[11px] text-[#6B7280]">
                  <span>user_id (path · integer)</span>
                  <span className="text-[#16A34A]">200 OK</span>
                </div>
              </div>
              <p className="text-xs text-[#6B7280]">
                Explore interactively, search routes, or download clean PDF, Markdown, and OpenAPI 3.0.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Feature Cards Section */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
        <div className="max-w-2xl space-y-2">
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1F2937]">
            Everything you need to document your APIs
          </h2>
          <p className="text-sm sm:text-base text-[#6B7280]">
            Built for engineering teams who need reliable, up-to-date reference documentation
            without manual boilerplate.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feat) => (
            <div
              key={feat.num}
              className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-3 hover:border-[#E53935]/40 transition-colors"
            >
              <div className="text-xs font-mono font-semibold text-[#E53935]">{feat.num}.</div>
              <h3 className="text-base font-semibold text-[#1F2937]">{feat.title}</h3>
              <p className="text-sm text-[#6B7280] leading-relaxed">{feat.description}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pipeline Verification Architecture Section */}
      <section className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 sm:p-8 space-y-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[#E5E7EB] pb-6">
            <div className="space-y-1">
              <h2 className="text-xl font-bold text-[#1F2937]">
                Grounded 9-Stage Verification Pipeline
              </h2>
              <p className="text-sm text-[#6B7280]">
                DocuAPI AI never sends raw code to an LLM blindly. Every endpoint, parameter, and
                authentication requirement is extracted and cross-validated against your source code.
              </p>
            </div>
            <button
              type="button"
              onClick={onTryExample}
              className="px-4 py-2.5 text-xs font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              Run Live Pipeline Demo
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-xs">
            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F2937]">
                <Layers className="w-4 h-4 text-[#E53935]" />
                <span>Phase 1: Static Fact Extraction</span>
              </div>
              <p className="text-[#6B7280] leading-relaxed">
                Detects language and framework, parses route decorators, extracts function
                signatures, path/query/body parameters, return schemas, and security dependencies.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F2937]">
                <Cpu className="w-4 h-4 text-[#E53935]" />
                <span>Phase 2: Structured Gemini Synthesis</span>
              </div>
              <p className="text-[#6B7280] leading-relaxed">
                Passes the structured API representation and code context to Gemini with a strict
                JSON schema to synthesize human-readable summaries, parameter descriptions, and
                examples.
              </p>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2 font-semibold text-[#1F2937]">
                <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
                <span>Phase 3: Hallucination Firewall</span>
              </div>
              <p className="text-[#6B7280] leading-relaxed">
                Compares AI output against extracted source facts. Blocks ungrounded endpoints,
                parameters, or invented authentication, and computes a deterministic quality score.
              </p>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
};
