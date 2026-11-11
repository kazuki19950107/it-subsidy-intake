'use client';

import Link from 'next/link';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ChevronDown, FileText, ImagePlus, Loader2, MapPin, MessageCircle, Search, SendHorizontal, Settings2, Users, X } from 'lucide-react';
import { useSavedState } from '@/lib/hooks/useSavedState';
import { dateLabel, hhmm, previewOf, shortTime, splitLinks } from '@/lib/line/messageText';
import type { ChatThread } from '@/lib/line/threads';
import type { ChatMessage } from '@/lib/line/messages';
import s from './talk.module.css';

type Local = ChatMessage & { localStatus?: 'sending' | 'failed'; localError?: string; localImage?: Blob };

const POLL_TALK_MS = 5_000;
const POLL_LIST_MS = 15_000;

function cx(...c: Array<string | false | null | undefined>) {
  return c.filter(Boolean).join(' ');
}

/** グループのアイコン（画像が無いときは頭文字） */
function Avatar({ url, name, size }: { url: string | null; name: string | null; size: number }) {
  const [broken, setBroken] = useState(false);
  const initial = (name ?? '').replace(/^[0-9０-９]+次/, '').trim().charAt(0) || '？';
  if (url && !broken) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={url} alt="" width={size} height={size} className={s.avatar} style={{ width: size, height: size }} onError={() => setBroken(true)} />;
  }
  return (
    <span className={s.avatar} style={{ width: size, height: size, fontSize: size * 0.42 }} aria-hidden>
      {initial}
    </span>
  );
}

function fileSize(n: number | null): string {
  if (!n) return '';
  if (n < 1024) return `${n}B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)}KB`;
  return `${(n / 1024 / 1024).toFixed(1)}MB`;
}

/** 画像を送る前に小さくする（長い辺 2000px・JPEG）。PNG の透明部分は白にする */
async function shrinkImage(file: Blob): Promise<Blob> {
  const bmp = await createImageBitmap(file);
  const scale = Math.min(1, 2000 / Math.max(bmp.width, bmp.height));
  const w = Math.round(bmp.width * scale);
  const h = Math.round(bmp.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.fillStyle = '#fff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bmp, 0, 0, w, h);
  bmp.close();
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('画像を変換できませんでした'))), 'image/jpeg', 0.85));
}

function TextWithLinks({ text }: { text: string }) {
  return (
    <>
      {splitLinks(text).map((p, i) =>
        p.href ? (
          <a key={i} href={p.href} target="_blank" rel="noopener noreferrer">
            {p.text}
          </a>
        ) : (
          <span key={i}>{p.text}</span>
        ),
      )}
    </>
  );
}

