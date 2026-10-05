import { GoogleGenAI, Type } from '@google/genai';
import type {
  AnalysisResult,
  DocumentationStyle,
  ExtractedEndpointFact,
} from '../models/schemas.ts';

const SYSTEM_INSTRUCTION_BASE = `You are an expert API documentation engineer.

Analyze the provided structured API information and source-code context.

Generate accurate, clear, developer-friendly API documentation.

STRICT RULES:

1. Never invent an endpoint.
2. Never invent a parameter.
3. Never invent an HTTP method.
4. Never invent authentication requirements.
5. Never invent response fields unless they can reasonably be inferred from the provided source.
6. Use the extracted API facts as the source of truth.
7. If information cannot be determined, explicitly mark it as unknown.
8. Generate concise but useful descriptions.
9. Generate realistic examples based only on the available API information.
10. Return ONLY valid JSON matching the provided schema.
11. Do not return Markdown outside the JSON.
12. Preserve exact endpoint paths and HTTP methods.

Your goal is accurate API documentation, not creative writing.`;

function getStyleInstruction(style: DocumentationStyle): string {
  switch (style) {
    case 'Concise':
      return 'STYLE: Concise. Keep summaries under 8 words and descriptions to 1 crisp, direct sentence.';
    case 'Detailed':
      return 'STYLE: Detailed. Provide thorough technical explanations covering behavior, parameter usage, edge cases grounded in the code, and expected payload structure.';
    case 'OpenAPI Style':
      return 'STYLE: OpenAPI Style. Use formal RFC/OpenAPI specification phrasing for operation summaries, parameter descriptions, and status code responses.';
    case 'Developer Friendly':
    default:
      return 'STYLE: Developer Friendly. Write clear, practical, easy-to-scan explanations geared toward engineers integrating this API.';
  }
}

export interface RawLlmEndpointDoc {
  method: string;
  path: string;
  summary: string;
  description: string;
  parameters: Array<{
    name: string;
    location: string;
    type: string;
    required: boolean;
    description: string;
  }>;
  requestBodyDescription?: string;
  responses: Array<{
    statusCode: number;
    description: string;
  }>;
  authentication: string;
  exampleRequest: string;
  exampleResponse: string;
}

export interface RawLlmDocumentationOutput {
  projectName: string;
  description: string;
  endpoints: RawLlmEndpointDoc[];
}

export async function generateStructuredDocsWithLLM(
  analysis: AnalysisResult,
  style: DocumentationStyle = 'Developer Friendly'
): Promise<{ data: RawLlmDocumentationOutput; aiPowered: boolean }> {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return {
      data: buildDeterministicFallback(analysis, style),
      aiPowered: false,
    };
  }

  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });

  const compactFacts = analysis.endpoints.map((ep) => ({
    method: ep.method,
    path: ep.path,
    functionName: ep.functionName,
    docstring: ep.docstring,
    parameters: ep.parameters,
    requestBodySchema: ep.requestBodySchema,
    responseSchema: ep.responseSchema,
    responseExample: ep.responseExample,
    statusCodes: ep.statusCodes,
    authentication: ep.authentication,
    rawSnippet: ep.rawSnippet.slice(0, 800),
  }));

  const prompt = `Analyze the following extracted API technical facts (${analysis.framework} / ${analysis.detectedLanguage}) and generate structured JSON documentation.

${getStyleInstruction(style)}

EXTRACTED TECHNICAL FACTS (SOURCE OF TRUTH):
${JSON.stringify(
  {
    framework: analysis.framework,
    language: analysis.detectedLanguage,
    models: analysis.models,
    endpoints: compactFacts,
  },
  null,
  2
)}`;

  const responseSchema = {
    type: Type.OBJECT,
    properties: {
      projectName: {
        type: Type.STRING,
        description: 'Clear name of the API service inferred from the routes and framework.',
      },
      description: {
        type: Type.STRING,
        description: '1-2 sentence overview of what this API service provides.',
      },
      endpoints: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            method: { type: Type.STRING },
            path: { type: Type.STRING },
            summary: {
              type: Type.STRING,
              description: 'Short one-line explanation of the endpoint (e.g. Retrieve User).',
            },
            description: {
              type: Type.STRING,
              description: 'Clear explanation of what the endpoint does grounded in the code.',
            },
            parameters: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  location: { type: Type.STRING },
                  type: { type: Type.STRING },
                  required: { type: Type.BOOLEAN },
                  description: { type: Type.STRING },
                },
                required: ['name', 'location', 'type', 'required', 'description'],
              },
            },
            requestBodyDescription: {
              type: Type.STRING,
              description: 'Description of the request body payload if applicable.',
            },
            responses: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  statusCode: { type: Type.INTEGER },
                  description: { type: Type.STRING },
                },
                required: ['statusCode', 'description'],
              },
            },
            authentication: {
              type: Type.STRING,
              description:
                'Authentication requirement grounded in the source code, or Unknown if not detectable.',
            },
            exampleRequest: {
              type: Type.STRING,
              description: 'Realistic cURL or HTTP request example for this endpoint.',
            },
            exampleResponse: {
              type: Type.STRING,
              description: 'Realistic JSON response string grounded in the endpoint return structure.',
            },
          },
          required: [
            'method',
            'path',
            'summary',
            'description',
            'parameters',
            'responses',
            'authentication',
            'exampleRequest',
            'exampleResponse',
          ],
        },
      },
    },
    required: ['projectName', 'description', 'endpoints'],
  };

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: {
          systemInstruction: `${SYSTEM_INSTRUCTION_BASE}\n\n${getStyleInstruction(style)}`,
          responseMimeType: 'application/json',
          responseSchema,
          temperature: 0.2,
        },
      });

      const rawText = response.text;
      if (!rawText) {
        throw new Error('Empty response from Gemini model');
      }

      const cleanedJson = repairJsonString(rawText);
      const parsed = JSON.parse(cleanedJson) as RawLlmDocumentationOutput;
      if (parsed && Array.isArray(parsed.endpoints)) {
        return { data: parsed, aiPowered: true };
      }
    } catch (err) {
      if (attempt === 2) {
        console.warn('LLM generation fallback triggered after retry:', err);
      }
    }
  }

  return {
    data: buildDeterministicFallback(analysis, style),
    aiPowered: false,
  };
}

