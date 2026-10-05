import type {
  AnalysisResult,
  AuthenticationKind,
  ExtractedEndpointFact,
  ExtractedParameter,
  HttpMethod,
  SupportedLanguage,
} from '../models/schemas.ts';

function normalizeTsType(raw: string): string {
  const clean = raw.trim().replace(/\s*\|\s*undefined|\s*\|\s*null/g, '');
  const lower = clean.toLowerCase();
  if (lower === 'number' || lower === 'float' || lower === 'double') return 'number';
  if (lower === 'int' || lower === 'integer') return 'integer';
  if (lower === 'boolean' || lower === 'bool') return 'boolean';
  if (lower === 'string') return 'string';
  if (lower.endsWith('[]') || lower.startsWith('array<')) return 'array';
  return clean || 'string';
}

function sampleForJsField(type: string, name: string): any {
  const lower = name.toLowerCase();
  if (lower.includes('email')) return 'alex@example.com';
  if (lower.includes('name') || lower.includes('title')) return 'Sample Item';
  if (lower.includes('id')) return type === 'integer' || type === 'number' ? 101 : 'ord_9021';
  if (lower.includes('price') || lower.includes('total') || lower.includes('amount')) return 129.99;
  if (lower.includes('status')) return 'active';
  if (lower.includes('token')) return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...';
  if (type === 'boolean') return true;
  if (type === 'integer') return 1;
  if (type === 'number') return 42.5;
  if (type === 'array') return [];
  return 'sample_' + name;
}

