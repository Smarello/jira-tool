# Kanban Analytics - Product Backlog

## 📋 Panoramica del Progetto

**Estensione Metriche Kanban per Jira Tool**
- **Versione**: 1.0
- **Data Inizio**: 09/07/2025
- **Stato Progetto**: 🟡 In Pianificazione

---

## 🎯 Obiettivi Strategici

1. Estendere il tool esistente con supporto alle board Kanban
2. Fornire metriche cycle time e percentili di completamento
3. Implementare filtri avanzati e gestione swimlane JQL
4. Mantenere coerenza architetturale con il sistema esistente

---

## 📊 Metriche di Progetto

- **Epic Totali**: 6
- **User Stories Totali**: 24
- **Task Totali**: 48
- **Story Points Stimati**: 144

### 🔄 Stato Avanzamento
- ✅ **Completate**: 2/24 (8%)
- 🔄 **In Corso**: 0/24 (0%)
- ⏳ **Da Fare**: 22/24 (92%)

---

## 🚀 EPIC 1: Foundation & Domain Layer
**Priorità**: 🔥 Critica | **Story Points**: 21 | **Stato**: 🔄 In Corso (2/3 completate)

### 📖 User Story 1.1: Domain Entities per Kanban
**Come sviluppatore, voglio definire le entità del dominio Kanban per mantenere la coerenza architetturale**

**Criteri di Accettazione**:
- [x] Definizione di `KanbanBoard` con mapping colonne-stati
- [x] Entità `KanbanIssue` con cycle time e stati
- [x] Value objects per `CycleTime` e `ColumnMapping`
- [x] Interfacce per repository pattern

**Story Points**: 8 | **Stato**: ✅ Completata | **Data**: 09/07/2025

#### 📝 Note Implementazione
- [x] Creato file `src/lib/jira/types.ts` con tutte le interfacce domain
- [x] Implementato `src/lib/jira/kanban-domain.ts` con value objects e business logic
- [x] Seguiti principi Clean Architecture e DDD
- [x] Aggiunte validazioni business secondo PRD
- [x] Implementate interfacce repository per dependency inversion

#### 🔧 Task 1.1.1: Creare KanbanBoard Entity
- [x] Definire interfaccia `KanbanBoard` in `src/lib/jira/types.ts`
- [x] Implementare mapping dinamico colonne-stati
- [x] Aggiungere validazione configurazioni board
- **Stima**: 3h | **Stato**: ✅ Completato

#### 🔧 Task 1.1.2: Creare KanbanIssue Entity
- [x] Estendere `JiraIssue` per supporto Kanban
- [x] Aggiungere campi cycle time e date tracking
- [x] Implementare logica esclusione issue riaperte
- **Stima**: 3h | **Stato**: ✅ Completato

#### 🔧 Task 1.1.3: Implementare Value Objects
- [x] Creare `CycleTime` value object
- [x] Implementare `ColumnMapping` per mapping board
- [x] Aggiungere validazioni business logic
- **Stima**: 2h | **Stato**: ✅ Completato

---

### 📖 User Story 1.2: Schema Database per Kanban
**Come sistema, voglio persistere i dati delle issue Kanban per analisi future**

**Criteri di Accettazione**:
- [x] Schema `kanban_issues` con tutti i campi richiesti
- [x] Schema `kanban_board_configs` per configurazioni board
- [x] Schema `kanban_metrics_cache` per cache metriche
- [x] Indici per performance su query frequenti
- [x] Migrazione database compatibile con schema esistente

**Story Points**: 5 | **Stato**: ✅ Completata | **Data**: 09/07/2025

#### � Note Implementazione
- [x] Creato schema TypeScript in `src/lib/database/schemas/kanban.ts`
- [x] Integrato schema Drizzle ORM in `src/lib/database/schemas/turso-schema.ts`
- [x] Rimossi errori di duplicazione e redeclarazione
- [x] Generata migrazione SQLite `0000_zippy_firestar.sql`
- [x] Definiti tutti i campi PRD: cycle time, board config, cache metriche
- [x] Aggiunto supporto per JSON data e audit fields

