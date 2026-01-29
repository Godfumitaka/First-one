import './globals.css';
import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Idea Graph Notebook',
  description: 'Japanese-first idea graph notebook MVP'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <header>
          <strong>Idea Graph Notebook</strong>
          <nav>
            <Link href="/">ノート</Link>
            <Link href="/graph">グラフ</Link>
            <Link href="/concepts">概念管理</Link>
          </nav>
        </header>
        <main>{children}</main>
      </body>
    </html>
  );
}
