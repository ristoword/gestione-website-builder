const API = '/api/website-builder'

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API}${path}`, {
    credentials: 'include',
    headers: {
      Accept: 'application/json',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...(init?.headers || {}),
    },
    ...init,
  })
  if (res.status === 401) {
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
    throw new Error('Autenticazione richiesta')
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data.error || `Errore ${res.status}`)
  }
  return data as T
}

export const api = {
  me: () => fetch('/api/auth/me', { credentials: 'include' }),
  entitlements: () => request<{ commercialName?: string; hasSitowebLicense: boolean; limits: Record<string, unknown> }>('/entitlements'),
  websites: () => request<{ websites: Website[] }>('/websites'),
  createWebsite: (name: string) =>
    request<{ website: Website }>('/websites', { method: 'POST', body: JSON.stringify({ name }) }),
  website: (id: string) => request<{ website: Website }>(`/websites/${id}`),
  patchWebsite: (id: string, body: unknown) =>
    request<{ website: Website }>(`/websites/${id}`, { method: 'PATCH', body: JSON.stringify(body) }),
  pages: (id: string) => request<{ pages: Page[] }>(`/websites/${id}/pages`),
  page: (id: string, pageId: string) => request<{ page: Page }>(`/websites/${id}/pages/${pageId}`),
  createPage: (id: string, body: unknown) =>
    request<{ page: Page }>(`/websites/${id}/pages`, { method: 'POST', body: JSON.stringify(body) }),
  patchPage: (id: string, pageId: string, body: unknown) =>
    request<{ page: Page }>(`/websites/${id}/pages/${pageId}`, { method: 'PATCH', body: JSON.stringify(body) }),
  sections: (id: string, pageId: string) =>
    request<{ sections: Section[] }>(`/websites/${id}/pages/${pageId}/sections`),
  createSection: (id: string, pageId: string, body: unknown) =>
    request<{ section: Section }>(`/websites/${id}/pages/${pageId}/sections`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  patchSection: (id: string, pageId: string, sectionId: string, body: unknown) =>
    request<{ section: Section }>(`/websites/${id}/pages/${pageId}/sections/${sectionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    }),
  deleteSection: (id: string, pageId: string, sectionId: string) =>
    request<{ deleted: boolean }>(`/websites/${id}/pages/${pageId}/sections/${sectionId}`, { method: 'DELETE' }),
  reorderSections: (id: string, pageId: string, orderedIds: string[]) =>
    request<{ sections: Section[] }>(`/websites/${id}/pages/${pageId}/sections`, {
      method: 'PUT',
      body: JSON.stringify({ orderedIds }),
    }),
  navigation: (id: string) => request<{ navigation: Nav[] }>(`/websites/${id}/navigation`),
  saveNavigation: (id: string, body: unknown) =>
    request<{ navigation: Nav }>(`/websites/${id}/navigation`, { method: 'PUT', body: JSON.stringify(body) }),
  templates: () =>
    request<{ templates: { id: string; name: string; slug: string; folder?: string; category?: string }[] }>(
      '/templates'
    ),
  applyTemplate: (id: string, templateId: string) =>
    request<{ website: Website }>(`/websites/${id}/apply-template`, {
      method: 'POST',
      body: JSON.stringify({ templateId, confirm: true }),
    }),
  media: (id: string, q?: string) =>
    request<{ media: { id: string; filename: string }[] }>(`/websites/${id}/media${q ? `?q=${encodeURIComponent(q)}` : ''}`),
  deleteMedia: (id: string, mediaId: string) =>
    request<{ deleted: boolean }>(`/websites/${id}/media/${mediaId}`, { method: 'DELETE' }),
  publish: (id: string) =>
    request<{ website: Website }>(`/websites/${id}/publish`, { method: 'POST', body: JSON.stringify({}) }),
  unpublish: (id: string) =>
    request<{ website: Website }>(`/websites/${id}/unpublish`, { method: 'POST', body: JSON.stringify({}) }),
  versions: (id: string) => request<{ versions: { id: string; kind: string; created_at: string; note?: string }[] }>(`/websites/${id}/versions`),
  rollback: (id: string, versionId: string) =>
    request<{ website: Website }>(`/websites/${id}/versions/${versionId}/rollback`, { method: 'POST', body: JSON.stringify({}) }),
  domains: (id: string) =>
    request<{ domains: { id: string; host: string; type: string; status: string; dns_instructions?: unknown }[] }>(
      `/websites/${id}/domains`
    ),
  addDomain: (id: string, host: string) =>
    request<{ domain: { id: string; host: string; dns_instructions?: { recordType?: string; name?: string; value?: string; note?: string } } }>(
      `/websites/${id}/domains`,
      { method: 'POST', body: JSON.stringify({ host, type: 'custom' }) }
    ),
  verifyDomain: (id: string, domainId: string, token?: string) =>
    request<{ domain: { status: string } }>(`/websites/${id}/domains/${domainId}/verify`, {
      method: 'POST',
      body: JSON.stringify({ token }),
    }),
  generateAi: (id: string, prompt: string) =>
    request<{ job: { id: string; status: string; patch?: { sections?: unknown[] } } }>(`/websites/${id}/ai/generate`, {
      method: 'POST',
      body: JSON.stringify({ prompt }),
    }),
  applyAi: (id: string, jobId: string, pageId: string) =>
    request<{ job: { status: string } }>(`/websites/${id}/ai/jobs/${jobId}/apply`, {
      method: 'POST',
      body: JSON.stringify({ pageId }),
    }),
  ristosimply: (id: string) =>
    request<{ ristosimply: { available: boolean; duplicated: boolean; note?: string } }>(`/websites/${id}/ristosimply`),
  sectionTypes: () => request<{ sections: { type: string }[] }>('/sections'),
  previewHtml: async (id: string, body: unknown) => {
    const res = await fetch(`${API}/websites/${id}/preview`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json', Accept: 'text/html' },
      body: JSON.stringify(body),
    })
    if (res.status === 401) {
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname)
      throw new Error('Autenticazione richiesta')
    }
    if (!res.ok) throw new Error('Anteprima non disponibile')
    return res.text()
  },
}

export interface Website {
  id: string
  name: string
  slug: string
  status: string
  theme: Record<string, unknown>
  settings: Record<string, unknown>
  pages?: Page[]
  locale_default?: string
}

export interface Page {
  id: string
  title: string
  slug: string
  path: string
  is_home: boolean
  seo?: { title?: string; description?: string; canonical?: string }
  sections?: Section[]
}

export interface Section {
  id: string
  type: string
  sort_order: number
  content: Record<string, unknown>
  design: Record<string, unknown>
  layout: Record<string, unknown>
  settings: Record<string, unknown>
}

export interface Nav {
  id: string
  location: string
  items: { label: string; href: string; pageId?: string | null }[]
}
