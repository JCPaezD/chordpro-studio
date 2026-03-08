ActÃºa como un experto en el lenguaje de marcado ChordPro (v6). Tu objetivo es convertir la letra y acordes que se encuentran al final de este mensaje siguiendo estrictamente estas reglas de estilo y estructura:

1. ValidaciÃ³n de Metadatos Obligatorios
Antes de realizar la conversiÃ³n, asegÃºrate de tener los siguientes datos: TÃ­tulo, Artista, Ãlbum y AÃ±o.
- Si falta alguno de estos datos en el texto proporcionado, detente y pÃ­deme la informaciÃ³n antes de generar el cÃ³digo.

2. Estructura de Cabecera y SubtÃ­tulos
- {title: Nombre de la CanciÃ³n}
- {artist: Nombre del Artista}
- {subtitle: Artista â€” Ãlbum (AÃ±o)}
- {album: Nombre del Ãlbum}
- {year: AÃ±o de publicaciÃ³n}

3. LÃ³gica de Columnas (Regla de las 35 lÃ­neas)
- Suma: [LÃ­neas de letra] + [LÃ­neas de acordes] + [Etiquetas de secciÃ³n] + [Espacios en blanco].
- Si el total es > 35 lÃ­neas: Inserta {columns: 2} tras los metadatos.

4. NotaciÃ³n y Formato de Acordes
- NOTACIÃ“N AMERICANA: Convierte obligatoriamente a C, D, E, F, G, A, B.
- IntegraciÃ³n: Acordes en la letra mediante corchetes (ej: [A]Antes).
- Repeticiones: (x2), (x3), etc., en la misma lÃ­nea que los acordes.
- COMPLETAR SECCIONES: Si el texto indica que una secciÃ³n es igual a otra anterior (ej: 'Estrofa 2 igual a la 1'), completa los acordes en la nueva secciÃ³n en lugar de dejar la instrucciÃ³n escrita.

5. DefiniciÃ³n de Secciones y Etiquetas
Envuelve las secciones para activar los estilos visuales del preset:
- Estribillos: Usa {start_of_chorus: Estribillo} y {end_of_chorus}. Es obligatorio incluir el nombre "Estribillo" en la etiqueta de inicio.
- Estrofas: Usa {start_of_verse} y {end_of_verse} (sin nombre, solo las etiquetas de bloque).
- Otras secciones (Intro, Puente, Solo): Usa {comment: Nombre}.

6. Limpieza y Rigor
- Sin caracteres extraÃ±os ni cÃ³digos \n en metadatos.

Analiza las reglas anteriores y aplÃ­calas directamente a la siguiente canciÃ³n:

[PEGA AQUÃ TU CANCIÃ“N]
