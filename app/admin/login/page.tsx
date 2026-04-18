import { LoginForm } from './LoginForm';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

export default function LoginPage() {
  const allowedDomain = process.env.ADMIN_EMAIL_DOMAIN ?? '';
  return (
    <div className="min-h-screen bg-off-white flex items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>管理者ログイン</CardTitle>
          <CardDescription>
            {allowedDomain
              ? `${allowedDomain} の管理者メールアドレスでサインインしてください。`
              : '管理者メールアドレスでサインインしてください。'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <LoginForm allowedDomain={allowedDomain} />
        </CardContent>
      </Card>
    </div>
  );
}
