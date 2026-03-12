This directory contains the bundled ChordPro CLI runtime used by the Tauri
preview and PDF export commands.

Expected primary executable:

- Windows: `chordpro.exe`
- macOS/Linux: `chordpro`

Important:

- Keep the full upstream runtime together, not only the executable.
- On Windows this includes runtime support files such as Perl DLLs plus
  support directories like `lib/` and `script/`.

The Tauri backend resolves the binary from packaged resources first and falls
back to this repository path during local development.
