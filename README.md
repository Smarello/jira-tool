# Jira Tool - Velocity Analytics Dashboard

Un dashboard avanzato per l'analisi della velocity di team Scrum/Kanban utilizzando dati Jira, costruito con Astro, TypeScript e Tailwind CSS.

## 🚀 Funzionalità Principali

- **Analisi Velocity**: Calcolo accurato della velocity del team basato su story points completati
- **Validazione Avanzata**: Controllo preciso delle transizioni alle colonne "Done" per determinare quando le issue sono state realmente completate
- **Dashboard Interattivo**: Visualizzazione di metriche, trend e dettagli per ogni sprint
- **Integrazione Jira**: Connessione diretta con Jira Cloud tramite API per dati real-time
- **Responsive Design**: Interfaccia ottimizzata per desktop e mobile

## 📋 Prerequisiti

Prima di iniziare, assicurati di avere installato:

- **Node.js**: versione 18.0 o superiore
  ```bash
  node --version  # dovrebbe essere >= 18.0.0
  ```
- **npm**: versione 8.0 o superiore (incluso con Node.js)
  ```bash
  npm --version   # dovrebbe essere >= 8.0.0
  ```
- **Git**: per clonare il repository
  ```bash
  git --version
  ```

## 🛠️ Setup Ambiente di Sviluppo

### 1. Clona il Repository

```bash
git clone https://github.com/your-org/jira-tool.git
cd jira-tool
```

### 2. Installa le Dipendenze

```bash
npm install
```

Questo comando installerà tutte le dipendenze necessarie definite in `package.json`, incluse:
- Astro (framework)
- TypeScript (type safety)
- Tailwind CSS (styling)
- E molte altre...

### 3. Configurazione Jira

L'applicazione richiede accesso a Jira Cloud. Crea un file `.env.local` nella root del progetto:

```bash
# Copia il template di configurazione
cp .env.example .env.local
```

Modifica `.env.local` con le tue credenziali Jira:

```env
# Configurazione Jira Cloud
JIRA_BASE_URL=https://your-domain.atlassian.net
JIRA_EMAIL=your-email@company.com
JIRA_API_TOKEN=your-jira-api-token

# Configurazione opzionale
NODE_ENV=development
```

#### Come ottenere il Jira API Token:

