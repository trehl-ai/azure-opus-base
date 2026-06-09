import { useState, useEffect } from 'react'

interface PlausibleStats {
  visitors: number
  visits: number
  email_visitors: number
  top_utm_contents: Array<{ utm_content: string; visitors: number }>
  loading: boolean
  error: string | null
}

export function usePlausibleStats(site: 'werteraum-schule.de' | 'viktoria-roadshow.com'): PlausibleStats {
  const [data, setData] = useState({ visitors: 0, visits: 0, email_visitors: 0, top_utm_contents: [] as Array<{ utm_content: string; visitors: number }> })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetch(
      `https://ttgvhqygmgtnjgwunuwz.supabase.co/functions/v1/plausible-stats?site=${site}&period=30d`
    )
      .then((r) => r.json())
      .then((json) => {
        if (cancelled) return
        setData({
          visitors: json.aggregate?.visitors?.value ?? 0,
          visits: json.aggregate?.visits?.value ?? 0,
          email_visitors: json.email_visitors ?? 0,
          top_utm_contents: json.top_utm_contents ?? [],
        })
      })
      .catch((e) => { if (!cancelled) setError(e.message) })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [site])

  return { ...data, loading, error }
}
