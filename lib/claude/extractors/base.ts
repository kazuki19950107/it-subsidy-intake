import { z } from 'zod';
import { anthropic, MODEL, MAX_TOKENS } from '../client';

export type ExtractionResult<T> = {
  data: T;
  confidence: number;
  usage: { input: number; output: number };
  raw: string;
};

/**
 * Vision OCR で抽出したテキストを Claude に渡して構造化JSONを得る。
 * 画像を直接 Claude vision に投げる方式は精度が出なかったため、
 * Google Vision (DOCUMENT_TEXT_DETECTION) → Claude (text-only) のパイプラインに統一。
 */
export async function extractFromText<T>({
  text: ocrText,
  systemPrompt,
  userPrompt,
  schema,
}: {
  text: string;
  systemPrompt: string;
  userPrompt: string;
  schema: z.ZodType<T>;
}): Promise<ExtractionResult<T>> {
  const response = await anthropic.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: systemPrompt,
    messages: [
      {
        role: 'user',
        content: `${userPrompt}\n\n=== 書類のOCRテキスト（Google Vision抽出）===\n${ocrText}\n=== ここまで ===`,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude APIの応答にテキストが含まれていません');
  }

  const respText = textBlock.text;
  const jsonMatch = respText.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude APIの応答にJSONが見つかりません: ${respText.slice(0, 200)}`);
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(jsonMatch[0]);
  } catch (e) {
    throw new Error(
      `Claude APIの応答JSONをパースできません: ${(e as Error).message}`,
    );
  }

  const validated = schema.parse(parsed);
  const confidence =
    typeof (parsed as Record<string, unknown>)._confidence === 'number'
      ? ((parsed as Record<string, unknown>)._confidence as number)
      : 0.9;

  return {
    data: validated,
    confidence,
    usage: {
      input: response.usage.input_tokens,
      output: response.usage.output_tokens,
    },
    raw: respText,
  };
}
