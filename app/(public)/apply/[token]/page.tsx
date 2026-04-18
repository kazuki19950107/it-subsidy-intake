import Link from 'next/link';
import { ArrowRight, FileCheck, Shield, Timer } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default async function LandingPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-ink mb-2">
          IT補助金申請のお手続きへようこそ
        </h1>
        <p className="text-sm md:text-base text-mute leading-relaxed">
          LINE サポート開始前に、必要な書類と基本情報をここでご提出いただきます。
          所要時間は <strong className="text-charcoal">約10〜15分</strong> です。
        </p>
      </div>

      <Card>
        <CardContent className="pt-6 space-y-4">
          <div className="flex gap-3">
            <FileCheck className="w-5 h-5 text-teal shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-charcoal">書類をアップロードするだけ</h3>
              <p className="text-sm text-mute mt-1">
                スマホのカメラで撮影した画像や、PCに保存されている PDF・画像をそのままご提出いただけます。AIが自動で書類内容を読み取ります。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Shield className="w-5 h-5 text-teal shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-charcoal">GビズIDのパスワードは聞きません</h3>
              <p className="text-sm text-mute mt-1">
                本フォームでは絶対にパスワードを入力させることはありません。取得状況のみお伺いします。
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <Timer className="w-5 h-5 text-teal shrink-0 mt-0.5" />
            <div>
              <h3 className="font-semibold text-charcoal">途中保存 OK</h3>
              <p className="text-sm text-mute mt-1">
                入力内容は自動保存されます。同じURLから再度アクセスすれば続きから進められます。
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-lg font-semibold text-ink mb-3">ご提出いただく書類</h2>
        <div className="grid gap-3 md:grid-cols-2">
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs font-semibold text-teal mb-1">法人の方</div>
              <ul className="text-sm space-y-1 list-disc list-inside text-charcoal">
                <li>履歴事項全部証明書（3ヶ月以内）</li>
                <li>納税証明書その1（法人税）</li>
                <li>決算書（P/L、販管費、B/S）</li>
              </ul>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-4">
              <div className="text-xs font-semibold text-teal mb-1">個人事業主の方</div>
              <ul className="text-sm space-y-1 list-disc list-inside text-charcoal">
                <li>本人確認書類（運転免許証など）</li>
                <li>確定申告書 第一表</li>
                <li>青色申告決算書</li>
                <li>納税証明書その2（所得税）</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="flex justify-end pt-4">
        <Button asChild size="lg">
          <Link href={`/apply/${token}/type`}>
            申請を開始する
            <ArrowRight className="w-4 h-4" />
          </Link>
        </Button>
      </div>
    </div>
  );
}
