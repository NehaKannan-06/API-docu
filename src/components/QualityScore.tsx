import React, { useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ShieldCheck } from 'lucide-react';
import type {
  QualityScoreBreakdown,
  ValidationAuditItem,
} from '../../backend/models/schemas.ts';

interface QualityScoreProps {
  score: QualityScoreBreakdown;
  audit: ValidationAuditItem[];
}

export const QualityScore: React.FC<QualityScoreProps> = ({ score, audit }) => {
  const [showAudit, setShowAudit] = useState(false);

  const metrics = [
    { label: 'Endpoint detection', value: score.endpointDetection },
    { label: 'Parameter detection', value: score.parameterDetection },
    { label: 'Request schema', value: score.requestSchema },
    { label: 'Response schema', value: score.responseSchema },
    { label: 'Description clarity', value: score.descriptionClarity },
  ];

  const verifiedCount = audit.filter((a) => a.status === 'verified').length;
  const repairedOrRemovedCount = audit.filter((a) => a.status !== 'verified').length;

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-[#16A34A]" />
            <h3 className="text-sm font-semibold text-[#1F2937]">Documentation Quality</h3>
            <span className="text-sm font-bold font-mono tabular-nums text-[#16A34A]">
              {score.overall}%
            </span>
          </div>
          <p className="text-xs text-[#6B7280]">
            Grounded against source-code AST facts · {verifiedCount} verified checks
            {repairedOrRemovedCount > 0
              ? ` · ${repairedOrRemovedCount} ungrounded AI claims corrected`
              : ' · 0 hallucinations'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="w-36 sm:w-48 h-2.5 bg-[#F8F9FA] border border-[#E5E7EB] rounded-full overflow-hidden">
            <div
              className="h-full bg-[#16A34A] transition-transform duration-200 origin-left"
              style={{ transform: `scaleX(${Math.min(1, Math.max(0, score.overall / 100))})` }}
            />
          </div>

          <button
            type="button"
            onClick={() => setShowAudit(!showAudit)}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#1F2937] hover:text-[#E53935] transition-colors cursor-pointer whitespace-nowrap"
          >
            <span>Validation Log</span>
            {showAudit ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 pt-2 border-t border-[#E5E7EB]">
        {metrics.map((m) => (
          <div
            key={m.label}
            className="p-2.5 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] space-y-1.5"
          >
            <div className="flex items-center justify-between text-xs">
              <span className="text-[#6B7280] truncate pr-1">{m.label}</span>
              <span className="font-mono font-semibold tabular-nums text-[#1F2937]">
                {m.value}%
              </span>
            </div>
            <div className="w-full h-1.5 bg-white border border-[#E5E7EB] rounded-full overflow-hidden">
              <div
                className="h-full bg-[#E53935]"
                style={{ transform: `scaleX(${Math.min(1, Math.max(0, m.value / 100))})`, transformOrigin: 'left' }}
              />
            </div>
          </div>
        ))}
      </div>

      {showAudit && (
        <div className="pt-3 border-t border-[#E5E7EB] space-y-2">
          <div className="text-xs font-semibold text-[#1F2937]">
            Source-Code Validation Audit ({audit.length} checks)
          </div>
          <div className="max-h-48 overflow-y-auto divide-y divide-[#E5E7EB] border border-[#E5E7EB] rounded-lg bg-[#F8F9FA]">
            {audit.map((item, idx) => (
              <div
                key={idx}
                className="px-3.5 py-2 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-1"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 shrink-0 ${
                      item.status === 'verified'
                        ? 'text-[#16A34A]'
                        : item.status === 'repaired'
                        ? 'text-[#F59E0B]'
                        : 'text-[#DC2626]'
                    }`}
                  />
                  <span className="font-mono font-medium text-[#1F2937] shrink-0">
                    {item.target}
                  </span>
                  <span className="text-[#6B7280] truncate">— {item.message}</span>
                </div>
                <span className="text-[11px] font-mono uppercase text-[#6B7280] shrink-0">
                  {item.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
