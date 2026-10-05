import type { SupportedLanguage } from '../models/schemas.ts';

export function detectLanguage(
  sourceCode: string,
  hintLanguage?: string,
  filename?: string
): { language: SupportedLanguage; framework: string } {
  const trimmed = sourceCode.trim();

  if (filename) {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.py')) {
      return { language: 'python', framework: detectPythonFramework(trimmed) };
    }
    if (lower.endsWith('.ts') || lower.endsWith('.tsx')) {
      return { language: 'typescript', framework: detectJsFramework(trimmed, true) };
    }
    if (lower.endsWith('.js') || lower.endsWith('.mjs') || lower.endsWith('.cjs')) {
      return { language: 'javascript', framework: detectJsFramework(trimmed, false) };
    }
    if (lower.endsWith('.java')) {
      return { language: 'java', framework: detectJavaFramework(trimmed) };
    }
    if (lower.endsWith('.json')) {
      return { language: 'json', framework: detectSpecFramework(trimmed) };
    }
    if (lower.endsWith('.yaml') || lower.endsWith('.yml')) {
      return { language: 'yaml', framework: detectSpecFramework(trimmed) };
    }
  }

  // Check if valid JSON first
  if (
    (trimmed.startsWith('{') && trimmed.endsWith('}')) ||
    (trimmed.startsWith('[') && trimmed.endsWith(']'))
  ) {
    try {
      JSON.parse(trimmed);
      return { language: 'json', framework: detectSpecFramework(trimmed) };
    } catch {
      // Not pure JSON
    }
  }

  // Check YAML OpenAPI / Swagger / route format
  if (
    /^openapi\s*:/m.test(trimmed) ||
    /^swagger\s*:/m.test(trimmed) ||
    (/^paths\s*:/m.test(trimmed) && /^\s+\/[a-zA-Z0-9_{}-]*\s*:/m.test(trimmed)) ||
    (/^endpoints\s*:/m.test(trimmed) && /^\s*-\s+path\s*:/m.test(trimmed))
  ) {
    return { language: 'yaml', framework: detectSpecFramework(trimmed) };
  }

  // Check Java
  if (
    /@RestController|@RequestMapping|@GetMapping|@PostMapping|@PutMapping|@DeleteMapping|@PatchMapping|public\s+class\s+\w+|ResponseEntity</.test(
      trimmed
    )
  ) {
    return { language: 'java', framework: detectJavaFramework(trimmed) };
  }

  // Check Python
  if (
    /from\s+fastapi\s+import|import\s+fastapi|FastAPI\s*\(|from\s+flask\s+import|Flask\s*\(|@(?:app|router|bp|api)\.(?:get|post|put|patch|delete|route)\s*\(|def\s+\w+\s*\(.*\)\s*(?:->.*)?:/m.test(
      trimmed
    )
  ) {
    return { language: 'python', framework: detectPythonFramework(trimmed) };
  }

  // Check TypeScript vs JavaScript
  if (
    /interface\s+\w+\s*\{|type\s+\w+\s*=|:\s*(?:Request|Response|NextFunction|string|number|boolean)\b|@(?:Controller|Get|Post|Put|Delete|Patch)\s*\(/.test(
      trimmed
    )
  ) {
    return { language: 'typescript', framework: detectJsFramework(trimmed, true) };
  }

  if (
    /\b(?:app|router|fastify|server)\.(?:get|post|put|patch|delete)\s*\(|require\s*\(\s*['"]express['"]\s*\)|from\s+['"]express['"]/.test(
      trimmed
    )
  ) {
    return { language: 'javascript', framework: detectJsFramework(trimmed, false) };
  }

  if (hintLanguage) {
    const normalized = hintLanguage.toLowerCase() as SupportedLanguage;
    if (['python', 'javascript', 'typescript', 'java', 'json', 'yaml'].includes(normalized)) {
      if (normalized === 'python') return { language: 'python', framework: detectPythonFramework(trimmed) };
      if (normalized === 'typescript') return { language: 'typescript', framework: detectJsFramework(trimmed, true) };
      if (normalized === 'javascript') return { language: 'javascript', framework: detectJsFramework(trimmed, false) };
      if (normalized === 'java') return { language: 'java', framework: detectJavaFramework(trimmed) };
      if (normalized === 'json') return { language: 'json', framework: detectSpecFramework(trimmed) };
      if (normalized === 'yaml') return { language: 'yaml', framework: detectSpecFramework(trimmed) };
    }
  }

  return { language: 'python', framework: detectPythonFramework(trimmed) };
}

function detectPythonFramework(code: string): string {
  if (/fastapi|FastAPI|APIRouter/i.test(code)) return 'FastAPI';
  if (/flask|Flask|Blueprint/i.test(code)) return 'Flask';
  if (/django| ninja /i.test(code)) return 'Django REST / Ninja';
  return 'Python HTTP API';
}

function detectJsFramework(code: string, isTs: boolean): string {
  if (/@Controller|@Get|@Post|@nestjs/i.test(code)) return 'NestJS';
  if (/fastify/i.test(code)) return 'Fastify';
  if (/Hono/i.test(code)) return 'Hono';
  if (/express|Router\(\)/i.test(code)) return isTs ? 'Express (TypeScript)' : 'Express.js';
  return isTs ? 'TypeScript Node API' : 'Node.js HTTP API';
}

function detectJavaFramework(code: string): string {
  if (/@RestController|@GetMapping|@PostMapping|@RequestMapping|SpringApplication/i.test(code)) {
    return 'Spring Boot';
  }
  if (/@Path|@GET|@POST|javax\.ws\.rs|jakarta\.ws\.rs/i.test(code)) {
    return 'JAX-RS / Quarkus';
  }
  return 'Java REST API';
}

function detectSpecFramework(code: string): string {
  if (/["']?openapi["']?\s*:\s*["']?3/i.test(code)) return 'OpenAPI 3.x';
  if (/["']?swagger["']?\s*:\s*["']?2/i.test(code)) return 'Swagger 2.0';
  if (/postman_id|schema\.getpostman\.com/i.test(code)) return 'Postman Collection';
  return 'API Specification';
}
