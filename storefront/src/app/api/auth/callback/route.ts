import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return NextResponse.redirect(new URL(`/login?error=${error}`, request.url));
  }

  if (!code) {
    return NextResponse.redirect(new URL('/login?error=missing_code', request.url));
  }

  // Get subdomain from Host header
  const host = request.headers.get('host') || '';
  const subdomain = host.split('.')[0];
  
  if (!subdomain || subdomain === 'localhost' || subdomain === 'www') {
    return NextResponse.redirect(new URL('/login?error=invalid_store', request.url));
  }

  try {
    // Forward the code to our secure Go backend for token exchange
    // This protects the Merchant's Auth0 Secret Key!
    const backendRes = await fetch(`http://127.0.0.1:8080/api/storefront/${subdomain}/auth/callback?code=${code}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    });

    const data = await backendRes.json();

    if (backendRes.ok && data.token) {
      // Create response and set JWT cookie
      const response = NextResponse.redirect(new URL('/', request.url));
      response.cookies.set('jwt', data.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        path: '/'
      });
      return response;
    } else {
      return NextResponse.redirect(new URL(`/login?error=${data.error || 'exchange_failed'}`, request.url));
    }
  } catch (err) {
    console.error('Auth0 callback exchange failed', err);
    return NextResponse.redirect(new URL('/login?error=server_error', request.url));
  }
}
