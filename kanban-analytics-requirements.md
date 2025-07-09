# Kanban Analytics - User Stories e Task

## Panoramica
Implementazione di una nuova visualizzazione analitica per board Kanban che mostra percentili di cycle time con filtri per tipo di issue e swimlane.

---

## User Story 1: Rilevamento Board Kanban
**Come** utente  
**Voglio** che il sistema rilevi automaticamente quando seleziono una board di tipo Kanban  
**Così che** possa vedere automaticamente le analytics specifiche per Kanban invece delle velocity metrics

### Task:
- [ ] Modificare il componente di selezione board per identificare il tipo di board (Kanban vs Scrum)
- [ ] Astrarre il Velocity Content che ora è in `VelocityPage`in un nuovo componente dedicato `ScrumAnalytics`
- [ ] Creare un nuovo componente `KanbanAnalytics` separato da `VelocityPage`
- [ ] Implementare la navigazione automatica verso il componente corretto

---

## User Story 2: Configurazione Swimlane per Board
**Come** amministratore  
**Voglio** poter configurare le swimlane per ogni board Kanban con le relative query JQL  
**Così che** possa definire i raggruppamenti logici per l'analisi dei dati

### Task:
- [ ] Creare una nuova tabella `board_swimlanes` nel database
  - Campi: id, board_id, name, jql_query, display_order, created_at, updated_at
- [ ] Implementare API per CRUD delle swimlane:
  - GET /api/boards/{boardId}/swimlanes
  - POST /api/boards/{boardId}/swimlanes
  - PUT /api/boards/{boardId}/swimlanes/{swimlaneId}
  - DELETE /api/boards/{boardId}/swimlanes/{swimlaneId}
- [ ] Creare componente UI per configurazione swimlane
- [ ] Implementare validazione delle query JQL
- [ ] Aggiungere interfaccia di gestione swimlane nella pagina di configurazione board

---

## User Story 3: Calcolo Cycle Time per Issue
**Come** sistema  
**Voglio** calcolare il cycle time per ogni issue completata  
**Così che** possa fornire dati accurati per l'analisi dei percentili

### Task:
- [ ] Estendere la tabella `sprint_issues` o creare `issue_cycle_times`:
  - Campi: issue_key, board_id, start_date, completion_date, cycle_time_days, issue_type, swimlane_id
- [ ] Implementare logica per calcolare cycle time:
  - Data inizio: quando l'issue entra nella prima colonna "In Progress"
  - Data fine: quando l'issue raggiunge una colonna "Done"
- [ ] Creare servizio per il calcolo batch dei cycle time storici
- [ ] Implementare aggiornamento real-time dei cycle time per nuove issue completate

---

## User Story 4: Analisi Percentili Cycle Time
**Come** utente  
**Voglio** vedere i percentili di cycle time (50°, 75°, 85°, 95°)  
**Così che** possa capire le performance temporali del team

### Task:
- [ ] Implementare algoritmo di calcolo percentili
- [ ] Creare API endpoint GET /api/boards/{boardId}/cycle-time-percentiles
- [ ] Implementare filtri per:
  - Periodo temporale (ultimi 30/60/90 giorni)
  - Tipo di issue
  - Swimlane
- [ ] Creare componente UI per visualizzazione percentili
- [ ] Implementare grafici/tabelle per mostrare i dati

---

## User Story 5: Filtro per Tipo di Issue
**Come** utente  
**Voglio** filtrare le analytics per tipo di issue (Bug, Story, Task, etc.)  
**Così che** possa analizzare le performance per diversi tipi di lavoro

### Task:
- [ ] Recuperare e memorizzare i tipi di issue disponibili per ogni board
- [ ] Creare componente dropdown per selezione tipo issue
- [ ] Implementare filtro nel backend per tipo issue
- [ ] Aggiornare le query di calcolo percentili per includere il filtro
- [ ] Implementare "Tutti i tipi" come opzione predefinita

---

## User Story 6: Filtro per Swimlane
**Come** utente  
**Voglio** filtrare le analytics per swimlane specifica  
**Così che** possa analizzare le performance di diversi flussi di lavoro

### Task:
- [ ] Creare componente dropdown per selezione swimlane
- [ ] Implementare logica per associare issue alle swimlane tramite JQL
- [ ] Aggiornare il calcolo dei percentili per includere filtro swimlane
- [ ] Implementare "Tutte le swimlane" come opzione predefinita
- [ ] Gestire issue che non appartengono a nessuna swimlane configurata

---

## User Story 7: Dashboard Kanban Analytics
**Come** utente  
**Voglio** una dashboard dedicata per le analytics Kanban  
**Così che** possa avere una visione completa delle performance della board

### Task:
- [ ] Creare layout principale `KanbanAnalyticsDashboard`
- [ ] Implementare sezione filtri (periodo, tipo issue, swimlane)
- [ ] Creare componente per visualizzazione percentili principali
- [ ] Aggiungere grafico distribuzione cycle time
- [ ] Implementare tabella dettagliata con breakdown per categoria
- [ ] Aggiungere indicatori di trend (miglioramento/peggioramento)

---

## User Story 8: Visualizzazione Grafica Avanzata
**Come** utente  
**Voglio** grafici intuitivi per comprendere i dati di cycle time  
**Così che** possa interpretare facilmente le performance del team

### Task:
- [ ] Implementare istogramma distribuzione cycle time
- [ ] Creare grafico box plot per visualizzare quartili
- [ ] Aggiungere grafico trend temporale dei percentili
- [ ] Implementare grafico comparativo per tipo issue/swimlane
- [ ] Aggiungere tooltip informativi sui grafici
- [ ] Implementare esportazione dati in CSV/Excel

---

## User Story 9: Performance e Caching
**Come** sistema  
**Voglio** che i calcoli siano performanti anche con grandi volumi di dati  
**Così che** l'utente abbia una risposta rapida

### Task:
- [ ] Implementare caching dei calcoli percentili
- [ ] Creare job schedulato per pre-calcolo dati aggregati
- [ ] Ottimizzare query database con indici appropriati
- [ ] Implementare paginazione per dataset grandi
- [ ] Aggiungere loading states nell'UI
- [ ] Implementare refresh incrementale dei dati

---

## User Story 10: Integrazione con Sistema Esistente
**Come** sviluppatore  
**Voglio** che la nuova funzionalità si integri seamlessly con l'architettura esistente  
**Così che** mantenga coerenza e qualità del codice

### Task:
- [ ] Estendere il router per gestire rotte Kanban analytics
- [ ] Integrare con il sistema di autenticazione esistente
- [ ] Utilizzare i pattern repository esistenti per i nuovi data layer
- [ ] Aggiornare la navigazione principale per includere analytics Kanban
- [ ] Implementare test unitari e di integrazione
- [ ] Aggiornare documentazione API e componenti
