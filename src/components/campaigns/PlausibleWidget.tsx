import * as React from 'react'
import { usePlausibleStats } from '@/hooks/usePlausibleStats'
import { useNavigate } from 'react-router-dom'
import { BarChart2, Mail, Users, TrendingUp } from 'lucide-react'

interface Props {
  site: 'werteraum-schule.de' | 'viktoria-roadshow.com'
}

function StatTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded bg-muted/40 p-2">
      <div className="flex items-center gap-1 text-muted-foreground mb-1">
        {icon}
        <span className="text-xs">{label}</span>
      </div>
      <p className="text-lg font-bold">{value.toLocaleString('de-DE')}</p>
    </div>
  )
}

export function PlausibleWidget({ site }: Props) {
  const { visitors, visits, email_visitors, top_utm_contents, loading, error } = usePlausibleStats(site)
  const navigate = useNavigate()

  if (loading) return <div className="rounded-lg border border-border bg-card p-4 animate-pulse h-48" />
  if (error) return <div className="rounded-lg border border-destructive bg-card p-4 text-sm text-destructive">Plausible: {error}</div>

  return (
    <div className="rounded-lg border border-border bg-card p-4 space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-muted-foreground">
        <BarChart2 className="h-4 w-4" />
        Analytics · {site} · 30 Tage
      </div>
      <div className="grid grid-cols-3 gap-3">
        <StatTile icon={<Users className="h-3 w-3" />} label="Unique Visitors" value={visitors} />
        <StatTile icon={<TrendingUp className="h-3 w-3" />} label="Visits" value={visits} />
        <StatTile icon={<Mail className="h-3 w-3" />} label="Via E-Mail" value={email_visitors} />
      </div>
      {top_utm_contents.length > 0 && (
        <div>
          <p className="text-xs text-muted-foreground mb-2">Top UTM Contents</p>
          <div className="space-y-1">
            {top_utm_contents.map((item) => (
              <div
                key={item.utm_content}
                className="flex items-center justify-between text-xs cursor-pointer hover:text-primary"
                onClick={() => navigate(`/contacts/${item.utm_content}`)}
              >
                <span className="font-mono text-muted-foreground">{item.utm_content}</span>
                <span className="font-medium">{item.visitors} Besucher</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
