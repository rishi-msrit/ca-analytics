import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'CA Analytics — Corporate Actions Consistency Monitor',
  description:
    'Checks whether adjusted stock prices match independent calculations after dividends and splits.',
  keywords: ['corporate actions', 'Nifty 50', 'S&P 500', 'adjusted prices', 'data quality'],
  authors: [{ name: 'Rishi' }],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('theme');if(t)document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700;1,9..40,400&display=swap"
          rel="stylesheet"
        />
      </head>
      <body suppressHydrationWarning>{children}</body>
    </html>
  );
}
