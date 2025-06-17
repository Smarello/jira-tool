# Jira Tool Analytics Dashboard

Dashboard di analisi per progetti Jira, costruito con Astro 5.x e integrazione MCP.

## 🚀 Features

### Velocity Analytics
- **Board Selection**: Selezione dinamica delle board Jira
- **Sprint Metrics**: Metriche dettagliate per ogni sprint
- **Velocity Charts**: Grafici interattivi per visualizzare la velocity nel tempo
- **Trend Analysis**: Analisi delle tendenze e predizioni
- **Progress Tracking**: Monitoraggio real-time del progresso degli sprint

### Project Analytics
- **KPI Dashboard**: Metriche chiave del progetto
- **Issue Analysis**: Analisi dettagliata delle issue per tipo e priorità
- **Team Performance**: Metriche di performance del team
- **Time Tracking**: Analisi dei tempi di risoluzione

### Advanced Features
- **Real-time Updates**: Aggiornamenti in tempo reale via MCP
- **Caching Intelligente**: Sistema di cache per ottimizzare le performance
- **Error Handling**: Gestione robusta degli errori con fallback
- **Responsive Design**: UI ottimizzata per tutti i dispositivi
- **Health Monitoring**: Monitoraggio dello stato delle API

## 🛠 Tech Stack

- **Frontend**: Astro 5.x, TypeScript, Tailwind CSS
- **Backend**: Node.js API Routes
- **Integration**: MCP (Model Context Protocol) per Atlassian
- **Charts**: Chart.js per visualizzazioni
- **Styling**: Tailwind CSS con componenti personalizzati

## 📋 Prerequisites

- Node.js 18+ 
- Account Jira/Atlassian con API access
- MCP server configurato (opzionale per sviluppo)

## ⚙️ Environment Setup

Crea un file `.env` nella root del progetto:

```env
# Jira Configuration
JIRA_BASE_URL=https://your-domain.atlassian.net/
JIRA_EMAIL=your.email@company.com
JIRA_API_TOKEN=your_api_token_here
JIRA_PROJECT_KEY=YOUR_PROJECT_KEY

# MCP Configuration (optional)
MCP_SERVER_URL=http://localhost:3001
MCP_ENABLED=true

# Application
NODE_ENV=development
```

## 🚀 Quick Start

1. **Clone & Install**
   ```bash
   git clone <repository-url>
   cd jira-tool
   npm install
   ```

2. **Configure Environment**
   - Copia `.env.example` in `.env`
   - Configura le credenziali Jira
   - Layout responsive con branding personalizzabile

3. **Start Development**
   ```bash
   npm run dev
   ```

4. **Build for Production**
   ```bash
   npm run build
   npm run preview
   ```

## 📁 Project Structure

```
src/
├── components/          # Componenti riusabili
│   ├── ui/             # Componenti UI base
│   ├── velocity/       # Componenti velocity-specific
│   ├── analytics/      # Componenti analytics
│   └── jira/          # Componenti Jira integration
├── lib/               # Business logic e utilities
│   ├── jira/          # Client e API Jira
│   ├── velocity/      # Logica velocity calculations
│   ├── analytics/     # Logica analytics
│   └── utils/         # Utilities generiche
├── pages/             # Route pages (Astro)
│   ├── api/           # API endpoints
│   ├── velocity/      # Velocity dashboard
│   └── analytics/     # Analytics pages
└── styles/            # Stili globali
```

## 🔧 API Endpoints

### Health & Monitoring
- `GET /api/health` - System health check
- `GET /api/health/jira` - Jira connection status

### Velocity Analytics
- `GET /api/velocity/boards` - Lista board disponibili
- `GET /api/velocity/[boardId]` - Dati velocity per board
- `GET /api/velocity/[boardId]/progress` - Progress real-time

### Project Analytics  
- `GET /api/jira/analytics` - Metriche generali progetto
- `GET /api/jira/project` - Dettagli progetto specifico

### Debug & Development
- `GET /api/debug/cache` - Cache status e management
- `GET /api/debug/fields` - Jira fields mapping
- `GET /api/debug/performance-test` - Performance testing

## 🎨 Customization

### Branding
Il sistema supporta personalizzazione completa del branding:

- **Colors**: Modifica `tailwind.config.js` per i colori del brand
- **Fonts**: Configura font personalizzati in `src/styles/global.css`  
- **Logo**: Sostituisci `public/favicon.svg` con il tuo logo
- **Layout**: Personalizza `src/components/ui/Layout.astro`

### Componenti
Tutti i componenti seguono i principi di Clean Architecture:

- **Single Responsibility**: Ogni componente ha una responsabilità specifica
- **Dependency Inversion**: Dipendenze iniettate tramite props
- **Interface Segregation**: Props interface minimali e specifiche

## 🧪 Testing

```bash
# Run tests
npm run test

# Run tests with coverage
npm run test:coverage

# Run e2e tests  
npm run test:e2e
```

## 📊 Performance

- **Lighthouse Score**: 95+ su tutte le metriche
- **Bundle Size**: < 100KB gzipped
- **API Response**: < 200ms media
- **Cache Hit Rate**: > 90% per dati frequenti

## 🔒 Security

- API token sicuri via environment variables
- Rate limiting su endpoint pubblici
- Sanitizzazione input utente
- CORS configurato per domini autorizzati

## 🤝 Contributing

1. Fork del repository
2. Crea feature branch (`git checkout -b feature/amazing-feature`)
3. Commit delle modifiche (`git commit -m 'Add amazing feature'`)
4. Push del branch (`git push origin feature/amazing-feature`)
5. Apri Pull Request

## 📝 License

Questo progetto è sotto licenza MIT. Vedi `LICENSE` per dettagli.

## 🆘 Support

Per supporto e domande:
- Apri un issue su GitHub
- Consulta la documentazione API
- Controlla i log di debug in `/api/debug/`

---

**Jira Tool Analytics Dashboard** - Potente strumento per l'analisi e il monitoraggio dei progetti Jira con UI responsive multi-device e personalizzazione completa del branding.
