-- Backfilled from live DB (ttgvhqygmgtnjgwunuwz) schema_migrations on 2026-06-08.
-- Originally applied out-of-band (Lovable/dashboard/MCP); committed to close schema-drift-check.


INSERT INTO eis_knowledge_entries (type, title, content, summary, tags) VALUES

-- TESTIMONIALS
('testimonial', 'Philipp Lahm — Botschafter', 
'Philipp Lahm ist Weltmeister 2014, Kapitän der deutschen Nationalmannschaft und einer der glaubwürdigsten Sportbotschafter Deutschlands. Seine Philipp Lahm Stiftung fördert Bildung und Integration durch Sport. Lahm steht für Fairplay, Teamgeist, Respekt und gesellschaftliche Verantwortung. Ideal für Sponsoren aus Automotive, Banking, Versicherung und Pharma, die CSR-Glaubwürdigkeit suchen. Roadshow-Format: Schulbesuche mit interaktiven Sport-Werte-Einheiten für Grundschüler. Reichweite: Schüler, Lehrer, Eltern, regionale Medien. Ticket: €50K–€150K je nach Paket (Laufzeit, Regionen, Medienrechte).',
'Philipp Lahm: Weltmeister, Stiftungsgründer, Werte-Botschafter. Roadshow Schulen. Ticket €50K–€150K.',
ARRAY['philipp_lahm','human_branding','testimonial','schulen','sport','csr','werte']),

('testimonial', 'Viktoria Rebensburg — Botschafterin',
'Viktoria Rebensburg ist Olympiasiegerin 2010 (Riesenslalom), mehrfache Weltcupsiegerin im Ski Alpin und eine der bekanntesten deutschen Wintersportlerinnen. Aktuelle Kampagnenschwerpunkte: MINT-Förderung, Nachhaltigkeit im Sport, Frauen im Sport. Starke Affinität zu Automotive (Sportlichkeit, Präzision), Outdoor-Brands, Versicherungen, Banken. Roadshow-Format: Schulbesuche Bayern/Süddeutschland + ausgewählte Bundesländer. Mediale Wirkung: TV-Präsenz, Social Media (Instagram, YouTube). Ticket: €50K–€100K.',
'Viktoria Rebensburg: Olympiasiegerin Ski, MINT + Nachhaltigkeit. Roadshow Bayern. Ticket €50K–€100K.',
ARRAY['viktoria_rebensburg','human_branding','testimonial','ski','mint','nachhaltigkeit','frauen_sport']),

-- ROADSHOW FORMATE
('roadshow_format', 'Roadshow Schulen — Basispaket',
'Kernformat der Human Branding Roadshows. Dauer: 1 Schultag pro Standort (4–6 Stunden). Zielgruppe: Grundschüler Klasse 3–4 (ca. 60–120 Kinder pro Standort). Inhalt: Interaktive Einheiten mit Testimonial-Botschafter, Spiel-Sport-Parcours, Wertevermittlung (Teamgeist, Respekt, Fairplay, Mut). Mediales Paket: Fotograf, Pressemitteilung, Social Media Content (Reel, Stories). Sponsor-Visibility: Branding auf allen Materialien, Backdrop, Trikots, Rollups. Anzahl Standorte Standard: 10–15 pro Saison. Regionen: Bayern, BW, NRW buchbar.',
'Basispaket: 10–15 Schulen, 1 Tag/Standort, 60–120 Kinder, Testimonial, Medienpaket, Sponsor-Branding.',
ARRAY['roadshow','schulen','format','grundschule','sport','werte','branding']),

('roadshow_format', 'Roadshow Schulen — Premium-Paket',
'Erweitertes Format mit exklusiver Sponsor-Integration. Zusätzlich zu Basispaket: Namentliche Benennung der Roadshow nach Sponsor (z.B. "Porsche 4Kids Erlebniswelt"), Sponsor-Exponat/Activation im Parcours, Zugang zu Schülerdaten für CSR-Reporting (aggregiert, DSGVO-konform), Jahresbericht mit Wirkungsmessung (Recall, Awareness, Reichweite). Exklusivität: nur 1 Hauptsponsor pro Saison je Testimonial. Ticket: €100K–€150K. Ideal für: Automotive (Porsche, BMW, Mercedes), Pharma (MSD, Roche), Versicherung (Allianz).',
'Premium: exklusive Namensnennung, eigenes Exponat, CSR-Reporting, 1 Hauptsponsor. Ticket €100K–€150K.',
ARRAY['roadshow','premium','exklusiv','sponsor','csr_reporting','automotive','pharma']),

