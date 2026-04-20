import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { isAxiosError } from 'axios'
import { useCallback, useEffect, useRef, useState } from 'react'
import { fetchSettings, saveBranding, saveContact, updatePassword } from '@/api/settings'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { useAuthStore } from '@/store/authStore'

const LANG_KEY = 'rto-helper-lang'

function getLang(): 'en' | 'hi' {
  const v = localStorage.getItem(LANG_KEY)
  return v === 'hi' ? 'hi' : 'en'
}

export function SettingsPage() {
  const queryClient = useQueryClient()
  const applyAccessToken = useAuthStore((s) => s.applyAccessToken)

  const settingsQuery = useQuery({
    queryKey: ['settings', 'profile'],
    queryFn: fetchSettings,
  })

  const [businessName, setBusinessName] = useState('')
  const [logoFile, setLogoFile] = useState<File | null>(null)
  const [logoPreview, setLogoPreview] = useState<string | null>(null)
  const [brandingError, setBrandingError] = useState<string | null>(null)
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [language, setLanguage] = useState<'en' | 'hi'>(() => getLang())
  const [contactError, setContactError] = useState<string | null>(null)
  const [contactOk, setContactOk] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwdError, setPwdError] = useState<string | null>(null)
  const [pwdOk, setPwdOk] = useState(false)

  const dropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const d = settingsQuery.data
    if (!d) return
    setBusinessName(d.businessName)
    setWhatsappNumber(d.whatsappNumber ?? '')
  }, [settingsQuery.data])

  useEffect(() => {
    if (!logoFile) {
      setLogoPreview(null)
      return
    }
    const url = URL.createObjectURL(logoFile)
    setLogoPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [logoFile])

  const onFile = useCallback((file: File | null) => {
    setBrandingError(null)
    if (!file) {
      setLogoFile(null)
      return
    }
    if (!['image/jpeg', 'image/png'].includes(file.type)) {
      setBrandingError('Please use JPG or PNG only.')
      return
    }
    if (file.size > 2 * 1024 * 1024) {
      setBrandingError('File must be 2MB or smaller.')
      return
    }
    setLogoFile(file)
  }, [])

  const brandingMut = useMutation({
    mutationFn: () => {
      const fd = new FormData()
      fd.append('businessName', businessName.trim())
      if (logoFile) fd.append('logo', logoFile)
      return saveBranding(fd)
    },
    onSuccess: (data) => {
      applyAccessToken(data.accessToken)
      queryClient.invalidateQueries({ queryKey: ['settings'] })
      setLogoFile(null)
      setBrandingError(null)
    },
    onError: (e) => {
      setBrandingError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Save failed')
    },
  })

  const contactMut = useMutation({
    mutationFn: () => saveContact({ whatsappNumber: whatsappNumber.trim() || null }),
    onSuccess: (data) => {
      applyAccessToken(data.accessToken)
      setContactOk(true)
      setContactError(null)
      setTimeout(() => setContactOk(false), 3000)
    },
    onError: (e) => {
      setContactError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Save failed')
    },
  })

  const passwordMut = useMutation({
    mutationFn: (payload: { currentPassword: string; newPassword: string; confirmNewPassword: string }) =>
      updatePassword(payload),
    onSuccess: (data) => {
      applyAccessToken(data.accessToken)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setPwdOk(true)
      setPwdError(null)
      setTimeout(() => setPwdOk(false), 3000)
    },
    onError: (e) => {
      setPwdError(isAxiosError(e) ? String((e.response?.data as { message?: string })?.message) : 'Update failed')
    },
  })

  const persistLanguage = (lang: 'en' | 'hi') => {
    setLanguage(lang)
    localStorage.setItem(LANG_KEY, lang)
  }

  const displayLogo =
    logoPreview ?? (settingsQuery.data?.logoUrl ? settingsQuery.data.logoUrl : null)

  return (
    <div className="mx-auto max-w-3xl space-y-10">
      <div>
        <h1 className="text-xl font-semibold text-text-primary">Settings</h1>
        <p className="mt-1 text-sm text-text-secondary">Branding, contact, and account security.</p>
      </div>

      <section className="space-y-4 border-b border-border-card pb-10">
        <h2 className="text-lg font-semibold text-text-primary">Branding</h2>
        <div
          ref={dropRef}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
          }}
          onDrop={(e) => {
            e.preventDefault()
            onFile(e.dataTransfer.files[0] ?? null)
          }}
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-border-card bg-bg-app px-4 py-10 text-center transition hover:border-accent-blue/50',
          )}
          onClick={() => document.getElementById('logo-input')?.click()}
          role="presentation"
        >
          <input
            id="logo-input"
            type="file"
            accept="image/jpeg,image/png"
            className="hidden"
            onChange={(e) => onFile(e.target.files?.[0] ?? null)}
          />
          {displayLogo ? (
            <img src={displayLogo} alt="Logo preview" className="mb-3 max-h-32 max-w-full object-contain" />
          ) : (
            <p className="text-sm text-text-secondary">Drag & drop logo here, or click to browse</p>
          )}
          <p className="mt-2 text-xs text-text-secondary">JPG or PNG, max 2MB</p>
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Business name</label>
          <input
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm text-text-primary"
            placeholder="Shown on quotes and forms"
          />
        </div>
        {brandingError ? <p className="text-sm text-accent-red">{brandingError}</p> : null}
        <Button
          type="button"
          className="bg-accent-blue text-white"
          disabled={!businessName.trim() || brandingMut.isPending}
          onClick={() => brandingMut.mutate()}
        >
          Save branding
        </Button>
      </section>

      <section className="space-y-4 border-b border-border-card pb-10">
        <h2 className="text-lg font-semibold text-text-primary">Contact & account</h2>
        <div>
          <label className="text-xs font-medium text-text-secondary">WhatsApp number</label>
          <input
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm text-text-primary"
            placeholder="+91..."
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Email</label>
          <input
            value={settingsQuery.data?.email ?? ''}
            readOnly
            className="mt-1 w-full cursor-not-allowed rounded-md border border-border-card bg-bg-app px-3 py-2 text-sm text-text-secondary"
          />
        </div>
        <div>
          <p className="text-xs font-medium text-text-secondary">Language preference</p>
          <div className="mt-2 flex gap-2">
            {(['en', 'hi'] as const).map((lang) => (
              <button
                key={lang}
                type="button"
                onClick={() => persistLanguage(lang)}
                className={cn(
                  'rounded-md border px-3 py-2 text-sm font-medium',
                  language === lang
                    ? 'border-accent-blue bg-accent-blue/15 text-accent-blue'
                    : 'border-border-card bg-bg-card text-text-secondary',
                )}
              >
                {lang === 'en' ? 'English' : 'Hindi'}
              </button>
            ))}
          </div>
          <p className="mt-1 text-xs text-text-secondary">Saved in this browser (localStorage).</p>
        </div>
        {contactError ? <p className="text-sm text-accent-red">{contactError}</p> : null}
        {contactOk ? <p className="text-sm text-accent-green">Contact saved.</p> : null}
        <Button
          type="button"
          variant="outline"
          className="border-border-card"
          disabled={contactMut.isPending}
          onClick={() => contactMut.mutate()}
        >
          Save contact
        </Button>
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-text-primary">Security</h2>
        <div>
          <label className="text-xs font-medium text-text-secondary">Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">New password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-text-secondary">Confirm new password</label>
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="mt-1 w-full rounded-md border border-border-card bg-bg-card px-3 py-2 text-sm"
          />
        </div>
        {pwdError ? <p className="text-sm text-accent-red">{pwdError}</p> : null}
        {pwdOk ? <p className="text-sm text-accent-green">Password updated.</p> : null}
        <Button
          type="button"
          className="bg-accent-green text-white hover:bg-accent-green/90"
          disabled={passwordMut.isPending}
          onClick={() => {
            setPwdError(null)
            if (newPassword !== confirmPassword) {
              setPwdError('New passwords do not match')
              return
            }
            if (newPassword.length < 8) {
              setPwdError('Use at least 8 characters')
              return
            }
            passwordMut.mutate({
              currentPassword,
              newPassword,
              confirmNewPassword: confirmPassword,
            })
          }}
        >
          Update password
        </Button>
      </section>
    </div>
  )
}
