prompts.md


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


## Prompt Storage Strategy

Runtime prompts used by the application are stored in the `app/prompts` directory.

This allows prompts to be versioned and modified independently from the code.

The prompts documented here represent reference versions used during design.