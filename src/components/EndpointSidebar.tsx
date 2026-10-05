import React, { useMemo, useState } from 'react';
import { ChevronDown, Search, X } from 'lucide-react';
import type { DocumentedEndpoint, HttpMethod } from '../../backend/models/schemas.ts';

interface EndpointSidebarProps {
  endpoints: DocumentedEndpoint[];
  selectedEndpointId: string;
  onSelectEndpoint: (id: string) => void;
  searchQuery: string;
  onSearchChange: (q: string) => void;
}

export function getMethodBadgeClasses(method: HttpMethod): string {
  switch (method) {
    case 'GET':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'POST':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'PUT':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'PATCH':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'DELETE':
      return 'bg-red-50 text-red-700 border-red-200';
    default:
      return 'bg-gray-100 text-gray-700 border-gray-200';
  }
}

export const EndpointSidebar: React.FC<EndpointSidebarProps> = ({
  endpoints,
  selectedEndpointId,
  onSelectEndpoint,
  searchQuery,
  onSearchChange,
}) => {
  const [methodFilter, setMethodFilter] = useState<'ALL' | HttpMethod>('ALL');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const availableMethods = useMemo(() => {
    const set = new Set<HttpMethod>();
    endpoints.forEach((e) => set.add(e.method));
    return Array.from(set);
  }, [endpoints]);

  const filteredEndpoints = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return endpoints.filter((ep) => {
      if (methodFilter !== 'ALL' && ep.method !== methodFilter) return false;
      if (!q) return true;
      return (
        ep.path.toLowerCase().includes(q) ||
        ep.method.toLowerCase().includes(q) ||
        ep.summary.toLowerCase().includes(q) ||
        ep.description.toLowerCase().includes(q) ||
        ep.functionName.toLowerCase().includes(q)
      );
    });
  }, [endpoints, methodFilter, searchQuery]);

  const selectedEndpoint =
    endpoints.find((e) => e.id === selectedEndpointId) || endpoints[0];

  return (
    <aside className="w-full lg:w-[300px] xl:w-[320px] shrink-0">
      <div className="lg:hidden mb-4">
        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="w-full flex items-center justify-between px-4 py-3 bg-white border border-[#E5E7EB] rounded-xl text-left shadow-2xs cursor-pointer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {selectedEndpoint && (
              <span
                className={`px-2 py-0.5 text-[11px] font-mono font-semibold border rounded ${getMethodBadgeClasses(
                  selectedEndpoint.method
                )}`}
              >
                {selectedEndpoint.method}
              </span>
            )}
            <span className="font-mono text-xs font-semibold text-[#1F2937] truncate">
              {selectedEndpoint ? selectedEndpoint.path : 'Select Endpoint'}
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-[#6B7280] shrink-0">
            <span>
              {endpoints.length} {endpoints.length === 1 ? 'route' : 'routes'}
            </span>
            <ChevronDown
              className={`w-4 h-4 transition-transform ${
                mobileMenuOpen ? 'rotate-180' : ''
              }`}
            />
          </div>
        </button>
      </div>

      <div
        className={`${
          mobileMenuOpen ? 'block' : 'hidden'
        } lg:block bg-white border border-[#E5E7EB] rounded-xl overflow-hidden`}
      >
        <div className="px-4 py-3.5 border-b border-[#E5E7EB] flex items-center justify-between">
          <h2 className="text-sm font-semibold text-[#1F2937]">API Documentation</h2>
          <span className="text-xs text-[#6B7280] tabular-nums">
            {filteredEndpoints.length} of {endpoints.length}
          </span>
        </div>

        <div className="p-3 border-b border-[#E5E7EB] space-y-2.5 bg-[#F8F9FA]">
          <div className="relative">
            <Search className="w-3.5 h-3.5 text-[#6B7280] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search endpoints..."
              aria-label="Search endpoints"
              className="w-full pl-8 pr-7 py-1.5 text-xs bg-white border border-[#E5E7EB] rounded-lg text-[#1F2937] placeholder:text-[#6B7280] focus:outline-none focus:border-[#E53935]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                title="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-[#6B7280] hover:text-[#1F2937] cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {availableMethods.length > 1 && (
            <div className="flex items-center gap-1 overflow-x-auto pb-0.5">
              <button
                type="button"
                onClick={() => setMethodFilter('ALL')}
                className={`px-2 py-1 text-[11px] font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                  methodFilter === 'ALL'
                    ? 'bg-[#E53935] text-white'
                    : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#1F2937]'
                }`}
              >
                All
              </button>
              {availableMethods.map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setMethodFilter(m)}
                  className={`px-2 py-1 text-[11px] font-mono font-semibold rounded transition-colors cursor-pointer whitespace-nowrap ${
                    methodFilter === m
                      ? 'bg-[#1F2937] text-white'
                      : 'bg-white text-[#6B7280] border border-[#E5E7EB] hover:text-[#1F2937]'
                  }`}
                >
                  {m}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="divide-y divide-[#E5E7EB] max-h-[560px] overflow-y-auto">
          {filteredEndpoints.length === 0 ? (
            <div className="p-6 text-center space-y-2">
              <p className="text-xs font-medium text-[#1F2937]">No matching endpoints</p>
              <p className="text-xs text-[#6B7280]">
                No endpoints match "{searchQuery}". Try searching by path or HTTP method.
              </p>
              <button
                type="button"
                onClick={() => {
                  onSearchChange('');
                  setMethodFilter('ALL');
                }}
                className="text-xs font-semibold text-[#E53935] hover:underline cursor-pointer"
              >
                Reset search
              </button>
            </div>
          ) : (
            filteredEndpoints.map((ep) => {
              const isSelected = ep.id === selectedEndpointId;
              return (
                <button
                  key={ep.id}
                  type="button"
                  onClick={() => {
                    onSelectEndpoint(ep.id);
                    setMobileMenuOpen(false);
                  }}
                  className={`w-full text-left px-4 py-3 transition-colors flex flex-col gap-1.5 cursor-pointer border-l-[3px] ${
                    isSelected
                      ? 'bg-[#E53935]/[0.04] border-l-[#E53935]'
                      : 'bg-white hover:bg-[#F8F9FA] border-l-transparent'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span
                      className={`px-1.5 py-0.5 text-[10px] font-mono font-semibold border rounded shrink-0 ${getMethodBadgeClasses(
                        ep.method
                      )}`}
                    >
                      {ep.method}
                    </span>
                    <span className="font-mono text-xs font-semibold text-[#1F2937] truncate">
                      {ep.path}
                    </span>
                  </div>
                  <p className="text-xs text-[#6B7280] truncate pl-0.5">{ep.summary}</p>
                </button>
              );
            })
          )}
        </div>
      </div>
    </aside>
  );
};
