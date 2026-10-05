import type {
  AnalysisResult,
  AuthenticationKind,
  ExtractedEndpointFact,
  ExtractedParameter,
  HttpMethod,
} from '../models/schemas.ts';

function normalizePythonType(rawType: string): string {
  const clean = rawType.trim().replace(/^Optional\[(.*)\]$/, '$1');
  const lower = clean.toLowerCase();
  if (lower === 'int' || lower === 'integer') return 'integer';
  if (lower === 'str' || lower === 'string' || lower === 'emailstr' || lower === 'uuid') return 'string';
  if (lower === 'float' || lower === 'decimal' || lower === 'number') return 'number';
  if (lower === 'bool' || lower === 'boolean') return 'boolean';
  if (lower.startsWith('list') || lower.startsWith('sequence')) return 'array';
  if (lower.startsWith('dict') || lower.startsWith('mapping')) return 'object';
  return clean || 'string';
}

function sampleValueForType(type: string, name: string): any {
  const lowerName = name.toLowerCase();
  if (lowerName.includes('email')) return 'john@example.com';
  if (lowerName.includes('name')) return 'John';
  if (lowerName.includes('id')) return type === 'integer' ? 1 : 'usr_101';
  if (lowerName.includes('price') || lowerName.includes('amount')) return 49.99;
  if (lowerName.includes('active') || lowerName.includes('enabled') || type === 'boolean') return true;
  if (type === 'integer') return 1;
  if (type === 'number') return 99.5;
  if (type === 'array') return [];
  if (type === 'object') return {};
  return 'sample_' + name;
}

