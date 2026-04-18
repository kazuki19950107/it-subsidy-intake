import { z } from 'zod';
import {
  anthropic,
  MODEL,
  MAX_TOKENS,
  isPdf,
  type SupportedMediaType,
  type SupportedImageMediaType,
} from '../client';
import type Anthropic from '@anthropic-ai/sdk';

type ContentBlock = Anthropic.MessageCreateParams['messages'][number]['content'];

function buildContentBlock(base64: string, mediaType: SupportedMediaType) {
  if (isPdf(mediaType)) {
    return {
      type: 'document' as const,
      source: {
        type: 'base64' as const,
        media_type: 'application/pdf' as const,
        data: base64,
      },
    };
  }
  return {
    type: 'image' as const,
    source: {
      type: 'base64' as const,
      media_type: mediaType,
      data: base64,
    },
  };
}

export type ExtractionResult<T> = {
  data: T;
  confidence: number;
  usage: { input: number; output: number };
  raw: string;
};

export async function extractDocument<T>({
  imageBase64,
  mediaType,
  systemPrompt,
  userPrompt,
  schema,
}: {
  imageBase64: string;
  mediaType: SupportedMediaType;
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
        content: [
          buildContentBlock(imageBase64, mediaType) as never,
          { type: 'text', text: userPrompt },
        ] as ContentBlock,
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude APIの応答にテキストが含まれていません');
  }

  const text = textBlock.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude APIの応答にJSONが見つかりません: ${text.slice(0, 200)}`);
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
    raw: text,
  };
}

// 複数画像で 1 つの抽出を行うバリアント（決算書など複数ページをまとめて解析）
export async function extractDocumentMulti<T>({
  images,
  systemPrompt,
  userPrompt,
  schema,
}: {
  images: Array<{ base64: string; mediaType: SupportedImageMediaType }>;
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
        content: [
          ...images.map((img) => ({
            type: 'image' as const,
            source: {
              type: 'base64' as const,
              media_type: img.mediaType,
              data: img.base64,
            },
          })),
          { type: 'text' as const, text: userPrompt },
        ],
      },
    ],
  });

  const textBlock = response.content.find((b) => b.type === 'text');
  if (!textBlock || textBlock.type !== 'text') {
    throw new Error('Claude APIの応答にテキストが含まれていません');
  }
  const text = textBlock.text;
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error(`Claude APIの応答にJSONが見つかりません: ${text.slice(0, 200)}`);
  }
  const parsed = JSON.parse(jsonMatch[0]);
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
    raw: text,
  };
}