export function parseJavaScriptCode(
  sourceCode: string,
  language: SupportedLanguage,
  framework: string
): AnalysisResult {
  const lines = sourceCode.split('\n');
  const models: Record<string, Record<string, string>> = {};
  const endpoints: ExtractedEndpointFact[] = [];
  const parseWarnings: string[] = [];

  // 1. Extract TypeScript interfaces or types
  const interfaceRegex = /(?:export\s+)?interface\s+(\w+)\s*\{([\s\S]*?)\}/g;
  for (const match of sourceCode.matchAll(interfaceRegex)) {
    const modelName = match[1];
    const body = match[2];
    const fields: Record<string, string> = {};
    for (const line of body.split('\n')) {
      const fMatch = line.trim().match(/^(\w+)\??\s*:\s*([^;,]+)[;,]?/);
      if (fMatch) {
        fields[fMatch[1]] = normalizeTsType(fMatch[2]);
      }
    }
    if (Object.keys(fields).length > 0) {
      models[modelName] = fields;
    }
  }

  // 2. Scan for Express / Fastify / Hono routes
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();

    const routeMatch = line.match(
      /\b(?:app|router|fastify|server|api|v1)\.(get|post|put|patch|delete)\s*\(\s*['"`]([^'"`]+)['"`](.*)/i
    );

    const nestMatch = line.match(/^@(Get|Post|Put|Patch|Delete)\s*\(\s*(?:['"`]([^'"`]*)['"`])?\s*\)/i);

    if (!routeMatch && !nestMatch) continue;

    let method: HttpMethod = 'GET';
    let rawPath = '/';
    let restOfLine = '';

    if (routeMatch) {
      method = routeMatch[1].toUpperCase() as HttpMethod;
      rawPath = routeMatch[2];
      restOfLine = routeMatch[3] || '';
    } else if (nestMatch) {
      method = nestMatch[1].toUpperCase() as HttpMethod;
      rawPath = nestMatch[2] || '/';
      if (!rawPath.startsWith('/')) rawPath = '/' + rawPath;
    }

    const normalizedPath = rawPath.replace(/:([a-zA-Z0-9_]+)/g, '{$1}');
    const pathParamNames = Array.from(normalizedPath.matchAll(/\{(\w+)\}/g)).map((m) => m[1]);

    const comments: string[] = [];
    let cIdx = i - 1;
    while (cIdx >= 0) {
      const cLine = lines[cIdx].trim();
      if (cLine.startsWith('//')) {
        comments.unshift(cLine.replace(/^\/\/+\s*/, ''));
        cIdx--;
      } else if (cLine.startsWith('*') || cLine.startsWith('/*') || cLine.startsWith('*/')) {
        const cleaned = cLine.replace(/^\/?\*+\/?\s*/, '').replace(/\*\/$/, '').trim();
        if (cleaned && !cleaned.startsWith('@')) comments.unshift(cleaned);
        cIdx--;
      } else {
        break;
      }
    }

    let braceDepth = 0;
    let startedBraces = false;
    let endIdx = i;
    const snippetLines: string[] = [];

    for (let j = i; j < Math.min(lines.length, i + 75); j++) {
      const l = lines[j];
      snippetLines.push(l);
      for (const ch of l) {
        if (ch === '{') {
          braceDepth++;
          startedBraces = true;
        } else if (ch === '}') {
          braceDepth--;
        }
      }
      endIdx = j;
      if (startedBraces && braceDepth <= 0) {
        break;
      }
    }

    const blockText = snippetLines.join('\n');

    let functionName = `${method.toLowerCase()}_${normalizedPath.replace(/[^a-zA-Z0-9]/g, '_').replace(/^_+|_+$/g, '') || 'root'}`;
    const namedFnMatch = blockText.match(/(?:async\s+)?function\s+(\w+)|^\s*(?:async\s+)?(\w+)\s*\([^)]*\)\s*\{/m);
    if (namedFnMatch && (namedFnMatch[1] || namedFnMatch[2])) {
      functionName = namedFnMatch[1] || namedFnMatch[2];
    }

    let authentication: AuthenticationKind = 'Unknown';
    if (
      /authenticateJWT|verifyJwt|jwtAuth|jwt\.verify|Bearer/i.test(blockText) ||
      /authenticateToken|requireAuth|authMiddleware|isAuthenticated|@UseGuards/i.test(restOfLine + '\n' + blockText)
    ) {
      authentication = /jwt/i.test(blockText) ? 'JWT' : 'Bearer Token';
    } else if (/x-api-key|apiKeyAuth|verifyApiKey/i.test(blockText)) {
      authentication = 'API Key';
    } else if (/oauth/i.test(blockText)) {
      authentication = 'OAuth';
    } else if (/req\.headers\.authorization|req\.header\(['"]Authorization['"]\)/i.test(blockText)) {
      authentication = 'Bearer Token';
    }

    const parameters: ExtractedParameter[] = [];

    // 1. Path params
    for (const pName of pathParamNames) {
      parameters.push({
        name: pName,
        location: 'path',
        type: pName.toLowerCase().endsWith('id') ? 'string' : 'string',
        required: true,
      });
    }

    // 2. Query params
    for (const m of blockText.matchAll(/req\.query\.(\w+)/g)) {
      if (!parameters.some((p) => p.name === m[1])) {
        parameters.push({
          name: m[1],
          location: 'query',
          type: 'string',
          required: false,
        });
      }
    }
    const destructuredQuery = blockText.match(/const\s+\{([^}]+)\}\s*=\s*req\.query/);
    if (destructuredQuery) {
      for (const item of destructuredQuery[1].split(',')) {
        const namePart = item.trim().split('=')[0].split(':')[0].trim();
        if (namePart && !parameters.some((p) => p.name === namePart)) {
          parameters.push({
            name: namePart,
            location: 'query',
            type: 'string',
            required: false,
          });
        }
      }
    }

    // 3. Header params
    for (const m of blockText.matchAll(/req\.(?:headers\[['"]([^'"]+)['"]\]|header\(['"]([^'"]+)['"]\))/g)) {
      const hName = m[1] || m[2];
      if (hName && !parameters.some((p) => p.name === hName)) {
        parameters.push({
          name: hName,
          location: 'header',
          type: 'string',
          required: true,
        });
      }
    }

    // 4. Body params
    let requestBodySchema: Record<string, any> | null = null;
    const bodyFields: Record<string, string> = {};

    const destructuredBody = blockText.match(/(?:const|let)\s+\{([^}]+)\}\s*(?::\s*(\w+))?\s*=\s*req\.body/);
    if (destructuredBody) {
      const typeName = destructuredBody[2];
      if (typeName && models[typeName]) {
        Object.assign(bodyFields, models[typeName]);
      } else {
        for (const item of destructuredBody[1].split(',')) {
          const cleanName = item.trim().split('=')[0].split(':')[0].trim();
          if (cleanName) {
            bodyFields[cleanName] = cleanName.toLowerCase().includes('price') || cleanName.toLowerCase().includes('count') || cleanName.toLowerCase().includes('quantity')
              ? 'number'
              : 'string';
          }
        }
      }
    }

    for (const m of blockText.matchAll(/req\.body\.(\w+)/g)) {
      const fName = m[1];
      if (!bodyFields[fName]) {
        bodyFields[fName] = 'string';
      }
    }

    const nestBodyMatch = blockText.match(/@Body\(\)\s+\w+\s*:\s*(\w+)/);
    if (nestBodyMatch && models[nestBodyMatch[1]]) {
      Object.assign(bodyFields, models[nestBodyMatch[1]]);
    }

    if (Object.keys(bodyFields).length > 0) {
      requestBodySchema = bodyFields;
      for (const [fName, fType] of Object.entries(bodyFields)) {
        if (!parameters.some((p) => p.name === fName && p.location === 'body')) {
          parameters.push({
            name: fName,
            location: 'body',
            type: fType,
            required: true,
          });
        }
      }
    }

    // 5. Status codes
    const statusCodes: number[] = [];
    for (const m of blockText.matchAll(/res\.status\s*\(\s*(\d{3})\s*\)/g)) {
      const code = parseInt(m[1], 10);
      if (!statusCodes.includes(code)) statusCodes.push(code);
    }
    if (statusCodes.length === 0) statusCodes.push(200);

    let responseSchema: Record<string, any> | null = null;
    let responseExample: Record<string, any> | null = null;

    const resJsonMatch = blockText.match(/res(?:\.status\(\d+\))?\.json\s*\(\s*\{([\s\S]*?)\}\s*\)/);
    if (resJsonMatch) {
      const objBody = resJsonMatch[1];
      const schema: Record<string, string> = {};
      const example: Record<string, any> = {};
      for (const propLine of objBody.split(',')) {
        const cleanProp = propLine.trim();
        if (!cleanProp) continue;
        const kv = cleanProp.match(/^['"]?(\w+)['"]?\s*(?::\s*([\s\S]+))?$/);
        if (kv) {
          const key = kv[1];
          const valExpr = kv[2] ? kv[2].trim() : key;
          if (/^['"`].*['"`]$/.test(valExpr)) {
            schema[key] = 'string';
            example[key] = valExpr.slice(1, -1);
          } else if (/^(?:true|false)$/.test(valExpr)) {
            schema[key] = 'boolean';
            example[key] = valExpr === 'true';
          } else if (/^\d+$/.test(valExpr)) {
            schema[key] = 'integer';
            example[key] = parseInt(valExpr, 10);
          } else if (/^\d+\.\d+$/.test(valExpr)) {
            schema[key] = 'number';
            example[key] = parseFloat(valExpr);
          } else if (valExpr.startsWith('[')) {
            schema[key] = 'array';
            example[key] = [];
          } else {
            schema[key] = 'string';
            example[key] = sampleForJsField('string', key);
          }
        }
      }
      if (Object.keys(schema).length > 0) {
        responseSchema = schema;
        responseExample = example;
      }
    }

    endpoints.push({
      id: `${method}_${normalizedPath}`,
      method,
      path: normalizedPath,
      functionName,
      lineStart: i + 1,
      docstring: comments.join(' '),
      parameters,
      requestBodySchema,
      responseSchema,
      responseExample,
      statusCodes,
      authentication,
      rawSnippet: snippetLines.join('\n'),
    });

    i = Math.max(i, endIdx - 1);
  }

  return {
    detectedLanguage: language,
    framework,
    endpoints,
    models,
    parseWarnings,
  };
}