export function parsePythonCode(sourceCode: string, framework: string): AnalysisResult {
  const lines = sourceCode.split('\n');
  const models: Record<string, Record<string, string>> = {};
  const endpoints: ExtractedEndpointFact[] = [];
  const parseWarnings: string[] = [];

  // 1. Extract Pydantic BaseModel or dataclass definitions
  const classRegex = /^class\s+(\w+)\s*(?:\(([^)]*)\))?\s*:/;
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(classRegex);
    if (match) {
      const className = match[1];
      const fields: Record<string, string> = {};
      let j = i + 1;
      while (j < lines.length) {
        const line = lines[j];
        if (line.trim() === '' || line.trim().startsWith('#')) {
          j++;
          continue;
        }
        if (!/^\s+/.test(line)) break;
        const fieldMatch = line.match(/^\s+(\w+)\s*:\s*([^=#\n]+)(?:=\s*([^#\n]+))?/);
        if (fieldMatch && !fieldMatch[1].startsWith('def ')) {
          fields[fieldMatch[1]] = normalizePythonType(fieldMatch[2]);
        }
        j++;
      }
      if (Object.keys(fields).length > 0) {
        models[className] = fields;
      }
    }
  }

  // 2. Detect global authentication patterns in file
  const hasOAuth2Global = /OAuth2PasswordBearer|OAuth2AuthorizationCodeBearer/i.test(sourceCode);
  const hasHTTPBearerGlobal = /HTTPBearer/i.test(sourceCode);
  const hasAPIKeyGlobal = /APIKeyHeader|APIKeyQuery|X-API-Key/i.test(sourceCode);
  const hasJWTGlobal = /\bjwt\.decode\b|\bpyjwt\b|\bjose\b/i.test(sourceCode);

  // 3. Scan for route decorators (@app.get, @router.post, @app.route, etc.)
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    // Match FastAPI / Flask 2.0 style: @app.get("/path") or @router.post("/path", status_code=201)
    const fastApiMatch = line.match(
      /^@(?:app|router|api|bp|v1|v2)\.(get|post|put|patch|delete)\s*\(\s*['"]([^'"]+)['"](.*)\)/i
    );

    // Match Flask style: @app.route("/path", methods=["GET", "POST"])
    const flaskMatch = line.match(
      /^@(?:app|bp|blueprint|api)\.route\s*\(\s*['"]([^'"]+)['"](.*)\)/i
    );

    if (!fastApiMatch && !flaskMatch) continue;

    let methods: HttpMethod[] = ['GET'];
    let rawPath = '';
    let decoratorArgs = '';

    if (fastApiMatch) {
      methods = [fastApiMatch[1].toUpperCase() as HttpMethod];
      rawPath = fastApiMatch[2];
      decoratorArgs = fastApiMatch[3] || '';
    } else if (flaskMatch) {
      rawPath = flaskMatch[1];
      decoratorArgs = flaskMatch[2] || '';
      const methodsMatch = decoratorArgs.match(/methods\s*=\s*\[([^\]]+)\]/i);
      if (methodsMatch) {
        const extractedMethods = methodsMatch[1]
          .split(',')
          .map((m) => m.replace(/['"\s]/g, '').toUpperCase())
          .filter((m): m is HttpMethod =>
            ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].includes(m)
          );
        if (extractedMethods.length > 0) {
          methods = extractedMethods;
        }
      }
    }

    // Normalize Flask <int:user_id> or <user_id> to {user_id}
    const flaskPathParams: Record<string, string> = {};
    const normalizedPath = rawPath.replace(/<(?:(\w+):)?(\w+)>/g, (_, typeHint, paramName) => {
      if (typeHint) {
        flaskPathParams[paramName] = normalizePythonType(typeHint);
      } else {
        flaskPathParams[paramName] = 'string';
      }
      return `{${paramName}}`;
    });

    // Extract path parameter names from {param}
    const pathParamNames = Array.from(normalizedPath.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);

    // Find preceding comments
    const precedingComments: string[] = [];
    let k = i - 1;
    while (k >= 0 && lines[k].trim().startsWith('#')) {
      precedingComments.unshift(lines[k].trim().replace(/^#+\s*/, ''));
      k--;
    }

    // Find function definition (`def` or `async def`)
    let defLineIdx = i + 1;
    while (
      defLineIdx < lines.length &&
      lines[defLineIdx].trim().startsWith('@')
    ) {
      defLineIdx++;
    }

    // Gather full function signature (can span multiple lines)
    let sigLines = '';
    let sigEndIdx = defLineIdx;
    while (sigEndIdx < lines.length) {
      sigLines += ' ' + lines[sigEndIdx].trim();
      if (lines[sigEndIdx].includes('):') || lines[sigEndIdx].trim().endsWith(':')) {
        break;
      }
      sigEndIdx++;
    }

    const funcMatch = sigLines.match(/(?:async\s+)?def\s+(\w+)\s*\(([\s\S]*?)\)\s*(?:->\s*([^:]+))?:/);
    const functionName = funcMatch ? funcMatch[1] : `endpoint_${i + 1}`;
    const rawParamsStr = funcMatch ? funcMatch[2] : '';
    const returnAnnotation = funcMatch && funcMatch[3] ? funcMatch[3].trim() : '';

    // Collect function body lines
    const bodyLines: string[] = [];
    let bodyIdx = sigEndIdx + 1;
    while (bodyIdx < lines.length) {
      const bLine = lines[bodyIdx];
      if (bLine.trim() !== '' && !/^\s+/.test(bLine) && !bLine.trim().startsWith('#')) {
        break;
      }
      bodyLines.push(bLine);
      bodyIdx++;
    }

    const fullBodyText = bodyLines.join('\n');
    const rawSnippet = lines.slice(Math.max(0, i - precedingComments.length), bodyIdx).join('\n');

    // Extract docstring if present
    let docstring = precedingComments.join(' ');
    const docMatch = fullBodyText.match(/^\s*(?:"""([\s\S]*?)"""|'''([\s\S]*?)''')/);
    if (docMatch) {
      const extractedDoc = (docMatch[1] || docMatch[2] || '').trim();
      docstring = docstring ? `${docstring}\n${extractedDoc}` : extractedDoc;
    }

    // Parse parameters from function signature
    const parsedParams: ExtractedParameter[] = [];
    let requestBodySchema: Record<string, any> | null = null;
    let detectedAuth: AuthenticationKind = 'Unknown';

    // Check decorator & signature for authentication
    const combinedFuncContext = `${decoratorArgs}\n${sigLines}\n${fullBodyText}`;
    if (/Depends\s*\(\s*(?:get_current_user|verify_token|oauth2_scheme|security|require_auth|verify_jwt|get_api_key)/i.test(combinedFuncContext)) {
      if (hasJWTGlobal || /jwt/i.test(combinedFuncContext)) {
        detectedAuth = 'JWT';
      } else if (hasOAuth2Global || /oauth/i.test(combinedFuncContext)) {
        detectedAuth = 'OAuth';
      } else if (hasAPIKeyGlobal || /api_key/i.test(combinedFuncContext)) {
        detectedAuth = 'API Key';
      } else {
        detectedAuth = 'Bearer Token';
      }
    } else if (/request\.headers\.get\s*\(\s*['"]Authorization['"]\)/i.test(combinedFuncContext) || /HTTPBearer/i.test(combinedFuncContext)) {
      detectedAuth = hasJWTGlobal ? 'JWT' : 'Bearer Token';
    } else if (/request\.headers\.get\s*\(\s*['"]X-API-Key['"]\)/i.test(combinedFuncContext) || /APIKeyHeader/i.test(combinedFuncContext)) {
      detectedAuth = 'API Key';
    }

    // Split function arguments safely by top-level commas respecting string quotes
    const paramTokens = splitTopLevelCommas(rawParamsStr);

    for (const token of paramTokens) {
      const cleanToken = token.trim();
      if (!cleanToken || cleanToken === 'self' || cleanToken === 'request' || cleanToken.startsWith('*')) {
        continue;
      }

      // Skip Depends(...) auth/db injections
      if (/Depends\s*\(/.test(cleanToken)) {
        continue;
      }
      if (/:\s*(?:Request|Response|BackgroundTasks|Session|AsyncSession)\b/.test(cleanToken)) {
        continue;
      }

      const paramParts = cleanToken.match(/^(\w+)(?:\s*:\s*([^=]+))?(?:\s*=\s*(.+))?$/);
      if (!paramParts) continue;

      const pName = paramParts[1].trim();
      const pRawType = paramParts[2] ? paramParts[2].trim() : 'string';
      const pDefault = paramParts[3] ? paramParts[3].trim() : undefined;

      // Check if pRawType is a known Pydantic model
      if (models[pRawType]) {
        requestBodySchema = { ...models[pRawType] };
        for (const [field, fieldType] of Object.entries(models[pRawType])) {
          parsedParams.push({
            name: field,
            location: 'body',
            type: fieldType,
            required: true,
          });
        }
        continue;
      }

      const normalizedType = normalizePythonType(pRawType);
      const isOptional =
        pRawType.startsWith('Optional[') ||
        pRawType.includes('| None') ||
        (pDefault !== undefined && pDefault !== '...' && !pDefault.includes('...'));

      let location: 'path' | 'query' | 'header' | 'body' = 'query';
      if (pathParamNames.includes(pName)) {
        location = 'path';
      } else if (pDefault && /^Header\s*\(/.test(pDefault)) {
        location = 'header';
      } else if (pDefault && /^Body\s*\(/.test(pDefault)) {
        location = 'body';
      } else if (pDefault && /^Path\s*\(/.test(pDefault)) {
        location = 'path';
      }

      parsedParams.push({
        name: pName,
        location,
        type: normalizedType,
        required: location === 'path' ? true : !isOptional,
        defaultValue: pDefault && !/^(?:Query|Path|Body|Header)\s*\(/.test(pDefault) ? pDefault : undefined,
      });
    }

    // Ensure all path parameters in the route URL are included even if omitted in signature
    for (const pathParam of pathParamNames) {
      if (!parsedParams.some((p) => p.name === pathParam)) {
        parsedParams.unshift({
          name: pathParam,
          location: 'path',
          type: flaskPathParams[pathParam] || 'string',
          required: true,
        });
      }
    }

    // Check Flask request.args.get or request.json.get
    const flaskQueryMatches = fullBodyText.matchAll(/request\.args\.get\s*\(\s*['"](\w+)['"]/g);
    for (const m of flaskQueryMatches) {
      const qName = m[1];
      if (!parsedParams.some((p) => p.name === qName)) {
        parsedParams.push({
          name: qName,
          location: 'query',
          type: 'string',
          required: false,
        });
      }
    }

    const flaskBodyMatches = fullBodyText.matchAll(/request\.(?:json|get_json\(\)|form)\.get\s*\(\s*['"](\w+)['"]/g);
    for (const m of flaskBodyMatches) {
      const bName = m[1];
      if (!parsedParams.some((p) => p.name === bName)) {
        parsedParams.push({
          name: bName,
          location: 'body',
          type: 'string',
          required: true,
        });
      }
    }

    // Extract response schema & example from `return { ... }` or `response_model=...`
    let responseSchema: Record<string, any> | null = null;
    let responseExample: Record<string, any> | null = null;

    const respModelMatch = decoratorArgs.match(/response_model\s*=\s*(\w+)/);
    if (respModelMatch && models[respModelMatch[1]]) {
      responseSchema = { ...models[respModelMatch[1]] };
    } else if (returnAnnotation && models[returnAnnotation]) {
      responseSchema = { ...models[returnAnnotation] };
    }

    const returnDict = extractPythonReturnDict(fullBodyText, parsedParams);
    if (returnDict) {
      if (!responseSchema) {
        responseSchema = returnDict.schema;
      }
      responseExample = returnDict.example;
    } else if (responseSchema) {
      responseExample = {};
      for (const [k, t] of Object.entries(responseSchema)) {
        responseExample[k] = sampleValueForType(t, k);
      }
    }

    // Status codes detection
    const statusCodes: number[] = [];
    const statusMatch = decoratorArgs.match(/status_code\s*=\s*(?:status\.HTTP_)?(\d{3})/);
    if (statusMatch) {
      statusCodes.push(parseInt(statusMatch[1], 10));
    } else {
      statusCodes.push(200);
    }

    const exceptionStatuses = fullBodyText.matchAll(/status_code\s*=\s*(?:status\.HTTP_)?(\d{3})/g);
    for (const ex of exceptionStatuses) {
      const code = parseInt(ex[1], 10);
      if (!statusCodes.includes(code)) statusCodes.push(code);
    }

    for (const method of methods) {
      let methodRequestBodySchema = requestBodySchema ? { ...requestBodySchema } : null;
      const bodyParams = parsedParams.filter((p) => p.location === 'body');
      if (!methodRequestBodySchema && bodyParams.length > 0) {
        methodRequestBodySchema = {};
        for (const bp of bodyParams) {
          methodRequestBodySchema[bp.name] = bp.type;
        }
      }

      endpoints.push({
        id: `${method}_${normalizedPath}`,
        method,
        path: normalizedPath,
        functionName,
        lineStart: i + 1,
        docstring,
        parameters: parsedParams.map((p) => ({ ...p })),
        requestBodySchema: methodRequestBodySchema,
        responseSchema,
        responseExample,
        statusCodes: [...statusCodes],
        authentication: detectedAuth,
        rawSnippet,
      });
    }
  }

  return {
    detectedLanguage: 'python',
    framework,
    endpoints,
    models,
    parseWarnings,
  };
}

function splitTopLevelCommas(str: string): string[] {
  const result: string[] = [];
  let current = '';
  let depth = 0;
  let inQuote: string | null = null;

  for (let i = 0; i < str.length; i++) {
    const ch = str[i];
    const prev = i > 0 ? str[i - 1] : '';

    if (inQuote) {
      if (ch === inQuote && prev !== '\\') {
        inQuote = null;
      }
      current += ch;
      continue;
    }

    if (ch === '"' || ch === "'") {
      inQuote = ch;
      current += ch;
      continue;
    }

    if (ch === '(' || ch === '[' || ch === '{') depth++;
    else if (ch === ')' || ch === ']' || ch === '}') depth = Math.max(0, depth - 1);

    if (ch === ',' && depth === 0) {
      result.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  if (current.trim()) result.push(current);
  return result;
}

function extractPythonReturnDict(
  bodyText: string,
  params: ExtractedParameter[]
): { schema: Record<string, string>; example: Record<string, any> } | null {
  const returnMatch = bodyText.match(/return\s+(?:jsonify\s*\(\s*)?\{([\s\S]*?)\}\s*\)?/);
  if (!returnMatch) return null;

  const dictContent = returnMatch[1];
  const entries = splitTopLevelCommas(dictContent);
  const schema: Record<string, string> = {};
  const example: Record<string, any> = {};

  for (const entry of entries) {
    const kv = entry.match(/^\s*['"]([^'"]+)['"]\s*:\s*([\s\S]+)$/);
    if (!kv) continue;
    const key = kv[1].trim();
    const rawVal = kv[2].trim();

    const cleanedVal = rawVal.replace(/\[([^\]]+)\]\(mailto:[^)]+\)/g, '$1');

    if (/^['"]([\s\S]*)['"]$/.test(cleanedVal)) {
      const strVal = cleanedVal.slice(1, -1);
      schema[key] = 'string';
      example[key] = strVal;
    } else if (/^\d+$/.test(cleanedVal)) {
      schema[key] = 'integer';
      example[key] = parseInt(cleanedVal, 10);
    } else if (/^\d+\.\d+$/.test(cleanedVal)) {
      schema[key] = 'number';
      example[key] = parseFloat(cleanedVal);
    } else if (/^(?:True|False)$/.test(cleanedVal)) {
      schema[key] = 'boolean';
      example[key] = cleanedVal === 'True';
    } else if (cleanedVal.startsWith('[')) {
      schema[key] = 'array';
      example[key] = [];
    } else if (cleanedVal.startsWith('{')) {
      schema[key] = 'object';
      example[key] = {};
    } else {
      const matchedParam = params.find((p) => p.name === cleanedVal);
      if (matchedParam) {
        schema[key] = matchedParam.type;
        example[key] = sampleValueForType(matchedParam.type, matchedParam.name);
      } else {
        schema[key] = 'string';
        example[key] = sampleValueForType('string', key);
      }
    }
  }

  if (Object.keys(schema).length === 0) return null;
  return { schema, example };
}
