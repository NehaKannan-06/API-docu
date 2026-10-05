import React, { useState } from 'react';
import { Check, Copy, Lock, ShieldAlert } from 'lucide-react';
import type { DocumentedEndpoint } from '../../backend/models/schemas.ts';
import { getMethodBadgeClasses } from './EndpointSidebar.tsx';

interface EndpointDocumentationProps {
  endpoint: DocumentedEndpoint;
  onViewSourceCode?: () => void;
}

export const EndpointDocumentation: React.FC<EndpointDocumentationProps> = ({
  endpoint,
  onViewSourceCode,
}) => {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 1800);
  };

  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
      <div className="p-6 border-b border-[#E5E7EB] space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <span
              className={`px-2.5 py-1 text-xs font-mono font-semibold border rounded-md shrink-0 ${getMethodBadgeClasses(
                endpoint.method
              )}`}
            >
              {endpoint.method}
            </span>
            <h1 className="font-mono text-base sm:text-lg font-semibold text-[#1F2937] break-all">
              {endpoint.path}
            </h1>
          </div>

          <div className="flex items-center gap-2 text-xs text-[#6B7280]">
            <span>Handler:</span>
            <code className="font-mono text-[#1F2937] font-medium">{endpoint.functionName}</code>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">Line {endpoint.lineStart}</span>
            {onViewSourceCode && (
              <>
                <span aria-hidden="true">·</span>
                <button
                  type="button"
                  onClick={onViewSourceCode}
                  className="text-[#E53935] hover:underline font-medium cursor-pointer"
                >
                  View source
                </button>
              </>
            )}
          </div>
        </div>

        <div className="space-y-1.5">
          <h2 className="text-lg font-semibold text-[#1F2937]">{endpoint.summary}</h2>
          <p className="text-sm text-[#6B7280] leading-relaxed max-w-[72ch]">
            {endpoint.description}
          </p>
        </div>
      </div>

      <div className="p-6 space-y-8">
        <section className="space-y-2.5">
          <h3 className="text-sm font-semibold text-[#1F2937]">Authentication</h3>
          <div className="flex items-start gap-2.5 p-3.5 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] text-xs">
            {endpoint.authenticationType === 'Unknown' ? (
              <ShieldAlert className="w-4 h-4 text-[#F59E0B] shrink-0 mt-0.5" />
            ) : (
              <Lock className="w-4 h-4 text-[#16A34A] shrink-0 mt-0.5" />
            )}
            <div className="space-y-0.5">
              <p className="font-medium text-[#1F2937]">{endpoint.authentication}</p>
              {endpoint.authenticationType !== 'Unknown' &&
                endpoint.authenticationType !== 'None' && (
                  <p className="text-[#6B7280]">
                    Detected scheme: {endpoint.authenticationType}
                  </p>
                )}
            </div>
          </div>
        </section>

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#1F2937]">Parameters</h3>
            <span className="text-xs text-[#6B7280] tabular-nums">
              {endpoint.parameters.length}{' '}
              {endpoint.parameters.length === 1 ? 'parameter' : 'parameters'}
            </span>
          </div>

          {endpoint.parameters.length === 0 ? (
            <div className="p-4 rounded-lg bg-[#F8F9FA] border border-[#E5E7EB] text-xs text-[#6B7280]">
              No path, query, header, or body parameters required for this endpoint.
            </div>
          ) : (
            <div className="overflow-x-auto border border-[#E5E7EB] rounded-lg">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-[#F8F9FA] border-b border-[#E5E7EB] text-[#6B7280] font-semibold">
                    <th className="py-2.5 px-3.5">Name</th>
                    <th className="py-2.5 px-3.5">Location</th>
                    <th className="py-2.5 px-3.5">Type</th>
                    <th className="py-2.5 px-3.5">Required</th>
                    <th className="py-2.5 px-3.5">Description</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {endpoint.parameters.map((param) => (
                    <tr key={`${param.location}-${param.name}`} className="hover:bg-[#F8F9FA]/60">
                      <td className="py-2.5 px-3.5 font-mono font-semibold text-[#1F2937] whitespace-nowrap">
                        {param.name}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#6B7280] capitalize whitespace-nowrap">
                        {param.location}
                      </td>
                      <td className="py-2.5 px-3.5 font-mono text-[#C62828] whitespace-nowrap">
                        {param.type}
                      </td>
                      <td className="py-2.5 px-3.5 whitespace-nowrap">
                        {param.required ? (
                          <span className="font-semibold text-[#E53935]">Required</span>
                        ) : (
                          <span className="text-[#6B7280]">Optional</span>
                        )}
                      </td>
                      <td className="py-2.5 px-3.5 text-[#6B7280] leading-relaxed">
                        {param.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {endpoint.requestBody && (
          <section className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#1F2937]">Request Body</h3>
              <span className="text-xs font-mono text-[#6B7280]">
                {endpoint.requestBody.contentType} ·{' '}
                {endpoint.requestBody.required ? 'Required' : 'Optional'}
              </span>
            </div>
            <p className="text-xs text-[#6B7280]">{endpoint.requestBody.description}</p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {endpoint.requestBody.schema && (
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                    Request Body Schema
                  </div>
                  <pre className="p-3.5 text-xs font-mono text-[#1F2937] bg-white overflow-x-auto">
                    {JSON.stringify(endpoint.requestBody.schema, null, 2)}
                  </pre>
                </div>
              )}

              {endpoint.requestBody.example && (
                <div className="border border-[#E5E7EB] rounded-lg overflow-hidden">
                  <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-[#E5E7EB] text-xs font-semibold text-[#6B7280]">
                    Request Payload Example
                  </div>
                  <pre className="p-3.5 text-xs font-mono text-[#1F2937] bg-white overflow-x-auto">
                    {JSON.stringify(endpoint.requestBody.example, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </section>
        )}

        <section className="space-y-4">
          <h3 className="text-sm font-semibold text-[#1F2937]">Response</h3>
          <div className="space-y-3">
            {endpoint.responses.map((resp) => {
              const isSuccess = resp.statusCode >= 200 && resp.statusCode < 300;
              return (
                <div
                  key={resp.statusCode}
                  className="border border-[#E5E7EB] rounded-lg overflow-hidden"
                >
                  <div className="px-4 py-2.5 bg-[#F8F9FA] border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono text-xs font-semibold tabular-nums ${
                          isSuccess ? 'text-[#16A34A]' : 'text-[#F59E0B]'
                        }`}
                      >
                        {resp.statusCode} {resp.statusText}
                      </span>
                      <span aria-hidden="true" className="text-[#6B7280]">
                        ·
                      </span>
                      <span className="text-xs text-[#6B7280]">{resp.description}</span>
                    </div>
                  </div>

                  {resp.schema && (
                    <div className="p-3.5 bg-white grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <p className="text-[11px] font-semibold text-[#6B7280] mb-1.5">
                          Response Schema
                        </p>
                        <pre className="p-3 rounded bg-[#F8F9FA] border border-[#E5E7EB] text-xs font-mono text-[#1F2937] overflow-x-auto">
                          {JSON.stringify(resp.schema, null, 2)}
                        </pre>
                      </div>
                      {resp.example && (
                        <div>
                          <p className="text-[11px] font-semibold text-[#6B7280] mb-1.5">
                            Status {resp.statusCode} Payload
                          </p>
                          <pre className="p-3 rounded bg-[#F8F9FA] border border-[#E5E7EB] text-xs font-mono text-[#1F2937] overflow-x-auto">
                            {JSON.stringify(resp.example, null, 2)}
                          </pre>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        <section className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-2 border-t border-[#E5E7EB]">
          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
            <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F2937]">Example Request</span>
              <button
                type="button"
                onClick={() => copyText(endpoint.exampleRequest, 'req')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#1F2937] cursor-pointer"
              >
                {copiedKey === 'req' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-[#16A34A]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-[#1F2937] overflow-x-auto leading-relaxed">
              {endpoint.exampleRequest}
            </pre>
          </div>

          <div className="border border-[#E5E7EB] rounded-lg overflow-hidden bg-white">
            <div className="px-3.5 py-2 bg-[#F8F9FA] border-b border-[#E5E7EB] flex items-center justify-between">
              <span className="text-xs font-semibold text-[#1F2937]">Example Response</span>
              <button
                type="button"
                onClick={() => copyText(endpoint.exampleResponse, 'res')}
                className="inline-flex items-center gap-1 text-xs font-medium text-[#6B7280] hover:text-[#1F2937] cursor-pointer"
              >
                {copiedKey === 'res' ? (
                  <>
                    <Check className="w-3.5 h-3.5 text-[#16A34A]" />
                    <span className="text-[#16A34A]">Copied</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-3.5 h-3.5" />
                    <span>Copy</span>
                  </>
                )}
              </button>
            </div>
            <pre className="p-4 text-xs font-mono text-[#1F2937] overflow-x-auto leading-relaxed">
              {endpoint.exampleResponse}
            </pre>
          </div>
        </section>
      </div>
    </div>
  );
};
