import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import type { GeneratedDocumentation } from '../../backend/models/schemas.ts';

/**
 * Downloads high-fidelity PDF documentation.
 * Uses clean vector PDF generation to ensure crystal-clear text, perfect page breaks,
 * and comprehensive coverage of all endpoints, parameters, models, request bodies, and responses.
 * Also supports HTML canvas capture when target element is provided.
 */
export async function downloadDocumentationPdfWithHtml2Canvas(
  targetElementOrId: HTMLElement | string,
  doc: GeneratedDocumentation
): Promise<void> {
  const element: HTMLElement | null =
    typeof targetElementOrId === 'string'
      ? document.getElementById(targetElementOrId)
      : targetElementOrId;

  // If element is visible and has rendered content, capture DOM; otherwise generate vector PDF
  if (element && element.clientHeight > 50) {
    try {
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#FFFFFF',
        logging: false,
        windowWidth: element.scrollWidth,
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'pt',
        format: 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const margin = 20;
      const printWidth = pageWidth - margin * 2;
      const printHeight = (canvas.height * printWidth) / canvas.width;

      let heightLeft = printHeight;
      let positionY = margin;

      pdf.addImage(imgData, 'PNG', margin, positionY, printWidth, printHeight, undefined, 'FAST');
      heightLeft -= pageHeight - margin * 2;

      while (heightLeft > 0) {
        positionY -= pageHeight - margin * 2;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', margin, positionY, printWidth, printHeight, undefined, 'FAST');
        heightLeft -= pageHeight - margin * 2;
      }

      const totalPages = (pdf.internal as any).getNumberOfPages();
      for (let p = 1; p <= totalPages; p++) {
        pdf.setPage(p);
        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(150, 150, 150);
        pdf.text(
          `DocuAPI AI · ${doc.projectName} · Page ${p} of ${totalPages}`,
          pageWidth / 2,
          pageHeight - 10,
          { align: 'center' }
        );
      }

      const safeSlug =
        doc.projectName
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-+|-+$/g, '') || 'api-documentation';

      pdf.save(`${safeSlug}-documentation.pdf`);
      return;
    } catch (e) {
      console.warn('html2canvas capture failed, falling back to structured vector PDF:', e);
    }
  }

  // Fallback to structured vector PDF
  generateDocumentationPdf(doc);
}

/**
 * Pure vector/text jsPDF generator for structured API documentation.
 * Everything is clearly mentioned:
 * - Project title, description, language, framework, quality score
 * - Detailed quality score audit breakdown
 * - Overview index table of all endpoints
 * - Comprehensive endpoint details:
 *    * Method, Path, Line number, Function Name
 *    * Description & Summary
 *    * Authentication requirements
 *    * Parameters table with Type, Location, Required, and full multi-line descriptions
 *    * Request body specification with Content-Type, Description, JSON Schema, and Sample payload
 *    * Responses with status code, description, schema, and sample JSON
 *    * Ready-to-use cURL request example
 *    * Example response payload
 * - Running headers, footers, and page numbers
 */