1. Vai su [Atlassian Account Settings](https://id.atlassian.com/manage-profile/security/api-tokens)
2. Clicca "Create API token"
3. Assegna un nome al token (es. "Jira Tool Development")
4. Copia il token generato e incollalo in `.env.local`

⚠️ **Importante**: Non committare mai il file `.env.local` nel repository!

### 4. Verifica la Configurazione

Testa la connessione a Jira:

```bash
npm run test:jira
```

Se tutto è configurato correttamente, vedrai un messaggio di successo.

## 🚀 Avvio dell'Applicazione

### Modalità Sviluppo

Per avviare il server di sviluppo con hot-reload:

```bash
npm run dev
```

L'applicazione sarà disponibile su: **http://localhost:4321**

### Build di Produzione

Per creare una build ottimizzata:

```bash
npm run build
```

### Preview Build di Produzione

Per testare la build di produzione localmente:

```bash
npm run preview
```

## 📁 Struttura del Progetto

```
jira-tool/
├── src/
│   ├── components/          # Componenti Astro riutilizzabili
│   │   ├── ui/             # Componenti UI base (Modal, Select, etc.)
│   │   ├── velocity/       # Componenti specifici per velocity
│   │   └── jira/           # Componenti per integrazione Jira
│   ├── lib/                # Logica business e utilities
│   │   ├── jira/          # API client e types per Jira
│   │   ├── velocity/      # Calcoli e validazioni velocity
│   │   ├── mcp/           # MCP Atlassian client
│   │   └── utils/         # Utilities generiche
│   ├── pages/             # Route e API endpoints
│   │   ├── api/           # API endpoints backend
│   │   └── velocity/      # Pagine velocity dashboard
│   └── styles/            # CSS globali
├── public/                # Asset statici
├── .env.example          # Template configurazione
└── README.md            # Questo file
```

## 🔧 Comandi Utili

### Sviluppo

```bash
# Avvia server di sviluppo
npm run dev

# Avvia con porta specifica
npm run dev -- --port 3000

# Type checking
npm run type-check

# Linting
npm run lint

# Formattazione codice
npm run format
```

### Build e Deploy

```bash
# Build di produzione
npm run build

# Preview build locale
npm run preview

# Analisi bundle
npm run build:analyze
```

### Testing e Debug

```bash
# Test connessione Jira
npm run test:jira

# Debug API cache
npm run debug:cache

# Performance test
npm run test:performance
```

## 🐛 Troubleshooting

### Problemi Comuni

#### 1. Errore "Cannot connect to Jira"

**Causa**: Credenziali Jira non valide o non configurate.

**Soluzione**:
- Verifica che `.env.local` esista e contenga i valori corretti
- Controlla che il Jira API Token sia valido
- Assicurati che l'email utilizzata abbia accesso al progetto Jira

#### 2. Errore "Port 4321 already in use"

**Causa**: La porta di default è occupata da un altro processo.

**Soluzione**:
```bash
# Usa una porta diversa
npm run dev -- --port 3000
```

#### 3. Problemi di Performance

**Causa**: Troppi dati da caricare o cache non ottimizzata.

**Soluzione**:
- Controlla la console del browser per errori
- Usa `npm run debug:cache` per analizzare la cache
- Limita il periodo temporale delle analisi

#### 4. TypeScript Errors

**Causa**: Problemi di tipizzazione o dipendenze.

**Soluzione**:
```bash
# Reinstalla dipendenze
rm -rf node_modules package-lock.json
npm install

# Verifica types
npm run type-check
```

### Log e Debug

Per abilitare log dettagliati, aggiungi al tuo `.env.local`:

```env
DEBUG=true
LOG_LEVEL=debug
```

## 📚 Documentazione Tecnica

### Architettura

L'applicazione segue i principi di **Clean Architecture**:

- **Domain Layer**: Logica business in `src/lib/velocity/`
- **Application Layer**: Use cases e orchestrazione
- **Infrastructure Layer**: API clients e database access
- **Presentation Layer**: Componenti UI e pagine

### Tecnologie Utilizzate

- **[Astro](https://astro.build/)**: Framework per siti web veloci
- **[TypeScript](https://www.typescriptlang.org/)**: Type safety e developer experience
- **[Tailwind CSS](https://tailwindcss.com/)**: Utility-first CSS framework
- **[Jira REST API](https://developer.atlassian.com/cloud/jira/platform/rest/v3/)**: Integrazione con Jira Cloud

### Design Patterns

Il codice utilizza design patterns consolidati:
- **Factory Pattern**: Per la creazione di client API
- **Strategy Pattern**: Per diversi algoritmi di validazione
- **Observer Pattern**: Per aggiornamenti real-time
- **Repository Pattern**: Per accesso ai dati

## 🤝 Contributing

Per contribuire al progetto:

1. Crea un branch per la tua feature: `git checkout -b feature/nome-feature`
2. Committa le modifiche: `git commit -m 'Add: nuova feature'`
3. Pusha il branch: `git push origin feature/nome-feature`
4. Apri una Pull Request

### Code Style

Il progetto segue i principi di **Clean Code**:
- Nomi espliciti e pronunciabili
- Funzioni piccole e focused
- Single Responsibility Principle
- Commenti che spiegano il "perché", non il "cosa"

## 🆘 Supporto

Se hai problemi o domande:

1. Controlla la sezione [Troubleshooting](#🐛-troubleshooting)
2. Cerca nelle [Issues](https://github.com/your-org/jira-tool/issues) esistenti
3. Crea una nuova issue con dettagli sul problema
4. Contatta il team di sviluppo

## 📄 Licenza

Questo progetto è sotto licenza MIT. Vedi il file `LICENSE` per dettagli.

---

**Happy coding! 🚀**
