'use client';

import { useState } from 'react';
import { ImageIcon, ZoomIn } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import type { ReferenceImage } from '@/lib/claude/referenceImages';

/** モーダル表示用ボタン（ランディングページなどで使用） */
export function ReferenceImageButton({ image }: { image: ReferenceImage }) {
  const [open, setOpen] = useState(false);
  if (!image.src) return null;
  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        className="text-teal border-teal/50 hover:bg-teal-light"
      >
        <ImageIcon className="w-3.5 h-3.5" />
        参考画像を見る
      </Button>
      <ReferenceImageDialog image={image} open={open} onOpenChange={setOpen} />
    </>
  );
}

/** インライン表示カード（アップローダー内で常時表示、クリックで拡大） */
export function ReferenceImageCard({ image }: { image: ReferenceImage }) {
  const [open, setOpen] = useState(false);
  if (!image.src) return null;

  return (
    <div className="rounded-md border border-teal/30 bg-teal-light/20 overflow-hidden">
      <div className="px-3 py-2 bg-teal-light/60 border-b border-teal/30 flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-teal-dark">
          <ImageIcon className="w-3.5 h-3.5" />
          参考画像
        </div>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="text-xs text-teal hover:text-teal-dark flex items-center gap-1 hover:underline"
        >
          <ZoomIn className="w-3 h-3" />
          拡大して見る
        </button>
      </div>
      <div className="p-3 space-y-2">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="block w-full rounded border border-rule bg-white overflow-hidden hover:ring-2 hover:ring-teal transition-all cursor-zoom-in"
          aria-label={`${image.caption} を拡大表示`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.caption}
            className="w-full h-auto block max-h-[280px] object-contain bg-off-white"
            loading="lazy"
          />
        </button>
        <div className="text-xs text-charcoal font-medium">{image.caption}</div>
        {image.notes && image.notes.length > 0 && (
          <ul className="text-xs text-charcoal space-y-0.5">
            {image.notes.map((n, i) => (
              <li key={i} className="flex gap-1">
                <span className="text-teal shrink-0">※</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <ReferenceImageDialog image={image} open={open} onOpenChange={setOpen} />
    </div>
  );
}

function ReferenceImageDialog({
  image,
  open,
  onOpenChange,
}: {
  image: ReferenceImage;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
        <DialogTitle className="text-base">{image.caption}</DialogTitle>
        {image.notes && image.notes.length > 0 && (
          <ul className="text-sm text-charcoal space-y-1 mt-1 bg-teal-light/40 rounded p-3">
            {image.notes.map((n, i) => (
              <li key={i} className="flex gap-1.5">
                <span className="text-teal">※</span>
                <span>{n}</span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-2 rounded border border-rule bg-off-white overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={image.src}
            alt={image.caption}
            className="w-full h-auto block"
            loading="lazy"
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
