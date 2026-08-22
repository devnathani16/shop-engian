'use client';
import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [subdomain, setSubdomain] = useState('');

  useEffect(() => {
    const host = window.location.hostname;
    setSubdomain(host.split('.')[0] || 'store');
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate sync customer in the background
    try {
      await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/customers/sync`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, provider: 'default' })
      });
      // In a real app we'd redirect to home or dashboard after successful JWT fetch
      window.location.href = '/';
    } catch (e) {
      console.error(e);
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-[80vh] flex flex-col items-center justify-center p-4 bg-zinc-50">
      <div className="bg-white p-8 md:p-10 rounded-2xl shadow-sm border border-zinc-200 w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-zinc-900 mb-2">Welcome Back</h1>
          <p className="text-zinc-500 text-sm">Please enter your details to sign in.</p>
        </div>

        <form className="space-y-5" onSubmit={handleLogin}>
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1" htmlFor="email">
              Email Address
            </label>
            <input 
              id="email"
              type="email" 
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="you@example.com"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-zinc-700 mb-1 flex justify-between" htmlFor="password">
              <span>Password</span>
              <Link href="#" className="text-zinc-500 hover:text-zinc-900 text-xs">Forgot password?</Link>
            </label>
            <input 
              id="password"
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2 border border-zinc-300 rounded-lg focus:ring-2 focus:ring-zinc-900 focus:border-zinc-900 transition-colors"
              placeholder="••••••••"
            />
          </div>

          <button 
            type="submit" 
            disabled={isSubmitting}
            className="w-full bg-zinc-900 text-white font-medium py-2.5 rounded-lg hover:bg-zinc-800 transition-colors disabled:opacity-50"
          >
            {isSubmitting ? 'Signing In...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 text-center text-sm text-zinc-500">
          Don't have an account? <Link href="#" className="text-zinc-900 font-medium hover:underline">Sign up</Link>
        </div>
      </div>
    </div>
  );
}
