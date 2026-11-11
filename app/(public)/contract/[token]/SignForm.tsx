'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import type { ConsentParty } from '@/lib/contracts/template';

/** 手書きの署名欄（マウス・指どちらでも書ける） */
function SignaturePad({ onChange }: { onChange: (dataUrl: string | null) => void }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const c = ref.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext('2d')!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.strokeStyle = '#111';
  }, []);

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  return (
    <div className="space-y-1">
      <canvas
        ref={ref}
        className="w-full h-40 bg-white border border-rule rounded-md touch-none"
        aria-label="手書きの署名欄"
        onPointerDown={(e) => {
          e.currentTarget.setPointerCapture(e.pointerId);
          drawing.current = true;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
        }}
        onPointerMove={(e) => {
          if (!drawing.current) return;
          const ctx = e.currentTarget.getContext('2d')!;
          const p = pos(e);
          ctx.lineTo(p.x, p.y);
          ctx.stroke();
          hasInk.current = true;
        }}
        onPointerUp={(e) => {
          drawing.current = false;
          onChange(hasInk.current ? e.currentTarget.toDataURL('image/png') : null);
        }}
      />
      <button
        type="button"
        className="text-xs text-teal hover:underline"
        onClick={() => {
          const c = ref.current!;
          c.getContext('2d')!.clearRect(0, 0, c.width, c.height);
          hasInk.current = false;
          onChange(null);
        }}
      >
        書き直す
      </button>
    </div>
  );
}

export function SignForm({
  token,
  label = '同意書',
  party = null,
  onPartyChange,
}: {
  token: string;
  label?: string;
  /** 同意書の「住所・名称・代表者」（あるときだけ入力欄を出す） */
  party?: ConsentParty | null;
  onPartyChange?: (p: ConsentParty) => void;
}) {
  const router = useRouter();
  const [method, setMethod] = useState<'typed' | 'drawn'>('typed');
  const [name, setName] = useState(party?.representative_name ?? '');
  const [nameTouched, setNameTouched] = useState(false);
  const setParty = (patch: Partial<ConsentParty>) => {
    if (!party || !onPartyChange) return;
    const next = { ...party, ...patch };
    onPartyChange(next);
    // 氏名は、手で直していなければ代表者と同じにしておく
    if (patch.representative_name !== undefined && !nameTouched) setName(patch.representative_name);
  };
  const [title, setTitle] = useState('');
  const [email, setEmail] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/contracts/${token}/sign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer_name: name,
          signer_title: title || null,
          signer_email: email || null,
          method,
          signature_image: method === 'drawn' ? image : null,
          agreed,
          party,
        }),
      });
      const b = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(b.error ?? '署名に失敗しました');
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const partyOk = !party || (party.address.trim() !== '' && party.company_name.trim() !== '' && party.representative_name.trim() !== '');
  const canSubmit = agreed && partyOk && name.trim() !== '' && (method === 'typed' || !!image) && !busy;

  return (
    <form onSubmit={submit} className="bg-white rounded-md border border-rule p-6 space-y-4">
      <h2 className="font-bold text-ink">署名</h2>
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {party && (
        <div className="space-y-3 rounded-md border border-teal/40 bg-teal-light/30 p-4">
          <div className="text-sm font-semibold text-ink">
            {label}に載せる会社の情報（必須）
            <span className="block text-xs font-normal text-mute">入力すると、上の{label}の「住所・名称・代表者」に入ります。</span>
          </div>
          <div className="space-y-1">
            <Label htmlFor="party_address">住所</Label>
            <Input id="party_address" value={party.address} onChange={(e) => setParty({ address: e.target.value })} autoComplete="street-address" placeholder="例: 東京都千代田区丸の内1-1-1" />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="party_company">名称（会社名・屋号）</Label>
              <Input id="party_company" value={party.company_name} onChange={(e) => setParty({ company_name: e.target.value })} autoComplete="organization" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="party_rep">代表者</Label>
              <Input id="party_rep" value={party.representative_name} onChange={(e) => setParty({ representative_name: e.target.value })} placeholder="例: 山田 太郎" />
            </div>
          </div>
        </div>
      )}
      <div className="grid gap-3 md:grid-cols-2">
        <div className="space-y-1">
          <Label htmlFor="signer_name">署名する人の氏名（必須）</Label>
          <Input
            id="signer_name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setNameTouched(true);
            }}
            autoComplete="name"
          />
        </div>
        <div className="space-y-1">
          <Label htmlFor="signer_title">役職</Label>
          <Input id="signer_title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="例: 代表取締役" />
        </div>
        <div className="space-y-1 md:col-span-2">
          <Label htmlFor="signer_email">メールアドレス</Label>
          <Input id="signer_email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
        </div>
      </div>
      <div className="space-y-2">
        <div className="text-sm font-semibold">署名の方法</div>
        <div className="flex gap-4 text-sm">
          <label className="flex items-center gap-1">
            <input type="radio" name="method" checked={method === 'typed'} onChange={() => setMethod('typed')} />
            氏名の入力で署名
          </label>
          <label className="flex items-center gap-1">
            <input type="radio" name="method" checked={method === 'drawn'} onChange={() => setMethod('drawn')} />
            手書きで署名
          </label>
        </div>
        {method === 'drawn' && <SignaturePad onChange={setImage} />}
      </div>
      <label className="flex items-start gap-2 text-sm">
        <input type="checkbox" className="mt-1 accent-teal w-4 h-4" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
        <span>上記の{label}の内容を確認し、同意します。署名日時・IPアドレスなどの記録が保存されることを了承します。</span>
      </label>
      <Button type="submit" size="lg" className="w-full" disabled={!canSubmit}>
        {busy ? '締結しています...' : '署名して締結する'}
      </Button>
    </form>
  );
}