-- THEMEN
('thema', 'MINT-Förderung an Schulen',
'Mathmatik, Informatik, Naturwissenschaften, Technik — MINT ist der strategische Schwerpunkt für Tech-Unternehmen, Automotive und Pharma im CSR. Roadshow-Integration: Interaktive MINT-Parcours mit Testimonial-Kontext (z.B. Rebensburg: Physik des Ski-Fahrens, Trägheit, Aerodynamik). Sponsor-Fit: BMW, Porsche, T-Systems, MSD, Roche, Siemens. KPI-Nachweise möglich: Anzahl Kinder erreicht, Lehrer-Befragungen, Medienecho.',
'MINT-Förderung via Roadshow. Fit: Automotive, Tech, Pharma. Messbarer CSR-Impact.',
ARRAY['mint','bildung','csr','automotive','pharma','tech','schule']),

('thema', 'Werte & Demokratie — Gesellschaftliche Verantwortung',
'Roadshows zu Teamgeist, Respekt, Fairplay, Zusammenhalt. Besonders relevant nach gesellschaftlichen Spannungen (Post-Corona, Polarisierung). Testimonial-Fit: Philipp Lahm (Lahm Stiftung). Sponsor-Fit: Versicherungen (Allianz, AOK), Banken, Beratung (EY), Pharma. CSR-Narrativ: "Wir investieren in den Zusammenhalt der Gesellschaft." Wird von Kommunen und Bildungsministerien positiv begleitet → erhöhte Pressereichweite.',
'Werte/Demokratie Roadshow. Lahm-Fit. Sponsor: Versicherung, Bank, Beratung. Stark in Pressereichweite.',
ARRAY['werte','demokratie','respekt','teamgeist','csr','lahm','versicherung','beratung']),

('thema', 'Nachhaltigkeit & Sport',
'Verbindung von sportlicher Leistung und Umweltverantwortung. Testimonial-Fit: Rebensburg (Skifahren, Natur, Klimawandel im Hochgebirge). Format: Roadshow + Natur-Parcours, Klimaschutz-Botschaft verpackt in Sport. Sponsor-Fit: Automotive (E-Mobilität-Narrative), Energie (E.ON, EnBW), FMCG (Nachhaltigkeit der Produktionskette). Mediales Potenzial: Umweltministerien, Green-Media, regionale TV.',
'Nachhaltigkeit + Sport. Rebensburg-Fit. Automotive E-Mobilität, Energie, FMCG. Grüne Medienreichweite.',
ARRAY['nachhaltigkeit','sport','klimaschutz','rebensburg','automotive','energie','fmcg']),

-- REFERENZKUNDEN
('referenz_kunde', 'Porsche AG — Porsche 4Kids Erlebniswelt',
'Langjähriger eo ipso Referenzkunde im Bereich Marken- & Themenwelten. Porsche 4Kids: Erlebniswelt für Kinder an Events und Roadshows. eo ipso konzipiert und operiert das gesamte Erlebnisformat. Signalwirkung für neue Sponsoren: wenn Porsche vertraut, ist die Qualität gesetzt. Verwendbar als Referenz in Pitch-Präsentationen für alle Automotive-Sponsoren.',
'Porsche 4Kids: eo ipso Referenz Automotive. Erlebniswelt Kinder. Trust-Signal für neue Automotive-Sponsoren.',
ARRAY['porsche','automotive','referenz','themenwelt','kinder','trust_signal']),

