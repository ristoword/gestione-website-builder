import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  FileText, Layers, Image, Menu, Palette, Search, Settings, Sparkles,
  Monitor, Tablet, Smartphone, Eye, Save, Globe
} from 'lucide-react'
import { api, Nav, Page, Section, Website } from '../api/client'
import Inspector from '../editor/Inspector'
import LeftPanel from '../editor/LeftPanel'

const LEFT_TABS = [
  { id: 'pages', label: 'Pagine', icon: FileText },
  { id: 'sections', label: 'Sezioni', icon: Layers },
  { id: 'media', label: 'Media', icon: Image },
  { id: 'menu', label: 'Menu', icon: Menu },
  { id: 'design', label: 'Design', icon: Palette },
  { id: 'seo', label: 'SEO', icon: Search },
  { id: 'settings', label: 'Impostazioni', icon: Settings },
  { id: 'ai', label: 'AI', icon: Sparkles },
] as const

type LeftTab = (typeof LEFT_TABS)[number]['id']
type Viewport = 'desktop' | 'tablet' | 'mobile'

export default function EditorPage() {
  const { websiteId = '' } = useParams()
  const [website, setWebsite] = useState<Website | null>(null)
  const [pages, setPages] = useState<Page[]>([])
  const [pageId, setPageId] = useState('')
  const [sections, setSections] = useState<Section[]>([])
  const [nav, setNav] = useState<Nav[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [tab, setTab] = useState<LeftTab>('sections')
  const [viewport, setViewport] = useState<Viewport>('desktop')
  const [html, setHtml] = useState('')
  const [status, setStatus] = useState('')
  const [error, setError] = useState('')
  const [previewMode, setPreviewMode] = useState(false)
  const saveTimer = useRef<number | null>(null)

  const selected = useMemo(
    () => sections.find((s) => s.id === selectedId) || null,
    [sections, selectedId]
  )

  const refreshPreview = useCallback(async (nextSections: Section[], sel: string | null, vp: Viewport, theme?: unknown) => {
    if (!websiteId || !pageId) return
    try {
      const doc = await api.previewHtml(websiteId, {
        pageId,
        sections: nextSections,
        selectedId: sel,
        viewport: vp,
        theme: theme || website?.theme,
      })
      setHtml(doc)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Anteprima non disponibile')
    }
  }, [websiteId, pageId, website?.theme])

  async function loadAll() {
    const data = await api.website(websiteId)
    setWebsite(data.website)
    const list = data.website.pages?.length ? data.website.pages : (await api.pages(websiteId)).pages
    setPages(list)
    const home = list.find((p) => p.is_home) || list[0]
    if (home) {
      setPageId(home.id)
      const full = await api.page(websiteId, home.id)
      setSections(full.page.sections || [])
    }
    try {
      const n = await api.navigation(websiteId)
      setNav(n.navigation || [])
    } catch {
      setNav([])
    }
  }

  useEffect(() => {
    loadAll().catch((e) => setError(e.message || 'Caricamento fallito'))
  }, [websiteId])

  useEffect(() => {
    if (pageId && sections) {
      refreshPreview(sections, selectedId, viewport)
    }
  }, [pageId, viewport, selectedId])

  useEffect(() => {
    function onMsg(ev: MessageEvent) {
      if (ev.data && ev.data.type === 'wb:select' && ev.data.id) {
        setSelectedId(ev.data.id)
        setTab('sections')
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  async function selectPage(id: string) {
    setPageId(id)
    const full = await api.page(websiteId, id)
    setSections(full.page.sections || [])
    setSelectedId(null)
    setPages((prev) => prev.map((p) => (p.id === id ? { ...p, ...full.page } : p)))
  }

  function schedulePreview(next: Section[]) {
    if (saveTimer.current) window.clearTimeout(saveTimer.current)
    saveTimer.current = window.setTimeout(() => refreshPreview(next, selectedId, viewport), 250)
  }

  async function saveSelected(patch: Partial<Section>) {
    if (!selected || !pageId) return
    const next = sections.map((s) => (s.id === selected.id ? { ...s, ...patch, content: patch.content || s.content, design: patch.design || s.design, layout: patch.layout || s.layout, settings: patch.settings || s.settings } : s))
    setSections(next)
    schedulePreview(next)
    try {
      const res = await api.patchSection(websiteId, pageId, selected.id, patch)
      setSections((cur) => cur.map((s) => (s.id === selected.id ? res.section : s)))
      setStatus('Salvato')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Salvataggio non riuscito')
    }
  }

  async function addSection(type: string) {
    if (!pageId) return
    const res = await api.createSection(websiteId, pageId, { type })
    const next = [...sections, res.section]
    setSections(next)
    setSelectedId(res.section.id)
    refreshPreview(next, res.section.id, viewport)
  }

  async function saveAll() {
    setStatus('Salvataggio...')
    if (website) {
      await api.patchWebsite(websiteId, { name: website.name, theme: website.theme, settings: website.settings })
    }
    setStatus('Salvato')
  }

  const width = viewport === 'mobile' ? 390 : viewport === 'tablet' ? 768 : '100%'

  if (error && !website) {
    return <div className="p-8 text-red-400">{error}</div>
  }
  if (!website) {
    return <div className="h-screen flex items-center justify-center text-slate-400">Caricamento editor…</div>
  }

  return (
    <div className="h-screen flex flex-col bg-surface-950 text-slate-100">
      <header className="h-14 border-b border-white/10 flex items-center px-3 gap-2 shrink-0">
        <a href="/account#siti" className="text-xs text-slate-400 hover:text-white mr-2">Area clienti</a>
        <strong className="truncate max-w-[180px]">{website.name}</strong>
        <span className="text-xs px-2 py-0.5 rounded bg-white/10">{website.status === 'published' ? 'Pubblicato' : 'Bozza'}</span>
        <div className="ml-auto flex items-center gap-1">
          {([
            ['desktop', Monitor, 'Desktop'],
            ['tablet', Tablet, 'Tablet'],
            ['mobile', Smartphone, 'Mobile'],
          ] as const).map(([id, Icon, label]) => (
            <button
              key={id}
              title={label}
              onClick={() => setViewport(id)}
              className={`p-2 rounded-lg ${viewport === id ? 'bg-brand-600' : 'hover:bg-white/10'}`}
            >
              <Icon size={16} />
            </button>
          ))}
          <button
            title="Anteprima"
            onClick={() => setPreviewMode((v) => !v)}
            className={`p-2 rounded-lg ${previewMode ? 'bg-brand-600' : 'hover:bg-white/10'}`}
          >
            <Eye size={16} />
          </button>
          <button onClick={saveAll} className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-sm">
            <Save size={14} /> Salva
          </button>
          <button
            onClick={async () => {
              try {
                setStatus('Pubblicazione...')
                const res = await api.publish(websiteId)
                setWebsite(res.website)
                setStatus('Sito pubblicato')
              } catch (e: unknown) {
                setError(e instanceof Error ? e.message : 'Pubblicazione non riuscita')
              }
            }}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-brand-600 hover:bg-brand-500 text-sm"
          >
            <Globe size={14} /> Pubblica
          </button>
        </div>
      </header>
      {status && <div className="text-xs text-center py-1 bg-emerald-500/10 text-emerald-300">{status}</div>}
      {error && website && <div className="text-xs text-center py-1 bg-red-500/10 text-red-300">{error}</div>}

      <div className="flex flex-1 min-h-0">
        {!previewMode && (
          <aside className="w-72 border-r border-white/10 flex flex-col bg-surface-900">
            <nav className="grid grid-cols-4 gap-1 p-2 border-b border-white/10">
              {LEFT_TABS.map((item) => {
                const Icon = item.icon
                return (
                  <button
                    key={item.id}
                    title={item.label}
                    onClick={() => setTab(item.id)}
                    className={`flex flex-col items-center gap-1 py-2 rounded-lg text-[10px] ${tab === item.id ? 'bg-brand-600' : 'hover:bg-white/10 text-slate-400'}`}
                  >
                    <Icon size={14} />
                    {item.label}
                  </button>
                )
              })}
            </nav>
            <div className="flex-1 overflow-auto p-3">
              <LeftPanel
                tab={tab}
                website={website}
                pages={pages}
                pageId={pageId}
                sections={sections}
                selectedId={selectedId}
                nav={nav}
                onSelectPage={selectPage}
                onSelectSection={(id) => { setSelectedId(id); setTab('sections') }}
                onAddSection={addSection}
                onCreatePage={async (title) => {
                  const res = await api.createPage(websiteId, { title })
                  setPages((p) => [...p, res.page])
                  selectPage(res.page.id)
                }}
                onPatchWebsite={async (patch) => {
                  const res = await api.patchWebsite(websiteId, patch)
                  setWebsite(res.website)
                  refreshPreview(sections, selectedId, viewport, res.website.theme)
                }}
                onPatchPage={async (patch) => {
                  if (!pageId) return
                  const res = await api.patchPage(websiteId, pageId, patch)
                  setPages((prev) => prev.map((p) => (p.id === pageId ? res.page : p)))
                }}
                onSaveNav={async (location, items) => {
                  const res = await api.saveNavigation(websiteId, { location, items })
                  setNav((prev) => {
                    const rest = prev.filter((n) => n.location !== location)
                    return [...rest, res.navigation]
                  })
                }}
                onReload={() => loadAll().catch((e) => setError(e.message || 'Ricaricamento fallito'))}
              />
            </div>
          </aside>
        )}

        <main className="flex-1 bg-slate-200/10 flex justify-center overflow-auto p-4">
          <div
            className="bg-white shadow-2xl overflow-hidden transition-all"
            style={{ width, maxWidth: '100%', height: '100%' }}
          >
            <iframe title="Anteprima sito" className="w-full h-full border-0" srcDoc={html} />
          </div>
        </main>

        {!previewMode && (
          <aside className="w-80 border-l border-white/10 bg-surface-900 overflow-auto">
            <Inspector section={selected} onChange={saveSelected} />
          </aside>
        )}
      </div>
    </div>
  )
}
