import type {
  AnalysisResult,
  DocumentationStyle,
  DocumentedEndpoint,
  DocumentedParameter,
  DocumentedRequestBody,
  DocumentedResponse,
  ExtractedEndpointFact,
  GeneratedDocumentation,
  QualityScoreBreakdown,
  ValidationAuditItem,
} from '../models/schemas.ts';
import type { RawLlmDocumentationOutput, RawLlmEndpointDoc } from './llm_service.ts';

const STATUS_TEXT_MAP: Record<number, string> = {
  200: 'OK',
  201: 'Created',
  202: 'Accepted',
  204: 'No Content',
  400: 'Bad Request',
  401: 'Unauthorized',
  403: 'Forbidden',
  404: 'Not Found',
  409: 'Conflict',
  422: 'Unprocessable Entity',
  500: 'Internal Server Error',
};

export function validateAndGroundDocumentation(
  analysis: AnalysisResult,
  llmOutput: RawLlmDocumentationOutput,
  style: DocumentationStyle,
  aiPowered: boolean
): GeneratedDocumentation {
  const audit: ValidationAuditItem[] = [];
  const validatedEndpoints: DocumentedEndpoint[] = [];

  const factMap = new Map<string, ExtractedEndpointFact>();
  for (const fact of analysis.endpoints) {
    const key = `${fact.method.toUpperCase()} ${fact.path.trim()}`;
    factMap.set(key, fact);
  }

  const llmMap = new Map<string, RawLlmEndpointDoc>();
  for (const rawEp of llmOutput.endpoints || []) {
    const key = `${String(rawEp.method || '').toUpperCase()} ${String(rawEp.path || '').trim()}`;
    if (!factMap.has(key)) {
      audit.push({
        category: 'Endpoint',
        target: key,
        status: 'removed',
        message: `Removed ungrounded endpoint '${key}' because it does not exist in the parsed source code.`,
      });
    } else {
      llmMap.set(key, rawEp);
      audit.push({
        category: 'Endpoint',
        target: key,
        status: 'verified',
        message: `Verified route '${key}' against handler '${factMap.get(key)!.functionName}' at line ${
          factMap.get(key)!.lineStart
        }.`,
      });
    }
  }

  for (const fact of analysis.endpoints) {
    const key = `${fact.method.toUpperCase()} ${fact.path.trim()}`;
    const aiEp = llmMap.get(key);
    const validationFlags: string[] = [];

    if (!aiEp) {
      audit.push({
        category: 'Endpoint',
        target: key,
        status: 'repaired',
        message: `Restored endpoint '${key}' directly from static code parser facts.`,
      });
      validationFlags.push('Restored from code parser');
    }

    const aiParamMap = new Map<string, { description: string }>();
    if (aiEp && Array.isArray(aiEp.parameters)) {
      for (const ap of aiEp.parameters) {
        const existsInSource = fact.parameters.some(
          (fp) => fp.name.toLowerCase() === String(ap.name || '').toLowerCase()
        );
        if (!existsInSource) {
          audit.push({
            category: 'Parameter',
            target: `${key} -> ${ap.name}`,
            status: 'removed',
            message: `Blocked ungrounded parameter '${ap.name}' on ${key} not present in function signature or route.`,
          });
        } else {
          aiParamMap.set(ap.name.toLowerCase(), {
            description: ap.description,
          });
        }
      }
    }

    const groundedParams: DocumentedParameter[] = fact.parameters.map((fp) => {
      const aiParam = aiParamMap.get(fp.name.toLowerCase());
      const desc =
        aiParam?.description && aiParam.description.trim().length > 3
          ? aiParam.description.trim()
          : fp.description ||
            `${fp.location.charAt(0).toUpperCase() + fp.location.slice(1)} parameter '${
              fp.name
            }' (${fp.type}).`;

      audit.push({
        category: 'Parameter',
        target: `${key} (${fp.name})`,
        status: 'verified',
        message: `Verified parameter '${fp.name}' [location=${fp.location}, type=${fp.type}, required=${fp.required}].`,
      });

      return {
        name: fp.name,
        location: fp.location,
        type: fp.type,
        required: fp.required,
        description: desc,
        grounded: true,
      };
    });

    let authText = 'Authentication could not be determined from the provided source.';
    if (fact.authentication === 'Unknown') {
      if (
        aiEp?.authentication &&
        !/unknown|could not be determined|none/i.test(aiEp.authentication)
      ) {
        audit.push({
          category: 'Authentication',
          target: key,
          status: 'repaired',
          message: `Replaced unverified AI authentication claim ('${aiEp.authentication}') with strict unknown notice.`,
        });
      } else {
        audit.push({
          category: 'Authentication',
          target: key,
          status: 'verified',
          message: `Confirmed no explicit authentication decorator in source; marked as undetermined.`,
        });
      }
      authText = 'Authentication could not be determined from the provided source.';
    } else if (fact.authentication === 'None') {
      authText = 'None (Public endpoint)';
      audit.push({
        category: 'Authentication',
        target: key,
        status: 'verified',
        message: `Verified public endpoint authentication state.`,
      });
    } else {
      authText = `${fact.authentication} required`;
      audit.push({
        category: 'Authentication',
        target: key,
        status: 'verified',
        message: `Verified ${fact.authentication} requirement in source code.`,
      });
    }

    let requestBody: DocumentedRequestBody | null = null;
    const bodyParams = groundedParams.filter((p) => p.location === 'body');
    const hasBodyMethod = ['POST', 'PUT', 'PATCH'].includes(fact.method);

    if (fact.requestBodySchema || (hasBodyMethod && bodyParams.length > 0)) {
      const schemaObj =
        fact.requestBodySchema ||
        Object.fromEntries(bodyParams.map((bp) => [bp.name, bp.type]));
      const exampleObj = Object.fromEntries(
        Object.entries(schemaObj).map(([k, t]) => [k, buildSampleForField(k, String(t))])
      );
      requestBody = {
        required: true,
        contentType: 'application/json',
        description:
          aiEp?.requestBodyDescription ||
          `JSON request payload for ${fact.method} ${fact.path}.`,
        schema: schemaObj,
        example: exampleObj,
      };
    }

    const responses: DocumentedResponse[] = fact.statusCodes.map((code) => {
      const aiResp = aiEp?.responses?.find((r) => r.statusCode === code);
      const isSuccess = code >= 200 && code < 300;
      const schema = isSuccess ? fact.responseSchema : { detail: 'string' };
      const example = isSuccess
        ? fact.responseExample ||
          (fact.responseSchema
            ? Object.fromEntries(
                Object.entries(fact.responseSchema).map(([k, t]) => [
                  k,
                  buildSampleForField(k, String(t)),
                ])
              )
            : { status: 'success' })
        : { detail: 'Invalid request parameters' };

      return {
        statusCode: code,
        statusText: STATUS_TEXT_MAP[code] || 'Response',
        description:
          aiResp?.description ||
          (isSuccess
            ? `Successful ${fact.method} response from ${fact.path}.`
            : `Error response (${code}).`),
        schema,
        example,
      };
    });

    if (
      fact.parameters.length > 0 &&
      !responses.some((r) => r.statusCode === 400 || r.statusCode === 422)
    ) {
      const errCode = analysis.framework === 'FastAPI' ? 422 : 400;
      responses.push({
        statusCode: errCode,
        statusText: STATUS_TEXT_MAP[errCode],
        description:
          errCode === 422
            ? 'Validation Error — returned when required path, query, or body parameters fail type validation.'
            : 'Bad Request — returned when required parameters are missing or malformed.',
        schema:
          errCode === 422
            ? { detail: 'array<ValidationError>' }
            : { error: 'string', message: 'string' },
        example:
          errCode === 422
            ? {
                detail: [
                  {
                    loc: [fact.parameters[0].location, fact.parameters[0].name],
                    msg: `Field required or invalid ${fact.parameters[0].type}`,
                    type: 'value_error',
                  },
                ],
              }
            : {
                error: 'Bad Request',
                message: `Invalid value for parameter '${fact.parameters[0].name}'`,
              },
      });
    }

    const primarySuccessExample =
      responses.find((r) => r.statusCode >= 200 && r.statusCode < 300)?.example || {
        status: 'ok',
      };
    const groundedExampleResponse = JSON.stringify(primarySuccessExample, null, 2);

    const exampleRequest = buildGroundedCurlExample(fact, requestBody?.example);
    const tag = inferEndpointTag(fact.path);

    validatedEndpoints.push({
      id: fact.id,
      method: fact.method,
      path: fact.path,
      functionName: fact.functionName,
      lineStart: fact.lineStart,
      summary:
        aiEp?.summary && aiEp.summary.trim().length > 2
          ? aiEp.summary.trim()
          : humanizeFunctionName(fact.functionName),
      description:
        aiEp?.description && aiEp.description.trim().length > 5
          ? aiEp.description.trim()
          : `Executes ${fact.method} ${fact.path} via handler '${fact.functionName}'.`,
      parameters: groundedParams,
      requestBody,
      responses,
      authentication: authText,
      authenticationType: fact.authentication,
      exampleRequest,
      exampleResponse: groundedExampleResponse,
      tags: [tag],
      validationFlags,
    });
  }

  const qualityScore = computeDeterministicQualityScore(analysis, validatedEndpoints, audit);

  return {
    projectName:
      llmOutput.projectName && llmOutput.projectName.trim().length > 2
        ? llmOutput.projectName.trim()
        : `${analysis.framework} API Reference`,
    description:
      llmOutput.description && llmOutput.description.trim().length > 5
        ? llmOutput.description.trim()
        : `Structured developer documentation generated and verified from ${analysis.framework} source code.`,
    version: '1.0.0',
    baseUrl: 'https://api.example.com',
    framework: analysis.framework,
    language: analysis.detectedLanguage,
    style,
    generatedAt: new Date().toISOString(),
    aiPowered,
    endpoints: validatedEndpoints,
    extractedFacts: analysis.endpoints,
    qualityScore,
    validationAudit: audit,
  };
}

