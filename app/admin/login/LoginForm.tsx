'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';

export function LoginForm({ allowedDomain = '' }: { allowedDomain?: string }) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    setError(null);

    if (allowedDomain && !email.endsWith(`@${allowedDomain}`)) {
      setError(`${allowedDomain} のメールアドレスでログインしてください`);
      setLoading(false);
      return;
    }

    const supabase = createClient();
    const { error: err } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (err) {
      setError(err.message);
    } else {
      setMessage(
        '確認メールを送信しました。メール内のリンクをクリックしてログインしてください。',
      );
    }
    setLoading(false);
  };

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {message && (
        <Alert variant="default">
          <AlertDescription>{message}</AlertDescription>
        </Alert>
      )}
      <div className="space-y-2">
        <Label htmlFor="email" required>
          メールアドレス
        </Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={allowedDomain ? `example@${allowedDomain}` : 'example@example.com'}
          required
        />
      </div>
      <Button type="submit" className="w-full" disabled={loading}>
        {loading ? '送信中...' : 'マジックリンクを送信'}
      </Button>
    </form>
  );
}
