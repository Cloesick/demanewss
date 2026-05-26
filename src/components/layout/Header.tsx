'use client';

import Link from 'next/link';
import { FiSearch, FiShoppingCart, FiUser, FiMapPin, FiMenu, FiFileText } from 'react-icons/fi';
import { useLocale } from '@/contexts/LocaleContext';
import { CONTACT } from '@/config/contact';
import { useCartStore } from '@/store/cartStore';
import { useCookieConsent } from '@/contexts/CookieConsentContext';
import { useQuote } from '@/contexts/QuoteContext';

export default function Header() {
  const { t, locale, setLocale } = useLocale();
  const contact = CONTACT[locale];
  const toggleCart = useCartStore(s => s.toggleCart);
  const count = useCartStore(s => s.items.reduce((t, i) => t + i.quantity, 0));
  const { openConsent } = useCookieConsent();
  const { quoteItems, toggleQuote } = useQuote();
  const quoteCount = quoteItems.reduce((total, item) => total + item.quantity, 0);
  return (
    <header className="bg-white shadow-sm sticky top-0 z-50">
      {/* Top Bar */}
      <div className="bg-gray-900 text-white text-sm py-1">
        <div className="container mx-auto px-4 flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <a href={`tel:${contact.phone.replace(/\s+/g,'')}`} className="hover:text-yellow-400 transition-colors">
              {t('topbar.customer_service')}: {contact.phone}
            </a>
            <span>|</span>
            <a href={`mailto:${contact.email}`} className="hover:text-yellow-400 transition-colors">
              {contact.email}
            </a>
          </div>
          <div className="flex items-center space-x-4">
            <Link href="/account" className="hover:text-yellow-400 flex items-center">
              <FiUser className="mr-1" /> {t('account')}
            </Link>
            <Link href="/contact" className="hover:text-yellow-400">{t('contact')}</Link>
            <button
              onClick={openConsent}
              className="hover:text-yellow-400 underline decoration-dotted"
              aria-label="Manage Cookies"
            >
              Manage Cookies
            </button>
            <div className="hidden sm:flex items-center space-x-1">
              {(['en','nl','fr'] as const).map(l => (
                <button
                  key={l}
                  onClick={() => setLocale(l)}
                  className={`px-2 py-0.5 text-xs rounded border ${locale===l ? 'bg-yellow-500 text-white border-yellow-500' : 'bg-transparent text-white border-white/30 hover:bg-white/10'}`}
                >{l.toUpperCase()}</button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Main Header */}
      <div className="container mx-auto px-4 py-4">
        <div className="flex flex-col md:flex-row items-center justify-between">
          {/* Logo */}
          <div className="mb-4 md:mb-0">
            <Link href="/" className="flex items-center">
              <img 
                src="/assets/front/favicon/dema/logo.webp" 
                alt="DEMA Shop Logo" 
                className="h-12 w-auto" 
                width={160}
                height={48}
                onError={(e) => {
                  // Fallback to text if image fails to load
                  const container = (e.target as HTMLElement).parentElement;
                  if (container) {
                    container.innerHTML = `
                      <span className="text-2xl font-bold text-gray-900">
                        DEMA<span class="text-primary">SHOP</span>
                      </span>
                    `;
                  }
                }}
              />
            </Link>
          </div>

          {/* Search Bar removed as requested */}

          {/* Request Quote & Cart & Contact */}
          <div className="flex items-center space-x-4">
            {/* Request Quote Button */}
            <Link
              href="/quote-request"
              className="flex items-center text-gray-700 hover:text-orange-600 relative transition-colors"
              title="Request Quote"
            >
              <FiFileText className="h-6 w-6" />
              {quoteCount > 0 && (
                <span className="absolute -top-2 -right-2 bg-orange-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center font-semibold">
                  {quoteCount}
                </span>
              )}
              <span className="ml-1 hidden md:inline">Quote</span>
            </Link>
            
            {/* Cart Button */}
            <button onClick={toggleCart} className="flex items-center text-gray-700 hover:text-blue-600 relative">
              <FiShoppingCart className="h-6 w-6" />
              {count > 0 && (
                <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                  {count}
                </span>
              )}
              <span className="ml-1 hidden md:inline">{t('cart')}</span>
            </button>
            <button className="md:hidden text-gray-700">
              <FiMenu className="h-6 w-6" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="hidden md:flex justify-center mt-4">
          <ul className="flex space-x-8">
            <li><Link href="/" className="text-gray-700 hover:text-blue-600 font-medium">{t('nav.home')}</Link></li>
            <li><Link href="/products" className="text-gray-700 hover:text-blue-600 font-medium">{t('nav.products')}</Link></li>
            <li><Link href="/categories" className="text-gray-700 hover:text-blue-600 font-medium">{t('nav.categories')}</Link></li>
            <li><Link href="/about" className="text-gray-700 hover:text-blue-600 font-medium">{t('nav.about')}</Link></li>
            <li><Link href="/contact" className="text-gray-700 hover:text-blue-600 font-medium">{t('contact')}</Link></li>
          </ul>
        </nav>
      </div>
    </header>
  );
}