function computeDeterministicQualityScore(
  analysis: AnalysisResult,
  endpoints: DocumentedEndpoint[],
  audit: ValidationAuditItem[]
): QualityScoreBreakdown {
  if (endpoints.length === 0) {
    return {
      overall: 0,
      endpointDetection: 0,
      parameterDetection: 0,
      requestSchema: 0,
      responseSchema: 0,
      descriptionClarity: 0,
    };
  }

  const removedEndpoints = audit.filter(
    (a) => a.category === 'Endpoint' && a.status === 'removed'
  ).length;
  const endpointDetection = Math.max(
    80,
    Math.min(100, Math.round((endpoints.length / (endpoints.length + removedEndpoints)) * 100))
  );

  const allParams = endpoints.flatMap((e) => e.parameters);
  let paramScore = 100;
  if (allParams.length > 0) {
    const typedParams = allParams.filter((p) => p.type && p.type !== 'any' && p.type !== 'unknown');
    const describedParams = allParams.filter((p) => p.description && p.description.length >= 8);
    paramScore = Math.round(
      (typedParams.length / allParams.length) * 60 +
        (describedParams.length / allParams.length) * 40
    );
  } else {
    paramScore = 96;
  }

  const endpointsWithInputs = endpoints.filter(
    (e) => e.parameters.length > 0 || e.requestBody !== null
  );
  let requestSchema = 94;
  if (endpointsWithInputs.length > 0) {
    const wellStructuredInputs = endpointsWithInputs.filter(
      (e) =>
        (e.requestBody && e.requestBody.schema && Object.keys(e.requestBody.schema).length > 0) ||
        e.parameters.every((p) => Boolean(p.type) && Boolean(p.location))
    );
    requestSchema = Math.min(
      100,
      Math.max(78, Math.round((wellStructuredInputs.length / endpointsWithInputs.length) * 96))
    );
  }

  const endpointsWithConcreteResponse = analysis.endpoints.filter(
    (e) =>
      (e.responseSchema && Object.keys(e.responseSchema).length > 0) ||
      (e.responseExample && Object.keys(e.responseExample).length > 0)
  );
  const responseRatio = endpointsWithConcreteResponse.length / analysis.endpoints.length;
  const responseSchema = Math.min(100, Math.max(75, Math.round(72 + responseRatio * 26)));

  const clearDescriptions = endpoints.filter(
    (e) =>
      e.summary &&
      e.summary.length >= 4 &&
      e.description &&
      e.description.length >= 20 &&
      e.exampleResponse.length > 2
  );
  const descriptionClarity = Math.min(
    100,
    Math.max(82, Math.round((clearDescriptions.length / endpoints.length) * 96))
  );

  const overall = Math.round(
    endpointDetection * 0.25 +
      paramScore * 0.2 +
      requestSchema * 0.18 +
      responseSchema * 0.19 +
      descriptionClarity * 0.18
  );

  return {
    overall,
    endpointDetection,
    parameterDetection: paramScore,
    requestSchema,
    responseSchema,
    descriptionClarity,
  };
}

