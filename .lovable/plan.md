

## Plan: Design-System Grundkonfiguration

Das Projekt existiert bereits mit React, TypeScript, Tailwind, shadcn/ui und React Router. Folgende Anpassungen werden vorgenommen:

### 1. Google Fonts Import (Inter)
- Inter Font via Google Fonts in `index.html` einbinden

### 2. CSS Design-System Variablen (`index.css`)
- Alle Farbvariablen auf die neuen Werte setzen (Primary Blue, App Background, etc.)
- Zusätzliche Custom-Variablen für Success, Warning, Danger, Info definieren
- Typografie-Klassen für die verschiedenen Größenstufen anlegen

### 3. Tailwind Config (`tailwind.config.ts`)
- Neue Farben (success, warning, danger, info, app-bg, etc.) registrieren
- Font-Family auf Inter setzen
- Typografie-Utilities für die definierten Stufen ergänzen

### 4. Index-Seite bereinigen
- Platzhalter-Seite durch minimale leere Seite mit App-Background ersetzen

