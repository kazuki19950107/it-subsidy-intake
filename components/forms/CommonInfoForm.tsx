'use client';

import { useForm, type Path } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { commonInfoSchema, type CommonInfoInput } from '@/lib/validation/schemas';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { AlertCircle, Info } from 'lucide-react';
import { useAutoSave } from '@/lib/hooks/useAutoSave';

type Props = {
  token: string;
  applicationId: string;
  applicantType: 'corporation' | 'sole_proprietor';
  defaultValues?: Partial<CommonInfoInput>;
};

export function CommonInfoForm({ token, applicationId, applicantType, defaultValues }: Props) {
  const router = useRouter();
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    getValues,
    formState: { errors },
  } = useForm<CommonInfoInput>({
    resolver: zodResolver(commonInfoSchema),
    defaultValues: {
      applicant_type: applicantType,
      gbiz_id_status: 'none',
      ...defaultValues,
    },
  });

  const gbizStatus = watch('gbiz_id_status');

  const { save: autoSave } = useAutoSave<Partial<CommonInfoInput>>({
    onSave: async (partial) => {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(partial),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
    },
  });

  const registerWithAutoSave = (name: Path<CommonInfoInput>, options?: Parameters<typeof register>[1]) => {
    const r = register(name, options);
    return {
      ...r,
      onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        r.onBlur(e);
        const value = getValues(name);
        autoSave({ [name]: value } as Partial<CommonInfoInput>);
      },
    };
  };

  const onSubmit = async (data: CommonInfoInput) => {
    setSubmitting(true);
    setServerError(null);
    try {
      const res = await fetch(`/api/applications/${applicationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, applicant_type: applicantType }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? '保存に失敗しました');
      }
      router.push(`/apply/${token}/documents`);
    } catch (e) {
      setServerError((e as Error).message);
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>保存に失敗しました</AlertTitle>
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {applicantType === 'corporation' && (
        <div className="space-y-2">
          <Label htmlFor="company_name" required>
            会社名（商号）
          </Label>
          <Input id="company_name" {...registerWithAutoSave('company_name')} placeholder="株式会社○○" />
          {errors.company_name && (
            <p className="text-sm text-accent">{errors.company_name.message}</p>
          )}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="applicant_name" required>
            代表者氏名
          </Label>
          <Input id="applicant_name" {...registerWithAutoSave('applicant_name')} placeholder="山田 太郎" />
          {errors.applicant_name && (
            <p className="text-sm text-accent">{errors.applicant_name.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="applicant_kana" required>
            フリガナ
          </Label>
          <Input id="applicant_kana" {...registerWithAutoSave('applicant_kana')} placeholder="ヤマダ タロウ" />
          {errors.applicant_kana && (
            <p className="text-sm text-accent">{errors.applicant_kana.message}</p>
          )}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="phone" required>
            電話番号（日中連絡可）
          </Label>
          <Input
            id="phone"
            type="tel"
            {...registerWithAutoSave('phone')}
            placeholder="090-1234-5678"
            inputMode="tel"
          />
          {errors.phone && <p className="text-sm text-accent">{errors.phone.message}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="email" required>
            メールアドレス
          </Label>
          <Input
            id="email"
            type="email"
            {...registerWithAutoSave('email')}
            placeholder="example@example.com"
            inputMode="email"
          />
          {errors.email && <p className="text-sm text-accent">{errors.email.message}</p>}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="line_display_name" required>
          LINE 表示名
        </Label>
        <Input
          id="line_display_name"
          {...registerWithAutoSave('line_display_name')}
          placeholder="LINEに登録されているお名前"
        />
        <p className="text-xs text-mute">
          サポート開始後に照合するため、現在のLINE表示名をご記入ください。
        </p>
        {errors.line_display_name && (
          <p className="text-sm text-accent">{errors.line_display_name.message}</p>
        )}
      </div>

      <div className="space-y-3 p-4 rounded-md bg-off-white border border-rule">
        <Label required>GビズID プライムの取得状況</Label>
        <RadioGroup
          defaultValue={defaultValues?.gbiz_id_status ?? 'none'}
          onValueChange={(v) => {
            const input = document.getElementById('gbiz_hidden') as HTMLInputElement;
            if (input) input.value = v;
            autoSave({ gbiz_id_status: v as CommonInfoInput['gbiz_id_status'] });
          }}
        >
          <div className="flex items-start gap-2">
            <RadioGroupItem value="acquired" id="gbiz-acquired" {...register('gbiz_id_status')} />
            <Label htmlFor="gbiz-acquired" className="font-normal cursor-pointer">
              取得済み
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="applying" id="gbiz-applying" {...register('gbiz_id_status')} />
            <Label htmlFor="gbiz-applying" className="font-normal cursor-pointer">
              申請中
            </Label>
          </div>
          <div className="flex items-start gap-2">
            <RadioGroupItem value="none" id="gbiz-none" {...register('gbiz_id_status')} />
            <Label htmlFor="gbiz-none" className="font-normal cursor-pointer">
              未取得
            </Label>
          </div>
        </RadioGroup>

        <Alert variant="info" className="mt-3">
          <Info className="h-4 w-4" />
          <AlertDescription className="text-xs">
            セキュリティのため、当フォームでは GビズID のパスワードは絶対にお聞きしません。
            取得状況のみご選択ください。
          </AlertDescription>
        </Alert>

        {gbizStatus === 'acquired' && (
          <div className="grid gap-3 md:grid-cols-2 mt-3">
            <div className="space-y-2">
              <Label htmlFor="gbiz_id_date">取得日</Label>
              <Input id="gbiz_id_date" type="date" {...registerWithAutoSave('gbiz_id_date')} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="gbiz_id_email">登録メールアドレス</Label>
              <Input
                id="gbiz_id_email"
                type="email"
                {...registerWithAutoSave('gbiz_id_email')}
                placeholder="gbiz登録メール"
              />
              {errors.gbiz_id_email && (
                <p className="text-sm text-accent">{errors.gbiz_id_email.message}</p>
              )}
            </div>
          </div>
        )}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="requested_amount">申請予定額（円）</Label>
          <Input
            id="requested_amount"
            type="number"
            inputMode="numeric"
            {...registerWithAutoSave('requested_amount', {
              setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
            })}
            placeholder="例: 500000"
          />
          {errors.requested_amount && (
            <p className="text-sm text-accent">{errors.requested_amount.message}</p>
          )}
        </div>
        <div className="space-y-2">
          <Label htmlFor="annual_revenue">直近年商（円）</Label>
          <Input
            id="annual_revenue"
            type="number"
            inputMode="numeric"
            {...registerWithAutoSave('annual_revenue', {
              setValueAs: (v) => (v === '' || v == null ? null : Number(v)),
            })}
            placeholder="例: 30000000"
          />
          {errors.annual_revenue && (
            <p className="text-sm text-accent">{errors.annual_revenue.message}</p>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">ご相談内容・備考（任意）</Label>
        <Textarea id="notes" {...registerWithAutoSave('notes')} rows={4} placeholder="ご質問や特記事項があればご記入ください。" />
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-rule">
        <Button type="submit" size="lg" disabled={submitting}>
          {submitting ? '保存中...' : '次へ（書類アップロードへ）'}
        </Button>
      </div>
    </form>
  );
}