('referenz_kunde', 'BMW — Junior Campus IAA',
'BMW Junior Campus auf der IAA: mobile Erlebniswelt für Kinder, entwickelt und umgesetzt von eo ipso. Messekontext + Roadshow-Erweiterung. Beleg für eo ipso Expertise in: großformatigen Live-Formaten, Kinder-Engagement, Automotive-Kontext. Ideal als Referenz für alle Automotive- und Mobilitätssponsoren.',
'BMW IAA Junior Campus: eo ipso mobile Erlebniswelt. Referenz Automotive + große Live-Formate.',
ARRAY['bmw','automotive','referenz','iaa','messe','mobile_erlebniswelt']),

('referenz_kunde', 'MSD — Interaktive Workshops',
'MSD (Merck Sharp & Dohme) als Pharmakunde belegt eo ipso Zugang zum Pharma-Sektor. Interaktive Workshops und Firmenveranstaltungen. Verwendbar als Referenz bei: Roche, Novartis, Bayer, AstraZeneca, GSK — zeigt Verständnis für Pharma-Compliance und sensible Kommunikationsanforderungen.',
'MSD Pharma: eo ipso Referenz für interaktive Formate im regulierten Umfeld.',
ARRAY['msd','pharma','referenz','workshop','compliance','b2b']),

-- PREISLISTE
('preisliste', 'Sponsor-Ticket Übersicht EIS-001',
'Human Branding Roadshow Sponsor-Tickets (Preisindikation, verhandelbar je nach Laufzeit und Exklusivität):
- Basispaket (Co-Sponsor): €50.000 — Logo-Präsenz, Medienpaket, 10 Standorte
- Hauptsponsor-Paket: €75.000–€100.000 — Namensnennung, eigene Activation, 15 Standorte, CSR-Report
- Exklusiv-Paket (1 Sponsor pro Saison): €100.000–€150.000 — Naming Rights, komplette Integration, Medienrechte, Wirkungsmessung
Laufzeit: 1 Saison (März–Juli oder Sep–Dez)
Zahlungsweise: 50% bei Vertragsunterzeichnung, 50% nach Halbzeit
Kombination mehrerer Testimonials: Aufpreis nach Absprache',
'Tickets: Co-Sponsor €50K, Hauptsponsor €75K–€100K, Exklusiv €100K–€150K. 1 Saison.',
ARRAY['preis','ticket','sponsor','paket','roadshow','saison']),

-- PITCH BAUSTEINE
('pitch_baustein', 'CSR-Narrativ: Warum Live-Erlebnisse wirken',
'Studien belegen: Erlebnisbasiertes Lernen hat 3–5x höhere Recall-Raten als klassische Werbung oder Unterrichtsinhalte. Kinder erinnern sich 2 Jahre später noch an erlebnisbasierte Markenkontakte. Eltern nehmen Sponsoren-Botschaft mit Wohlwollen auf, wenn Kinder davon profitieren. Lehrer werden zu Multiplikatoren. Mediale Verlängerung: jeder Schulbesuch = potentielle Pressestory + Social Media Content. Für Pharma und Versicherung besonders relevant: regulierte Branchen können über Education und CSR kommunizieren, wo direkte Werbung eingeschränkt ist.',
'Erlebnismarketing: 3–5x Recall, Eltern als positive Multiplikatoren, Mediale Verlängerung, Pharma/Versicherung CSR-Kanal.',
ARRAY['csr','wirkung','recall','erlebnismarketing','pitch','pharma','versicherung']),

('pitch_baustein', 'Differenzierung vs. klassisches Sponsoring',
'Klassisches Trikot-Sponsoring: passiv, geringe Erinnerungswirkung, austauschbar. eo ipso Human Branding Roadshow: aktiv, emotional, exklusiv. Kinder erleben die Marke — nicht nur das Logo. Testimonial schafft echte Verbindung zwischen Markenwert und menschlicher Geschichte. Employer Branding: Eltern und Lehrer sind potenzielle Kandidaten oder Kunden. Community Goodwill: Bürgermeister, Stadtrat, lokale Medien berichten positiv. Für CMO: differenziertes CSR-Asset, das intern und extern erzählt werden kann.',
'Roadshow vs. Trikot-Sponsoring: aktiv vs. passiv, Erlebnis vs. Logo, exklusiv vs. generisch. Employer Branding + Community Goodwill.',
ARRAY['differenzierung','sponsoring','employer_branding','cmo','pitch','community']);
