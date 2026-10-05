import type {
  AnalysisResult,
  AuthenticationKind,
  ExtractedEndpointFact,
  ExtractedParameter,
  HttpMethod,
} from '../models/schemas.ts';

function normalizeJavaType(raw: string): string {
  const clean = raw.trim();
  if (/^(?:int|Integer|long|Long|short|Short)$/.test(clean)) return 'integer';
  if (/^(?:double|Double|float|Float|BigDecimal)$/.test(clean)) return 'number';
  if (/^(?:boolean|Boolean)$/.test(clean)) return 'boolean';
  if (/^(?:String|UUID|LocalDate|LocalDateTime)$/.test(clean)) return 'string';
  if (/^(?:List|Set|Collection)</.test(clean) || clean.endsWith('[]')) return 'array';
  if (/^Map</.test(clean)) return 'object';
  return clean || 'string';
}

export function parseJavaCode(sourceCode: string, framework: string): AnalysisResult {
  const lines = sourceCode.split('\n');
  const models: Record<string, Record<string, string>> = {};
  const endpoints: ExtractedEndpointFact[] = [];
  const parseWarnings: string[] = [];

  const recordRegex = /record\s+(\w+)\s*\(([^)]+)\)/g;
  for (const match of sourceCode.matchAll(recordRegex)) {
    const recordName = match[1];
    const params = match[2].split(',');
    const fields: Record<string, string> = {};
    for (const p of params) {
      const tokens = p.trim().split(/\s+/);
      if (tokens.length >= 2) {
        const name = tokens[tokens.length - 1];
        const type = tokens[tokens.length - 2];
        fields[name] = normalizeJavaType(type);
      }
    }
    if (Object.keys(fields).length > 0) {
      models[recordName] = fields;
    }
  }

  let baseMapping = '';
  const classMappingMatch = sourceCode.match(
    /@RequestMapping\s*\(\s*(?:value\s*=\s*)?['"]([^'"]+)['"]\s*\)\s*(?:@\w+\s*)*public\s+class/
  );
  if (classMappingMatch) {
    baseMapping = classMappingMatch[1].replace(/\/$/, '');
  }

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    const mappingMatch = line.match(
      /^@(Get|Post|Put|Patch|Delete)Mapping(?:\s*\(\s*(?:value\s*=\s*|path\s*=\s*)?(?:['"]([^'"]*)['"])?.*\))?/i
    );
    if (!mappingMatch) continue;

    const method = mappingMatch[1].toUpperCase() as HttpMethod;
    const subPath = mappingMatch[2] || '';
    const fullPath = `${baseMapping}${subPath.startsWith('/') || !subPath ? subPath : '/' + subPath}` || '/';

    let sigIdx = i + 1;
    while (sigIdx < lines.length && lines[sigIdx].trim().startsWith('@')) {
      sigIdx++;
    }
    let sigText = '';
    let endSigIdx = sigIdx;
    while (endSigIdx < lines.length) {
      sigText += ' ' + lines[endSigIdx].trim();
      if (lines[endSigIdx].includes('{')) break;
      endSigIdx++;
    }

    const methodMatch = sigText.match(
      /public\s+(?:ResponseEntity<([^>]+)>|(\w+))\s+(\w+)\s*\(([\s\S]*?)\)\s*\{/
    );
    const returnType = methodMatch ? (methodMatch[1] || methodMatch[2] || 'Object') : 'Object';
    const functionName = methodMatch ? methodMatch[3] : `handler_${i + 1}`;
    const argsStr = methodMatch ? methodMatch[4] : '';

    const parameters: ExtractedParameter[] = [];
    let requestBodySchema: Record<string, any> | null = null;
    let authentication: AuthenticationKind = 'Unknown';

    const snippetBlock = lines.slice(i, Math.min(lines.length, endSigIdx + 15)).join('\n');
    if (/@PreAuthorize|@Secured|@RolesAllowed|Bearer|Jwt/i.test(snippetBlock)) {
      authentication = /Jwt/i.test(snippetBlock) ? 'JWT' : 'Bearer Token';
    }

    const argParts = argsStr.split(',').map((s) => s.trim()).filter(Boolean);
    for (const arg of argParts) {
      if (/@PathVariable/.test(arg)) {
        const m = arg.match(/(\w+)\s+(\w+)$/);
        if (m) {
          parameters.push({
            name: m[2],
            location: 'path',
            type: normalizeJavaType(m[1]),
            required: true,
          });
        }
      } else if (/@RequestParam/.test(arg)) {
        const required = !/required\s*=\s*false/.test(arg);
        const m = arg.match(/(\w+)\s+(\w+)$/);
        if (m) {
          parameters.push({
            name: m[2],
            location: 'query',
            type: normalizeJavaType(m[1]),
            required,
          });
        }
      } else if (/@RequestHeader/.test(arg)) {
        const m = arg.match(/(\w+)\s+(\w+)$/);
        if (m) {
          parameters.push({
            name: m[2],
            location: 'header',
            type: 'string',
            required: true,
          });
        }
      } else if (/@RequestBody/.test(arg)) {
        const m = arg.match(/(\w+)\s+(\w+)$/);
        if (m) {
          const dtoType = m[1];
          if (models[dtoType]) {
            requestBodySchema = { ...models[dtoType] };
            for (const [fName, fType] of Object.entries(models[dtoType])) {
              parameters.push({
                name: fName,
                location: 'body',
                type: fType,
                required: true,
              });
            }
          } else {
            requestBodySchema = { [m[2]]: 'object' };
            parameters.push({
              name: m[2],
              location: 'body',
              type: 'object',
              required: true,
            });
          }
        }
      }
    }

    for (const m of fullPath.matchAll(/\{(\w+)\}/g)) {
      if (!parameters.some((p) => p.name === m[1])) {
        parameters.push({
          name: m[1],
          location: 'path',
          type: 'string',
          required: true,
        });
      }
    }

    const responseSchema = models[returnType] ? { ...models[returnType] } : { status: 'string', data: normalizeJavaType(returnType) };

    endpoints.push({
      id: `${method}_${fullPath}`,
      method,
      path: fullPath,
      functionName,
      lineStart: i + 1,
      docstring: '',
      parameters,
      requestBodySchema,
      responseSchema,
      responseExample: null,
      statusCodes: [/HttpStatus\.CREATED|201/.test(snippetBlock) ? 201 : 200],
      authentication,
      rawSnippet: snippetBlock,
    });
  }

  return {
    detectedLanguage: 'java',
    framework,
    endpoints,
    models,
    parseWarnings,
  };
}
