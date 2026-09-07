import { useEffect, useState } from 'react'
import { api, Website, Page, Section, Nav } from '../api/client'

const SECTION_LABELS: Record<string, string> = {
  hero: 'Hero',
  header: 'Intestazione',
  footer: 'Piè di pagina',
  about: 'Chi siamo',
  services: 'Servizi',
  features: 'Caratteristiche',
  gallery: 'Galleria',
  testimonials: 'Testimonianze',
  pricing: 'Prezzi',
  contact: 'Contatti',
  faq: 'FAQ',
  cta: 'Call to action',
  team: 'Team',
  map: 'Mappa',
  events: 'Eventi',
  blog: 'Blog',
  menu: 'Menu',
  booking: 'Prenotazione',
}

type Props = {
  tab: string
  website: Website
  pages: Page[]
  pageId: string
  sections: Section[]
  selectedId: string | null
  nav: Nav[]
  onSelectPage: (id: string) => void
  onSelectSection: (id: string) => void
  onAddSection: (type: string) => void
  onCreatePage: (title: string) => void
  onPatchWebsite: (patch: Record<string, unknown>) => void
  onPatchPage: (patch: Record<string, unknown>) => void
  onSaveNav: (location: string, items: { label: string; href: string }[]) => void
  onReload: () => void
}

export default function LeftPanel(props: Props) {
  const page = props.pages.find((p) => p.id === props.pageId)
  const theme = (props.website.theme || {}) as { colors?: Record<string, string>; fonts?: Record<string, string> }
  const settings = (props.website.settings || {}) as Record<string, string>
  const headerNav = props.nav.find((n) => n.location === 'header')

  if (props.tab === 'pages') {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">Pagine</h3>
        <ul className="space-y-1">
          {props.pages.map((p) => (
            <li key={p.id}>
              <button
                onClick={() => props.onSelectPage(p.id)}
                className={`w-full text-left px-2 py-1.5 rounded ${p.id === props.pageId ? 'bg-brand-600' : 'hover:bg-white/10'}`}
              >
                {p.title || p.slug} {p.is_home ? '· Home' : ''}
              </button>
            </li>
          ))}
        </ul>
        <button
          className="mt-3 text-sm text-brand-400"
          onClick={() => {
            const title = window.prompt('Titolo della nuova pagina')
            if (title) props.onCreatePage(title)
          }}
        >
          + Nuova pagina
        </button>
      </div>
    )
  }

  if (props.tab === 'sections') {
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">Sezioni della pagina</h3>
        <ul className="space-y-1 mb-4">
          {props.sections.map((s) => (
            <li key={s.id}>
              <button
                onClick={() => props.onSelectSection(s.id)}
                className={`w-full text-left px-2 py-1.5 rounded ${s.id === props.selectedId ? 'bg-brand-600' : 'hover:bg-white/10'}`}
              >
                {SECTION_LABELS[s.type] || s.type}
              </button>
            </li>
          ))}
        </ul>
        <h4 className="text-xs uppercase text-slate-500 mb-2">Aggiungi</h4>
        <div className="grid grid-cols-2 gap-1">
          {Object.entries(SECTION_LABELS).map(([type, label]) => (
            <button
              key={type}
              onClick={() => props.onAddSection(type)}
              className="text-xs px-2 py-1 rounded bg-white/5 hover:bg-white/10"
            >
              {label}
            </button>
          ))}
        </div>
      </div>
    )
  }

  if (props.tab === 'media') {
    return <MediaTab websiteId={props.website.id} />
  }

  if (props.tab === 'menu') {
    const items = headerNav?.items || []
    return (
      <div>
        <h3 className="text-sm font-semibold mb-2">Menu intestazione</h3>
        {items.map((item, i) => (
          <div key={i} className="mb-2">
            <input
              className="w-full mb-1 bg-surface-950 rounded px-2 py-1 text-sm border border-white/10"
              defaultValue={item.label}
              onBlur={(e) => {
                const next = items.map((it, idx) => (idx === i ? { ...it, label: e.target.value } : it))
                props.onSaveNav('header', next)
              }}
            />
            <input
              className="w-full bg-surface-950 rounded px-2 py-1 text-sm border border-white/10"
              defaultValue={item.href}
              onBlur={(e) => {
                const next = items.map((it, idx) => (idx === i ? { ...it, href: e.target.value } : it))
                props.onSaveNav('header', next)
              }}
            />
          </div>
        ))}
        <button
          className="text-sm text-brand-400"
          onClick={() => props.onSaveNav('header', [...items, { label: 'Voce', href: '/' }])}
        >
          + Voce di menu
        </button>
      </div>
    )
  }

  if (props.tab === 'design') {
    const colors = theme.colors || {}
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Design</h3>
        {(['primary', 'accent', 'background', 'text'] as const).map((key) => (
          <label key={key} className="block text-xs text-slate-400">
            {key}
            <input
              type="color"
              className="block mt-1 h-8 w-full bg-transparent"
              defaultValue={String(colors[key] || '#1a1a1a')}
              onChange={(e) =>
                props.onPatchWebsite({
                  theme: { ...theme, colors: { ...colors, [key]: e.target.value } },
                })
              }
            />
          </label>
        ))}
      </div>
    )
  }

  if (props.tab === 'seo') {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">SEO pagina</h3>
        <label className="block text-xs text-slate-400">
          Titolo
          <input
            className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-sm text-white"
            defaultValue={page?.seo?.title || page?.title || ''}
            onBlur={(e) => props.onPatchPage({ seo: { ...(page?.seo || {}), title: e.target.value } })}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Descrizione
          <textarea
            className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-sm text-white"
            rows={4}
            defaultValue={page?.seo?.description || ''}
            onBlur={(e) => props.onPatchPage({ seo: { ...(page?.seo || {}), description: e.target.value } })}
          />
        </label>
        <p className="text-xs text-slate-500">Sitemap e robots sono generati dal sito. Il dominio personalizzato si verifica solo con un record TXT.</p>
        <DomainsBlock websiteId={props.website.id} />
      </div>
    )
  }

  if (props.tab === 'settings') {
    return (
      <div className="space-y-3">
        <h3 className="text-sm font-semibold">Impostazioni sito</h3>
        <label className="block text-xs text-slate-400">
          Nome
          <input
            className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-sm text-white"
            defaultValue={props.website.name}
            onBlur={(e) => props.onPatchWebsite({ name: e.target.value })}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Telefono
          <input
            className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-sm text-white"
            defaultValue={settings.phone || ''}
            onBlur={(e) => props.onPatchWebsite({ settings: { ...settings, phone: e.target.value } })}
          />
        </label>
        <label className="block text-xs text-slate-400">
          Email
          <input
            className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-sm text-white"
            defaultValue={settings.email || ''}
            onBlur={(e) => props.onPatchWebsite({ settings: { ...settings, email: e.target.value } })}
          />
        </label>
        <TemplatesBlock websiteId={props.website.id} onApplied={props.onReload} />
        <VersionsBlock websiteId={props.website.id} onReload={props.onReload} />
        <RistoBlock websiteId={props.website.id} />
      </div>
    )
  }

  return <AiTab websiteId={props.website.id} pageId={props.pageId} onReload={props.onReload} />
}

