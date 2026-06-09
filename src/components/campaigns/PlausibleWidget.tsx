import * as React from 'react'
import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { usePlausibleStats } from '@/hooks/usePlausibleStats'
import { supabase } from '@/integrations/supabase/client'
import { BarChart2, Mail, Users, TrendingUp, Percent } from 'lucide-react'

interface Props {
  site: 'werteraum-schule.de' | 'viktoria-roadshow.com'
}

interface ContactRef {
  id: string
  first_name: string | null
  last_name: string | null
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold">{value}</p>
    </div>
  )
}

// Plausible's utm_content carries the 8-char hex first segment of a contact UUID.
// PostgREST cannot ILIKE a uuid column (42883), so resolve each prefix via a gte/lt
// range over synthetic UUID bounds — see memory postgrest_uuid_like_range_lookup.
// contacts is RLS-protected → the session `supabase` client (carries auth.uid()) only,
// never the anon supabaseEIC (→ 401). Same rule as the deals/contacts reads on this page.
async function resolveContacts(prefixes: string[]): Promise<Record<string, ContactRef>> {
  const out: Record<string, ContactRef> = {}
  await Promise.all(
    prefixes.map(async (raw) => {
      const utm = raw.toLowerCase()
      if (!/^[0-9a-f]{8}$/.test(utm)) return // non-contact source (Direct, campaign name, …)
      const nextHex = (parseInt(utm, 16) + 1).toString(16).padStart(8, '0')
      if (nextHex.length !== 8) return // utm === "ffffffff": no valid upper bound
      const { data } = await (supabase as any)
        .from('contacts')
        .select('id, first_name, last_name')
        .gte('id', `${utm}-0000-0000-0000-000000000000`)
        .lt('id', `${nextHex}-0000-0000-0000-000000000000`)
        .limit(1)
      if (data && data[0]) out[raw] = data[0] as ContactRef
    })
  )
  return out
}

export function PlausibleWidget({ site }: Props) {
  const { visitors, visits, email_visitors, top_utm_contents, loading, error } = usePlausibleStats(site)
  const navigate = useNavigate()

  const prefixes = top_utm_contents.map((t) => t.utm_content)
  const { data: contacts = {} } = useQuery({
    queryKey: ['plausible', 'utm_contacts', site, prefixes],
    queryFn: () => resolveContacts(prefixes),
    enabled: prefixes.length > 0,
  })

  if (loading) return <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-48" />
  if (error) return <div className="rounded-lg border border-destructive bg-card p-4 text-sm text-destructive">Plausible: {error}</div>

  const emailQuote = visitors > 0 ? Math.round((email_visitors / visitors) * 100) : 0

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <BarChart2 className="h-4 w-4" />
        Analytics · {site} · 30 Tage
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile icon={<Users className="h-3 w-3" />} label="Unique Visitors" value={visitors.toLocaleString('de-DE')} />
        <StatTile icon={<TrendingUp className="h-3 w-3" />} label="Visits" value={visits.toLocaleString('de-DE')} />
        <StatTile icon={<Mail className="h-3 w-3" />} label="Via E-Mail" value={email_visitors.toLocaleString('de-DE')} />
        <StatTile icon={<Percent className="h-3 w-3" />} label="E-Mail-Quote" value={`${emailQuote}%`} />
      </div>
      {top_utm_contents.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Top Kontakte via Link</p>
          <div className="space-y-1">
            {top_utm_contents.map((item) => {
              const contact = contacts[item.utm_content]
              const name = contact
                ? [contact.first_name, contact.last_name].filter(Boolean).join(' ').trim() || item.utm_content
                : item.utm_content
              return (
                <div
                  key={item.utm_content}
                  className={`flex items-center justify-between text-xs py-1 px-2 rounded ${
                    contact ? 'cursor-pointer hover:bg-muted/50' : ''
                  }`}
                  onClick={contact ? () => navigate(`/contacts/${contact.id}`) : undefined}
                >
                  <span className={contact ? 'text-foreground' : 'font-mono text-muted-foreground'}>{name}</span>
                  <span className="font-medium">{item.visitors} Besucher</span>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
