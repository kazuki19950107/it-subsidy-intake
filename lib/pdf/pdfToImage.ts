// クライアント側 PDF → PNG 変換ヘルパ。
// pdfjs-dist は Node では __dirname を要求してくるので、必ず動的 import で
// ブラウザ実行時のみロードする。

/**
 * File として渡された PDF を 1 ページずつ PNG Blob に変換する。
 * ブラウザでのみ動作（canvas を使う）。
 */
export async function pdfToPngPagesClient(
  file: File,
  options: { scale?: number; maxPages?: number } = {},
): Promise<Blob[]> {
  if (typeof window === 'undefined') {
    throw new Error('pdfToPngPagesClient はブラウザでのみ実行できます');
  }
  const { scale = 2.0, maxPages = 10 } = options;

  // 動的 import — Server コンポーネントのバンドルに含めない。
  // pdfjs-dist の build/pdf.mjs は型定義がないため、ローカル変数で型をキャスト。
  const pdfjs = (await import('pdfjs-dist/build/pdf.mjs' as string)) as typeof import('pdfjs-dist');
  pdfjs.GlobalWorkerOptions.workerSrc = new URL(
    'pdfjs-dist/build/pdf.worker.mjs',
    import.meta.url,
  ).toString();

  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
  const pdf = await loadingTask.promise;
  const pageCount = Math.min(pdf.numPages, maxPages);

  const results: Blob[] = [];
  for (let i = 1; i <= pageCount; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d コンテキスト取得失敗');

    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob: Blob = await new Promise((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error('PDF→PNG 変換失敗'))),
        'image/png',
      );
    });
    results.push(blob);
  }
  return results;
}