#### 🔧 Task 1.2.1: Definire Schema Kanban Issues
- [x] Creare schema in `src/lib/database/schemas/kanban.ts`
- [x] Definire campi secondo PRD (ID, summary, cycle time, etc.)
- [x] Aggiungere constraints e relazioni
- **Stima**: 2h | **Stato**: ✅ Completato

#### 🔧 Task 1.2.2: Creare Migrazione Database
- [x] Generare migrazione Drizzle per nuove tabelle
- [x] Testare migrazione su database di sviluppo
- [x] Documentare schema changes
- [x] Semplificazione schema - rimozione campi eccessivi (09/07/2025)
- [x] Ricreazione migrazione pulita - una sola migrazione con campi PRD (09/07/2025)
- **Stima**: 2h | **Stato**: ✅ Completato

#### 🔧 Task 1.2.3: Implementare Repository Pattern
- [ ] Creare `KanbanIssueRepository` interface
- [ ] Implementare concrete repository con Drizzle
- [ ] Aggiungere metodi CRUD per tutte le entità Kanban
- **Stima**: 1h
- [ ] Aggiungere metodi CRUD e query avanzate
- **Stima**: 3h

---

### 📖 User Story 1.3: API Client per Board Kanban
**Come sistema, voglio recuperare dati delle board Kanban da Jira API**

**Criteri di Accettazione**:
- [ ] Estensione `jira-client` per supporto board Kanban
- [ ] Recupero configurazione colonne e mapping stati
- [ ] Gestione paginazione e rate limiting

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 1.3.1: Estendere Jira API Client
- [ ] Aggiungere metodi per board Kanban in `src/lib/jira/boards-api.ts`
- [ ] Implementare recupero configurazione board
- [ ] Gestire mapping colonne-stati dinamico
- **Stima**: 4h

#### 🔧 Task 1.3.2: Implementare Issue Retrieval
- [ ] Creare metodi per recupero issue Kanban
- [ ] Implementare filtri per issue "Done" non riaperte
- [ ] Aggiungere gestione changelog per date tracking
- **Stima**: 4h

---

## 🚀 EPIC 2: Core Calculation Engine
**Priorità**: 🔥 Critica | **Story Points**: 34 | **Stato**: ⏳ Da Fare

### 📖 User Story 2.1: Calcolo Cycle Time
**Come Product Owner, voglio che il sistema calcoli automaticamente il cycle time delle issue**

**Criteri di Accettazione**:
- [ ] Calcolo cycle time da prima colonna a "Done"
- [ ] Gestione issue riaperte (ultimo ciclo di chiusura)
- [ ] Fallback a data creazione per issue senza data ingresso

**Story Points**: 13 | **Stato**: ⏳ Da Fare

#### 🔧 Task 2.1.1: Implementare CycleTimeCalculator
- [ ] Creare service `src/lib/services/cycle-time-calculator.ts`
- [ ] Implementare algoritmo calcolo cycle time
- [ ] Gestire edge cases (issue senza date, riaperte)
- **Stima**: 5h

#### 🔧 Task 2.1.2: Date Extraction Service
- [ ] Creare service per estrazione date da changelog
- [ ] Implementare logica primo ingresso board
- [ ] Gestire ultimo ingresso in colonna "Done"
- **Stima**: 4h

#### 🔧 Task 2.1.3: Issue Filter Service
- [ ] Implementare filtri per issue "Done" valide
- [ ] Escludere issue riaperte dopo chiusura
- [ ] Aggiungere logging per issue escluse
- **Stima**: 3h

---

### 📖 User Story 2.2: Calcolo Percentili
**Come Team Lead, voglio visualizzare i percentili di completamento per prevedere i tempi**

**Criteri di Accettazione**:
- [ ] Calcolo 50°, 85°, 95° percentile
- [ ] Aggregazione per board e filtri applicati
- [ ] Performance ottimizzata per grandi dataset

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 2.2.1: Implementare PercentilesCalculator
- [ ] Creare service per calcolo percentili statistici
- [ ] Implementare algoritmi efficienti per grandi dataset
- [ ] Validare accuratezza calcoli con test
- **Stima**: 4h

