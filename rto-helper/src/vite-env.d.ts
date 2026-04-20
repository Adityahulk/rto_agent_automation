/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL?: string
  readonly VITE_RAZORPAY_KEY_ID?: string
}

interface RazorpayOptions {
  key: string
  amount: number
  currency: string
  name: string
  description?: string
  handler: (response: { razorpay_payment_id?: string }) => void
  theme?: { color?: string }
}

declare class Razorpay {
  constructor(options: RazorpayOptions)
  open(): void
}

interface Window {
  Razorpay?: typeof Razorpay
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