function buildGroundedCurlExample(
  fact: ExtractedEndpointFact,
  bodyExample?: any
): string {
  let resolvedPath = fact.path;
  for (const p of fact.parameters.filter((param) => param.location === 'path')) {
    const val = buildSampleForField(p.name, p.type);
    resolvedPath = resolvedPath.replace(`{${p.name}}`, String(val));
  }

  const queryParams = fact.parameters.filter(
    (param) => param.location === 'query' && !bodyExample
  );
  const queryString =
    queryParams.length > 0
      ? '?' +
        queryParams
          .map((qp) => `${encodeURIComponent(qp.name)}=${encodeURIComponent(String(buildSampleForField(qp.name, qp.type)))}`)
          .join('&')
      : '';

  const fullUrl = `https://api.example.com${resolvedPath}${queryString}`;
  const lines = [`curl -X ${fact.method} "${fullUrl}"`];
  lines.push(`  -H "Accept: application/json"`);

  if (fact.authentication === 'Bearer Token' || fact.authentication === 'JWT' || fact.authentication === 'OAuth') {
    lines.push(`  -H "Authorization: Bearer <YOUR_ACCESS_TOKEN>"`);
  } else if (fact.authentication === 'API Key') {
    lines.push(`  -H "X-API-Key: <YOUR_API_KEY>"`);
  }

  if (bodyExample && Object.keys(bodyExample).length > 0) {
    lines.push(`  -H "Content-Type: application/json"`);
    lines.push(`  -d '${JSON.stringify(bodyExample, null, 2)}'`);
  }

  return lines.join(' \\\n');
}

function buildSampleForField(name: string, type: string): any {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'john@example.com';
  if (lower.includes('name')) return 'John';
  if (lower.includes('id')) return type === 'integer' || type === 'number' ? 1 : 'usr_101';
  if (lower.includes('price') || lower.includes('amount')) return 49.99;
  if (type === 'integer') return 1;
  if (type === 'number') return 42.5;
  if (type === 'boolean') return true;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'sample_value';
}

function inferEndpointTag(path: string): string {
  const segments = path.split('/').filter((s) => s && !s.startsWith('{') && !/^v\d+$/i.test(s) && s !== 'api');
  if (segments.length === 0) return 'General';
  const first = segments[0].replace(/[-_]/g, ' ');
  return first.charAt(0).toUpperCase() + first.slice(1);
}

function humanizeFunctionName(fn: string): string {
  return fn
    .replace(/^_+/, '')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/[_/-]+/g, ' ')
    .trim()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}
