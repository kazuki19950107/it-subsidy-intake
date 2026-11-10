import type { Metadata } from 'next';
import './globals.css';
import { Inter, Noto_Sans_JP } from 'next/font/google';
import { ToastProvider } from '@/components/ui/toast';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' });
const notoJp = Noto_Sans_JP({ subsets: ['latin'], weight: ['400', '500', '700'], variable: '--font-noto-jp', display: 'swap' });

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
    <html lang="ja" className={`${inter.variable} ${notoJp.variable}`}>
      <body className="font-sans antialiased text-charcoal bg-off-white">
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