function MediaTab({ websiteId }: { websiteId: string }) {
  const [items, setItems] = useState<{ id: string; filename: string }[]>([])
  const [msg, setMsg] = useState('')

  async function refresh() {
    try {
      const data = await api.media(websiteId)
      setItems(data.media || [])
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Media non disponibili')
    }
  }

  useEffect(() => {
    refresh()
  }, [websiteId])

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Media</h3>
      <input
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        className="text-xs mb-3"
        onChange={async (e) => {
          const file = e.target.files && e.target.files[0]
          if (!file) return
          const fd = new FormData()
          fd.append('file', file)
          const res = await fetch(`/api/website-builder/websites/${websiteId}/media`, {
            method: 'POST',
            credentials: 'include',
            body: fd,
          })
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            setMsg(data.error || 'Caricamento non riuscito')
            return
          }
          setMsg('Immagine caricata: ' + (data.media && data.media.filename))
          refresh()
        }}
      />
      <p className="text-xs text-slate-500 mb-2">JPEG, PNG, GIF o WebP. Il file resta nel tenant corrente.</p>
      {msg && <p className="text-xs text-emerald-300 mb-2">{msg}</p>}
      <ul className="space-y-1 text-xs">
        {items.map((m) => (
          <li key={m.id} className="flex justify-between gap-2">
            <span className="truncate">{m.filename}</span>
            <button className="text-red-300" onClick={() => api.deleteMedia(websiteId, m.id).then(refresh)}>Elimina</button>
          </li>
        ))}
      </ul>
    </div>
  )
}

function TemplatesBlock({ websiteId, onApplied }: { websiteId: string; onApplied: () => void }) {
  const [list, setList] = useState<{ id: string; name: string; folder?: string }[]>([])
  const [sel, setSel] = useState('')
  const [msg, setMsg] = useState('')

  useEffect(() => {
    api.templates().then((d) => {
      setList(d.templates || [])
      if (d.templates && d.templates[0]) setSel(d.templates[0].id)
    }).catch(() => setMsg('Template non disponibili'))
  }, [])

  return (
    <div className="pt-3 border-t border-white/10">
      <h4 className="text-sm font-semibold mb-2">Template (cartelle)</h4>
      <select
        className="w-full bg-surface-950 rounded px-2 py-1 text-sm border border-white/10 mb-2"
        value={sel}
        onChange={(e) => setSel(e.target.value)}
      >
        {list.map((t) => (
          <option key={t.id} value={t.id}>{t.name}{t.folder ? ` · ${t.folder}` : ''}</option>
        ))}
      </select>
      <button
        className="text-sm text-brand-400"
        onClick={async () => {
          if (!sel) return
          if (!window.confirm('Sovrascrivere pagine e sezioni con questo template?')) return
          try {
            await api.applyTemplate(websiteId, sel)
            setMsg('Template applicato')
            onApplied()
          } catch (e: unknown) {
            setMsg(e instanceof Error ? e.message : 'Applicazione non riuscita')
          }
        }}
      >
        Applica template
      </button>
      {msg && <p className="text-xs mt-1 text-slate-400">{msg}</p>}
    </div>
  )
}

