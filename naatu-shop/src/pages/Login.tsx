import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { Leaf, Mail, Shield, ArrowLeft } from 'lucide-react'
import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { authService } from '../services/authService'
import { useAuthStore } from '../store/store'
import { BRAND_EN, BRAND_TA } from '../lib/brand'

const ADMIN_EMAILS = ['admin@srisiddha.com', 'eshwarbalaji07@gmail.com']
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function Login() {
  const [step, setStep] = useState<'email' | 'otp'>('email')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [otp, setOtp] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const navigate = useNavigate()
  const location = useLocation()
  const redirectPath = new URLSearchParams(location.search).get('redirect') || '/'
  const setAuth = useAuthStore((s) => s.setAuth)

  // ── Step 1: Send OTP ──────────────────────────────────────────
  const handleSendOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    const cleanEmail = email.trim().toLowerCase()
    if (!EMAIL_RE.test(cleanEmail)) {
      setError('Please enter a valid email address')
      return
    }
    setLoading(true)
    setError('')

    if (!isSupabaseConfigured) {
      // Dev fallback — skip OTP
      const { user } = await authService.signIn(cleanEmail, 'devpass')
      if (user) {
        setAuth({ id: user.id, name: user.name, email: user.email, mobile: user.mobile, role: user.role })
        navigate(redirectPath)
      } else {
        setError('Unable to sign in in dev mode')
      }
      setLoading(false)
      return
    }

    const { error: otpError } = await supabase.auth.signInWithOtp({
      email: cleanEmail,
      options: {
        shouldCreateUser: true,
        data: name.trim() ? { name: name.trim() } : undefined,
      },
    })

    setLoading(false)

    if (otpError) {
      setError(otpError.message)
      return
    }

    setStep('otp')
  }

  // ── Step 2: Verify OTP ────────────────────────────────────────
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault()
    if (otp.trim().length < 6) {
      setError('Enter the 6-digit code from your email')
      return
    }
    setLoading(true)
    setError('')

    const { data, error: verifyError } = await supabase.auth.verifyOtp({
      email: email.trim().toLowerCase(),
      token: otp.trim(),
      type: 'email',
    })

    if (verifyError || !data.session) {
      setLoading(false)
      setError(verifyError?.message || 'Invalid or expired code. Please try again.')
      return
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', data.session.user.id)
      .single()

    const isAdmin =
      profile?.role === 'admin' ||
      ADMIN_EMAILS.includes((data.session.user.email || '').toLowerCase())

    setAuth({
      id: data.session.user.id,
      name: profile?.name || name.trim() || data.session.user.email || 'Customer',
      email: data.session.user.email || '',
      mobile: profile?.mobile || '',
      role: isAdmin ? 'admin' : 'customer',
    })

    setLoading(false)
    navigate(redirectPath)
  }

  // ── OTP verification screen ──────────────────────────────────
  if (step === 'otp') {
    return (
      <div className="bg-gradient-to-br from-[#eaf2e5] to-[#f7f6f2] min-h-screen flex items-center justify-center p-4">
        <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-sand/40 w-full max-w-md">
          <div className="flex flex-col items-center mb-8">
            <div className="w-14 h-14 bg-blue-50 rounded-2xl flex items-center justify-center mb-3">
              <Shield size={28} className="text-blue-600" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold font-headline text-textMain">Check Your Email</h1>
            <p className="text-sm text-textMuted mt-2 text-center leading-relaxed">
              We sent a <strong>6-digit code</strong> to<br />
              <span className="text-sageDark font-bold">{email}</span>
            </p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
          )}

          <form onSubmit={handleVerifyOtp} className="space-y-5">
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="0  0  0  0  0  0"
              className="w-full text-center text-3xl font-bold tracking-[0.6em] py-4 bg-gray-50 border-2 border-sand focus:border-sageDark rounded-xl outline-none transition-all placeholder:text-gray-200 placeholder:tracking-[0.4em]"
              value={otp}
              onChange={(e) => { setOtp(e.target.value.replace(/\D/g, '')); setError('') }}
              autoFocus
            />

            <button
              type="submit"
              disabled={loading || otp.length < 6}
              className="w-full bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {loading
                ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Verifying...</>
                : 'Verify & Sign In →'}
            </button>

            <button
              type="button"
              onClick={() => { setStep('email'); setOtp(''); setError('') }}
              className="w-full flex items-center justify-center gap-1.5 text-sm text-textMuted hover:text-textMain transition-colors py-1"
            >
              <ArrowLeft size={14} /> Use a different email
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
            Didn't receive the code? Check your spam folder.<br />The code expires in <strong>60 minutes</strong>.
          </p>
        </div>
      </div>
    )
  }

  // ── Email entry screen ────────────────────────────────────────
  return (
    <div className="bg-gradient-to-br from-[#eaf2e5] to-[#f7f6f2] min-h-screen flex items-center justify-center p-4">
      <div className="bg-white p-6 sm:p-8 rounded-3xl shadow-xl border border-sand/40 w-full max-w-md">
        <div className="flex flex-col items-center mb-8">
          <div className="w-14 h-14 bg-sage/30 rounded-2xl flex items-center justify-center mb-3">
            <Leaf size={28} className="text-sageDark" />
          </div>
          <h1 className="text-xl sm:text-2xl font-bold font-headline text-textMain text-center">{BRAND_EN}</h1>
          <p className="text-sm text-textMuted mt-1">{BRAND_TA}</p>
          <p className="mt-2 text-xs font-bold text-sageDark bg-sage/10 px-3 py-1 rounded-full">
            No password needed — sign in with email OTP
          </p>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-3 rounded-xl text-sm mb-4">{error}</div>
        )}

        <form onSubmit={handleSendOtp} className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-textMain mb-1.5">
              Your Name <span className="text-textMuted font-normal text-xs">(for new accounts)</span>
            </label>
            <input
              type="text"
              placeholder="Full name"
              className="w-full px-4 py-3 rounded-xl border-2 border-sand focus:border-sageDark outline-none transition-colors"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div>
            <label className="block text-sm font-bold text-textMain mb-1.5">Email Address *</label>
            <div className="relative">
              <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-textMuted" size={18} />
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@example.com"
                className="w-full pl-10 pr-4 py-3 rounded-xl border-2 border-sand focus:border-sageDark outline-none transition-colors"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setError('') }}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-sageDark hover:bg-sageDeep text-white font-bold py-3.5 rounded-xl transition-colors disabled:opacity-60 flex items-center justify-center gap-2 mt-2"
          >
            {loading
              ? <><span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Sending Code...</>
              : 'Send OTP Code to Email →'}
          </button>
        </form>

        <div className="mt-6 pt-5 border-t border-sand/50 space-y-2 text-center">
          <p className="text-xs text-gray-400">
            New users get an account automatically.<br />Existing users log in with the same OTP flow.
          </p>
        </div>
      </div>
    </div>
  )
}
