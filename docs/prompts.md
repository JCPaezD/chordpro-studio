# Prompts

This document describes how prompts are handled in the project.

---

## Runtime Prompt Source

The runtime conversion prompt used by the application lives in:

- `app/prompts/conversion.prompt.md`

That file is the authoritative source for the current conversion behavior.

This documentation file should not drift away from the runtime prompt.

---

## Current Prompt Intent

The active conversion prompt is designed as a deterministic transformer.

Its role is to convert cleaned song text into valid ChordPro that can be processed automatically by the pipeline.

Current behavior:

- return only valid ChordPro
- do not return explanations or markdown fences
- continue even if metadata is incomplete
- normalize chord notation to American notation
- preserve chord alignment from chord-line plus lyric-line input
- emit section tags in ChordPro format

---

## Prompt Variables

The conversion prompt currently uses:

- `{{song_text}}`
- `{{user_preferences}}`

These variables are rendered by `PromptLoader` before the LLM request is sent.

---

## Storage Strategy

Prompts are stored outside the application logic so they can be versioned and edited without changing service code.

Current prompt directory:

- `app/prompts/`

Current file naming:

- `*.prompt.md`

Example:

- `conversion.prompt.md`

---

## Documentation Rule

If the runtime prompt changes materially, this document should be updated to reflect:

- where the authoritative prompt lives
- what the prompt is expected to do
- which variables it consumes

This file is intentionally descriptive rather than a second copy of the full prompt body, to avoid divergence.

---

## Historical Reference

The following prompt is kept only as historical context for the origin of the project and the early prompting strategy.

It is not the current runtime prompt.

The authoritative runtime prompt remains:

- `app/prompts/conversion.prompt.md`

Original historical reference:

```md
Actúa como un experto en el lenguaje de marcado ChordPro (v6). Tu objetivo es convertir la letra y acordes que se encuentran al final de este mensaje siguiendo estrictamente estas reglas de estilo y estructura:

1. Validación de Metadatos Obligatorios
Antes de realizar la conversión, asegúrate de tener los siguientes datos: Título, Artista, Álbum y Año.
- Si falta alguno de estos datos en el texto proporcionado, detente y pídeme la información antes de generar el código.

2. Estructura de Cabecera y Subtítulos
- {title: Nombre de la Canción}
- {artist: Nombre del Artista}
- {subtitle: Artista — Álbum (Año)}
- {album: Nombre del Álbum}
- {year: Año de publicación}

3. Lógica de Columnas (Regla de las 35 líneas)
- Suma: [Líneas de letra] + [Líneas de acordes] + [Etiquetas de sección] + [Espacios en blanco].
- Si el total es > 35 líneas: Inserta {columns: 2} tras los metadatos.

4. Notación y Formato de Acordes
- NOTACIÓN AMERICANA: Convierte obligatoriamente a C, D, E, F, G, A, B.
- Integración: Acordes en la letra mediante corchetes (ej: [A]Antes).
- Repeticiones: (x2), (x3), etc., en la misma línea que los acordes.
- COMPLETAR SECCIONES: Si el texto indica que una sección es igual a otra anterior (ej: 'Estrofa 2 igual a la 1'), completa los acordes en la nueva sección en lugar de dejar la instrucción escrita.

5. Definición de Secciones y Etiquetas
Envuelve las secciones para activar los estilos visuales del preset:
- Estribillos: Usa {start_of_chorus: Estribillo} y {end_of_chorus}. Es obligatorio incluir el nombre "Estribillo" en la etiqueta de inicio.
- Estrofas: Usa {start_of_verse} y {end_of_verse} (sin nombre, solo las etiquetas de bloque).
- Otras secciones (Intro, Puente, Solo): Usa {comment: Nombre}.

6. Limpieza y Rigor
- Sin caracteres extraños ni códigos \n en metadatos.

Analiza las reglas anteriores y aplícalas directamente a la siguiente canción:

[PEGA AQUÍ TU CANCIÓN]
```