#### 🔧 Task 2.2.2: Aggregation Service
- [ ] Implementare aggregazioni per board e filtri
- [ ] Creare cache per risultati frequenti
- [ ] Ottimizzare query database
- **Stima**: 3h

---

### 📖 User Story 2.3: Data Persistence Service
**Come sistema, voglio salvare periodicamente tutti i dati delle issue per analisi**

**Criteri di Accettazione**:
- [ ] Salvataggio completo (non incrementale) delle issue
- [ ] Batch processing per performance
- [ ] Gestione errori e retry logic

**Story Points**: 13 | **Stato**: ⏳ Da Fare

#### 🔧 Task 2.3.1: Batch Processing Service
- [ ] Implementare service per elaborazione batch
- [ ] Gestire chunk processing per grandi volumi
- [ ] Aggiungere progress tracking
- **Stima**: 5h

#### 🔧 Task 2.3.2: Data Synchronization
- [ ] Implementare logica sincronizzazione completa
- [ ] Gestire conflitti e aggiornamenti
- [ ] Aggiungere audit trail
- **Stima**: 4h

#### 🔧 Task 2.3.3: Error Handling & Logging
- [ ] Implementare comprehensive error handling
- [ ] Aggiungere structured logging
- [ ] Creare alerting per fallimenti critici
- **Stima**: 2h

---

## 🚀 EPIC 3: User Interface Foundation
**Priorità**: 🟡 Alta | **Story Points**: 21 | **Stato**: ⏳ Da Fare

### 📖 User Story 3.1: Selezione Board Kanban
**Come utente, voglio selezionare una o più board Kanban per l'analisi**

**Criteri di Accettazione**:
- [ ] Dropdown/multiselect per board disponibili
- [ ] Visualizzazione dettagli board (nome, progetto)
- [ ] Persistenza selezione utente

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 3.1.1: Board Selector Component
- [ ] Creare component `src/components/kanban/BoardSelector.astro`
- [ ] Implementare multiselect con Tailwind
- [ ] Aggiungere ricerca e filtro board
- **Stima**: 4h

#### 🔧 Task 3.1.2: Board Details Display
- [ ] Visualizzare informazioni board selezionate
- [ ] Mostrare configurazione colonne
- [ ] Aggiungere preview mapping stati
- **Stima**: 3h

---

### 📖 User Story 3.2: Layout Kanban Analytics
**Come utente, voglio una interfaccia coerente con lo stile esistente**

**Criteri di Accettazione**:
- [ ] Layout responsive con Tailwind CSS
- [ ] Coerenza con design system esistente
- [ ] Navigazione intuitiva

**Story Points**: 5 | **Stato**: ⏳ Da Fare

#### 🔧 Task 3.2.1: Main Layout Component
- [ ] Creare `src/components/kanban/KanbanAnalytics.astro`
- [ ] Implementare grid layout responsive
- [ ] Integrare con layout esistente
- **Stima**: 3h

#### 🔧 Task 3.2.2: Navigation & Breadcrumbs
- [ ] Aggiungere navigazione Kanban
- [ ] Implementare breadcrumbs
- [ ] Testare responsive design
- **Stima**: 2h

---

### 📖 User Story 3.3: Metriche Display Components
**Come utente, voglio visualizzare chiaramente i percentili calcolati**

**Criteri di Accettazione**:
- [ ] Cards per visualizzazione percentili
- [ ] Grafici cycle time distribution
- [ ] Indicatori performance

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 3.3.1: Percentiles Cards
- [ ] Creare component per display percentili
- [ ] Implementare design cards consistente
- [ ] Aggiungere tooltips esplicativi
- **Stima**: 3h

#### 🔧 Task 3.3.2: Cycle Time Charts
- [ ] Implementare grafici distribuzione
- [ ] Aggiungere chart library (Chart.js/D3)
- [ ] Creare visualizzazioni interattive
- **Stima**: 5h

---

## 🚀 EPIC 4: Advanced Filtering & Swimlanes
**Priorità**: 🟡 Alta | **Story Points**: 29 | **Stato**: ⏳ Da Fare

