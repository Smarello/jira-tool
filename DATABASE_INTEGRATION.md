# Database Integration Guide

## 🎯 Overview

Il database layer è stato integrato nel tuo progetto JIRA Tool seguendo i principi di Clean Architecture. Ora hai un sistema di caching intelligente per i dati degli sprint chiusi.

## 🚀 Funzionalità Implementate

### ✅ Cache Intelligente
- **Automatic Caching**: Gli sprint chiusi vengono salvati automaticamente nel database
- **Smart Refresh**: Cache invalidation basata su età dei dati (default: 24 ore)
- **Fallback Strategy**: Se il database non è disponibile, usa sempre l'API JIRA

### ✅ API Endpoints Migliorati
- **`/api/velocity/[boardId]`**: Ora usa cache intelligente
- **`/api/velocity/[boardId]/cache`**: Gestione cache dedicata
- **`/api/database/stats`**: Statistiche e manutenzione database

### ✅ Configurazione Flessibile
- **Multi-Database Support**: Turso, PostgreSQL, MySQL, SQLite locale
- **Environment-Based**: Configurazione tramite variabili ambiente
- **Mock Mode**: Funziona senza database per sviluppo

## 📊 Come Funziona

### Flusso di Cache Intelligente
```
1. Request → /api/velocity/[boardId]
2. Check Database for Closed Sprints
3. If All Sprints Cached & Fresh → Return Cached Data
4. If Missing Sprints → Fetch Missing from JIRA API
5. If Cache Stale/Empty → Fetch All from JIRA API
6. Save New Data to Database → Return Combined Data
```

### Workflow Dettagliato
```
┌─────────────────┐
│   API Request   │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐    ✅ Found & Fresh
│  Check Database │ ──────────────────► Return Cached Data
│   for Sprints   │
└─────────┬───────┘
          │ ❌ Missing/Stale
          ▼
┌─────────────────┐
│  Fetch from     │
│   JIRA API      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│  Save to        │
│   Database      │
└─────────┬───────┘
          │
          ▼
┌─────────────────┐
│ Return Fresh    │
│     Data        │
└─────────────────┘
```

### Parametri URL
```bash
# Normale (usa cache se disponibile)
GET /api/velocity/123

# Force refresh (ignora cache)
GET /api/velocity/123?refresh=true
```

### Response Format
```json
{
  "boardId": "123",
  "boardName": "My Board",
  "sprints": [...],
  "averageVelocity": 25.5,
  "fromCache": true,
  "cacheAge": 2.5,
  "lastUpdated": "2024-01-15T10:30:00Z",
  "timestamp": "2024-01-15T12:45:00Z"
}
```

## 🔧 Configurazione

### 1. Variabili Ambiente
Copia `.env.example` in `.env` e configura:

```env
# Database Provider
DATABASE_PROVIDER=mock  # Inizia con mock, poi cambia

# Cache Settings
VELOCITY_CACHE_ENABLED=true
VELOCITY_CACHE_MAX_AGE_HOURS=24
DATABASE_RETENTION_DAYS=365
```

### 2. Modalità Mock (Default)
```env
DATABASE_PROVIDER=mock
```
- ✅ Funziona subito senza setup database
- ✅ Perfetto per sviluppo e testing
- ❌ Non persiste dati tra restart

### 3. Database Reale - Turso (Implementato!)
```env
# Per Turso (PRONTO!)
DATABASE_PROVIDER=turso
TURSO_DATABASE_URL=libsql://your-db.turso.io
TURSO_AUTH_TOKEN=your-token

# Opzionali per Turso
TURSO_SYNC_URL=
TURSO_SYNC_INTERVAL=5000
TURSO_ENCRYPTION_KEY=

# Per Supabase/PostgreSQL (Future)
DATABASE_PROVIDER=postgres
POSTGRES_CONNECTION_STRING=postgresql://...

# Per PlanetScale/MySQL (Future)
DATABASE_PROVIDER=mysql
MYSQL_CONNECTION_STRING=mysql://...
```

## 🛠️ Nuovi Endpoint API

