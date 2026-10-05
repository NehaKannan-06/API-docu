export type SupportedLanguage =
  | 'python'
  | 'javascript'
  | 'typescript'
  | 'java'
  | 'json'
  | 'yaml';

export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export type ParameterLocation = 'path' | 'query' | 'header' | 'body';

export type AuthenticationKind =
  | 'None'
  | 'API Key'
  | 'Bearer Token'
  | 'JWT'
  | 'OAuth'
  | 'Unknown';

export type DocumentationStyle =
  | 'Developer Friendly'
  | 'Concise'
  | 'Detailed'
  | 'OpenAPI Style';

export interface ExtractedParameter {
  name: string;
  location: ParameterLocation;
  type: string;
  required: boolean;
  defaultValue?: string;
  description?: string;
}

export interface ExtractedEndpointFact {
  id: string;
  method: HttpMethod;
  path: string;
  functionName: string;
  lineStart: number;
  docstring: string;
  parameters: ExtractedParameter[];
  requestBodySchema: Record<string, any> | null;
  responseSchema: Record<string, any> | null;
  responseExample: Record<string, any> | any | null;
  statusCodes: number[];
  authentication: AuthenticationKind;
  authDetails?: string;
  rawSnippet: string;
}

export interface AnalysisResult {
  detectedLanguage: SupportedLanguage;
  framework: string;
  endpoints: ExtractedEndpointFact[];
  models: Record<string, Record<string, string>>;
  parseWarnings: string[];
}

export interface DocumentedParameter {
  name: string;
  location: ParameterLocation;
  type: string;
  required: boolean;
  description: string;
  grounded: boolean;
}

export interface DocumentedResponse {
  statusCode: number;
  statusText: string;
  description: string;
  schema: Record<string, any> | null;
  example: any;
}

export interface DocumentedRequestBody {
  required: boolean;
  contentType: string;
  description: string;
  schema: Record<string, any> | null;
  example: any;
}

export interface DocumentedEndpoint {
  id: string;
  method: HttpMethod;
  path: string;
  functionName: string;
  lineStart: number;
  summary: string;
  description: string;
  parameters: DocumentedParameter[];
  requestBody: DocumentedRequestBody | null;
  responses: DocumentedResponse[];
  authentication: string;
  authenticationType: AuthenticationKind;
  exampleRequest: string;
  exampleResponse: string;
  tags: string[];
  validationFlags: string[];
}

export interface QualityScoreBreakdown {
  overall: number;
  endpointDetection: number;
  parameterDetection: number;
  requestSchema: number;
  responseSchema: number;
  descriptionClarity: number;
}

export interface ValidationAuditItem {
  category: 'Endpoint' | 'Parameter' | 'Authentication' | 'Schema' | 'Status Code';
  target: string;
  status: 'verified' | 'repaired' | 'removed';
  message: string;
}

export interface GeneratedDocumentation {
  projectName: string;
  description: string;
  version: string;
  baseUrl: string;
  framework: string;
  language: SupportedLanguage;
  style: DocumentationStyle;
  generatedAt: string;
  aiPowered: boolean;
  endpoints: DocumentedEndpoint[];
  extractedFacts: ExtractedEndpointFact[];
  qualityScore: QualityScoreBreakdown;
  validationAudit: ValidationAuditItem[];
}