### 📖 User Story 4.1: Filtri Tipologie Issue
**Come Team Lead, voglio filtrare le metriche per tipologie di issue specifiche**

**Criteri di Accettazione**:
- [ ] Multiselect per tipologie issue
- [ ] Aggiornamento real-time delle metriche
- [ ] Persistenza filtri applicati

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 4.1.1: Issue Type Filter Component
- [ ] Creare component filtro tipologie
- [ ] Implementare multiselect avanzato
- [ ] Aggiungere icone tipologie
- **Stima**: 3h

#### 🔧 Task 4.1.2: Filter State Management
- [ ] Implementare state management filtri
- [ ] Aggiungere persistenza localStorage
- [ ] Gestire reset e clear filters
- **Stima**: 3h

---

### 📖 User Story 4.2: Swimlane JQL
**Come utente avanzato, voglio definire swimlane tramite query JQL**

**Criteri di Accettazione**:
- [ ] Editor JQL con syntax highlighting
- [ ] Validazione query in real-time
- [ ] Salvataggio configurazioni swimlane

**Story Points**: 13 | **Stato**: ⏳ Da Fare

#### 🔧 Task 4.2.1: JQL Editor Component
- [ ] Implementare editor JQL con Monaco Editor
- [ ] Aggiungere syntax highlighting
- [ ] Implementare auto-completion
- **Stima**: 6h

#### 🔧 Task 4.2.2: JQL Validation Service
- [ ] Creare service validazione JQL
- [ ] Implementare preview risultati
- [ ] Gestire errori syntax
- **Stima**: 4h

#### 🔧 Task 4.2.3: Swimlane Configuration
- [ ] Implementare salvataggio configurazioni
- [ ] Creare preset swimlane comuni
- [ ] Aggiungere sharing configurazioni
- **Stima**: 3h

---

### 📖 User Story 4.3: Saved Configurations
**Come utente, voglio salvare configurazioni di filtri per riutilizzo futuro**

**Criteri di Accettazione**:
- [ ] Salvataggio named configurations
- [ ] Load/apply configurazioni salvate
- [ ] Gestione CRUD configurazioni

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 4.3.1: Configuration Management
- [ ] Implementare schema configurazioni
- [ ] Creare CRUD operations
- [ ] Aggiungere validazione configurazioni
- **Stima**: 4h

#### 🔧 Task 4.3.2: Configuration UI
- [ ] Creare interface gestione configurazioni
- [ ] Implementare save/load workflow
- [ ] Aggiungere configuration templates
- **Stima**: 4h

---

## 🚀 EPIC 5: API & Backend Integration
**Priorità**: 🟡 Alta | **Story Points**: 21 | **Stato**: ⏳ Da Fare

### 📖 User Story 5.1: API Endpoints Kanban
**Come frontend, voglio API endpoints per recuperare dati e metriche Kanban**

**Criteri di Accettazione**:
- [ ] REST API per board, issue e metriche
- [ ] Validazione input e error handling
- [ ] Performance optimization e caching

**Story Points**: 13 | **Stato**: ⏳ Da Fare

#### 🔧 Task 5.1.1: Board API Endpoints
- [ ] Creare `src/pages/api/kanban/boards.ts`
- [ ] Implementare GET boards con filtri
- [ ] Aggiungere board configuration endpoint
- **Stima**: 4h

#### 🔧 Task 5.1.2: Metrics API Endpoints
- [ ] Creare endpoints per cycle time e percentili
- [ ] Implementare aggregation queries
- [ ] Aggiungere filtering e pagination
- **Stima**: 5h

#### 🔧 Task 5.1.3: Issue Data API
- [ ] Implementare endpoints per issue data
- [ ] Aggiungere batch processing endpoints
- [ ] Creare sync status endpoints
- **Stima**: 4h

---

### 📖 User Story 5.2: Caching & Performance
**Come sistema, voglio ottimizzare le performance con caching intelligente**

**Criteri di Accettazione**:
- [ ] Cache per query frequenti
- [ ] Invalidazione cache intelligente
- [ ] Monitoring performance

**Story Points**: 8 | **Stato**: ⏳ Da Fare