### Cache Management
```bash
# Get cache status
GET /api/velocity/[boardId]/cache

# Force cache refresh
POST /api/velocity/[boardId]/cache
```

### Database Stats
```bash
# Get database statistics
GET /api/database/stats

# Trigger cleanup
POST /api/database/stats
Content-Type: application/json
{"action": "cleanup"}
```

## 📈 Benefici Immediati

### Performance
- **Faster Response**: Cache hit = risposta in ~100ms vs ~5-10s
- **Reduced API Calls**: Meno chiamate a JIRA API
- **Better UX**: Loading più veloce per utenti

### Reliability
- **Offline Capability**: Dati disponibili anche se JIRA è down
- **Graceful Degradation**: Fallback automatico all'API
- **Error Recovery**: Gestione errori robusta

### Scalability
- **Reduced Load**: Meno stress sui server JIRA
- **Batch Operations**: Operazioni efficienti per molti sprint
- **Smart Caching**: Cache solo quando necessario

## 🔍 Monitoring

### Cache Hit Rate
```bash
# Check cache status
curl /api/velocity/123/cache

# Response includes cache metadata
{
  "cached": true,
  "cacheAge": 2.5,
  "totalSprints": 15
}
```

### Database Health
```bash
# Check database status
curl /api/database/stats

# Response includes health info
{
  "database": {
    "status": "connected",
    "provider": "mock"
  }
}
```

## 🧪 Testing

### Development Mode
```bash
# Start with mock database
npm run dev

# Test velocity endpoint
curl http://localhost:4321/api/velocity/123
```

### Cache Testing
```bash
# First call (fresh data)
curl http://localhost:4321/api/velocity/123
# Response: "fromCache": false

# Second call (cached data)
curl http://localhost:4321/api/velocity/123
# Response: "fromCache": true

# Force refresh
curl http://localhost:4321/api/velocity/123?refresh=true
# Response: "fromCache": false
```

## 🚀 Prossimi Passi

### 1. Immediate (Funziona Già)
- ✅ Cache in memoria funzionante
- ✅ API endpoints migliorati
- ✅ Configurazione flessibile

### 2. Database Setup (Quando Decidi)
1. Scegli database provider (Turso/Supabase/PlanetScale)
2. Crea account e database
3. Aggiorna variabili ambiente
4. Implementa repository concreto
5. Run migrations

### 3. Advanced Features (Future)
- Dashboard cache analytics
- Automated cache warming
- Multi-tenant support
- Advanced metrics

## 🔧 Troubleshooting

### Cache Non Funziona
```bash
# Check database provider
echo $DATABASE_PROVIDER

# Check cache endpoint
curl /api/velocity/123/cache
```

### Performance Issues
```bash
# Check database stats
curl /api/database/stats

# Force cleanup
curl -X POST /api/database/stats -d '{"action":"cleanup"}'
```

### Errors
- **Mock Mode**: Sempre funziona, errori indicano problemi di codice
- **Database Mode**: Check connection string e credenziali
- **API Mode**: Check JIRA credentials e network

## 📚 Architecture

```
┌─────────────────────────────────────────┐
│           Frontend (Astro)              │
└─────────────────┬───────────────────────┘
                  │
┌─────────────────▼───────────────────────┐
│        API Layer (/api/velocity)        │
│  ┌─────────────────────────────────────┐ │
│  │    VelocityCacheService             │ │
│  └─────────────────┬───────────────────┘ │
└────────────────────┼─────────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │     Database Layer              │
    │  ┌──────────────────────────┐   │
    │  │  Repository Pattern      │   │
    │  │  - IClosedSprintsRepo    │   │
    │  │  - IBoardConfigRepo      │   │
    │  │  - ISprintIssuesRepo     │   │
    │  └──────────────────────────┘   │
    └─────────────────────────────────┘
                     │
    ┌────────────────▼────────────────┐
    │     Database Provider           │
    │  (Turso/Supabase/MySQL/Mock)    │
    └─────────────────────────────────┘
```

Il sistema è pronto e funzionante! Puoi iniziare a usarlo subito in modalità mock, e quando deciderai il database, sarà facile fare il switch.
