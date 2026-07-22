import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CA Analytics — Corporate Actions Consistency Monitor',
  description:
    'Checks whether Yahoo Finance correctly adjusts stock prices after dividends and splits across 80 tracked stocks.',
  keywords: ['corporate actions', 'Nifty 50', 'S&P 500', 'adjusted prices', 'data quality'],
  authors: [{ name: 'Rishi' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Apply saved theme before paint to avoid flash */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){var t=localStorage.getItem('theme')||'light';document.documentElement.setAttribute('data-theme',t);})();`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
