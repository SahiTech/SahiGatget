import 'server-only'

export type HttpDeliveryResult = {
  ok: boolean
  latency: number
  status?: number
  category?: 'HTTP_ERROR' | 'TIMEOUT' | 'NETWORK_ERROR' | 'RETRY_EXHAUSTED'
  responseBody?: string
  attempts: number
}

export async function postJson(url: string, body: unknown, headers: Record<string, string> = {}): Promise<HttpDeliveryResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const started = Date.now()
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), 3500)
    try {
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'content-type': 'application/json', ...headers },
        body: JSON.stringify(body),
        signal: controller.signal,
        cache: 'no-store',
      })
      const latency = Date.now() - started
      const responseBody = (await response.text()).slice(0, 1000)
      if (response.ok) return { ok: true, latency, status: response.status, responseBody, attempts: attempt + 1 }
      if (response.status < 500) return { ok: false, latency, status: response.status, category: 'HTTP_ERROR', responseBody, attempts: attempt + 1 }
    } catch (error) {
      const latency = Date.now() - started
      if (attempt === 1) {
        return {
          ok: false,
          latency,
          category: error instanceof Error && error.name === 'AbortError' ? 'TIMEOUT' : 'NETWORK_ERROR',
          attempts: attempt + 1,
        }
      }
    } finally {
      clearTimeout(timer)
    }
  }
  return { ok: false, latency: 0, category: 'RETRY_EXHAUSTED', attempts: 2 }
}
