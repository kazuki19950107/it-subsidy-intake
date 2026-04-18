'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { FileImage, Loader2, Download } from 'lucide-react';
import { ValidationList } from '@/components/upload/ValidationBadge';
import type { Document } from '@/lib/supabase/types';
import { DOC_TYPE_LABELS } from '@/lib/claude/docTypes';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';

type Props = {
  doc: Document;
};

export function DocumentViewer({ doc }: Props) {
  const [signedUrl, setSignedUrl] = useState<string | null>(null);
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/admin/documents/${doc.id}/signed-url`)
      .then((r) => r.json())
      .then((d) => {
        if (cancelled) return;
        setSignedUrl(d.url ?? null);
        setDownloadUrl(d.download_url ?? d.url ?? null);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [doc.id]);

  const result = (doc.user_corrected ?? doc.ocr_result) as Record<string, unknown> | null;
  const validationErrors = (doc.validation_errors ?? []) as unknown as CrossCheckResult[];
  const isImage = doc.file_mime.startsWith('image/');

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base flex items-center gap-2 min-w-0">
            <FileImage className="w-4 h-4 shrink-0" />
            <span className="truncate">{DOC_TYPE_LABELS[doc.doc_type]}</span>
          </CardTitle>
          <div className="flex items-center gap-2 shrink-0">
            <Badge variant={doc.ocr_status === 'done' ? 'success' : 'muted'}>
              {doc.ocr_status === 'done' ? '解析済' : doc.ocr_status}
            </Badge>
            {downloadUrl && (
              <Button asChild variant="outline" size="sm">
                <a href={downloadUrl} download={doc.file_name}>
                  <Download className="w-3 h-3" />
                  ダウンロード
                </a>
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <div className="text-xs text-mute mb-2">{doc.file_name}</div>
            {loading ? (
              <div className="flex items-center justify-center h-48 bg-off-white rounded border border-rule">
                <Loader2 className="w-5 h-5 animate-spin text-mute" />
              </div>
            ) : signedUrl && isImage ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={signedUrl}
                alt={doc.file_name}
                className="w-full max-h-[500px] object-contain bg-off-white rounded border border-rule"
              />
            ) : signedUrl ? (
              <a
                href={signedUrl}
                target="_blank"
                rel="noreferrer"
                className="block p-6 text-center bg-off-white rounded border border-rule text-teal hover:bg-teal-light"
              >
                ファイルを開く
              </a>
            ) : (
              <div className="p-6 text-center bg-off-white rounded border border-rule text-mute">
                プレビューが取得できません
              </div>
            )}
          </div>

          <div>
            <div className="text-xs text-mute mb-2">抽出結果</div>
            {result ? (
              <dl className="space-y-1 text-sm">
                {Object.entries(result)
                  .filter(([k]) => !k.startsWith('_'))
                  .map(([k, v]) => (
                    <div key={k} className="flex justify-between border-b border-rule/50 py-1">
                      <dt className="text-mute text-xs">{k}</dt>
                      <dd className="font-medium text-right ml-2 break-all">
                        {v == null ? (
                          <span className="text-mute">未取得</span>
                        ) : Array.isArray(v) ? (
                          v.join(', ')
                        ) : typeof v === 'boolean' ? (
                          v ? 'はい' : 'いいえ'
                        ) : (
                          String(v)
                        )}
                      </dd>
                    </div>
                  ))}
              </dl>
            ) : (
              <div className="text-sm text-mute">未解析</div>
            )}
            {validationErrors.length > 0 && <ValidationList errors={validationErrors} />}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
