import type {
  AnalysisResult,
  DocumentationStyle,
  GeneratedDocumentation,
  SupportedLanguage,
} from '../../backend/models/schemas.ts';

export type {
  AnalysisResult,
  DocumentationStyle,
  GeneratedDocumentation,
  SupportedLanguage,
};

export interface GenerateResponse {
  analysis: AnalysisResult;
  documentation: GeneratedDocumentation;
  exports: {
    markdown: string;
    openApiJson: string;
    openApiYaml: string;
  };
}

export interface SampleApiPreset {
  id: string;
  title: string;
  subtitle: string;
  language: SupportedLanguage;
  filename: string;
  code: string;
}

export const PRIMARY_FASTAPI_EXAMPLE = `from fastapi import FastAPI

app = FastAPI()

@app.get("/hello")
def hello():
    return {
        "message": "Hello, World!"
    }

@app.get("/users/{user_id}")
def get_user(user_id: int):
    return {
        "id": user_id,
        "name": "John",
        "email": "john@example.com"
    }

@app.post("/users")
def create_user(name: str, email: str):
    return {
        "message": "User created",
        "name": name,
        "email": email
    }
`;

export const SAMPLE_API_PRESETS: SampleApiPreset[] = [
  {
    id: 'fastapi-users',
    title: 'FastAPI User Service (Default Sample)',
    subtitle: 'Python · FastAPI · 3 endpoints',
    language: 'python',
    filename: 'main.py',
    code: PRIMARY_FASTAPI_EXAMPLE,
  },
  {
    id: 'express-orders',
    title: 'Express.js E-Commerce Orders API',
    subtitle: 'TypeScript · Express · 4 endpoints · JWT Auth',
    language: 'typescript',
    filename: 'orders.routes.ts',
    code: `import express, { Request, Response } from 'express';

const router = express.Router();

interface CreateOrderBody {
  customerId: string;
  productId: string;
  quantity: number;
  shippingAddress: string;
}

// List all orders with optional status and limit filters
router.get('/orders', (req: Request, res: Response) => {
  const { status, limit } = req.query;
  res.status(200).json({
    orders: [],
    filterStatus: status,
    limit: 20
  });
});

// Retrieve a specific order by ID
router.get('/orders/:orderId', (req: Request, res: Response) => {
  const orderId = req.params.orderId;
  res.status(200).json({
    orderId: orderId,
    status: "processing",
    totalAmount: 149.50,
    currency: "USD"
  });
});

// Create a new customer order (requires Bearer JWT authentication)
router.post('/orders', authenticateJWT, (req: Request, res: Response) => {
  const { customerId, productId, quantity, shippingAddress }: CreateOrderBody = req.body;
  res.status(201).json({
    orderId: "ord_98120",
    customerId: customerId,
    productId: productId,
    quantity: quantity,
    status: "created"
  });
});

// Cancel and delete an existing order
router.delete('/orders/:orderId', authenticateJWT, (req: Request, res: Response) => {
  res.status(200).json({
    deleted: true,
    message: "Order cancelled"
  });
});
`,
  },
  {
    id: 'spring-inventory',
    title: 'Spring Boot Inventory Controller',
    subtitle: 'Java · Spring Boot · 3 endpoints',
    language: 'java',
    filename: 'InventoryController.java',
    code: `package com.docuapi.inventory;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;

record StockUpdateRequest(String sku, int quantity, String warehouseLocation) {}

@RestController
@RequestMapping("/api/v1")
public class InventoryController {

    @GetMapping("/products/{productId}/stock")
    public ResponseEntity<Object> getProductStock(
        @PathVariable String productId,
        @RequestParam(required = false) String warehouse
    ) {
        return ResponseEntity.ok().build();
    }

    @PostMapping("/products/stock")
    @PreAuthorize("hasRole('INVENTORY_ADMIN')")
    public ResponseEntity<Object> updateStockLevel(
        @RequestBody StockUpdateRequest payload
    ) {
        return ResponseEntity.status(201).build();
    }

    @DeleteMapping("/products/{productId}")
    @PreAuthorize("hasRole('INVENTORY_ADMIN')")
    public ResponseEntity<Object> archiveProduct(
        @PathVariable String productId
    ) {
        return ResponseEntity.ok().build();
    }
}
`,
  },
  {
    id: 'openapi-payments',
    title: 'Payments Gateway Specification',
    subtitle: 'YAML · OpenAPI 3.0 · 3 endpoints',
    language: 'yaml',
    filename: 'payments-openapi.yaml',
    code: `openapi: 3.0.3
info:
  title: Enterprise Payments API
  version: 1.2.0
  description: Core payment intents and refund processing service.
components:
  securitySchemes:
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key
  schemas:
    PaymentIntentRequest:
      type: object
      required:
        - amount
        - currency
        - customerEmail
      properties:
        amount:
          type: number
        currency:
          type: string
        customerEmail:
          type: string
    PaymentIntentResponse:
      type: object
      properties:
        intentId:
          type: string
        status:
          type: string
        amount:
          type: number
paths:
  /v1/payments:
    get:
      operationId: listPayments
      summary: List Payment Intents
      description: Returns a paginated list of recent payment intents.
      parameters:
        - name: currency
          in: query
          required: false
          description: Three-letter ISO currency code filter.
          schema:
            type: string
        - name: limit
          in: query
          required: false
          description: Maximum number of records to return.
          schema:
            type: integer
      responses:
        '200':
          description: Paginated list of payments retrieved successfully.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentIntentResponse'
    post:
      operationId: createPaymentIntent
      summary: Create Payment Intent
      description: Initializes a new payment intent for a customer checkout session.
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PaymentIntentRequest'
      responses:
        '201':
          description: Payment intent created.
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PaymentIntentResponse'
  /v1/payments/{intentId}/refund:
    put:
      operationId: refundPayment
      summary: Issue Full Refund
      description: Refunds a captured payment intent by its unique identifier.
      parameters:
        - name: intentId
          in: path
          required: true
          description: Unique identifier of the payment intent to refund.
          schema:
            type: string
      responses:
        '200':
          description: Refund processed successfully.
`,
  },
];

export async function generateDocumentationApi(params: {
  sourceCode: string;
  language?: SupportedLanguage;
  filename?: string;
  style?: DocumentationStyle;
}): Promise<GenerateResponse> {
  const response = await fetch('/api/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(params),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error ||
        `Failed to generate documentation (HTTP ${response.status}). Please check your input and try again.`
    );
  }

  return data as GenerateResponse;
}

export async function importFromGitHubUrl(url: string): Promise<{
  filename: string;
  sourceCode: string;
}> {
  const response = await fetch('/api/github-import', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });

  const data = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(
      data?.error || 'Could not import file from GitHub. Verify the URL points to a public file.'
    );
  }

  return data;
}