export function TalkClient({
  initialThreads,
  initialGroupId,
  staffNames,
  quota,
}: {
  initialThreads: ChatThread[];
  initialGroupId: string | null;
  staffNames: string[];
  quota: { limit: number | null; used: number } | null;
}) {
  const [threads, setThreads] = useState(initialThreads);
  const [selectedId, setSelectedId] = useState<string | null>(initialGroupId);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useSavedState<'all' | 'unread' | 'customer' | 'internal'>('talk.filter', 'all');
  const [sender, setSender] = useSavedState<string>('talk.sender', '');
  const [messages, setMessages] = useState<Local[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);
  const [loadingOlder, setLoadingOlder] = useState(false);
  const [draft, setDraft] = useState('');
  const [pendingImage, setPendingImage] = useState<{ blob: Blob; url: string; name: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [newBelow, setNewBelow] = useState(0);
  const [usedCount, setUsedCount] = useState(quota?.used ?? null);

  const cache = useRef(new Map<string, { messages: Local[]; hasMore: boolean }>());
  const bodyRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const selectedRef = useRef(selectedId);
  selectedRef.current = selectedId;
  const nearBottom = useRef(true);
  const scrollMode = useRef<'bottom' | { keepFrom: number } | null>('bottom');

  const selected = threads.find((t) => t.id === selectedId) ?? null;
  const totalUnread = threads.reduce((n, t) => n + t.unread, 0);

  const visibleThreads = useMemo(() => {
    const q = query.trim().toLowerCase();
    return threads.filter((t) => {
      if (filter === 'unread' && t.unread === 0) return false;
      if (filter === 'customer' && t.kind !== 'customer') return false;
      if (filter === 'internal' && t.kind !== 'internal') return false;
      if (!q) return true;
      return [t.group_name, t.case_label, t.last_message_preview].some((v) => (v ?? '').toLowerCase().includes(q));
    });
  }, [threads, query, filter]);

  // ---- 読み込み ----
  const loadThreads = useCallback(async () => {
    const res = await fetch('/api/admin/line/threads', { cache: 'no-store' }).catch(() => null);
    if (!res?.ok) return;
    const { threads: list } = (await res.json()) as { threads: ChatThread[] };
    // 開いているトークは未読 0 のまま
    setThreads(list.map((t) => (t.id === selectedRef.current ? { ...t, unread: 0 } : t)));
  }, []);

  const markRead = useCallback((id: string) => {
    fetch(`/api/admin/line/groups/${id}/read`, { method: 'POST' }).catch(() => {});
    setThreads((prev) => prev.map((t) => (t.id === id ? { ...t, unread: 0 } : t)));
  }, []);

  const openThread = useCallback(
    async (id: string) => {
      setSelectedId(id);
      setError(null);
      setNewBelow(0);
      const url = new URL(window.location.href);
      url.searchParams.set('g', id);
      window.history.replaceState(null, '', url.toString());
      const cached = cache.current.get(id);
      setMessages(cached?.messages ?? []);
      setHasMore(cached?.hasMore ?? false);
      scrollMode.current = 'bottom';
      markRead(id);
      setLoading(!cached);
      const res = await fetch(`/api/admin/line/groups/${id}/messages`, { cache: 'no-store' }).catch(() => null);
      setLoading(false);
      if (selectedRef.current !== id) return; // 別のトークに切り替えた
      if (!res?.ok) {
        setError('メッセージを読み込めませんでした');
        return;
      }
      const data = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean };
      scrollMode.current = 'bottom';
      setMessages(data.messages);
      setHasMore(data.hasMore);
      setTimeout(() => inputRef.current?.focus(), 0);
    },
    [markRead],
  );

  useEffect(() => {
    if (initialGroupId) void openThread(initialGroupId);
    // 最初の 1 回だけ
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 開いているトークを覚えておく（切り替えたときにすぐ出す）
  useEffect(() => {
    if (selectedId) cache.current.set(selectedId, { messages: messages.filter((m) => !m.localStatus), hasMore });
  }, [selectedId, messages, hasMore]);

  const loadOlder = useCallback(async () => {
    if (!selectedId || loadingOlder || !hasMore) return;
    const oldest = messages.find((m) => !m.localStatus);
    if (!oldest) return;
    setLoadingOlder(true);
    const id = selectedId;
    const res = await fetch(`/api/admin/line/groups/${id}/messages?before=${encodeURIComponent(oldest.sent_at)}`, { cache: 'no-store' }).catch(() => null);
    setLoadingOlder(false);
    if (!res?.ok || selectedRef.current !== id) return;
    const data = (await res.json()) as { messages: ChatMessage[]; hasMore: boolean };
    scrollMode.current = { keepFrom: bodyRef.current ? bodyRef.current.scrollHeight - bodyRef.current.scrollTop : 0 };
    setMessages((prev) => [...data.messages, ...prev]);
    setHasMore(data.hasMore);
  }, [selectedId, loadingOlder, hasMore, messages]);

  // 新しいメッセージを取りに行く
  const pollTalk = useCallback(async () => {
    const id = selectedRef.current;
    if (!id) return;
    const latest = [...messages].reverse().find((m) => !m.localStatus);
    const q = latest ? `?after=${encodeURIComponent(latest.sent_at)}` : '';
    const res = await fetch(`/api/admin/line/groups/${id}/messages${q}`, { cache: 'no-store' }).catch(() => null);
    if (!res?.ok || selectedRef.current !== id) return;
    const data = (await res.json()) as { messages: ChatMessage[] };
    if (!latest) {
      if (data.messages.length) setMessages(data.messages);
      return;
    }
    if (data.messages.length === 0) return;
    setMessages((prev) => {
      const ids = new Set(prev.map((m) => m.id));
      const add = data.messages.filter((m) => !ids.has(m.id));
      if (add.length === 0) return prev;
      const local = prev.filter((m) => m.localStatus);
      const sent = prev.filter((m) => !m.localStatus);
      if (nearBottom.current) scrollMode.current = 'bottom';
      else setNewBelow((n) => n + add.filter((m) => m.direction === 'in').length);
      return [...sent, ...add, ...local];
    });
    if (data.messages.some((m) => m.direction === 'in') && document.visibilityState === 'visible') markRead(id);
  }, [messages, markRead]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void pollTalk();
    }, POLL_TALK_MS);
    return () => clearInterval(t);
  }, [pollTalk]);

  useEffect(() => {
    const t = setInterval(() => {
      if (document.visibilityState === 'visible') void loadThreads();
    }, POLL_LIST_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible') {
        void loadThreads();
        void pollTalk();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      clearInterval(t);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [loadThreads, pollTalk]);

  // ---- スクロール ----
  const scrollToBottom = useCallback(() => {
    const el = bodyRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
    setNewBelow(0);
  }, []);

  useLayoutEffect(() => {
    const el = bodyRef.current;
    const mode = scrollMode.current;
    if (!el || !mode) return;
    if (mode === 'bottom') {
      el.scrollTop = el.scrollHeight;
      // 画像の読み込みで高さが変わっても下に合わせる
      requestAnimationFrame(() => (el.scrollTop = el.scrollHeight));
      setTimeout(() => {
        if (nearBottom.current) el.scrollTop = el.scrollHeight;
      }, 120);
    } else {
      el.scrollTop = el.scrollHeight - mode.keepFrom;
    }
    scrollMode.current = null;
  }, [messages]);

  const onScroll = () => {
    const el = bodyRef.current;
    if (!el) return;
    nearBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom.current && newBelow) setNewBelow(0);
    if (el.scrollTop < 40 && hasMore && !loadingOlder) void loadOlder();
  };

  // ---- 送信 ----
  const pickImage = (file: File | null | undefined) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setError('送れるのは画像だけです（PDF などのファイルは送れません）');
      return;
    }
    if (file.size > 20 * 1024 * 1024) {
      setError('画像が大きすぎます（20MBまで）');
      return;
    }
    setError(null);
    if (pendingImage) URL.revokeObjectURL(pendingImage.url);
    setPendingImage({ blob: file, url: URL.createObjectURL(file), name: file.name || '画像' });
  };

  const postMessage = async (local: Local[], text: string, image: Blob | null): Promise<void> => {
    const id = selectedRef.current;
    if (!id) return;
    const ids = new Set(local.map((m) => m.id));
    try {
      let res: Response;
      if (image) {
        const small = await shrinkImage(image);
        if (small.size > 4 * 1024 * 1024) throw new Error('画像が大きすぎます');
        const form = new FormData();
        form.set('image', new File([small], 'image.jpg', { type: 'image/jpeg' }));
        form.set('text', text);
        form.set('sentBy', sender);
        res = await fetch(`/api/admin/line/groups/${id}/messages`, { method: 'POST', body: form });
      } else {
        res = await fetch(`/api/admin/line/groups/${id}/messages`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text, sentBy: sender }),
        });
      }
      const data = (await res.json().catch(() => ({}))) as { messages?: ChatMessage[]; error?: string };
      if (!res.ok || !data.messages) throw new Error(data.error ?? '送れませんでした');
      if (selectedRef.current !== id) return;
      scrollMode.current = 'bottom';
      setMessages((prev) => {
        const known = new Set(prev.map((m) => m.id));
        return [...prev.filter((m) => !ids.has(m.id)), ...data.messages!.filter((m) => !known.has(m.id))];
      });
      setUsedCount((n) => (n == null ? n : n + 1));
      void loadThreads();
    } catch (e) {
      const reason = (e as Error).message;
      setMessages((prev) => prev.map((m) => (ids.has(m.id) ? { ...m, localStatus: 'failed', localError: reason } : m)));
    }
  };

  const send = () => {
    if (!selected) return;
    const text = draft.trim();
    if (!text && !pendingImage) return;
    const now = new Date().toISOString();
    const base = {
      line_group_id: selected.id,
      direction: 'out' as const,
      sticker_package_id: null,
      sticker_id: null,
      storage_path: null,
      file_name: null,
      file_size: null,
      line_message_id: null,
      sender_user_id: null,
      sender_name: null,
      sender_picture_url: null,
      sent_by: sender || '社内',
      sent_at: now,
      unsent_at: null,
      created_at: now,
      localStatus: 'sending' as const,
    };
    const local: Local[] = [];
    if (pendingImage) {
      local.push({ ...base, id: `local-${Date.now()}-img`, message_type: 'image', text: null, media_url: pendingImage.url, localImage: pendingImage.blob });
    }
    if (text) local.push({ ...base, id: `local-${Date.now()}-txt`, message_type: 'text', text, media_url: null });
    scrollMode.current = 'bottom';
    setMessages((prev) => [...prev, ...local]);
    setDraft('');
    setPendingImage(null);
    setError(null);
    void postMessage(local, text, pendingImage?.blob ?? null);
    inputRef.current?.focus();
  };

  const retry = (m: Local) => {
    const group = messages.filter((x) => x.localStatus === 'failed' && x.sent_at === m.sent_at);
    setMessages((prev) => prev.map((x) => (group.includes(x) ? { ...x, localStatus: 'sending', localError: undefined } : x)));
    const text = group.find((x) => x.message_type === 'text')?.text ?? '';
    const image = group.find((x) => x.localImage)?.localImage ?? null;
    void postMessage(group, text, image);
  };
  const discard = (m: Local) => setMessages((prev) => prev.filter((x) => !(x.localStatus === 'failed' && x.sent_at === m.sent_at)));

  // 入力欄の高さを文字に合わせる
  useLayoutEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 140)}px`;
  }, [draft, selectedId]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // 変換中の Enter では送らない。Shift+Enter は改行
    if (e.key !== 'Enter' || e.shiftKey || e.altKey || e.nativeEvent.isComposing || e.keyCode === 229) return;
    e.preventDefault();
    send();
  };

  // ---- 表示 ----
  const rows = useMemo(() => {
    const out: Array<{ kind: 'date'; key: string; label: string } | { kind: 'msg'; key: string; m: Local; first: boolean; showTime: boolean }> = [];
    messages.forEach((m, i) => {
      const prev = messages[i - 1];
      const next = messages[i + 1];
      const day = new Date(m.sent_at).toDateString();
      const newDay = !prev || new Date(prev.sent_at).toDateString() !== day;
      if (newDay) out.push({ kind: 'date', key: `d-${m.id}`, label: dateLabel(m.sent_at) });
      const sameSide = (a?: Local) =>
        !!a && a.direction === m.direction && (m.direction === 'out' || a.sender_user_id === m.sender_user_id);
      const first = newDay || !sameSide(prev);
      const sameMinute = (a?: Local) => !!a && hhmm(a.sent_at) === hhmm(m.sent_at) && new Date(a.sent_at).toDateString() === day;
      const showTime = !next || !sameSide(next) || !sameMinute(next) || !!m.localStatus || !!next.localStatus;
      out.push({ kind: 'msg', key: m.id, m, first, showTime });
    });
    return out;
  }, [messages]);

  const renderContent = (m: Local, tail: boolean) => {
    const inbound = m.direction === 'in';
    const bubble = cx(s.bubble, inbound ? s.bubbleIn : s.bubbleOut, tail && (inbound ? s.tailIn : s.tailOut));
    if (m.unsent_at) return <div className={s.unsent}>メッセージの送信が取り消されました</div>;
    switch (m.message_type) {
      case 'text':
        return (
          <div className={bubble}>
            <TextWithLinks text={m.text ?? ''} />
          </div>
        );
      case 'sticker':
        return m.media_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={m.media_url} alt="スタンプ" className={s.sticker} />
        ) : (
          <div className={bubble}>[スタンプ]</div>
        );
      case 'image':
        return m.media_url ? (
          <button type="button" className={s.media} onClick={() => setLightbox(m.media_url)} style={{ border: 0, padding: 0 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={m.media_url} alt="画像" loading="lazy" style={{ opacity: m.localStatus === 'sending' ? 0.6 : 1 }} />
          </button>
        ) : (
          <div className={bubble}>[画像]（保存できませんでした）</div>
        );
      case 'video':
        return m.media_url ? (
          <video src={m.media_url} controls preload="metadata" className={s.media} style={{ cursor: 'default' }} />
        ) : (
          <div className={bubble}>[動画]（保存できませんでした）</div>
        );
      case 'audio':
        return m.media_url ? <audio src={m.media_url} controls preload="none" /> : <div className={bubble}>[音声]</div>;
      case 'file':
        return (
          <div className={bubble}>
            <a className={s.file} href={m.media_url ?? undefined} target="_blank" rel="noopener noreferrer" download={m.file_name ?? undefined}>
              <span className={s.fileIcon}>
                <FileText size={18} />
              </span>
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                  {m.file_name ?? 'ファイル'}
                </span>
                <span style={{ display: 'block', fontSize: 11, color: '#8b9096' }}>
                  {m.media_url ? `${fileSize(m.file_size)}・開く` : '保存できませんでした'}
                </span>
              </span>
            </a>
          </div>
        );
      case 'location':
        return (
          <div className={bubble}>
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(m.text ?? '')}`}
              target="_blank"
              rel="noopener noreferrer"
              style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}
            >
              <MapPin size={16} style={{ flex: 'none', marginTop: 3 }} />
              {m.text ?? '位置情報'}
            </a>
          </div>
        );
      default:
        return <div className={bubble}>{previewOf(m)}</div>;
    }
  };

  const quotaText =
    usedCount != null ? `今月 ${usedCount}${quota?.limit != null ? `/${quota.limit}` : ''}通` : null;

  return (
    <div className={s.wrap}>
      {/* ---- トーク一覧 ---- */}
      <aside className={cx(s.threads, selected && s.hideMobile)}>
        <div className={s.threadsHead}>
          <span className={s.threadsTitle}>トーク</span>
          {totalUnread > 0 && <span className={s.totalBadge}>{totalUnread > 99 ? '99+' : totalUnread}</span>}
          <Link href="/admin/line" className={s.iconBtn} style={{ marginLeft: 'auto' }} title="グループの設定（紐付け・社内用）">
            <Settings2 size={18} />
          </Link>
        </div>
        <div className={s.search}>
          <label className={s.searchBox}>
            <Search size={15} />
            <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="グループ名・会社名で検索" />
            {query && (
              <button type="button" onClick={() => setQuery('')} aria-label="検索を消す" style={{ border: 0, background: 'none', color: '#9aa0a6', cursor: 'pointer' }}>
                <X size={14} />
              </button>
            )}
          </label>
          <div className={s.filters}>
            {(
              [
                ['all', 'すべて'],
                ['unread', '未読'],
                ['customer', 'お客様'],
                ['internal', '社内用'],
              ] as const
            ).map(([k, label]) => (
              <button key={k} type="button" className={cx(s.chip, filter === k && s.chipOn)} onClick={() => setFilter(k)}>
                {label}
              </button>
            ))}
          </div>
        </div>
        <div className={s.threadList}>
          {visibleThreads.length === 0 && (
            <div className={s.empty}>{threads.length === 0 ? '公式LINEが参加しているグループがありません' : '当てはまるトークがありません'}</div>
          )}
          {visibleThreads.map((t) => (
            <button key={t.id} type="button" className={cx(s.row, t.id === selectedId && s.rowActive)} onClick={() => void openThread(t.id)}>
              <Avatar url={t.picture_url} name={t.group_name} size={48} />
              <div className={s.rowMain}>
                <div className={s.rowTop}>
                  <span className={s.rowName}>{t.group_name ?? '（グループ名を取得できていません）'}</span>
                  {t.kind === 'internal' && <span className={s.tag}>社内用</span>}
                  {!t.active && <span className={cx(s.tag, s.tagWarn)}>退出済み</span>}
                  {t.last_message_at && <span className={s.rowTime}>{shortTime(t.last_message_at)}</span>}
                </div>
                <div className={s.rowBottom}>
                  <span className={s.rowPreview}>
                    {t.kind === 'customer' && !t.application_id && <span style={{ color: '#e08600' }}>未紐付け・</span>}
                    {t.last_message_preview ?? 'まだメッセージがありません'}
                  </span>
                  {t.unread > 0 && <span className={s.unread}>{t.unread > 99 ? '99+' : t.unread}</span>}
                </div>
              </div>
            </button>
          ))}
        </div>
      </aside>

      {/* ---- トーク ---- */}
      <section className={cx(s.talk, !selected && s.hideMobile)}>
        {!selected ? (
          <div className={s.placeholder}>
            <MessageCircle size={44} strokeWidth={1.5} />
            左のトークを選んでください
          </div>
        ) : (
          <>
            <header className={s.talkHead}>
              <button type="button" className={cx(s.iconBtn, s.back)} onClick={() => setSelectedId(null)} aria-label="一覧に戻る">
                <ArrowLeft size={18} />
              </button>
              <Avatar url={selected.picture_url} name={selected.group_name} size={34} />
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className={s.talkName}>{selected.group_name ?? '（グループ名なし）'}</div>
                <div className={s.talkSub}>
                  {selected.kind === 'internal' ? (
                    '社内用グループ'
                  ) : selected.application_id ? (
                    <Link href={`/admin/dashboard/${selected.application_id}`} className={s.caseLink}>
                      案件: {selected.case_label}
                    </Link>
                  ) : (
                    <Link href="/admin/line" className={s.warn}>
                      案件と紐付いていません（LINE画面で選ぶ）
                    </Link>
                  )}
                </div>
              </div>
              <Link href="/admin/line" className={s.iconBtn} title="グループの設定">
                <Users size={18} />
              </Link>
            </header>

            <div
              ref={bodyRef}
              className={cx(s.body, dragging && s.bodyDrag)}
              onScroll={onScroll}
              onDragOver={(e) => {
                if (e.dataTransfer.types.includes('Files')) {
                  e.preventDefault();
                  setDragging(true);
                }
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(e) => {
                e.preventDefault();
                setDragging(false);
                pickImage(e.dataTransfer.files?.[0]);
              }}
            >
              {hasMore && (
                <div className={s.loadOlder}>
                  <button type="button" onClick={() => void loadOlder()} disabled={loadingOlder}>
                    {loadingOlder ? '読み込み中…' : '前のメッセージを見る'}
                  </button>
                </div>
              )}
              {loading && messages.length === 0 && (
                <div className={s.placeholder} style={{ paddingTop: 40 }}>
                  <Loader2 className="animate-spin" size={24} />
                </div>
              )}
              {!loading && messages.length === 0 && (
                <div className={s.placeholder} style={{ paddingTop: 40, textAlign: 'center' }}>
                  まだメッセージがありません
                  <span style={{ fontSize: 11, opacity: 0.85 }}>公式LINEが参加したあとのメッセージだけが表示されます</span>
                </div>
              )}
              {rows.map((r) => {
                if (r.kind === 'date') {
                  return (
                    <div key={r.key} className={s.dateSep}>
                      <span>{r.label}</span>
                    </div>
                  );
                }
                const { m, first, showTime } = r;
                const inbound = m.direction === 'in';
                const plain = m.message_type === 'sticker' || m.message_type === 'image' || m.message_type === 'video' || !!m.unsent_at;
                if (m.unsent_at) {
                  return (
                    <div key={r.key} className={s.dateSep}>
                      <span>{inbound ? `${m.sender_name ?? 'メンバー'}が` : ''}メッセージの送信を取り消しました</span>
                    </div>
                  );
                }
                return (
                  <div key={r.key} className={cx(s.msgRow, !inbound && s.msgRowOut, first && s.msgRowFirst)}>
                    {inbound && (
                      <div className={s.msgAvatar}>{first && <Avatar url={m.sender_picture_url} name={m.sender_name} size={34} />}</div>
                    )}
                    <div className={s.msgCol}>
                      {inbound && first && <div className={s.sender}>{m.sender_name ?? 'メンバー'}</div>}
                      {renderContent(m, first && !plain)}
                    </div>
                    <div className={s.meta}>
                      {m.localStatus === 'sending' && <span>送信中…</span>}
                      {m.localStatus === 'failed' && (
                        <span className={s.failed} title={m.localError}>
                          送れませんでした
                          <button type="button" onClick={() => retry(m)}>
                            再送
                          </button>
                          <button type="button" onClick={() => discard(m)}>
                            削除
                          </button>
                        </span>
                      )}
                      {!m.localStatus && showTime && (
                        <>
                          {!inbound && m.sent_by && <span>{m.sent_by}</span>}
                          <span>{hhmm(m.sent_at)}</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {newBelow > 0 && (
              <button type="button" className={s.newPill} onClick={scrollToBottom}>
                <ChevronDown size={14} style={{ display: 'inline', verticalAlign: '-2px' }} /> 新しいメッセージ {newBelow}件
              </button>
            )}

            {pendingImage && (
              <div className={s.pending}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pendingImage.url} alt="" />
                <span style={{ flex: 1, minWidth: 0, fontSize: 12, color: '#5f6368', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {pendingImage.name}
                </span>
                <button
                  type="button"
                  className={s.iconBtn}
                  aria-label="画像を外す"
                  onClick={() => {
                    URL.revokeObjectURL(pendingImage.url);
                    setPendingImage(null);
                  }}
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {error && <div className={s.error}>{error}</div>}
            {messages.some((m) => m.localStatus === 'failed') && (
              <div className={s.error}>
                {messages.find((m) => m.localStatus === 'failed')?.localError}
              </div>
            )}
            <div className={s.foot}>
              <input
                ref={fileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={(e) => {
                  pickImage(e.target.files?.[0]);
                  e.target.value = '';
                }}
              />
              <button type="button" className={s.iconBtn} onClick={() => fileRef.current?.click()} disabled={!selected.active} aria-label="画像を選ぶ" title="画像を送る">
                <ImagePlus size={22} />
              </button>
              <textarea
                ref={inputRef}
                className={s.input}
                rows={1}
                value={draft}
                disabled={!selected.active}
                placeholder={selected.active ? 'メッセージを入力（Enterで送信・Shift+Enterで改行）' : '公式LINEはこのグループから退出しています'}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={onKeyDown}
                onPaste={(e) => {
                  const f = Array.from(e.clipboardData.files).find((x) => x.type.startsWith('image/'));
                  if (f) {
                    e.preventDefault();
                    pickImage(f);
                  }
                }}
              />
              <button type="button" className={s.send} onClick={send} disabled={!selected.active || (!draft.trim() && !pendingImage)} aria-label="送信">
                <SendHorizontal size={18} />
              </button>
            </div>
            <div className={s.footNote}>
              <span>
                送ると通数を使います（グループの人数分）{quotaText ? `・${quotaText}` : ''}
              </span>
              <label style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                送る人
                <select value={sender} onChange={(e) => setSender(e.target.value)}>
                  <option value="">（選ぶ）</option>
                  {staffNames.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </>
        )}
      </section>

      {lightbox && (
        <div className={s.lightbox} onClick={() => setLightbox(null)} role="dialog" aria-label="画像">
          <div className={s.lightboxBar} onClick={(e) => e.stopPropagation()}>
            <a href={lightbox} target="_blank" rel="noopener noreferrer">
              新しいタブで開く
            </a>
            <button type="button" onClick={() => setLightbox(null)}>
              閉じる
            </button>
          </div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={lightbox} alt="" />
        </div>
      )}
    </div>
  );
}
