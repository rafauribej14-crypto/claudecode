/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_GROQ_API_KEY: string
  readonly VITE_GOOGLE_CLIENT_ID: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}

interface CredentialResponse {
  credential: string
  select_by: string
}

interface Google {
  accounts: {
    id: {
      initialize: (config: { client_id: string; callback: (response: CredentialResponse) => void }) => void
      renderButton: (element: HTMLElement, config: { theme?: string; size?: string; width?: number; shape?: string; text?: string }) => void
    }
  }
}

declare const google: Google
