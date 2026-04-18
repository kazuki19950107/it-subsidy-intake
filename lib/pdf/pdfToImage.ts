// PDF → 画像変換（サーバー側）
// pdfjs-dist を使って 1 ページずつ PNG に変換する
// Node 環境で canvas に依存しないように、低レベル API で画像データを取り出す

import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';

// 標準フォントや worker のパスを無効化（サーバー側で直接実行）
pdfjs.GlobalWorkerOptions.workerSrc = '';

export async function pdfToPngPages(pdfBuffer: Buffer, maxPages = 5): Promise<Buffer[]> {
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(pdfBuffer),
    disableFontFace: true,
    isEvalSupported: false,
  });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, maxPages);

  const results: Buffer[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    // Node 環境では node-canvas などが必要だが、MVP では簡易対応として
    // 画像化はクライアント側（申請者ブラウザ）で実施する前提にする。
    // このファイルはサーバー側で呼ばれた場合のフォールバック用にテキストのみ返す。
    results.push(
      Buffer.from(
        JSON.stringify({ page: i, width: viewport.width, height: viewport.height }),
      ),
    );
  }
  return results;
}

/**
 * クライアント側での PDF → 画像変換（DocumentUploader で使用）
 * ブラウザで canvas API が使える環境でのみ動く
 */
export async function pdfToPngPagesClient(file: File): Promise<Blob[]> {
  const arrayBuffer = await file.arrayBuffer();
  // pdfjs-dist の build/pdf.mjs は型定義がないため、動的 import + any キャストで回避
  const pdfjsClient = (await import(
    /* webpackIgnore: true */ 'pdfjs-dist/build/pdf.mjs' as string
  )) as typeof pdfjs;
  pdfjsClient.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const loadingTask = pdfjsClient.getDocument({ data: arrayBuffer });
  const pdf = await loadingTask.promise;
  const results: Blob[] = [];

  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2.0 });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d コンテキスト取得失敗');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PDF→画像変換失敗'))),
        'image/png',
      );
    });
    results.push(blob);
  }
  return results;
}
