import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import Cart from '@/components/cart/Cart';
import QuoteList from '@/components/QuoteListSimplified';
import { CookieConsentProvider } from '@/contexts/CookieConsentContext';
import { LocaleProvider } from '@/contexts/LocaleContext';
import { QuoteProvider } from '@/contexts/QuoteContext';
import CookieConsentWrapper from '@/components/layout/CookieConsentWrapper';
import { cookies } from 'next/headers';
import { Providers } from './providers';

export async function generateMetadata(): Promise<Metadata> {
  const cookieStore = await cookies();
  const initialLocale = (cookieStore.get('locale')?.value as 'en'|'nl'|'fr') ?? 'en';
  // Import locale files on server to avoid using client provider
  const locales = {
    en: await import('@/locales/en.json').then(m => m.default),
    nl: await import('@/locales/nl.json').then(m => m.default),
    fr: await import('@/locales/fr.json').then(m => m.default),
  } as const;
  const dict = (locales as any)[initialLocale] || locales.en;
  return {
    title: dict['metadata.title'] || 'DemaShop',
    description: dict['metadata.description'] || '',
    metadataBase: new URL('https://www.demashop.be'),
    alternates: { canonical: '/' },
    icons: { icon: [{ url: '/assets/front/favicon/dema/favicon.webp' }] },
    other: { 'theme-color': '#00adef' },
  };
}

const inter = Inter({ 
  subsets: ['latin'],
  variable: '--font-inter',
});

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialLocale = (cookieStore.get('locale')?.value as 'en'|'nl'|'fr') ?? 'en';
  return (
    <html lang={initialLocale} className="h-full light" suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        {/* Additional meta tags */}
        <meta name="google-site-verification" content="" />
        <meta name="google-site-verification" content="" />
      </head>
      <body className={`${inter.variable} font-sans bg-white text-gray-900 flex flex-col min-h-screen`}>
        <Providers>
          <CookieConsentProvider>
            <LocaleProvider>
              <QuoteProvider>
                <Header />
                <main className="flex-grow">
                  {children}
                </main>
                <Footer />
                <CookieConsentWrapper />
                <Cart />
                <QuoteList />
              </QuoteProvider>
            </LocaleProvider>
          </CookieConsentProvider>
        </Providers>
      </body>
    </html>
  );
}
