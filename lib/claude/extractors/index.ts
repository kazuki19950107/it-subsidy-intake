import type { DocType } from '@/lib/supabase/types';
import type { SupportedMediaType } from '../client';
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
  imageBase64: string,
  mediaType: SupportedMediaType,
): Promise<RunExtractionResult> {
  switch (docType) {
    case 'certificate_of_history': {
      const r = await extractCertificateOfHistory(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: [],
        usage: r.usage,
      };
    }
    case 'tax_cert_1': {
      const r = await extractTaxCertificate1(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxCert1(r.data),
        usage: r.usage,
      };
    }
    case 'tax_cert_2': {
      const r = await extractTaxCertificate2(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxCert2(r.data),
        usage: r.usage,
      };
    }
    case 'financial_statements': {
      const r = await extractFinancialStatements(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateFinancialStatements(r.data),
        usage: r.usage,
      };
    }
    case 'id_document': {
      const r = await extractIdDocument(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateIdDocument(r.data),
        usage: r.usage,
      };
    }
    case 'tax_return': {
      const r = await extractTaxReturn(imageBase64, mediaType);
      // e-Tax 受信通知の有無は後段のクロスチェックで判定するため、ここでは false 固定
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: validateTaxReturn(r.data, false),
        usage: r.usage,
      };
    }
    case 'blue_form': {
      const r = await extractBlueForm(imageBase64, mediaType);
      return {
        data: r.data as unknown as Record<string, unknown>,
        confidence: r.confidence,
        validationErrors: [],
        usage: r.usage,
      };
    }
    case 'e_tax_receipt': {
      const r = await extractETaxReceipt(imageBase64, mediaType);
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
