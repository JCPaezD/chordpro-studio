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

## ChordPro Parser

The system includes an internal ChordPro parser responsible for converting ChordPro text into the internal Song domain model.

Flow:

ChordPro text  
↓  
ChordProParser  
↓  
Song domain model

The parser must support:

- metadata directives
- section directives
- chord notation
- lyric lines

Directives not required by the MVP may be parsed but ignored.

### Section Detection

Sections may be defined in two ways:

1. Explicit ChordPro directives such as:

{start_of_verse}
{start_of_chorus}
{start_of_bridge}

2. Plain text headers commonly used in chord sheets, for example:

Verse
Chorus
Bridge
Intro
Outro

If a plain text line matches a known section name, the parser should treat it as a section boundary.

Directive-based sections take precedence when both are present.

## LLM Integration

The application integrates Large Language Models through a provider abstraction layer.

Supported providers (initial):

- OpenAI
- Gemini

Additional providers may be added later.

---

## API Key Strategy

The application resolves API keys in the following order:

1. Environment variables
2. User configuration file
3. Manual entry in the UI

Example environment variables:

OPENAI_API_KEY  
GEMINI_API_KEY

User configuration is stored locally in:

~/.chordpro-studio/config.json

---

## Prompt System

Prompts used by the application are stored outside the codebase in:

app/prompts/

Prompts are versioned and editable without modifying application logic.

Prompt files use the extension:

.prompt.md

Example:

conversion.prompt.md

---

## Prompt Loader

The system includes a PromptLoader utility responsible for:

- loading prompt files from app/prompts
- caching prompt contents
- rendering prompts with variables

Variable syntax:

{{variable_name}}

Example:

{{song_text}}

---

## LLM Processing Flow

The pipeline uses the following flow:

Raw Text  
↓  
CleaningService  
↓  
ConversionService  
↓  
ChordPro text  
↓  
ChordProParser  
↓  
Song domain model

All LLM interactions are performed through the LLMProvider abstraction.

## Prompt Variables

Prompts may contain template variables rendered by PromptLoader.

Current variables:

{{song_text}}
The raw or cleaned chord sheet text being processed.

{{user_preferences}}
Serialized user preferences that may influence conversion behavior.

Example usage in a prompt:

Song text:

{{song_text}}

User preferences:

{{user_preferences}}