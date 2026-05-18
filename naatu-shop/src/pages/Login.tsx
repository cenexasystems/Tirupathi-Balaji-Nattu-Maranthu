/**
 * Login — Sign in / Sign up
 * Two methods: Google OAuth  |  Email Magic Link
 * Phone OTP removed (not required).
 */
import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Leaf, Mail, ArrowLeft, CheckCircle } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { useAuthStore } from '../store/store'
import { BRAND_EN, BRAND_TA } from '../lib/brand'

const SITE_URL =
  (import.meta.env.VITE_SITE_URL as string | undefined)?.replace(/\/$/, '') ||
  window.location.origin

type Method = 'google' | 'email'
type EmailStep = 'input' | 'sent'

export default function Login() {
  const navigate   = useNavigate()
  const location   = useLocation()
  const initialize = useAuthStore((s) => s.initialize)
  const redirectPath = new URLSearchParams(location.search).get('redirect') || '/'

  const [method,    setMethod]    = useState<Method>('google')
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [email,     setEmail]     = useState('')
  const [name,      setName]      = useState('')
  const [emailStep, setEmailStep] = useState<EmailStep>('input')
  const [otp,       setOtp]       = useState('')

  const switchMethod = (m: Method) => {
    setMethod(m); setError(''); setLoading(false)
    setEmail(''); setName(''); setEmailStep('input'); setOtp('')
  }

  /* ── Google ──────────────────────────────────────────────────── */
  const handleGoogle = async () => {
    if (!isSupabaseConfigured) { setError('Auth not configured.'); return }
    setLoading(true); setError('')
    const { error: e } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: SITE_URL,
        queryParams: { prompt: 'select_account' },
      },
    })
    if (e) { setError(e.message); setLoading(false) }
    // On success the browser navigates away — no code after this.
  }

  /* ── Email magic link ─────────────────────────────────────────── */
  const handleSendLink = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!cleanEmail.includes('@')) { setError('Enter a valid email address.'); return }
    if (!isSupabaseConfigured) { setError('Auth not configured.'); return }
    setLoading(true); setError('')

    const { error: e2 } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: SITE_URL,
        data: name.trim() ? { name: name.trim(), full_name: name.trim() } : undefined,
      },
    })

    setLoading(false)
    if (e2) { setError(e2.message); return }
    setEmailStep('sent')
  }

  /* ── Email OTP code (only if Supabase template uses {{ .Token }}) */
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim().length < 6) { setError('Enter the 6-digit code.'); return }
    setLoading(true); setError('')

    const { error: e2 } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    })

    if (e2) { setLoading(false); setError(e2.message); return }
    await initialize()
    setLoading(false)
    navigate(redirectPath, { replace: true })
  }

  /* ── Render ───────────────────────────────────────────────────── */
  return (
    <div className="bg-gradient-to-br from-[#eaf2e5] to-[#f7f6f2] min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-sand/40 w-full max-w-md">

        {/* Brand */}
        <div className="flex flex-col items-center mb-6">
          <div className="w-12 h-12 bg-sage/30 rounded-2xl flex items-center justify-center mb-3">
            <Leaf size={24} className="text-sageDark" />
          </div>
          <h1 className="text-xl font-bold font-headline text-textMain text-center">{BRAND_EN}</h1>
          <p className="text-[12px] text-textMuted mt-0.5 text-center">{BRAND_TA}</p>
          {redirectPath !== '/' && (
            <p className="mt-2.5 text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
              Sign in to continue
            </p>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-1.5 bg-[#F7F6F2] rounded-xl p-1 mb-5">
          <TabBtn active={method === 'google'} onClick={() => switchMethod('google')}
            icon={<GoogleIcon />} label="Google" />
          <TabBtn active={method === 'email'} onClick={() => switchMethod('email')}
            icon={<Mail size={13} />} label="Email" />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-[12px] mb-4">
            {error}
          </div>
        )}

        {/* ═══ GOOGLE ════════════════════════════════════════════ */}
        {method === 'google' && (
          <div className="space-y-4">
            <button onClick={handleGoogle} disabled={loading}
              className="w-full flex items-center justify-center gap-3 bg-white border-2 border-[#EAD7B7] hover:border-sageDark text-textMain font-bold py-4 rounded-xl transition-all disabled:opacity-60 shadow-sm hover:shadow-md active:scale-[0.98]">
              {loading ? <Spinner /> : <GoogleIcon size={20} />}
              {loading ? 'Redirecting…' : 'Continue with Google'}
            </button>

            <div className="relative flex items-center gap-3 py-1">
              <div className="flex-1 h-px bg-sand/60" />
              <span className="text-[11px] text-textMuted font-medium shrink-0">What happens</span>
              <div className="flex-1 h-px bg-sand/60" />
            </div>

            <div className="space-y-2.5 text-[12px] text-textMuted">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7DAA8F]/15 text-sageDark flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">1</span>
                <p><strong className="text-textMain">New user?</strong> A free account is created automatically using your Google profile.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7DAA8F]/15 text-sageDark flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">2</span>
                <p><strong className="text-textMain">Returning user?</strong> You're signed straight in — no password needed.</p>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-[#7DAA8F]/15 text-sageDark flex items-center justify-center text-[10px] font-black shrink-0 mt-0.5">3</span>
                <p>Your orders, cart and favourites are linked to your account.</p>
              </div>
            </div>
          </div>
        )}

        {/* ═══ EMAIL ═════════════════════════════════════════════ */}
        {method === 'email' && emailStep === 'input' && (
          <form onSubmit={handleSendLink} className="space-y-4">
            <div>
              <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wide mb-1.5">
                Your Name <span className="font-normal normal-case">(for new accounts)</span>
              </label>
              <input type="text" placeholder="Full name"
                className="w-full px-4 py-3 rounded-xl border-2 border-sand focus:border-sageDark outline-none text-[13px]"
                value={name} onChange={e => setName(e.target.value)} />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-textMuted uppercase tracking-wide mb-1.5">
                Email Address *
              </label>
              <input type="email" required autoComplete="email" placeholder="you@example.com"
                className="w-full px-4 py-3 rounded-xl border-2 border-sand focus:border-sageDark outline-none text-[13px]"
                value={email} onChange={e => { setEmail(e.target.value); setError('') }} />
            </div>

            <button type="submit" disabled={loading}
              className="w-full bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2">
              {loading ? <><Spinner /> Sending…</> : <><Mail size={15} /> Send Magic Link</>}
            </button>

            <p className="text-center text-[11px] text-gray-400 leading-relaxed">
              We'll send a one-click sign-in link to your inbox.<br />
              No password required. Works for sign-up and sign-in.
            </p>
          </form>
        )}

        {method === 'email' && emailStep === 'sent' && (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 bg-green-50 rounded-full flex items-center justify-center mx-auto">
              <CheckCircle size={32} className="text-green-500" />
            </div>
            <div>
              <h3 className="font-bold text-textMain text-[15px] mb-1">Check your inbox!</h3>
              <p className="text-[13px] text-textMuted leading-relaxed">
                A magic sign-in link was sent to<br />
                <strong className="text-sageDark">{email}</strong>
              </p>
            </div>
            <p className="text-[11px] text-gray-400 leading-relaxed">
              Click the link to sign in instantly.<br />
              Valid for 60 minutes · Check spam if not received.
            </p>

            {/* OTP entry — shown only when Supabase template sends {{ .Token }} */}
            <details className="text-left border border-sand/60 rounded-xl p-4">
              <summary className="text-[11px] text-sageDark font-bold cursor-pointer select-none list-none flex items-center gap-1.5">
                <span className="text-sageDark">›</span> Received a 6-digit code instead?
              </summary>
              <form onSubmit={handleVerifyOtp} className="mt-3 space-y-3">
                <input type="text" inputMode="numeric" maxLength={6} placeholder="000000"
                  className="w-full text-center text-2xl font-bold tracking-[0.4em] py-3 bg-gray-50 border-2 border-sand focus:border-sageDark rounded-xl outline-none"
                  value={otp} onChange={e => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }} />
                <button type="submit" disabled={loading || otp.length < 6}
                  className="w-full bg-sageDark text-white font-bold py-3 rounded-xl disabled:opacity-60 flex items-center justify-center gap-2">
                  {loading ? <><Spinner /> Verifying…</> : 'Verify & Sign In'}
                </button>
              </form>
            </details>

            <button type="button" onClick={() => { setEmailStep('input'); setError(''); setOtp('') }}
              className="flex items-center justify-center gap-1.5 text-[12px] text-textMuted hover:text-textMain mx-auto">
              <ArrowLeft size={13} /> Use a different email
            </button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-6 pt-5 border-t border-sand/50 text-center">
          <p className="text-[11px] text-gray-400">
            New users get a free account on first sign-in. No credit card needed.
          </p>
        </div>
      </div>
    </div>
  )
}

/* ── Module-level helpers (not inside component) ──────────────────── */

function Spinner() {
  return <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin inline-block" />
}

function TabBtn({ active, onClick, icon, label }: {
  active: boolean; onClick: () => void; icon: React.ReactNode; label: string
}) {
  return (
    <button type="button" onClick={onClick}
      className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[12px] font-bold rounded-xl transition-all ${
        active ? 'bg-[#2C392A] text-white shadow-sm' : 'text-[#5F6D59] hover:bg-[#F7F6F2]'
      }`}>
      {icon}{label}
    </button>
  )
}

function GoogleIcon({ size = 18 }: { size?: number }) {
  return (
    <svg viewBox="0 0 24 24" style={{ width: size, height: size }} className="shrink-0" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
    </svg>
  )
}
