import React, { useMemo, useRef, useState } from 'react';
import { Check, Copy, RotateCcw } from 'lucide-react';
import type { SupportedLanguage } from '../services/api.ts';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: SupportedLanguage;
  onLanguageChange: (language: SupportedLanguage) => void;
  readOnly?: boolean;
  placeholder?: string;
}

const LANGUAGES: Array<{ value: SupportedLanguage; label: string }> = [
  { value: 'python', label: 'Python' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'java', label: 'Java' },
  { value: 'json', label: 'JSON' },
  { value: 'yaml', label: 'YAML' },
];

function highlightLineTokens(line: string): React.ReactNode[] {
  if (!line) return ['\u00A0'];
  const trimmed = line.trim();
  if (trimmed.startsWith('#') || trimmed.startsWith('//')) {
    return [
      <span key="comment" className="text-[#6B7280] italic">
        {line}
      </span>,
    ];
  }

  if (trimmed.startsWith('@')) {
    return [
      <span key="decorator" className="text-[#C62828] font-medium">
        {line}
      </span>,
    ];
  }

  const tokenRegex =
    /("[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|\b(?:from|import|def|async|return|class|interface|type|const|let|var|function|export|public|private|record|true|false|True|False|None|null|int|str|float|bool|string|number|boolean)\b|\b\d+(?:\.\d+)?\b)/g;

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let idx = 0;

  while ((match = tokenRegex.exec(line)) !== null) {
    if (match.index > lastIndex) {
      parts.push(line.slice(lastIndex, match.index));
    }
    const token = match[0];
    if (token.startsWith('"') || token.startsWith("'")) {
      parts.push(
        <span key={idx++} className="text-[#16A34A]">
          {token}
        </span>
      );
    } else if (/^\d/.test(token)) {
      parts.push(
        <span key={idx++} className="text-[#D97706]">
          {token}
        </span>
      );
    } else {
      parts.push(
        <span key={idx++} className="text-[#C62828] font-medium">
          {token}
        </span>
      );
    }
    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < line.length) {
    parts.push(line.slice(lastIndex));
  }

  return parts;
}

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  onLanguageChange,
  readOnly = false,
  placeholder = 'Paste your API code here...',
}) => {
  const [copied, setCopied] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const preRef = useRef<HTMLPreElement>(null);

  const lines = useMemo(() => {
    const split = value.split('\n');
    return split.length > 0 ? split : [''];
  }, [value]);

  const handleScroll = () => {
    if (textareaRef.current && preRef.current) {
      preRef.current.scrollTop = textareaRef.current.scrollTop;
      preRef.current.scrollLeft = textareaRef.current.scrollLeft;
    }
  };

  const handleCopy = async () => {
    if (!value) return;
    await navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 1800);
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden shadow-2xs">
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E5E7EB]">
        <div className="flex items-center gap-3">
          <label htmlFor="language-select" className="text-xs font-medium text-[#6B7280]">
            Language:
          </label>
          <select
            id="language-select"
            value={language}
            disabled={readOnly}
            onChange={(e) => onLanguageChange(e.target.value as SupportedLanguage)}
            className="text-xs font-semibold text-[#1F2937] bg-white border border-[#E5E7EB] rounded-md px-2.5 py-1.5 focus:outline-none focus:border-[#E53935] cursor-pointer disabled:opacity-60"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>
                {lang.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-[#6B7280] tabular-nums hidden sm:inline">
            {lines.length} {lines.length === 1 ? 'line' : 'lines'} · {value.length} chars
          </span>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            disabled={!value}
            title="Copy source code"
            className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#1F2937] bg-white border border-[#E5E7EB] rounded-md hover:bg-[#F8F9FA] transition-colors disabled:opacity-40 cursor-pointer whitespace-nowrap"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                <span>Copied</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#6B7280]" />
                <span>Copy</span>
              </>
            )}
          </button>

          {!readOnly && value.length > 0 && (
            <button
              type="button"
              onClick={() => onChange('')}
              title="Clear editor"
              className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-[#6B7280] bg-white border border-[#E5E7EB] rounded-md hover:text-[#DC2626] hover:border-[#DC2626]/30 transition-colors cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>Clear</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative flex min-h-[340px] max-h-[500px] bg-white font-mono text-[13px] leading-6">
        <div
          aria-hidden="true"
          className="select-none py-4 px-3 bg-[#F8F9FA] border-r border-[#E5E7EB] text-right text-[#6B7280] tabular-nums min-w-[48px] overflow-hidden"
        >
          {lines.map((_, idx) => (
            <div key={idx} className="leading-6">
              {idx + 1}
            </div>
          ))}
        </div>

        <div className="relative flex-1 overflow-hidden">
          <pre
            ref={preRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 m-0 py-4 px-4 overflow-hidden whitespace-pre font-mono text-[13px] leading-6 text-[#1F2937]"
          >
            {lines.map((line, idx) => (
              <div key={idx} className="leading-6">
                {highlightLineTokens(line)}
              </div>
            ))}
          </pre>

          <textarea
            ref={textareaRef}
            value={value}
            readOnly={readOnly}
            onChange={(e) => onChange(e.target.value)}
            onScroll={handleScroll}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder={placeholder}
            aria-label="API Source Code Editor"
            className="relative z-10 w-full h-full min-h-[340px] max-h-[500px] py-4 px-4 bg-transparent text-transparent caret-[#E53935] resize-none focus:outline-none font-mono text-[13px] leading-6 whitespace-pre overflow-auto placeholder:text-[#6B7280]"
          />
        </div>
      </div>
    </div>
  );
};
