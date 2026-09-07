import { Section } from '../api/client'

type Props = {
  section: Section | null
  onChange: (patch: Partial<Section>) => void
}

function i18n(val: unknown): string {
  if (!val) return ''
  if (typeof val === 'string') return val
  const obj = val as Record<string, string>
  return obj.it || obj.en || Object.values(obj)[0] || ''
}

function setI18n(val: unknown, next: string) {
  const obj = val && typeof val === 'object' ? { ...(val as Record<string, string>) } : {}
  obj.it = next
  return obj
}

export default function Inspector({ section, onChange }: Props) {
  if (!section) {
    return <div className="p-4 text-sm text-slate-400">Seleziona una sezione nell'anteprima o nell'elenco.</div>
  }

  const c = section.content || {}
  const d = section.design || {}
  const l = section.layout || {}
  const s = section.settings || {}
  const cta = (c.cta || {}) as { label?: unknown; href?: string }

  function patchContent(partial: Record<string, unknown>) {
    onChange({ content: { ...c, ...partial } })
  }
  function patchDesign(partial: Record<string, unknown>) {
    onChange({ design: { ...d, ...partial } })
  }
  function patchLayout(partial: Record<string, unknown>) {
    onChange({ layout: { ...l, ...partial } })
  }
  function patchSettings(partial: Record<string, unknown>) {
    onChange({ settings: { ...s, ...partial } })
  }

  return (
    <div className="p-4 space-y-4 text-sm">
      <h3 className="font-semibold capitalize">{section.type}</h3>

      <label className="block text-xs text-slate-400">
        Titolo
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={i18n(c.heading || c.siteName)}
          onChange={(e) => {
            if ('heading' in c || section.type !== 'header') patchContent({ heading: setI18n(c.heading, e.target.value) })
            else patchContent({ siteName: setI18n(c.siteName, e.target.value) })
          }}
        />
      </label>

      <label className="block text-xs text-slate-400">
        Testo
        <textarea
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          rows={3}
          value={i18n(c.subheading || c.body || c.copyright)}
          onChange={(e) => {
            if ('subheading' in c) patchContent({ subheading: setI18n(c.subheading, e.target.value) })
            else if ('body' in c) patchContent({ body: setI18n(c.body, e.target.value) })
            else patchContent({ copyright: setI18n(c.copyright, e.target.value) })
          }}
        />
      </label>

      <label className="block text-xs text-slate-400">
        Pulsante
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={i18n(cta.label)}
          onChange={(e) => patchContent({ cta: { ...cta, label: setI18n(cta.label, e.target.value) } })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Link pulsante
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={cta.href || ''}
          onChange={(e) => patchContent({ cta: { ...cta, href: e.target.value } })}
        />
      </label>

      <label className="block text-xs text-slate-400">
        ID immagine (media)
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(c.mediaId || c.logoMediaId || '')}
          onChange={(e) => patchContent({ mediaId: e.target.value || null })}
        />
      </label>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-xs text-slate-400">
          Sfondo
          <input type="color" className="block mt-1 w-full h-8 bg-transparent" value={String(d.backgroundColor || '#ffffff')} onChange={(e) => patchDesign({ backgroundColor: e.target.value })} />
        </label>
        <label className="text-xs text-slate-400">
          Testo
          <input type="color" className="block mt-1 w-full h-8 bg-transparent" value={String(d.textColor || '#1a1a1a')} onChange={(e) => patchDesign({ textColor: e.target.value })} />
        </label>
        <label className="text-xs text-slate-400">
          Accento
          <input type="color" className="block mt-1 w-full h-8 bg-transparent" value={String(d.accentColor || '#c9a227')} onChange={(e) => patchDesign({ accentColor: e.target.value })} />
        </label>
        <label className="text-xs text-slate-400">
          Bordo
          <input type="color" className="block mt-1 w-full h-8 bg-transparent" value={String(d.borderColor || '#000000')} onChange={(e) => patchDesign({ borderColor: e.target.value })} />
        </label>
      </div>

      <label className="block text-xs text-slate-400">
        Font
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(d.fontFamily || '')}
          onChange={(e) => patchDesign({ fontFamily: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Dimensione
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(d.fontSize || '')}
          onChange={(e) => patchDesign({ fontSize: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Raggio bordo
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(d.borderRadius || '')}
          onChange={(e) => patchDesign({ borderRadius: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Spessore bordo
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(d.borderWidth || '')}
          onChange={(e) => patchDesign({ borderWidth: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Margine
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(l.margin || '')}
          onChange={(e) => patchLayout({ margin: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Padding
        <input
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(l.padding || '')}
          onChange={(e) => patchLayout({ padding: e.target.value })}
        />
      </label>
      <label className="block text-xs text-slate-400">
        Allineamento
        <select
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={String(l.alignment || 'center')}
          onChange={(e) => patchLayout({ alignment: e.target.value })}
        >
          <option value="left">Sinistra</option>
          <option value="center">Centro</option>
          <option value="right">Destra</option>
          <option value="stretch">Larghezza</option>
        </select>
      </label>
      <label className="block text-xs text-slate-400">
        Colonne layout
        <input
          type="number"
          min={1}
          max={12}
          className="mt-1 w-full bg-surface-950 rounded px-2 py-1 border border-white/10 text-white"
          value={Number(l.columns || 1)}
          onChange={(e) => patchLayout({ columns: Number(e.target.value) })}
        />
      </label>

      <div className="space-y-1">
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={s.visibleDesktop !== false} onChange={(e) => patchSettings({ visibleDesktop: e.target.checked })} />
          Visibile desktop
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={s.visibleTablet !== false} onChange={(e) => patchSettings({ visibleTablet: e.target.checked })} />
          Visibile tablet
        </label>
        <label className="flex items-center gap-2 text-xs">
          <input type="checkbox" checked={s.visibleMobile !== false} onChange={(e) => patchSettings({ visibleMobile: e.target.checked })} />
          Visibile mobile
        </label>
      </div>
    </div>
  )
}
