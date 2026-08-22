"use client";

import { SignInButton, UserButton, useAuth, useUser } from "@clerk/nextjs";
import { User } from 'lucide-react';
import { useEffect } from 'react';

export default function ClerkAuthButtons() {
  const { isLoaded, isSignedIn } = useAuth();
  const { user: clerkUser } = useUser();

  useEffect(() => {
    if (isSignedIn && clerkUser) {
      const email = clerkUser.primaryEmailAddress?.emailAddress;
      if (email) {
        const host = window.location.hostname;
        const subdomain = host.split('.')[0] || 'store';
        // Sync clerk user to backend (using 127.0.0.1 instead of localhost for Windows fetch issues)
        fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/customers/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, provider: 'clerk' })
        })
        .then(async res => {
          if (!res.ok) {
            const errText = await res.text();
            console.warn("Sync returned non-200:", res.status, errText);
          }
        })
        .catch(err => console.error("Failed to sync Clerk customer (Network Error):", err));
      }
    }
  }, [isSignedIn, clerkUser]);

  if (!isLoaded) return null;

  return (
    <div className="flex items-center">
      {!isSignedIn ? (
        <SignInButton mode="modal">
          <button className="p-2 text-zinc-600 hover:bg-zinc-100 rounded-full transition-colors relative group" title="Login with Clerk">
            <User className="w-5 h-5" />
            <div className="absolute top-10 right-0 w-max bg-zinc-900 text-white text-xs px-2 py-1 rounded opacity-0 group-hover:opacity-100 transition-opacity">
              Login via Clerk
            </div>
          </button>
        </SignInButton>
      ) : (
        <div className="ml-2">
          <UserButton />
        </div>
      )}
    </div>
  );
}
