

## Context (verificat)

DB-ul are deja **doar** rolurile `owner` și `company_admin` (1 user fiecare, ambele sunt tu). **Nu există date live** — nici studenți, nici enrollments, nici leads, nici alți utilizatori. Deci nu există risc de breaking change pentru utilizatori reali.

Codul însă conține **805 referințe** la `admin_id`/`agent_id` și **370 referințe** la stringurile `"admin"`/`"agent"` răspândite în 31+ fișiere — moștenite din proiectul original B2C.

## Decizia de arhitectură

Mergem pe **rebrand de roluri + curățare chirurgicală**, nu rescriere totală. Modelul ierarhic „Owner → Manager → Subordonat → Studenți" rămâne identic, doar nume noi:

| Vechi | Nou | Sens |
|-------|-----|------|
| `owner` | `owner` | Tu (super admin platformă) |
| `admin` | `branch_manager` | Manager sucursală (în cadrul unei companii partenere) |
| `agent` | `consultant` | Consultant care înrolează studenți |
| — | `company_admin` | Adminul companiei partenere (vede toate sucursalele ei) |

Coloanele DB `admin_id` și `agent_id` rămân ca **nume tehnice** (refactor-ul lor ar însemna 800+ atingeri și ruperea a 5+ funcții/triggere SECURITY DEFINER). Frontend-ul afișează „Branch Manager" / „Consultant".

## Plan de execuție

### 1. Curățare rute & fișiere
- **Șterg** `src/pages/admin/AdminDashboard.tsx` și `src/pages/agent/AgentDashboard.tsx` (înlocuite de `BranchDashboard` / `ConsultantDashboard`).
- **Redenumesc** folderul `src/pages/admin/` → `src/pages/branch/`, `src/pages/agent/` → `src/pages/consultant/`.
- **Șterg** rutele `/admin/*` și `/agent/*` din `App.tsx`. Le înlocuiesc cu `/branch/*` și `/consultant/*` (același set de pagini shared).
- Ajustez `getHomeRoute` din `roles.ts`: `branch_manager` → `/branch/dashboard`, `consultant` → `/consultant/dashboard`.

### 2. Migrare DB (un singur fișier)
- **DROP** valorile `'admin'` și `'agent'` din enum `app_role` (sigur — nu mai sunt rânduri).
- **DROP** `LEGACY_ADMIN` / `LEGACY_AGENT` din `roles.ts` și aliasurile din `DashboardLayout.tsx`.
- **Update** `protect_student_sensitive_fields` și `create_commission_snapshot` să folosească `'consultant'` în loc de `'agent'`.
- **Update** `get_user_role` rămâne neschimbat (returnează orice rol).

### 3. Refactor referințe în cod (search & replace țintit)
Pentru fiecare din cele 31 fișiere cu `=== "admin"` / `=== "agent"`:
- `role === "admin"` → `role === "branch_manager"`
- `role === "agent"` → `role === "consultant"`
- `allowedRoles={["admin", ...]}` → `["branch_manager", ...]`
- Prefixe path: `/admin/...` → `/branch/...`, `/agent/...` → `/consultant/...`
- `recipient_role: "admin"` → `"branch_manager"` (în plăți)

Coloanele `agent_id` / `admin_id` din DB rămân — sunt doar nume de chei, nu afișate utilizatorului.

### 4. UI labels
`getRoleLabel` deja returnează „Branch Manager" / „Consultant" — verific că nu mai apare nicăieri text hardcodat „Admin" sau „Agent" pentru roluri (etichete coloane, badge-uri, butoane).

### 5. Sidebar & navigation
`AppSidebar.tsx` deja are logică pentru `branch_manager`/`consultant`. Elimin ramurile `LEGACY_ADMIN`/`LEGACY_AGENT` adăugate în mesajul anterior.

### 6. Memorie
Actualizez `mem://constraints/live-environment` (nu mai sunt 44 agenți live, e remix curat) și șterg `mem://features/agent-gamification` referirile la „agent" în favoarea „consultant" — sau marchez ca opțional.

## Ce NU schimb
- Schema tabelelor (`students`, `enrollments`, `leads`, `profiles.admin_id` etc.) rămâne neatinsă.
- Logica de comisioane, gamification, notificări — funcționalitatea identică, doar etichete noi.
- Edge functions interne care folosesc `agent_id` ca nume de coloană.

## Riscuri
- **Cod fals-pozitiv**: există stringuri „admin" în context non-rol (ex: „administrative requirements"). Voi face replace cu regex precis (`role\s*===\s*["']admin["']`).
- **Rute vechi bookmark-uite**: nu există utilizatori reali → impact zero.
- Build TS poate evidenția referințe ascunse — le rezolv iterativ până trece `tsc --noEmit`.

## Estimare livrabile
- 1 migration SQL nouă
- ~31 fișiere TSX/TS modificate
- 2 foldere redenumite, 2 fișiere șterse
- `App.tsx`, `roles.ts`, `DashboardLayout.tsx`, `AppSidebar.tsx` curățate de aliasuri legacy
- 1 actualizare memorie

Rezultat: platformă **pur B2B** cu ierarhia Owner → Company Admin → Branch Manager → Consultant, fără urme de „admin"/„agent" în UI sau roluri.

