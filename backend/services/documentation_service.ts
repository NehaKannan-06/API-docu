import YAML from 'yaml';
import type {
  AnalysisResult,
  DocumentationStyle,
  GeneratedDocumentation,
} from '../models/schemas.ts';
import { analyzeSourceCode } from '../parsers/index.ts';
import { generateStructuredDocsWithLLM } from './llm_service.ts';
import { validateAndGroundDocumentation } from './validation_service.ts';

export async function runDocumentationPipeline(
  sourceCode: string,
  options?: {
    language?: string;
    filename?: string;
    style?: DocumentationStyle;
  }
): Promise<{
  analysis: AnalysisResult;
  documentation: GeneratedDocumentation;
}> {
  const style: DocumentationStyle = options?.style || 'Developer Friendly';

  const analysis = analyzeSourceCode(sourceCode, options?.language, options?.filename);

  if (analysis.endpoints.length === 0) {
    throw new Error(
      'No API endpoints were detected in this file. Please provide source code or a JSON/YAML specification containing API routes.'
    );
  }

  const { data: rawLlmOutput, aiPowered } = await generateStructuredDocsWithLLM(
    analysis,
    style
  );

  const documentation = validateAndGroundDocumentation(
    analysis,
    rawLlmOutput,
    style,
    aiPowered
  );

  return { analysis, documentation };
}

export function exportDocumentationToMarkdown(doc: GeneratedDocumentation): string {
  const lines: string[] = [];

  lines.push(`# ${doc.projectName}`);
  lines.push('');
  lines.push(`${doc.description}`);
  lines.push('');
  lines.push(
    `**Framework:** ${doc.framework} · **Language:** ${doc.language.toUpperCase()} · **Documentation Quality:** ${doc.qualityScore.overall}% · **Style:** ${doc.style}`
  );
  lines.push('');
  lines.push('---');
  lines.push('');
  lines.push('## Endpoints Overview');
  lines.push('');
  lines.push('| Method | Path | Summary | Authentication |');
  lines.push('| :--- | :--- | :--- | :--- |');
  for (const ep of doc.endpoints) {
    lines.push(`| **${ep.method}** | \`${ep.path}\` | ${ep.summary} | ${ep.authentication} |`);
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const ep of doc.endpoints) {
    lines.push(`## \`${ep.method}\` ${ep.path}`);
    lines.push('');
    lines.push(`**${ep.summary}**`);
    lines.push('');
    lines.push(`${ep.description}`);
    lines.push('');
    lines.push(`- **Handler:** \`${ep.functionName}\` (Line ${ep.lineStart})`);
    lines.push(`- **Authentication:** ${ep.authentication}`);
    lines.push('');

    if (ep.parameters.length > 0) {
      lines.push('### Parameters');
      lines.push('');
      lines.push('| Name | Location | Type | Required | Description |');
      lines.push('| :--- | :--- | :--- | :--- | :--- |');
      for (const p of ep.parameters) {
        lines.push(
          `| \`${p.name}\` | ${p.location} | \`${p.type}\` | ${
            p.required ? 'Yes' : 'No'
          } | ${p.description} |`
        );
      }
      lines.push('');
    } else {
      lines.push('### Parameters');
      lines.push('');
      lines.push('_No parameters required for this endpoint._');
      lines.push('');
    }

    if (ep.requestBody) {
      lines.push('### Request Body');
      lines.push('');
      lines.push(`**Content-Type:** \`${ep.requestBody.contentType}\``);
      lines.push('');
      lines.push(`${ep.requestBody.description}`);
      lines.push('');
      if (ep.requestBody.schema) {
        lines.push('```json');
        lines.push(JSON.stringify(ep.requestBody.schema, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('### Responses');
    lines.push('');
    for (const resp of ep.responses) {
      lines.push(`#### \`${resp.statusCode} ${resp.statusText}\``);
      lines.push('');
      lines.push(`${resp.description}`);
      lines.push('');
      if (resp.example) {
        lines.push('```json');
        lines.push(JSON.stringify(resp.example, null, 2));
        lines.push('```');
        lines.push('');
      }
    }

    lines.push('### Example Request');
    lines.push('');
    lines.push('```bash');
    lines.push(ep.exampleRequest);
    lines.push('```');
    lines.push('');
    lines.push('### Example Response');
    lines.push('');
    lines.push('```json');
    lines.push(ep.exampleResponse);
    lines.push('```');
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  return lines.join('\n');
}

export function exportDocumentationToOpenAPI(
  doc: GeneratedDocumentation,
  format: 'json' | 'yaml' = 'json'
): string {
  const paths: Record<string, any> = {};

  for (const ep of doc.endpoints) {
    if (!paths[ep.path]) {
      paths[ep.path] = {};
    }

    const methodLower = ep.method.toLowerCase();
    const nonBodyParams = ep.parameters.filter((p) => p.location !== 'body');

    const operationObj: Record<string, any> = {
      summary: ep.summary,
      description: ep.description,
      operationId: ep.functionName || `${methodLower}_${ep.path.replace(/[^a-zA-Z0-9]/g, '_')}`,
      tags: ep.tags,
      parameters: nonBodyParams.map((p) => ({
        name: p.name,
        in: p.location,
        required: p.location === 'path' ? true : p.required,
        description: p.description,
        schema: {
          type: mapToOpenApiType(p.type),
        },
      })),
      responses: {},
    };

    if (ep.requestBody) {
      const properties: Record<string, any> = {};
      const requiredFields: string[] = [];

      if (ep.requestBody.schema) {
        for (const [k, v] of Object.entries(ep.requestBody.schema)) {
          properties[k] = { type: mapToOpenApiType(String(v)) };
          requiredFields.push(k);
        }
      }

      operationObj.requestBody = {
        required: ep.requestBody.required,
        description: ep.requestBody.description,
        content: {
          [ep.requestBody.contentType]: {
            schema: {
              type: 'object',
              properties,
              ...(requiredFields.length > 0 ? { required: requiredFields } : {}),
            },
            example: ep.requestBody.example,
          },
        },
      };
    }

    for (const resp of ep.responses) {
      const respProperties: Record<string, any> = {};
      if (resp.schema) {
        for (const [k, v] of Object.entries(resp.schema)) {
          respProperties[k] = { type: mapToOpenApiType(String(v)) };
        }
      }

      operationObj.responses[String(resp.statusCode)] = {
        description: resp.description,
        content: {
          'application/json': {
            schema: {
              type: 'object',
              properties: respProperties,
            },
            example: resp.example,
          },
        },
      };
    }

    paths[ep.path][methodLower] = operationObj;
  }

  const openApiSpec = {
    openapi: '3.0.3',
    info: {
      title: doc.projectName,
      description: doc.description,
      version: doc.version,
    },
    servers: [
      {
        url: doc.baseUrl,
        description: 'Primary API Server',
      },
    ],
    paths,
  };

  if (format === 'yaml') {
    return YAML.stringify(openApiSpec);
  }
  return JSON.stringify(openApiSpec, null, 2);
}

function mapToOpenApiType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower === 'integer' || lower === 'int') return 'integer';
  if (lower === 'number' || lower === 'float' || lower === 'double') return 'number';
  if (lower === 'boolean' || lower === 'bool') return 'boolean';
  if (lower === 'array' || lower.startsWith('array')) return 'array';
  if (lower === 'object') return 'object';
  return 'string';
}
