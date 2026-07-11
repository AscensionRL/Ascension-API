# Auth-Setup & OAuth-Anleitung

Session-basierte Authentifizierung (E-Mail/Passwort + Discord/Google OAuth).
Sessions liegen in **Redis**, der Client bekommt ein **httpOnly-Cookie** (`sid`).

## Starten

Voraussetzung: PostgreSQL + Redis laufen (Docker), Werte in `.env` stimmen.

```bash
cd backend
npm run start:dev        # Dev mit Watch  → http://localhost:3000/api
```

Hinweis: Die `.tsbuildinfo` liegt jetzt unter `dist/.tsbuildinfo`
(via `tsBuildInfoFile` in `tsconfig.json`) und wird von `deleteOutDir`
mitgelöscht. Dadurch schreibt `nest build`/`start:dev` immer sauber nach
`dist/` – der frühere „Cannot find module dist/main"-Fehler tritt nicht mehr auf.

Frontend:
```bash
cd frontend
npm run dev              # nutzt VITE_API_URL aus .env (http://localhost:3000)
```

Für OAuth muss das Frontend unter der in `.env` gesetzten `FRONTEND_URL`
(`http://localhost:5173`) laufen, weil der Callback dorthin zurückleitet.

## API-Endpunkte

| Methode | Pfad                          | Zweck                                  |
|---------|-------------------------------|----------------------------------------|
| POST    | `/api/auth/register`          | `{ username, email, password, epicName? }` |
| POST    | `/api/auth/login`             | `{ identifier, password }` (E-Mail oder Username) |
| POST    | `/api/auth/logout`            | Session beenden                        |
| GET     | `/api/auth/me`                | Aktueller Nutzer (401 wenn nicht angemeldet) |
| GET     | `/api/auth/discord`           | Startet Discord-Login                  |
| GET     | `/api/auth/discord/callback`  | Discord-Rücksprung                     |
| GET     | `/api/auth/google`            | Startet Google-Login                   |
| GET     | `/api/auth/google/callback`   | Google-Rücksprung                      |

## Discord OAuth

Die Discord-Credentials sind bereits in `.env` hinterlegt. Wichtig ist nur, dass
im [Discord Developer Portal](https://discord.com/developers/applications) unter
**OAuth2 → Redirects** exakt diese URL eingetragen ist:

```
http://localhost:3000/api/auth/discord/callback
```

Scopes werden vom Backend gesetzt (`identify email`) — nichts weiter nötig.

## Google OAuth (noch einzurichten)

In `.env` sind aktuell Platzhalter. So bekommst du echte Werte:

1. [Google Cloud Console](https://console.cloud.google.com/) → Projekt anlegen/wählen.
2. **APIs & Services → OAuth consent screen** einrichten (External, Testnutzer = deine Mail).
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**.
4. Typ **Web application**.
5. Unter **Authorized redirect URIs** eintragen:
   ```
   http://localhost:3000/api/auth/google/callback
   ```
6. Client-ID und Client-Secret kopieren und in `.env` setzen:
   ```
   GOOGLE_CLIENT_ID=...
   GOOGLE_CLIENT_SECRET=...
   GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
   ```
7. Backend neu starten.

## Verhalten bei OAuth

- Bereits per Provider-ID verknüpft → direkter Login.
- Gleiche E-Mail vorhanden → Account wird verknüpft (Discord/Google an bestehendes Konto).
- Sonst → neuer Account mit eindeutig generiertem Benutzernamen.
- Bei Erfolg: Redirect nach `FRONTEND_URL/dashboard`.
- Bei Fehler: Redirect nach `FRONTEND_URL/?auth_error=<provider>`.

## 2FA – E-Mail-Versand (SMTP)

Die Authenticator-Variante (TOTP) läuft ohne Zusatz. Für **Code-per-Mail**
brauchst du einen SMTP-Zugang in der `.env`:

```
SMTP_HOST=smtp.deinprovider.de
SMTP_PORT=587
SMTP_SECURE=false        # true bei Port 465
SMTP_USER=login@deinedomain.de
SMTP_PASS=dein-passwort
SMTP_FROM=Ascension <no-reply@ascension-dach.org>
```

Ohne SMTP-Konfig wird der 2FA-Code **nur im Backend-Log** ausgegeben
(`[Kein SMTP konfiguriert] 2FA-Code für …`) – praktisch zum Testen, aber
es geht keine echte Mail raus. Das Mail-Design liegt in
`src/mail/templates/2fa-code.html`.

## Für Produktion beachten

- `NODE_ENV=production` setzen → Cookie wird `secure` (nur HTTPS).
- CORS in `main.ts` ist im Dev bewusst offen für `localhost:*`; für Produktion
  auf die echte Domain beschränken.
- `synchronize: true` (TypeORM) nur im Dev lassen — für Produktion Migrationen nutzen.