function repairJsonString(input: string): string {
  let text = input.trim();
  if (text.startsWith('```')) {
    text = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.slice(firstBrace, lastBrace + 1);
  }
  return text;
}

export function buildDeterministicFallback(
  analysis: AnalysisResult,
  style: DocumentationStyle
): RawLlmDocumentationOutput {
  const endpoints: RawLlmEndpointDoc[] = analysis.endpoints.map((ep: ExtractedEndpointFact) => {
    const humanName = humanizeIdentifier(ep.functionName || ep.path);
    const summary = ep.docstring
      ? ep.docstring.split('.')[0].slice(0, 75)
      : `${humanName}`;

    const description = ep.docstring
      ? ep.docstring
      : style === 'Concise'
      ? `Executes ${ep.method} on ${ep.path}.`
      : `Handles ${ep.method} requests to ${ep.path} (${ep.functionName}). Processes the provided parameters and returns the resulting JSON payload.`;

    const parameters = ep.parameters.map((p) => ({
      name: p.name,
      location: p.location,
      type: p.type,
      required: p.required,
      description:
        p.description ||
        `${capitalize(p.location)} parameter '${p.name}' of type ${p.type}${
          p.required ? ' (required)' : ' (optional)'
        }.`,
    }));

    const exampleObj =
      ep.responseExample ||
      (ep.responseSchema
        ? Object.fromEntries(
            Object.entries(ep.responseSchema).map(([k, v]) => [k, sampleValue(k, String(v))])
          )
        : { status: 'ok' });

    const bodyParams = ep.parameters.filter((p) => p.location === 'body');
    const reqPayload =
      bodyParams.length > 0
        ? Object.fromEntries(bodyParams.map((bp) => [bp.name, sampleValue(bp.name, bp.type)]))
        : ep.requestBodySchema
        ? Object.fromEntries(
            Object.entries(ep.requestBodySchema).map(([k, v]) => [k, sampleValue(k, String(v))])
          )
        : null;

    const curlUrl = `https://api.example.com${ep.path.replace(/\{(\w+)\}/g, '1')}`;
    const curlCmd = reqPayload
      ? `curl -X ${ep.method} "${curlUrl}" \\\n  -H "Content-Type: application/json" \\\n  -d '${JSON.stringify(reqPayload, null, 2)}'`
      : `curl -X ${ep.method} "${curlUrl}" \\\n  -H "Accept: application/json"`;

    return {
      method: ep.method,
      path: ep.path,
      summary,
      description,
      parameters,
      requestBodyDescription: reqPayload
        ? `JSON payload containing ${Object.keys(reqPayload).join(', ')}.`
        : undefined,
      responses: ep.statusCodes.map((code) => ({
        statusCode: code,
        description:
          code === 201
            ? 'Resource created successfully.'
            : code === 204
            ? 'Request succeeded with no response content.'
            : code >= 400
            ? 'Client or validation error response.'
            : 'Successful response returning the requested data.',
      })),
      authentication:
        ep.authentication === 'Unknown'
          ? 'Authentication could not be determined from the provided source.'
          : ep.authentication,
      exampleRequest: curlCmd,
      exampleResponse: JSON.stringify(exampleObj, null, 2),
    };
  });

  return {
    projectName: `${analysis.framework} Service Documentation`,
    description: `Automated technical reference generated from ${analysis.framework} (${analysis.detectedLanguage}) source definitions, covering ${endpoints.length} verified API endpoint${
      endpoints.length === 1 ? '' : 's'
    }.`,
    endpoints,
  };
}

function humanizeIdentifier(raw: string): string {
  return raw
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function sampleValue(name: string, type: string): any {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'john@example.com';
  if (lower.includes('name')) return 'John';
  if (lower.includes('message')) return 'Operation completed successfully';
  if (lower.includes('id')) return type === 'integer' || type === 'number' ? 1 : 'usr_101';
  if (type === 'integer') return 1;
  if (type === 'number') return 49.99;
  if (type === 'boolean') return true;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'example_value';
}
