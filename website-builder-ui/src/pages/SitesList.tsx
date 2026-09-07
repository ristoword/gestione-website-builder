import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, Website } from '../api/client'

export default function SitesList() {
  const [sites, setSites] = useState<Website[]>([])
  const [templates, setTemplates] = useState<{ id: string; name: string; folder?: string }[]>([])
  const [error, setError] = useState('')
  const [name, setName] = useState('Il mio sito')
  const [templateId, setTemplateId] = useState('')
  const [busy, setBusy] = useState(false)

  async function load() {
    try {
      const data = await api.websites()
      setSites(data.websites || [])
      const tpl = await api.templates()
      setTemplates(tpl.templates || [])
      if (tpl.templates && tpl.templates[0] && !templateId) setTemplateId(tpl.templates[0].id)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Errore')
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function create() {
    setBusy(true)
    setError('')
    try {
      const data = await api.createWebsite(name)
      if (templateId) {
        await api.applyTemplate(data.website.id, templateId)
      }
      window.location.href = `/builder/${data.website.id}`
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Impossibile creare il sito')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="min-h-screen p-8 max-w-3xl mx-auto">
      <h1 className="font-serif text-3xl mb-2">I miei siti</h1>
      <p className="text-slate-400 mb-8">Website Builder Gestione Semplificata</p>
      {error && <p className="text-red-400 mb-4">{error}</p>}
      <div className="glass rounded-2xl p-4 mb-6 space-y-3">
        <input
          className="w-full bg-surface-950 rounded-lg px-3 py-2 border border-white/10"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nome del sito"
        />
        <select
          className="w-full bg-surface-950 rounded-lg px-3 py-2 border border-white/10"
          value={templateId}
          onChange={(e) => setTemplateId(e.target.value)}
        >
          <option value="">Senza template</option>
          {templates.map((t) => (
            <option key={t.id} value={t.id}>{t.name}{t.folder ? ` (${t.folder})` : ''}</option>
          ))}
        </select>
        <button
          onClick={create}
          disabled={busy}
          className="px-4 py-2 rounded-lg bg-brand-600 hover:bg-brand-500 disabled:opacity-50"
        >
          Crea sito
        </button>
      </div>
      <div className="space-y-3">
        {sites.map((s) => (
          <Link
            key={s.id}
            to={`/${s.id}`}
            className="glass rounded-2xl p-4 flex justify-between items-center hover:border-brand-500/40"
          >
            <div>
              <div className="font-semibold">{s.name}</div>
              <div className="text-sm text-slate-400">{s.slug} · {s.status === 'published' ? 'Pubblicato' : 'Bozza'}</div>
            </div>
            <span className="text-brand-400">Apri editor →</span>
          </Link>
        ))}
        {!sites.length && <p className="text-slate-500">Nessun sito. Creane uno per iniziare.</p>}
      </div>
      <p className="mt-8 text-sm">
        <a className="text-slate-400 hover:text-white" href="/account#siti">← Torna all'area clienti</a>
      </p>
    </div>
  )
}
