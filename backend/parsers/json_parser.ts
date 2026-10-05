import type {
  AnalysisResult,
  AuthenticationKind,
  ExtractedEndpointFact,
  ExtractedParameter,
  HttpMethod,
  SupportedLanguage,
} from '../models/schemas.ts';

function resolveRef(rootObj: any, refString: string): any {
  if (!refString || !refString.startsWith('#/')) return null;
  const parts = refString.slice(2).split('/');
  let cur = rootObj;
  for (const part of parts) {
    if (cur && typeof cur === 'object' && part in cur) {
      cur = cur[part];
    } else {
      return null;
    }
  }
  return cur;
}

function flattenSchemaObject(rootObj: any, schemaObj: any): Record<string, string> | null {
  if (!schemaObj) return null;
  const resolved = schemaObj.$ref ? resolveRef(rootObj, schemaObj.$ref) : schemaObj;
  if (!resolved) return null;

  if (resolved.properties && typeof resolved.properties === 'object') {
    const out: Record<string, string> = {};
    for (const [k, v] of Object.entries<any>(resolved.properties)) {
      if (v && v.$ref) {
        out[k] = v.$ref.split('/').pop() || 'object';
      } else {
        out[k] = v?.type || 'string';
      }
    }
    return Object.keys(out).length > 0 ? out : null;
  }

  if (resolved.type === 'array' && resolved.items) {
    const itemSchema = flattenSchemaObject(rootObj, resolved.items);
    return itemSchema || { items: resolved.items.type || 'object' };
  }

  return null;
}

