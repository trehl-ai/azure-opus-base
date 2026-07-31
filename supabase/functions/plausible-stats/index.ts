import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE = 'https://plausible.io/api/v1/stats'

type Abruf = {
  name: string
  ok: boolean
  status: number
  daten: unknown
  meldung?: string
}

/**
 * Ein Abruf gegen die Plausible Stats API.
 *
 * Wichtig: Fehler werden NICHT verschluckt. Die Vorgaengerfassung schrieb
 * `agg?.results ?? {}` — ein 402 (Abo abgelaufen) oder 401 (Key tot) wurde damit
 * zu Nullen, ununterscheidbar von "keine Besucher". Genau daran ist die Messung
 * bis zum 31.07.2026 unbemerkt gescheitert.
 */
async function hole(name: string, pfad: string, headers: HeadersInit): Promise<Abruf> {
  try {
    const r = await fetch(`${BASE}/${pfad}`, { headers })
    const txt = await r.text()
    let daten: unknown = null
    try { daten = JSON.parse(txt) } catch { /* kein JSON */ }
    if (!r.ok) {
      const m = (daten as { error?: string })?.error ?? txt.slice(0, 200)
      return { name, ok: false, status: r.status, daten: null, meldung: m }
    }
    return { name, ok: true, status: r.status, daten }
  } catch (e) {
    return { name, ok: false, status: 0, daten: null, meldung: String(e).slice(0, 200) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  const PLAUSIBLE_KEY = Deno.env.get('PLAUSIBLE_API_KEY')
  if (!PLAUSIBLE_KEY) {
    return new Response(
      JSON.stringify({ status: 'api_fehler', hinweis: 'PLAUSIBLE_API_KEY fehlt im Function-Secret.', fehler: [] }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } },
    )
  }

  const url = new URL(req.url)
  const site = url.searchParams.get('site') ?? 'werteraum-schule.de'
  const period = url.searchParams.get('period') ?? '30d'
  // Optionaler Kampagnenfilter — traegt Ebene 3 (eine Landeswelle einzeln auswerten).
  const campaign = url.searchParams.get('campaign')

  const headers = { Authorization: `Bearer ${PLAUSIBLE_KEY}` }
  const q = `site_id=${encodeURIComponent(site)}&period=${encodeURIComponent(period)}`
  const filter = campaign
    ? `&filters=${encodeURIComponent(`visit:utm_campaign==${campaign}`)}`
    : ''

  const abrufe = await Promise.all([
    hole('aggregate',     `aggregate?${q}${filter}&metrics=visitors,visits,pageviews,bounce_rate,visit_duration`, headers),
    hole('timeseries',    `timeseries?${q}${filter}&metrics=visitors,pageviews`, headers),
    hole('utm_campaigns', `breakdown?${q}${filter}&property=visit:utm_campaign&metrics=visitors,pageviews&limit=100`, headers),
    hole('utm_contents',  `breakdown?${q}${filter}&property=visit:utm_content&metrics=visitors&limit=100`, headers),
    hole('sources',       `breakdown?${q}${filter}&property=visit:source&metrics=visitors&limit=50`, headers),
    hole('pages',         `breakdown?${q}${filter}&property=event:page&metrics=visitors,pageviews&limit=20`, headers),
    hole('devices',       `breakdown?${q}${filter}&property=visit:device&metrics=visitors&limit=10`, headers),
  ])

  const nach = (n: string) => abrufe.find((a) => a.name === n)
  const ergebnisse = (n: string) =>
    ((nach(n)?.daten as { results?: unknown[] })?.results ?? []) as Array<Record<string, unknown>>

  const aggregate = ((nach('aggregate')?.daten as { results?: Record<string, { value: number }> })?.results) ?? {}
  const fehler = abrufe.filter((a) => !a.ok).map((a) => ({ abruf: a.name, status: a.status, meldung: a.meldung }))

  const pageviews = aggregate?.pageviews?.value ?? 0

  // Drei klar unterscheidbare Zustaende statt einer stillen Null.
  let status: 'ok' | 'api_fehler' | 'keine_daten' = 'ok'
  let hinweis: string | null = null
  if (fehler.length > 0) {
    status = 'api_fehler'
    hinweis = `Plausible antwortet nicht sauber (${fehler.map((f) => `${f.abruf}:${f.status}`).join(', ')}). `
      + `Bei 402 fehlt das Abo, bei 401 ist der API-Key tot.`
  } else if (pageviews === 0) {
    status = 'keine_daten'
    hinweis = `Die API antwortet, meldet aber 0 Seitenaufrufe fuer ${site} im Zeitraum ${period}. `
      + `Haeufigste Ursache: die Seite traegt kein Plausible-Script. Pruefen mit `
      + `"curl -s https://${site}/ | grep -i plausible".`
  }

  const emailVisitors = ergebnisse('sources')
    .filter((r) => String(r.source ?? '').toLowerCase().includes('email'))
    .reduce((s, r) => s + Number(r.visitors ?? 0), 0)

  return new Response(
    JSON.stringify({
      site,
      period,
      campaign,
      status,
      hinweis,
      fehler,
      // --- ab hier abwaertskompatibel zu usePlausibleStats.ts ---
      aggregate,
      email_visitors: emailVisitors,
      top_utm_contents: ergebnisse('utm_contents'),
      // --- neu ---
      timeseries: ergebnisse('timeseries'),
      utm_campaigns: ergebnisse('utm_campaigns'),
      sources: ergebnisse('sources'),
      pages: ergebnisse('pages'),
      devices: ergebnisse('devices'),
    }),
    { headers: { ...CORS, 'Content-Type': 'application/json' } },
  )
})
