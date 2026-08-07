import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  weight: ['300', '400', '500', '600', '700'],
  variable: '--font-inter',
});

export const metadata: Metadata = {
  title: 'VBL Tournament Tracker',
  description: 'Tournament team rankings, points analysis, and qualifier bracket visualization',
};

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html lang="en" className={`dark ${inter.variable}`}>
      <body className="min-h-screen bg-[#0b1120] text-[#f8fafc] font-sans antialiased">
        {children}
      </body>
    </html>
  );
}
