import type { DocType } from '@/lib/supabase/types';
import { extractCertificateOfHistory } from './certificateOfHistory';
import { extractTaxCertificate1, validateTaxCert1 } from './taxCertificate1';
import { extractTaxCertificate2, validateTaxCert2 } from './taxCertificate2';
import {
  extractFinancialStatements,
  validateFinancialStatements,
} from './financialStatements';
import { extractIdDocument, validateIdDocument } from './idDocument';
import { extractTaxReturn, validateTaxReturn } from './taxReturn';
import { extractBlueForm } from './blueForm';
import { extractETaxReceipt } from './eTaxReceipt';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

export type RunExtractionResult = {
  data: Record<string, unknown>;
  confidence: number;
  validationErrors: CrossCheckResult[];
  usage: { input: number; output: number };
};

export async function runExtractor(
  docType: DocType,
  ocrText: string,
): Promise<RunExtractionResult> {
  switch (docType) {
    case 'certificate_of_history': {
      const r = await extractCertificateOfHistory(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: [],
        usage: r.usage,
      };
    }
    case 'tax_cert_1': {
      const r = await extractTaxCertificate1(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxCert1(r.data),
        usage: r.usage,
      };
    }
    case 'tax_cert_2': {
      const r = await extractTaxCertificate2(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxCert2(r.data),
        usage: r.usage,
      };
    }
    case 'financial_statements': {
      const r = await extractFinancialStatements(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateFinancialStatements(r.data),
        usage: r.usage,
      };
    }
    case 'id_document': {
      const r = await extractIdDocument(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateIdDocument(r.data),
        usage: r.usage,
      };
    }
    case 'tax_return': {
      const r = await extractTaxReturn(ocrText);
      // e-Tax 受信通知の有無は後段のクロスチェックで判定するため、ここでは false 固定
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxReturn(r.data, false),
        usage: r.usage,
      };
    }
    case 'blue_form': {
      const r = await extractBlueForm(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: [],
        usage: r.usage,
      };
    }
    case 'e_tax_receipt': {
      const r = await extractETaxReceipt(ocrText);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: [],
        usage: r.usage,
      };
    }
    case 'gbiz_screenshot': {
      // スクリーンショットは解析対象外（そのまま保存）
      return {
        data: {},
        confidence: 1,
        validationErrors: [],
        usage: { input: 0, output: 0 },
      };
    }
    default:
      throw new Error(`未対応の書類種別: ${docType}`);
  }
}

export { DOC_TYPE_LABELS, REQUIRED_DOCS } from '@/lib/claude/docTypes';
