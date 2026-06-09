import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const PLAUSIBLE_KEY = Deno.env.get('PLAUSIBLE_API_KEY')
  if (!PLAUSIBLE_KEY) return new Response('Missing key', { status: 500, headers: CORS })

  const url = new URL(req.url)
  const site = url.searchParams.get('site') ?? 'werteraum-schule.de'
  const period = url.searchParams.get('period') ?? '30d'
  const base = 'https://plausible.io/api/v1/stats'
  const headers = { Authorization: `Bearer ${PLAUSIBLE_KEY}` }

  const [aggRes, breakdownRes, sourceRes] = await Promise.all([
    fetch(`${base}/aggregate?site_id=${site}&period=${period}&metrics=visitors,visits,pageviews,bounce_rate`, { headers }),
    fetch(`${base}/breakdown?site_id=${site}&period=${period}&property=visit:utm_content&metrics=visitors&limit=5`, { headers }),
    fetch(`${base}/breakdown?site_id=${site}&period=${period}&property=visit:source&metrics=visitors&limit=50`, { headers }),
  ])

  const [agg, breakdown, sources] = await Promise.all([aggRes.json(), breakdownRes.json(), sourceRes.json()])

  const emailVisits = sources?.results?.find(
    (r: { source: string }) => r.source?.toLowerCase().includes('email')
  )?.visitors ?? 0

  return new Response(
    JSON.stringify({
      aggregate: agg?.results ?? {},
      email_visitors: emailVisits,
      top_utm_contents: breakdown?.results ?? [],
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } }
  )
})
