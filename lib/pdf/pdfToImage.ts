// クライアント側 PDF → JPEG 変換ヘルパ。
// pdfjs-dist は Node では __dirname を要求してくるので、必ず動的 import で
// ブラウザ実行時のみロードする。

const TARGET_LONG_EDGE_PX = 2000; // Claude 内部の推奨解像度に合わせる
const MAX_BYTES = 4_500_000; // Claude API は 5MB/画像。安全マージン込みで 4.5MB

async function canvasToJpegBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error('canvas → JPEG エンコード失敗'))),
      'image/jpeg',
      quality,
    );
  });
}

/**
 * File として渡された PDF を 1 ページずつ JPEG Blob に変換する。
 * - 各ページを長辺 ~2000px になる scale で描画
 * - JPEG 品質 0.92 → 4.5MB 超なら 0.85 → 0.75 と段階的に下げる
 * ブラウザでのみ動作。
 */
export async function pdfToPngPagesClient(
  file: File,
  options: { maxPages?: number } = {},
): Promise<Blob[]> {
  if (typeof window === 'undefined') {
    throw new Error('pdfToPngPagesClient はブラウザでのみ実行できます');
  }
  const { maxPages = 10 } = options;

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
    // 1.0 倍のビューポートからページの実寸を取り、長辺が TARGET_LONG_EDGE_PX に
    // なるように scale を計算する。
    const baseViewport = page.getViewport({ scale: 1.0 });
    const longEdge = Math.max(baseViewport.width, baseViewport.height);
    const scale = TARGET_LONG_EDGE_PX / longEdge;
    const viewport = page.getViewport({ scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('canvas 2d コンテキスト取得失敗');

    // 白背景で塗りつぶし（透過PDFでJPEGが黒くなるのを防ぐ）
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: ctx, viewport }).promise;

    // 品質を段階的に下げて 4.5MB 以内に収める
    let blob: Blob | null = null;
    for (const quality of [0.92, 0.85, 0.75, 0.65]) {
      const b = await canvasToJpegBlob(canvas, quality);
      if (b.size <= MAX_BYTES) {
        blob = b;
        break;
      }
      blob = b; // 全部超過したら最後の小さい方を採用
    }
    if (!blob) throw new Error('PDF→JPEG 変換失敗');
    results.push(blob);
  }
  return results;
}
