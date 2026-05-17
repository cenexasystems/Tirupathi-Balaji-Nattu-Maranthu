import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Leaf } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { BRAND_EN, BRAND_TA } from '../lib/brand'

export default function Login() {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const location = useLocation()

  const redirectPath = new URLSearchParams(location.search).get('redirect') || '/'

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured) {
      setError('Authentication is not configured. Contact support.')
      return
    }
    setLoading(true)
    setError('')

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        // After Supabase processes the Google callback, redirect to app root.
        // Cart is persisted in localStorage, so in-progress checkout is preserved.
        redirectTo: window.location.origin,
      },
    })

    if (authError) {
      setError(authError.message)
      setLoading(false)
    }
    // On success the browser navigates to Google — no further code runs here.
  }

  return (
    <div className="bg-gradient-to-br from-[#eaf2e5] to-[#f7f6f2] min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-8 rounded-3xl shadow-xl border border-sand/40 w-full max-w-md">

        {/* Brand */}
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-sage/30 rounded-2xl flex items-center justify-center mb-3">
            <Leaf size={28} className="text-sageDark" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-headline text-textMain text-center">{BRAND_EN}</h1>
          <p className="text-sm text-textMuted mt-1 text-center">{BRAND_TA}</p>
          {redirectPath !== '/' && (
            <p className="mt-3 text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-full text-center">
              Sign in to continue
            </p>
          )}
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-5">
            {error}
          </div>
        )}

        <button
          onClick={handleGoogleSignIn}
          disabled={loading}
          className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#EAD7B7] hover:border-sageDark text-textMain font-bold py-4 rounded-xl transition-all disabled:opacity-60 shadow-sm hover:shadow-md active:scale-[0.98]"
        >
          {loading ? (
            <>
              <span className="w-5 h-5 border-2 border-textMuted/30 border-t-textMuted rounded-full animate-spin" />
              Redirecting to Google…
            </>
          ) : (
            <>
              <GoogleIcon />
              Continue with Google
            </>
          )}
        </button>

        <div className="mt-6 pt-5 border-t border-sand/50 text-center space-y-1.5">
          <p className="text-xs text-gray-400">New users get an account automatically.</p>
          <p className="text-xs text-gray-400">Admin access is granted to authorised emails.</p>
        </div>
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
