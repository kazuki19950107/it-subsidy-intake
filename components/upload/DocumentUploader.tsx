'use client';

import { useCallback, useState } from 'react';
import { Camera, Upload, Loader2, FileImage, Trash2, RotateCw, Check, AlertCircle, CloudUpload, Download } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { DocType } from '@/lib/supabase/types';
import type { CrossCheckResult } from '@/lib/validation/crossCheck';
import { ValidationBadge, ValidationList } from './ValidationBadge';
import { ExtractionPreview } from './ExtractionPreview';
import { ReferenceImageCard } from './ReferenceImageViewer';
import { DOC_REFERENCE_IMAGES, DOC_SUPPLEMENTARY_IMAGES } from '@/lib/claude/referenceImages';
import { cn } from '@/lib/utils/cn';

function UploadStatusBanner({ status }: { status: 'pending' | 'analyzing' | 'done' | 'failed' }) {
  if (status === 'analyzing') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-amber-700">
        <Loader2 className="w-4 h-4 animate-spin" />
        <span>解析中... ファイルは保存済みです</span>
      </div>
    );
  }
  if (status === 'done') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-teal-dark">
        <Check className="w-4 h-4" />
        <span>保存完了・解析済み</span>
      </div>
    );
  }
  if (status === 'failed') {
    return (
      <div className="flex items-center gap-2 text-xs font-semibold text-accent">
        <AlertCircle className="w-4 h-4" />
        <span>解析失敗（ファイルは保存されています）</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 text-xs font-semibold text-mute">
      <CloudUpload className="w-4 h-4" />
      <span>アップロード待ち</span>
    </div>
  );
}

type UploadedDoc = {
  id: string;
  file_name: string;
  ocr_status: 'pending' | 'analyzing' | 'done' | 'failed';
  ocr_result: Record<string, unknown> | null;
  ocr_error: string | null;
  validation_errors: CrossCheckResult[] | null;
  previewUrl?: string;
};

type Props = {
  applicationId: string;
  docType: DocType;
  label: string;
  description?: string;
  required?: boolean;
  existingDocs?: UploadedDoc[];
  onChange?: (docs: UploadedDoc[]) => void;
};

