import React from 'react';
import { ArrowRight, CheckCircle2, Code2, FileSpreadsheet, ShieldCheck } from 'lucide-react';

interface AboutProps {
  onStartGenerator: () => void;
  onTryExample: () => void;
}

export const About: React.FC<AboutProps> = ({ onStartGenerator, onTryExample }) => {
  const pipelineStages = [
    {
      step: '01. Language & Framework Detection',
      detail:
        'Automatically identifies Python (FastAPI, Flask), JavaScript/TypeScript (Express, NestJS, Fastify), Java (Spring Boot), or JSON/YAML OpenAPI definitions.',
    },
    {
      step: '02. Static Code & AST Fact Extraction',
      detail:
        'Extracts HTTP methods, route paths, path/query/header/body parameters, data types, return structures, and authentication decorators directly from source code.',
    },
    {
      step: '03. Structured API Representation',
      detail:
        'Normalizes extracted technical facts into a canonical JSON representation so the AI model receives verified structural constraints.',
    },
    {
      step: '04. Gemini AI Documentation Synthesis',
      detail:
        'Uses strict JSON-schema constrained generation to produce clear summaries, developer-friendly descriptions, and realistic request/response examples.',
    },
    {
      step: '05. Grounded Validation & Hallucination Prevention',
      detail:
        'Cross-checks every AI-generated endpoint, parameter, type, and authentication claim against the extracted source facts and computes a deterministic quality score.',
    },
  ];

  return (
    <div className="max-w-[1380px] mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-12">
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 sm:p-10 space-y-6">
        <div className="max-w-3xl space-y-3">
          <p className="text-xs font-semibold text-[#E53935]">
            Architecture & Verification Methodology
          </p>
          <h1 className="text-2xl sm:text-4xl font-bold tracking-tight text-[#1F2937]">
            Built for Grounded, Hallucination-Free API Documentation
          </h1>
          <p className="text-sm sm:text-base text-[#6B7280] leading-relaxed">
            Unlike generic chat interfaces that guess API behavior from raw text, DocuAPI AI
            combines deterministic static route parsers with schema-constrained Gemini AI synthesis
            and post-generation validation.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-2">
          <button
            type="button"
            onClick={onStartGenerator}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-white bg-[#E53935] hover:bg-[#C62828] rounded-xl transition-colors cursor-pointer"
          >
            <span>Open Generator</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onTryExample}
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs sm:text-sm font-semibold text-[#1F2937] bg-[#F8F9FA] hover:bg-[#E5E7EB]/60 border border-[#E5E7EB] rounded-xl transition-colors cursor-pointer"
          >
            <span>Try Sample FastAPI Code</span>
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <h2 className="text-xl font-bold text-[#1F2937]">How the Analysis Pipeline Works</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {pipelineStages.map((stage) => (
            <div
              key={stage.step}
              className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-2.5"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-[#E53935]">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{stage.step}</span>
              </div>
              <p className="text-xs sm:text-sm text-[#6B7280] leading-relaxed">{stage.detail}</p>
            </div>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
            <Code2 className="w-4 h-4 text-[#E53935]" />
            <span>Multi-Language Parsers</span>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            First-class support for Python (FastAPI, Flask), JavaScript & TypeScript (Express,
            NestJS, Fastify), Java (Spring Boot), and OpenAPI/Swagger JSON & YAML definitions.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <span>Strict Validation Rules</span>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            Never invents endpoints, parameters, or authentication schemes. If authentication is not
            explicitly present in the source code, it is transparently reported as undetermined.
          </p>
        </div>

        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 space-y-2">
          <div className="flex items-center gap-2 text-sm font-semibold text-[#1F2937]">
            <FileSpreadsheet className="w-4 h-4 text-[#E53935]" />
            <span>Portable Developer Exports</span>
          </div>
          <p className="text-xs text-[#6B7280] leading-relaxed">
            One-click export to formatted PDF documents, clean Markdown for READMEs, structured JSON for custom
            portals, and valid OpenAPI 3.0.3 YAML/JSON specs.
          </p>
        </div>
      </div>
    </div>
  );
};
