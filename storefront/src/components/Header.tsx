'use client';

import { useState } from 'react';
import { Search, User, Menu, X, Package } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import ClerkAuthButtons from './ClerkAuthButtons';
import CartButton from './CartButton';
import CurrencySelector from './CurrencySelector';

interface HeaderProps {
  authSettings: { provider: string; public_key: string; domain?: string };
  subdomain: string;
}

export default function Header({ authSettings, subdomain }: HeaderProps) {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  // Determine Login Link based on Provider
  let loginLink = '/login';
  if (authSettings.provider === 'clerk') {
    loginLink = '#'; // Handled by Clerk SignInButton
  } else if (authSettings.provider === 'auth0') {
    // We use the actual window location in a client component, but since this is SSR, we can pass the subdomain
    loginLink = `https://${authSettings.domain}/authorize?response_type=code&client_id=${authSettings.public_key}&redirect_uri=http://${subdomain}.localhost:5174/api/auth/callback`;
  }

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && searchQuery.trim() !== '') {
      router.push(`/search?q=${encodeURIComponent(searchQuery)}`);
      setIsMobileMenuOpen(false);
    }
  };

  const navLinks = [
    { name: 'New Arrivals', href: '#' },
    { name: 'Collections', href: '#' },
    { name: 'About', href: '#' },
    { name: 'Orders', href: '/orders' },
  ];

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          
          {/* Mobile Menu Toggle & Logo */}
          <div className="flex items-center gap-4">
            <button 
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="p-2 lg:hidden text-zinc-600 hover:bg-zinc-100 rounded-lg transition-colors"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2" onClick={() => setIsMobileMenuOpen(false)}>
              <div className="w-8 h-8 bg-zinc-900 rounded-lg flex items-center justify-center text-white font-bold text-lg">
                {subdomain.charAt(0).toUpperCase()}
              </div>
              <span className="font-bold text-lg text-zinc-900 hidden sm:block capitalize">
                {subdomain}
              </span>
            </Link>
          </div>

          {/* Desktop Nav */}
          <nav className="hidden lg:flex items-center gap-8 text-sm font-medium text-zinc-600">
            {navLinks.map((link) => (
              <Link key={link.name} href={link.href} className="hover:text-zinc-900 transition-colors">
                {link.name}
              </Link>
            ))}
          </nav>

          {/* Actions */}
          <div className="flex items-center gap-2 sm:gap-4">
            
            {/* Currency Selector */}
            <div className="hidden sm:block">
              <CurrencySelector />
            </div>

            {/* Desktop Search */}
            <div className="hidden md:flex items-center relative">
              <Search className="w-4 h-4 text-zinc-400 absolute left-3" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search products..." 
                className="pl-9 pr-4 py-1.5 bg-zinc-100 border-transparent rounded-full text-sm focus:bg-white focus:border-zinc-300 focus:ring-0 w-48 transition-all"
              />
            </div>
            
            {/* Mobile Search Button (handled in mobile menu) */}
            <button 
              className="p-2 md:hidden text-zinc-600 hover:bg-zinc-100 rounded-full"
              onClick={() => setIsMobileMenuOpen(true)}
            >
              <Search className="w-5 h-5" />
            </button>

            {/* Dynamic Auth Implementation */}
            {authSettings.provider === 'clerk' ? (
              <ClerkAuthButtons />
            ) : (
              <Link href={loginLink} className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors relative group" title={`Login via ${authSettings.provider}`}>
                <User className="w-5 h-5" />
                <div className="absolute top-10 right-0 w-max bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
                  Login via {authSettings.provider}
                </div>
              </Link>
            )}

            <CartButton />
          </div>
        </div>
      </div>

      {/* Mobile Offcanvas Menu */}
      {isMobileMenuOpen && (
        <div className="lg:hidden absolute top-16 left-0 right-0 bg-white border-b border-zinc-200 shadow-xl overflow-hidden animate-in slide-in-from-top-2 duration-200">
          <div className="px-4 pt-4 pb-6 space-y-6">
            
            {/* Mobile Search */}
            <div className="relative">
              <Search className="w-5 h-5 text-zinc-400 absolute left-3 top-2.5" />
              <input 
                type="text" 
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={handleSearch}
                placeholder="Search products..." 
                className="w-full pl-10 pr-4 py-2.5 bg-zinc-50 border border-zinc-200 rounded-xl text-base focus:bg-white focus:border-zinc-900 focus:ring-0 transition-all"
              />
            </div>

            {/* Mobile Navigation Links */}
            <nav className="flex flex-col space-y-4">
              {navLinks.map((link) => (
                <Link 
                  key={link.name} 
                  href={link.href} 
                  onClick={() => setIsMobileMenuOpen(false)}
                  className="flex items-center text-base font-medium text-zinc-600 hover:text-zinc-900"
                >
                  {link.name === 'Orders' && <Package className="w-5 h-5 mr-3 text-zinc-400" />}
                  {link.name}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      )}
    </header>
  );
}