export function DocumentUploader({
  applicationId,
  docType,
  label,
  description,
  required = true,
  existingDocs = [],
  onChange,
}: Props) {
  const [docs, setDocs] = useState<UploadedDoc[]>(existingDocs);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (next: UploadedDoc[]) => {
    setDocs(next);
    onChange?.(next);
  };

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      setUploading(true);
      setError(null);

      try {
        // PDF も画像もそのままアップロードする。
        // サーバー側で Google Vision API が PDF を直接 OCR する（files:annotate）。
        const newDocs: UploadedDoc[] = [...docs];
        for (const file of Array.from(files)) {
          if (file.size > 20 * 1024 * 1024) {
            throw new Error(`${file.name}: ファイルサイズが20MBを超えています`);
          }

          // 1. Signed URL 取得
          const uploadReq = await fetch('/api/documents/upload', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              application_id: applicationId,
              doc_type: docType,
              file_name: file.name,
              file_mime: file.type || 'application/octet-stream',
              file_size: file.size,
            }),
          });
          if (!uploadReq.ok) {
            const body = await uploadReq.json().catch(() => ({}));
            throw new Error(body.error ?? 'アップロード準備に失敗しました');
          }
          const { signed_url, document_id } = await uploadReq.json();

          // 2. ファイル本体を Supabase Storage にアップロード
          // signed URL はクエリ文字列にトークンを含むため、Authorization ヘッダー不要。
          // x-upsert で再アップロード時の上書きを許可。
          const put = await fetch(signed_url, {
            method: 'PUT',
            headers: {
              'Content-Type': file.type || 'application/octet-stream',
              'x-upsert': 'true',
            },
            body: file,
          });
          if (!put.ok) {
            const detail = await put.text().catch(() => '');
            throw new Error(
              `ファイルのアップロードに失敗しました（${put.status}）${detail ? `: ${detail.slice(0, 200)}` : ''}`,
            );
          }

          // 仮エントリー
          const previewUrl = URL.createObjectURL(file);
          newDocs.push({
            id: document_id,
            file_name: file.name,
            ocr_status: 'analyzing',
            ocr_result: null,
            ocr_error: null,
            validation_errors: null,
            previewUrl,
          });
          update([...newDocs]);

          // 3. 解析リクエスト
          const analyzeRes = await fetch('/api/documents/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ document_id }),
          });
          if (!analyzeRes.ok) {
            const body = await analyzeRes.json().catch(() => ({}));
            const idx = newDocs.findIndex((d) => d.id === document_id);
            if (idx >= 0) {
              newDocs[idx] = {
                ...newDocs[idx],
                ocr_status: 'failed',
                ocr_error: body.error ?? '解析に失敗しました',
              };
            }
            update([...newDocs]);
            continue;
          }
          const analyzed = await analyzeRes.json();
          const idx = newDocs.findIndex((d) => d.id === document_id);
          if (idx >= 0) {
            newDocs[idx] = {
              ...newDocs[idx],
              ocr_status: 'done',
              ocr_result: analyzed.ocr_result,
              validation_errors: analyzed.validation_errors ?? [],
            };
          }
          update([...newDocs]);
        }
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setUploading(false);
      }
    },
    [applicationId, docType, docs],
  );

  const handleDownload = async (docId: string, fileName: string) => {
    try {
      const res = await fetch(`/api/documents/${docId}/signed-url`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const { url } = await res.json();
      // 別タブで開いてブラウザのダウンロード機構に任せる（Content-Disposition で download 強制済）
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (e) {
      alert(`ダウンロードに失敗しました: ${(e as Error).message}`);
    }
  };

  const handleDelete = async (docId: string) => {
    if (!confirm('この書類を削除しますか？')) return;
    const res = await fetch(`/api/documents/${docId}`, { method: 'DELETE' });
    if (res.ok) {
      update(docs.filter((d) => d.id !== docId));
    } else {
      const body = await res.json().catch(() => ({}));
      alert(`削除に失敗しました: ${body.error ?? `HTTP ${res.status}`}`);
    }
  };

  const handleReanalyze = async (docId: string) => {
    const idx = docs.findIndex((d) => d.id === docId);
    if (idx < 0) return;
    const next = [...docs];
    next[idx] = { ...next[idx], ocr_status: 'analyzing' };
    update(next);
    const res = await fetch('/api/documents/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ document_id: docId }),
    });
    if (res.ok) {
      const analyzed = await res.json();
      next[idx] = {
        ...next[idx],
        ocr_status: 'done',
        ocr_result: analyzed.ocr_result,
        validation_errors: analyzed.validation_errors ?? [],
      };
    } else {
      next[idx] = { ...next[idx], ocr_status: 'failed', ocr_error: '再解析に失敗しました' };
    }
    update(next);
  };

  const referenceImage = DOC_REFERENCE_IMAGES[docType];
  const supplementaryImages = DOC_SUPPLEMENTARY_IMAGES[docType] ?? [];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="text-base">
              {label}
              {required && <span className="ml-1 text-accent">*</span>}
            </CardTitle>
            {description && (
              <CardDescription className="mt-1">{description}</CardDescription>
            )}
          </div>
          {docs.length > 0 && (
            <div className="shrink-0">
              <ValidationBadge
                errors={docs.flatMap((d) => d.validation_errors ?? [])}
              />
            </div>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {(referenceImage?.src || supplementaryImages.length > 0) && (
          <div className="grid gap-3 md:grid-cols-2">
            {referenceImage?.src && <ReferenceImageCard image={referenceImage} />}
            {supplementaryImages.map((img, i) => (
              <ReferenceImageCard key={i} image={img} />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="flex flex-wrap gap-2">
          <label className="cursor-pointer">
            <input
              type="file"
              accept="image/*,application/pdf"
              multiple
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <span className="inline-flex h-10 items-center gap-2 rounded-md border border-rule bg-white px-4 py-2 text-sm font-semibold hover:bg-teal-light">
              <Upload className="w-4 h-4" />
              ファイルを選択
            </span>
          </label>
          <label className="cursor-pointer md:hidden">
            <input
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              disabled={uploading}
              onChange={(e) => handleFiles(e.target.files)}
            />
            <span className="inline-flex h-10 items-center gap-2 rounded-md bg-teal px-4 py-2 text-sm font-semibold text-white hover:bg-teal-dark">
              <Camera className="w-4 h-4" />
              カメラで撮影
            </span>
          </label>
          {uploading && (
            <span className="inline-flex items-center gap-2 text-sm text-mute">
              <Loader2 className="w-4 h-4 animate-spin" />
              アップロード・解析中...
            </span>
          )}
        </div>

        {docs.length > 0 && (
          <ul className="space-y-3">
            {docs.map((d) => (
              <li
                key={d.id}
                className={cn(
                  'border-2 rounded-md p-3 transition-colors',
                  d.ocr_status === 'done' && 'border-teal/40 bg-teal/5',
                  d.ocr_status === 'analyzing' && 'border-amber-300 bg-amber-50',
                  d.ocr_status === 'failed' && 'border-accent/40 bg-accent/5',
                  d.ocr_status === 'pending' && 'border-rule bg-off-white',
                )}
              >
                <UploadStatusBanner status={d.ocr_status} />
                <div className="flex items-start justify-between gap-2 mt-2">
                  <div className="flex items-start gap-2 min-w-0 flex-1">
                    {d.previewUrl && d.file_name.match(/\.(png|jpe?g|gif|webp|heic|heif)$/i) ? (
                      <img
                        src={d.previewUrl}
                        alt=""
                        className="w-12 h-12 object-cover rounded border border-rule shrink-0"
                      />
                    ) : (
                      <FileImage className="w-12 h-12 shrink-0 text-mute p-2 border border-rule rounded bg-white" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium truncate">{d.file_name}</div>
                      {d.ocr_status === 'done' && d.validation_errors && (
                        <div className="mt-1">
                          <ValidationBadge errors={d.validation_errors ?? []} />
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    {d.ocr_status === 'failed' && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleReanalyze(d.id)}
                      >
                        <RotateCw className="w-3 h-3" />
                        再解析
                      </Button>
                    )}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDownload(d.id, d.file_name)}
                      aria-label="ダウンロード"
                    >
                      <Download className="w-4 h-4 text-mute" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(d.id)}
                      aria-label="削除"
                    >
                      <Trash2 className="w-4 h-4 text-accent" />
                    </Button>
                  </div>
                </div>

                {d.ocr_error && (
                  <Alert variant="destructive" className="mt-2">
                    <AlertDescription>{d.ocr_error}</AlertDescription>
                  </Alert>
                )}
                {d.ocr_status === 'done' && d.ocr_result && (
                  <>
                    <ExtractionPreview
                      documentId={d.id}
                      docType={docType}
                      ocrResult={d.ocr_result}
                      onSave={(corrected) => {
                        const idx = docs.findIndex((x) => x.id === d.id);
                        if (idx >= 0) {
                          const next = [...docs];
                          next[idx] = { ...next[idx], ocr_result: corrected };
                          update(next);
                        }
                      }}
                    />
                    <ValidationList errors={d.validation_errors ?? []} />
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