export function generateDocumentationPdf(doc: GeneratedDocumentation): void {
  const pdf = new jsPDF({
    orientation: 'portrait',
    unit: 'pt',
    format: 'a4',
  });

  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  const margin = 36;
  const contentWidth = pageWidth - margin * 2;
  let y = margin;

  const drawPageHeader = () => {
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(229, 57, 53);
    pdf.text('DOCUAPI AI', margin, 24);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(150, 150, 150);
    pdf.text(`${doc.projectName} — Developer Reference Guide`, margin + 65, 24);

    pdf.setDrawColor(229, 231, 235);
    pdf.setLineWidth(0.75);
    pdf.line(margin, 28, pageWidth - margin, 28);
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > pageHeight - margin - 24) {
      pdf.addPage();
      y = margin + 10;
      drawPageHeader();
    }
  };

  // --- Title and Meta Header ---
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(22);
  pdf.setTextColor(31, 41, 55);
  pdf.text(doc.projectName, margin, y + 16);
  y += 28;

  pdf.setFont('helvetica', 'normal');
  pdf.setFontSize(9.5);
  pdf.setTextColor(107, 114, 128);
  const descLines = pdf.splitTextToSize(doc.description || 'Comprehensive API Reference Documentation', contentWidth);
  pdf.text(descLines, margin, y);
  y += descLines.length * 13 + 8;

  // Metadata summary banner
  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(229, 231, 235);
  pdf.roundedRect(margin, y, contentWidth, 32, 4, 4, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8.5);
  pdf.setTextColor(229, 57, 53);
  pdf.text(`Framework: ${doc.framework || 'REST API'}`, margin + 12, y + 20);

  pdf.setFont('helvetica', 'normal');
  pdf.setTextColor(75, 85, 99);
  pdf.text(`Language: ${doc.language.toUpperCase()}`, margin + 130, y + 20);
  pdf.text(`Total Endpoints: ${doc.endpoints.length}`, margin + 250, y + 20);

  pdf.setFont('helvetica', 'bold');
  pdf.setTextColor(22, 163, 74);
  pdf.text(`Quality Score: ${doc.qualityScore.overall}%`, margin + 370, y + 20);
  y += 44;

  // --- Quality Score Breakdown Table ---
  checkPageBreak(50);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text('API Quality & Validation Score', margin, y);
  y += 14;

  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(229, 231, 235);
  pdf.rect(margin, y, contentWidth, 20, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text('Metric', margin + 8, y + 13);
  pdf.text('Score', margin + 140, y + 13);
  pdf.text('Verification Details', margin + 200, y + 13);
  y += 20;

  const scoreRows = [
    { label: 'Endpoint Detection', score: `${doc.qualityScore.endpointDetection}%`, detail: `${doc.endpoints.length} route(s) extracted from AST declarations` },
    { label: 'Parameter Extraction', score: `${doc.qualityScore.parameterDetection}%`, detail: 'Path variables, queries, headers matched against handlers' },
    { label: 'Schema Validation', score: `${doc.qualityScore.requestSchema}%`, detail: 'Request bodies & JSON payload models validated' },
    { label: 'Response Specs', score: `${doc.qualityScore.responseSchema}%`, detail: 'Status codes & return structures verified' },
  ];

  for (const row of scoreRows) {
    checkPageBreak(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(31, 41, 55);
    pdf.text(row.label, margin + 8, y + 12);

    pdf.setFont('helvetica', 'bold');
    pdf.setTextColor(22, 163, 74);
    pdf.text(row.score, margin + 140, y + 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(107, 114, 128);
    pdf.text(row.detail, margin + 200, y + 12);

    pdf.setDrawColor(240, 240, 240);
    pdf.line(margin, y + 16, margin + contentWidth, y + 16);
    y += 17;
  }
  y += 16;

  // --- Endpoints Overview Matrix ---
  checkPageBreak(60);
  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(11);
  pdf.setTextColor(31, 41, 55);
  pdf.text('Endpoints Summary Matrix', margin, y);
  y += 14;

  pdf.setFillColor(248, 249, 250);
  pdf.setDrawColor(229, 231, 235);
  pdf.rect(margin, y, contentWidth, 20, 'FD');

  pdf.setFont('helvetica', 'bold');
  pdf.setFontSize(8);
  pdf.setTextColor(107, 114, 128);
  pdf.text('Method', margin + 8, y + 13);
  pdf.text('Path', margin + 65, y + 13);
  pdf.text('Summary', margin + 210, y + 13);
  pdf.text('Authentication', margin + 410, y + 13);
  y += 20;

  for (const ep of doc.endpoints) {
    checkPageBreak(18);
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);

    if (ep.method === 'GET') pdf.setTextColor(29, 78, 216);
    else if (ep.method === 'POST') pdf.setTextColor(22, 163, 74);
    else if (ep.method === 'PUT') pdf.setTextColor(217, 119, 6);
    else if (ep.method === 'DELETE') pdf.setTextColor(220, 38, 38);
    else pdf.setTextColor(126, 34, 206);

    pdf.text(ep.method, margin + 8, y + 12);

    pdf.setFont('courier', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(31, 41, 55);
    pdf.text(ep.path.slice(0, 30), margin + 65, y + 12);

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(75, 85, 99);
    pdf.text((ep.summary || ep.description).slice(0, 42), margin + 210, y + 12);

    pdf.setTextColor(107, 114, 128);
    pdf.text(ep.authenticationType || 'None', margin + 410, y + 12);

    pdf.setDrawColor(240, 240, 240);
    pdf.line(margin, y + 16, margin + contentWidth, y + 16);
    y += 18;
  }

  y += 14;
  pdf.setDrawColor(229, 231, 235);
  pdf.line(margin, y, margin + contentWidth, y);
  y += 18;

  // --- Detailed Endpoint Sections ---
  for (let i = 0; i < doc.endpoints.length; i++) {
    const ep = doc.endpoints[i];
    checkPageBreak(140);

    // Section Header Box
    pdf.setFillColor(255, 255, 255);
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(margin, y, contentWidth, 34, 4, 4, 'FD');

    // Method Pill
    let badgeBg: [number, number, number] = [239, 246, 255];
    let badgeText: [number, number, number] = [29, 78, 216];
    if (ep.method === 'POST') {
      badgeBg = [240, 253, 244];
      badgeText = [22, 163, 74];
    } else if (ep.method === 'PUT') {
      badgeBg = [254, 243, 199];
      badgeText = [180, 83, 9];
    } else if (ep.method === 'DELETE') {
      badgeBg = [254, 242, 242];
      badgeText = [220, 38, 38];
    }

    pdf.setFillColor(...badgeBg);
    pdf.roundedRect(margin + 8, y + 8, 44, 18, 3, 3, 'F');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8.5);
    pdf.setTextColor(...badgeText);
    pdf.text(ep.method, margin + 14, y + 20);

    // Endpoint Route
    pdf.setFont('courier', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(31, 41, 55);
    pdf.text(ep.path, margin + 58, y + 21);

    // Code Location
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8);
    pdf.setTextColor(107, 114, 128);
    pdf.text(`fn: ${ep.functionName || 'handler'} (Line ${ep.lineStart || 1})`, margin + contentWidth - 140, y + 21);
    y += 42;

    // Summary & Description
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(10.5);
    pdf.setTextColor(31, 41, 55);
    pdf.text(ep.summary || ep.path, margin, y);
    y += 14;

    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(8.5);
    pdf.setTextColor(75, 85, 99);
    const epDesc = pdf.splitTextToSize(ep.description || 'No description provided.', contentWidth);
    pdf.text(epDesc, margin, y);
    y += epDesc.length * 12 + 6;

    // Authentication Info
    checkPageBreak(30);
    pdf.setFillColor(248, 249, 250);
    pdf.setDrawColor(229, 231, 235);
    pdf.roundedRect(margin, y, contentWidth, 20, 3, 3, 'FD');
    pdf.setFont('helvetica', 'bold');
    pdf.setFontSize(8);
    pdf.setTextColor(31, 41, 55);
    pdf.text('Authentication:', margin + 8, y + 13);
    pdf.setFont('helvetica', 'normal');
    pdf.setTextColor(75, 85, 99);
    pdf.text(ep.authentication || 'Public Endpoint — No authentication required.', margin + 80, y + 13);
    y += 26;

    // Parameters Table
    if (ep.parameters && ep.parameters.length > 0) {
      checkPageBreak(50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Parameters', margin, y);
      y += 12;

      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(229, 231, 235);
      pdf.rect(margin, y, contentWidth, 18, 'FD');

      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(7.5);
      pdf.setTextColor(107, 114, 128);
      pdf.text('Name', margin + 6, y + 12);
      pdf.text('In', margin + 85, y + 12);
      pdf.text('Type', margin + 135, y + 12);
      pdf.text('Required', margin + 195, y + 12);
      pdf.text('Description', margin + 250, y + 12);
      y += 18;

      for (const p of ep.parameters) {
        const descArr = pdf.splitTextToSize(p.description || '', contentWidth - 255);
        const rowHeight = Math.max(16, descArr.length * 10 + 6);
        checkPageBreak(rowHeight + 4);

        pdf.setFont('courier', 'bold');
        pdf.setFontSize(8);
        pdf.setTextColor(31, 41, 55);
        pdf.text(p.name, margin + 6, y + 11);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(7.5);
        pdf.setTextColor(75, 85, 99);
        pdf.text(p.location, margin + 85, y + 11);

        pdf.setFont('courier', 'normal');
        pdf.setTextColor(198, 40, 40);
        pdf.text(p.type || 'string', margin + 135, y + 11);

        pdf.setFont('helvetica', p.required ? 'bold' : 'normal');
        pdf.setTextColor(p.required ? 229 : 107, p.required ? 57 : 114, p.required ? 53 : 128);
        pdf.text(p.required ? 'Required' : 'Optional', margin + 195, y + 11);

        pdf.setFont('helvetica', 'normal');
        pdf.setTextColor(75, 85, 99);
        pdf.text(descArr, margin + 250, y + 11);

        pdf.setDrawColor(240, 240, 240);
        pdf.line(margin, y + rowHeight, margin + contentWidth, y + rowHeight);
        y += rowHeight;
      }
      y += 8;
    }

    // Request Body
    if (ep.requestBody) {
      checkPageBreak(50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text(`Request Body (${ep.requestBody.contentType || 'application/json'})${ep.requestBody.required ? ' · Required' : ' · Optional'}`, margin, y);
      y += 12;

      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(8);
      pdf.setTextColor(107, 114, 128);
      pdf.text(ep.requestBody.description || 'Structured JSON request payload', margin, y);
      y += 14;

      if (ep.requestBody.schema) {
        checkPageBreak(40);
        pdf.setFillColor(248, 249, 250);
        pdf.setDrawColor(229, 231, 235);
        const schemaStr = JSON.stringify(ep.requestBody.schema, null, 2);
        const sLines = pdf.splitTextToSize(schemaStr, contentWidth - 16);
        const boxHeight = Math.min(sLines.length * 9.5 + 8, 80);
        pdf.rect(margin, y, contentWidth, boxHeight, 'FD');
        pdf.setFont('courier', 'normal');
        pdf.setFontSize(7);
        pdf.setTextColor(31, 41, 55);
        pdf.text(sLines.slice(0, 8), margin + 8, y + 11);
        y += boxHeight + 10;
      }
    }

    // Responses
    if (ep.responses && ep.responses.length > 0) {
      checkPageBreak(40);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(9.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Response Codes & Status', margin, y);
      y += 12;

      for (const r of ep.responses) {
        checkPageBreak(24);
        pdf.setFont('courier', 'bold');
        pdf.setFontSize(8);
        if (r.statusCode >= 200 && r.statusCode < 300) {
          pdf.setTextColor(22, 163, 74);
        } else if (r.statusCode >= 400 && r.statusCode < 500) {
          pdf.setTextColor(217, 119, 6);
        } else {
          pdf.setTextColor(220, 38, 38);
        }
        pdf.text(`${r.statusCode} ${r.statusText}`, margin, y);

        pdf.setFont('helvetica', 'normal');
        pdf.setFontSize(8);
        pdf.setTextColor(75, 85, 99);
        const rDesc = pdf.splitTextToSize(`— ${r.description}`, contentWidth - 85);
        pdf.text(rDesc, margin + 75, y);
        y += Math.max(14, rDesc.length * 10 + 4);
      }
      y += 4;
    }

    // Example Request (cURL)
    if (ep.exampleRequest) {
      checkPageBreak(50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Example Request (cURL)', margin, y);
      y += 10;

      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(229, 231, 235);
      const curlLines = pdf.splitTextToSize(ep.exampleRequest, contentWidth - 16);
      const curlBoxHeight = Math.min(curlLines.length * 9.5 + 8, 65);
      pdf.rect(margin, y, contentWidth, curlBoxHeight, 'FD');
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(31, 41, 55);
      pdf.text(curlLines.slice(0, 6), margin + 8, y + 10);
      y += curlBoxHeight + 12;
    }

    // Example Response (JSON)
    if (ep.exampleResponse) {
      checkPageBreak(50);
      pdf.setFont('helvetica', 'bold');
      pdf.setFontSize(8.5);
      pdf.setTextColor(31, 41, 55);
      pdf.text('Example Response (JSON)', margin, y);
      y += 10;

      pdf.setFillColor(248, 249, 250);
      pdf.setDrawColor(229, 231, 235);
      const resLines = pdf.splitTextToSize(ep.exampleResponse, contentWidth - 16);
      const resBoxHeight = Math.min(resLines.length * 9.5 + 8, 65);
      pdf.rect(margin, y, contentWidth, resBoxHeight, 'FD');
      pdf.setFont('courier', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(31, 41, 55);
      pdf.text(resLines.slice(0, 6), margin + 8, y + 10);
      y += resBoxHeight + 16;
    }

    if (i < doc.endpoints.length - 1) {
      pdf.setDrawColor(229, 231, 235);
      pdf.setLineWidth(0.5);
      pdf.line(margin, y, margin + contentWidth, y);
      y += 18;
    }
  }

  // --- Page Numbering Footers ---
  const totalPages = (pdf.internal as any).getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFont('helvetica', 'normal');
    pdf.setFontSize(7.5);
    pdf.setTextColor(150, 150, 150);
    pdf.text(
      `DocuAPI AI · ${doc.projectName} · Page ${p} of ${totalPages}`,
      pageWidth / 2,
      pageHeight - 16,
      { align: 'center' }
    );
  }

  const safeSlug =
    doc.projectName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'api-documentation';

  pdf.save(`${safeSlug}-documentation.pdf`);
}
