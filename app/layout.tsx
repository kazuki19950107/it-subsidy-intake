import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'IT補助金申請 受付 | AzCreate',
  description: 'IT補助金申請の書類提出・基本情報入力フォーム',
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body className="font-sans antialiased text-charcoal bg-off-white">
        {children}
      </body>
    </html>
  );
}
