# Architecture - architecture.md

## Platform Strategy

ChordPro Studio follows a **desktop-first architecture**.

Primary platform:

Desktop application built with Tauri.

Reasons:

- local filesystem access
- local ChordPro CLI execution
- offline usage
- faster iteration for power users

Future platforms may include:

- mobile
- web client

---

## Core Principles

1. Local-first processing
2. AI-assisted workflows
3. Separation of concerns
4. Extensible architecture

---

## System Layers

The system is divided into three main layers.

---

### 1. Core Domain

The core contains platform-independent models and logic.

Examples:

- Song model
- Section model
- Preferences
- Layout rules

The core does not depend on:

- UI
- ChordPro CLI
- AI providers
- filesystem

---

### 2. Services

Services implement functional logic.

Examples:

- LLM conversion service
- chord analysis service
- layout optimizer
- scraping service

Services operate on the domain models.

---

### 3. Platform Adapters

Adapters connect the core system to external systems.

Examples:

Desktop adapters:

- ChordPro CLI
- filesystem
- PDF export

Future adapters:

- mobile rendering
- remote export service
- cloud sync

---

## Export Pipeline

The export process is expected to follow this flow:

Raw input  
→ AI conversion  
→ Internal Song model  
→ ChordPro generation  
→ ChordPro CLI  
→ PDF output

---

## AI Integration

AI is used for:

- cleaning chord sheets
- converting to structured format
- analyzing potential chord issues
- assisting layout optimization

Multiple AI providers may be supported.


## Project Structure

The project follows a layered architecture to ensure clear separation of concerns.

Repository structure:

```
chordpro-studio
│
├─ docs
│
├─ app
│  ├─ src
│  │  ├─ domain
│  │  │  ├─ song
│  │  │  └─ preferences
│  │  │
│  │  ├─ services
│  │  │  ├─ cleaning
│  │  │  ├─ conversion
│  │  │  └─ analysis
│  │  │
│  │  ├─ adapters
│  │  │  ├─ llm
│  │  │  ├─ chordpro
│  │  │  └─ filesystem
│  │  │
│  │  ├─ ui
│  │  │  ├─ components
│  │  │  ├─ views
│  │  │  └─ store
│  │  │
│  │  ├─ types
│  │  └─ utils
│  │
│  └─ public
```

### Layer Responsibilities

Domain

Core models and business logic.

Services

Application logic such as AI processing, text cleaning and conversion.

Adapters

Integrations with external systems such as LLM providers, filesystem and ChordPro CLI.

UI

User interface and state management.

## Processing Pipeline

Song processing follows a centralized pipeline architecture.

The pipeline is orchestrated by a dedicated application service.

Pipeline flow:

Raw Song Input  
↓  
Cleaning Service  
↓  
Conversion Service  
↓  
Song Model Builder  
↓  
Song Domain Model  
↓  
Preview  
↓  
Export

The UI does not directly coordinate individual services.

Instead it interacts with a central pipeline service responsible for orchestrating the workflow.