export function parseStructuredSpecObject(
  parsed: any,
  language: SupportedLanguage,
  framework: string
): AnalysisResult {
  const endpoints: ExtractedEndpointFact[] = [];
  const models: Record<string, Record<string, string>> = {};
  const parseWarnings: string[] = [];

  if (!parsed || typeof parsed !== 'object') {
    return {
      detectedLanguage: language,
      framework,
      endpoints: [],
      models: {},
      parseWarnings: ['Document does not contain a valid JSON/YAML object structure.'],
    };
  }

  const schemasDict = parsed.components?.schemas || parsed.definitions || {};
  for (const [schemaName, schemaDef] of Object.entries<any>(schemasDict)) {
    const flattened = flattenSchemaObject(parsed, schemaDef);
    if (flattened) {
      models[schemaName] = flattened;
    }
  }

  let globalAuth: AuthenticationKind = 'Unknown';
  const secSchemes = parsed.components?.securitySchemes || parsed.securityDefinitions || {};
  for (const scheme of Object.values<any>(secSchemes)) {
    if (scheme?.type === 'http' && /bearer/i.test(scheme?.scheme)) {
      globalAuth = /jwt/i.test(scheme?.bearerFormat) ? 'JWT' : 'Bearer Token';
    } else if (scheme?.type === 'apiKey') {
      globalAuth = 'API Key';
    } else if (scheme?.type === 'oauth2') {
      globalAuth = 'OAuth';
    }
  }

  if (parsed.paths && typeof parsed.paths === 'object') {
    let indexCounter = 1;
    for (const [routePath, pathItem] of Object.entries<any>(parsed.paths)) {
      if (!pathItem || typeof pathItem !== 'object') continue;
      const pathLevelParams: any[] = Array.isArray(pathItem.parameters) ? pathItem.parameters : [];

      for (const methodKey of ['get', 'post', 'put', 'patch', 'delete']) {
        const op = pathItem[methodKey];
        if (!op || typeof op !== 'object') continue;

        const method = methodKey.toUpperCase() as HttpMethod;
        const parameters: ExtractedParameter[] = [];

        const combinedParams = [...pathLevelParams, ...(Array.isArray(op.parameters) ? op.parameters : [])];
        for (const rawP of combinedParams) {
          const p = rawP.$ref ? resolveRef(parsed, rawP.$ref) || rawP : rawP;
          if (!p || !p.name) continue;
          const loc = ['path', 'query', 'header', 'body'].includes(p.in) ? p.in : 'query';
          const pType = p.schema?.type || p.type || 'string';
          parameters.push({
            name: p.name,
            location: loc,
            type: pType,
            required: loc === 'path' ? true : Boolean(p.required),
            description: p.description || undefined,
          });
        }

        let requestBodySchema: Record<string, any> | null = null;
        if (op.requestBody) {
          const reqBodyObj = op.requestBody.$ref
            ? resolveRef(parsed, op.requestBody.$ref)
            : op.requestBody;
          const jsonSchema =
            reqBodyObj?.content?.['application/json']?.schema ||
            reqBodyObj?.content?.['*/*']?.schema;
          const flattened = flattenSchemaObject(parsed, jsonSchema);
          if (flattened) {
            requestBodySchema = flattened;
            const reqList: string[] = Array.isArray(jsonSchema?.required) ? jsonSchema.required : [];
            for (const [fName, fType] of Object.entries(flattened)) {
              if (!parameters.some((param) => param.name === fName && param.location === 'body')) {
                parameters.push({
                  name: fName,
                  location: 'body',
                  type: fType,
                  required: reqList.length > 0 ? reqList.includes(fName) : true,
                });
              }
            }
          }
        }

        const statusCodes: number[] = [];
        let responseSchema: Record<string, any> | null = null;
        let responseExample: any = null;

        if (op.responses && typeof op.responses === 'object') {
          for (const [codeKey, respObj] of Object.entries<any>(op.responses)) {
            const numericCode = parseInt(codeKey, 10);
            if (!isNaN(numericCode)) {
              statusCodes.push(numericCode);
            }
            if (codeKey.startsWith('2') && !responseSchema) {
              const rSchema =
                respObj?.content?.['application/json']?.schema || respObj?.schema;
              responseSchema = flattenSchemaObject(parsed, rSchema);
              responseExample =
                respObj?.content?.['application/json']?.example ||
                respObj?.examples?.['application/json'] ||
                null;
            }
          }
        }
        if (statusCodes.length === 0) statusCodes.push(200);

        let endpointAuth: AuthenticationKind = globalAuth;
        if (Array.isArray(op.security)) {
          if (op.security.length === 0) {
            endpointAuth = 'None';
          } else if (globalAuth === 'Unknown') {
            endpointAuth = 'Bearer Token';
          }
        }

        endpoints.push({
          id: `${method}_${routePath}`,
          method,
          path: routePath,
          functionName: op.operationId || `${methodKey}_${routePath.replace(/[^a-zA-Z0-9]/g, '_')}`,
          lineStart: indexCounter++,
          docstring: [op.summary, op.description].filter(Boolean).join(' — '),
          parameters,
          requestBodySchema,
          responseSchema,
          responseExample,
          statusCodes,
          authentication: endpointAuth,
          rawSnippet: JSON.stringify({ [routePath]: { [methodKey]: op } }, null, 2),
        });
      }
    }
  } else if (Array.isArray(parsed.endpoints || parsed.routes || parsed)) {
    const list = Array.isArray(parsed) ? parsed : parsed.endpoints || parsed.routes;
    list.forEach((item: any, idx: number) => {
      if (!item || typeof item !== 'object') return;
      const rawMethod = String(item.method || 'GET').toUpperCase();
      const method: HttpMethod = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(rawMethod)
        ? (rawMethod as HttpMethod)
        : 'GET';
      const path = String(item.path || item.url || item.route || `/endpoint-${idx + 1}`);
      const parameters: ExtractedParameter[] = Array.isArray(item.parameters)
        ? item.parameters.map((p: any) => ({
            name: String(p.name || 'param'),
            location: ['path', 'query', 'header', 'body'].includes(p.location || p.in)
              ? p.location || p.in
              : 'query',
            type: String(p.type || 'string'),
            required: Boolean(p.required ?? true),
            description: p.description,
          }))
        : [];

      endpoints.push({
        id: `${method}_${path}`,
        method,
        path,
        functionName: item.name || item.operationId || `${method.toLowerCase()}_${idx + 1}`,
        lineStart: idx + 1,
        docstring: item.description || item.summary || '',
        parameters,
        requestBodySchema: item.requestBody || null,
        responseSchema: item.response || item.responseSchema || null,
        responseExample: item.exampleResponse || null,
        statusCodes: Array.isArray(item.statusCodes) ? item.statusCodes : [200],
        authentication: item.authentication || 'Unknown',
        rawSnippet: JSON.stringify(item, null, 2),
      });
    });
  }

  return {
    detectedLanguage: language,
    framework,
    endpoints,
    models,
    parseWarnings,
  };
}

export function parseJsonSpec(sourceCode: string, framework: string): AnalysisResult {
  try {
    const parsed = JSON.parse(sourceCode);
    return parseStructuredSpecObject(parsed, 'json', framework);
  } catch (err: any) {
    return {
      detectedLanguage: 'json',
      framework,
      endpoints: [],
      models: {},
      parseWarnings: [`Invalid JSON syntax: ${err?.message || 'Unable to parse JSON'}`],
    };
  }
}
