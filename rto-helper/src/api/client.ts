import axios from 'axios'
import toast from 'react-hot-toast'

export const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL ?? '/api',
  timeout: 15_000,
  headers: {
    'Content-Type': 'application/json',
  },
})

type ToastableConfig = {
  __toastId?: string
}

function isMutationMethod(method: string | undefined) {
  const m = (method ?? 'get').toLowerCase()
  return m === 'post' || m === 'put' || m === 'patch' || m === 'delete'
}

function parseApiError(err: unknown) {
  if (axios.isAxiosError(err)) {
    const apiMessage =
      typeof err.response?.data === 'object' && err.response?.data && 'message' in err.response.data
        ? String((err.response?.data as { message?: string }).message)
        : null
    return apiMessage ?? err.message
  }
  return 'Request failed'
}

function attachMutationToasts(instance: typeof axios | typeof apiClient) {
  instance.interceptors.request.use((config) => {
    if (isMutationMethod(config.method)) {
      ;(config as typeof config & ToastableConfig).__toastId = toast.loading('Saving...')
    }
    return config
  })

  instance.interceptors.response.use(
    (response) => {
      const cfg = response.config as typeof response.config & ToastableConfig
      if (cfg.__toastId) {
        const msg =
          typeof response.data?.message === 'string' ? response.data.message : 'Saved successfully'
        toast.success(msg, { id: cfg.__toastId })
      }
      return response
    },
    (error) => {
      const cfg = (error.config ?? {}) as ToastableConfig
      if (cfg.__toastId) {
        toast.error(parseApiError(error), { id: cfg.__toastId })
      }
      return Promise.reject(error)
    },
  )
}

attachMutationToasts(apiClient)
attachMutationToasts(axios)