function VersionsBlock({ websiteId, onReload }: { websiteId: string; onReload: () => void }) {
  const [rows, setRows] = useState<{ id: string; kind: string; created_at: string }[]>([])

  useEffect(() => {
    api.versions(websiteId).then((d) => setRows(d.versions || [])).catch(() => setRows([]))
  }, [websiteId])

  return (
    <div className="pt-3 border-t border-white/10">
      <h4 className="text-sm font-semibold mb-2">Versioni</h4>
      <ul className="space-y-1 text-xs">
        {rows.slice(0, 8).map((v) => (
          <li key={v.id} className="flex justify-between gap-2">
            <span>{v.kind} · {new Date(v.created_at).toLocaleString('it-IT')}</span>
            <button
              className="text-brand-400"
              onClick={async () => {
                await api.rollback(websiteId, v.id)
                onReload()
              }}
            >
              Ripristina
            </button>
          </li>
        ))}
        {!rows.length && <li className="text-slate-500">Nessuna pubblicazione ancora.</li>}
      </ul>
    </div>
  )
}

function DomainsBlock({ websiteId }: { websiteId: string }) {
  const [host, setHost] = useState('')
  const [info, setInfo] = useState('')

  return (
    <div className="pt-2 border-t border-white/10">
      <h4 className="text-sm font-semibold mb-2">Dominio (solo TXT)</h4>
      <input
        className="w-full bg-surface-950 rounded px-2 py-1 text-sm border border-white/10 mb-2"
        placeholder="www.tuodominio.it"
        value={host}
        onChange={(e) => setHost(e.target.value)}
      />
      <button
        className="text-sm text-brand-400"
        onClick={async () => {
          try {
            const res = await api.addDomain(websiteId, host)
            const dns = (res.domain as { dns_instructions?: { recordType?: string; name?: string; value?: string; note?: string }; dns_instructions_json?: string }).dns_instructions
              || JSON.parse((res.domain as { dns_instructions_json?: string }).dns_instructions_json || '{}')
            setInfo(`${dns.recordType || 'TXT'} ${dns.name || ''} = ${dns.value || ''}. ${dns.note || ''}`)
          } catch (e: unknown) {
            setInfo(e instanceof Error ? e.message : 'Dominio non aggiunto')
          }
        }}
      >
        Aggiungi e mostra TXT
      </button>
      {info && <p className="text-xs mt-2 text-slate-400 whitespace-pre-wrap">{info}</p>}
    </div>
  )
}

function RistoBlock({ websiteId }: { websiteId: string }) {
  const [note, setNote] = useState('')
  useEffect(() => {
    api.ristosimply(websiteId)
      .then((d) => setNote(d.ristosimply.note || (d.ristosimply.duplicated ? 'Errore: dati duplicati' : 'RistoSimply in sola lettura')))
      .catch(() => setNote('RistoSimply non collegato'))
  }, [websiteId])
  return (
    <div className="pt-3 border-t border-white/10">
      <h4 className="text-sm font-semibold mb-1">RistoSimply</h4>
      <p className="text-xs text-slate-400">{note}</p>
    </div>
  )
}

function AiTab({ websiteId, pageId, onReload }: { websiteId: string; pageId: string; onReload: () => void }) {
  const [prompt, setPrompt] = useState('Crea una sezione chi siamo e una FAQ')
  const [msg, setMsg] = useState('')

  return (
    <div>
      <h3 className="text-sm font-semibold mb-2">Assistente AI</h3>
      <p className="text-xs text-slate-400 mb-2">
        Genera JSON di sezioni validato. Nessun HTML libero. Serve OPENAI_API_KEY oppure modalità offline.
      </p>
      <textarea
        className="w-full bg-surface-950 rounded px-2 py-1 text-sm border border-white/10 mb-2"
        rows={4}
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
      />
      <button
        className="text-sm text-brand-400"
        onClick={async () => {
          try {
            const gen = await api.generateAi(websiteId, prompt)
            await api.applyAi(websiteId, gen.job.id, pageId)
            setMsg('Sezioni AI applicate')
            onReload()
          } catch (e: unknown) {
            setMsg(e instanceof Error ? e.message : 'AI non disponibile')
          }
        }}
      >
        Genera e applica
      </button>
      {msg && <p className="text-xs mt-2 text-slate-400">{msg}</p>}
    </div>
  )
}
