import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CA Analytics — Nifty 50 Corporate Actions Consistency Monitor',
  description:
    'Detects and quantifies corporate-action adjustment inconsistencies across independent data sources for Nifty 50 stocks. Shows which stocks are affected, by how much, and the resulting distortion in return calculations.',
  keywords: [
    'corporate actions', 'Nifty 50', 'data quality', 'adjusted prices',
    'dividends', 'stock splits', 'return calculation', 'financial data pipeline',
    'NSE India', 'yfinance', 'Stooq',
  ],
  authors: [{ name: 'CA Analytics' }],
  openGraph: {
    title: 'CA Analytics — Corporate Actions Data Consistency',
    description: 'Cross-source consistency checking for Nifty 50 adjusted price series',
    type: 'website',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>
      <body className="antialiased grid-bg">{children}</body>
    </html>
  );
}