#### 🔧 Task 5.2.1: Caching Layer
- [ ] Implementare Redis/memory cache
- [ ] Creare cache strategies
- [ ] Aggiungere cache warming
- **Stima**: 4h

#### 🔧 Task 5.2.2: Performance Monitoring
- [ ] Aggiungere metrics collection
- [ ] Implementare query optimization
- [ ] Creare performance dashboard
- **Stima**: 4h

---

## 🚀 EPIC 6: Quality Assurance & Documentation
**Priorità**: 🟢 Media | **Story Points**: 18 | **Stato**: ⏳ Da Fare

### 📖 User Story 6.1: Testing Completo
**Come sviluppatore, voglio una suite di test completa per garantire qualità**

**Criteri di Accettazione**:
- [ ] Unit tests per tutti i services
- [ ] Integration tests per API endpoints
- [ ] E2E tests per workflow principali

**Story Points**: 13 | **Stato**: ⏳ Da Fare

#### 🔧 Task 6.1.1: Unit Tests
- [ ] Test per CycleTimeCalculator
- [ ] Test per PercentilesCalculator
- [ ] Test per domain entities
- **Stima**: 6h

#### 🔧 Task 6.1.2: Integration Tests
- [ ] Test API endpoints Kanban
- [ ] Test database operations
- [ ] Test Jira API integration
- **Stima**: 5h

#### 🔧 Task 6.1.3: E2E Tests
- [ ] Test workflow completo
- [ ] Test filtri e configurazioni
- [ ] Test performance scenarios
- **Stima**: 4h

---

### 📖 User Story 6.2: Documentazione
**Come utente/sviluppatore, voglio documentazione completa del sistema**

**Criteri di Accettazione**:
- [ ] User guide per funzionalità Kanban
- [ ] Developer documentation
- [ ] API documentation

**Story Points**: 5 | **Stato**: ⏳ Da Fare

#### 🔧 Task 6.2.1: User Documentation
- [ ] Creare user guide Kanban analytics
- [ ] Documentare filtri e swimlane
- [ ] Aggiungere troubleshooting guide
- **Stima**: 3h

#### 🔧 Task 6.2.2: Technical Documentation
- [ ] Documentare architettura Kanban
- [ ] Aggiornare API documentation
- [ ] Creare deployment guide
- **Stima**: 2h

---

## 📈 Roadmap & Prioritizzazione

### 🎯 Sprint 1 (Settimana 1-2): Foundation
- Epic 1: Foundation & Domain Layer
- Obiettivo: Completare base architetturale

### 🎯 Sprint 2 (Settimana 3-4): Core Engine
- Epic 2: Core Calculation Engine
- Obiettivo: Implementare logica business principale

### 🎯 Sprint 3 (Settimana 5-6): UI Foundation
- Epic 3: User Interface Foundation
- Obiettivo: Interfaccia base funzionante

### 🎯 Sprint 4 (Settimana 7-8): Advanced Features
- Epic 4: Advanced Filtering & Swimlanes
- Obiettivo: Filtri avanzati e configurazioni

### 🎯 Sprint 5 (Settimana 9-10): Backend & API
- Epic 5: API & Backend Integration
- Obiettivo: Completare integrazione backend

### 🎯 Sprint 6 (Settimana 11-12): Quality & Documentation
- Epic 6: Quality Assurance & Documentation
- Obiettivo: Testing e documentazione completa

---

## 🔄 Note per Aggiornamenti

**Template per aggiornare stato User Story:**
```markdown
**Story Points**: X | **Stato**: ✅ Completata | **Data**: gg/mm/yyyy
```

**Template per aggiungere note implementazione:**
```markdown
#### 📝 Note Implementazione
- [ ] Nota 1
- [ ] Nota 2
```

**Legenda Stati:**
- ⏳ **Da Fare**: Non ancora iniziata
- 🔄 **In Corso**: Sviluppo attivo
- 🔍 **In Review**: In fase di review
- ✅ **Completata**: Sviluppo e test completati
- ❌ **Bloccata**: Bloccata da dipendenze

---

**Ultimo Aggiornamento**: 09/07/2025
**Prossima Review**: Da definire
