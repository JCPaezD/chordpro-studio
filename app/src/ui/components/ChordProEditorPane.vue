<script setup lang="ts">
import { defaultKeymap, history, historyKeymap } from "@codemirror/commands";
import { Compartment, EditorState, RangeSetBuilder, Transaction, type Extension } from "@codemirror/state";
import {
  Decoration,
  type DecorationSet,
  drawSelection,
  dropCursor,
  EditorView,
  keymap,
  placeholder as editorPlaceholder,
  ViewPlugin,
  type ViewUpdate
} from "@codemirror/view";
import { onBeforeUnmount, onMounted, ref, shallowRef, watch } from "vue";

import LoadingOverlayCard from "./LoadingOverlayCard.vue";

const props = withDefaults(
  defineProps<{
    modelValue: string;
    placeholder?: string;
    disabled?: boolean;
    loading?: boolean;
    loadingMessage?: string;
  }>(),
  {
    placeholder: "ChordPro text",
    disabled: false,
    loading: false,
    loadingMessage: "Loading..."
  }
);

const emit = defineEmits<{
  "update:modelValue": [value: string];
}>();

const editorHostRef = ref<HTMLDivElement | null>(null);
const editorView = shallowRef<EditorView | null>(null);
const editableCompartment = new Compartment();
const placeholderCompartment = new Compartment();
const editorAttributesCompartment = new Compartment();
let isApplyingExternalChange = false;

const directivePunctuationDecoration = Decoration.mark({ class: "cm-cho-directive-punctuation" });
const directiveKeyDecoration = Decoration.mark({ class: "cm-cho-directive-key" });
const directiveValueDecoration = Decoration.mark({ class: "cm-cho-directive-value" });
const sectionKeyDecoration = Decoration.mark({ class: "cm-cho-section-key" });
const chordDecoration = Decoration.mark({ class: "cm-cho-chord" });
const tabDecoration = Decoration.mark({ class: "cm-cho-tab-line" });

const sectionDirectiveKeys = new Set([
  "c",
  "comment",
  "chorus",
  "soc",
  "start_of_chorus",
  "verse",
  "sov",
  "start_of_verse",
  "bridge",
  "sob",
  "start_of_bridge",
  "solo",
  "sos",
  "start_of_solo",
  "tab",
  "sot",
  "start_of_tab"
]);

const tabStartDirectiveKeys = new Set(["sot", "start_of_tab"]);
const tabEndDirectiveKeys = new Set(["eot", "end_of_tab"]);

type DirectiveParts = {
  key: string;
  openBraceFrom: number;
  openBraceTo: number;
  keyFrom: number;
  keyTo: number;
  colonFrom: number | null;
  colonTo: number | null;
  valueFrom: number | null;
  valueTo: number | null;
  closeBraceFrom: number;
  closeBraceTo: number;
};

function parseDirectiveParts(line: string): DirectiveParts | null {
  if (!/^\s*\{[^}]+\}\s*$/.test(line)) {
    return null;
  }

  const openBraceFrom = line.indexOf("{");
  const closeBraceFrom = line.lastIndexOf("}");
  if (openBraceFrom === -1 || closeBraceFrom <= openBraceFrom) {
    return null;
  }

  const contentStart = openBraceFrom + 1;
  const content = line.slice(contentStart, closeBraceFrom);
  const colonIndex = content.indexOf(":");
  const rawKey = colonIndex === -1 ? content : content.slice(0, colonIndex);
  const key = rawKey.trim();
  if (!key) {
    return null;
  }

  const keyTrimOffset = rawKey.length - rawKey.trimStart().length;
  const keyFrom = contentStart + keyTrimOffset;
  const keyTo = keyFrom + key.length;
  const colonFrom = colonIndex === -1 ? null : contentStart + colonIndex;
  const rawValue = colonIndex === -1 ? "" : content.slice(colonIndex + 1);
  const value = rawValue.trim();
  const valueTrimOffset = rawValue.length - rawValue.trimStart().length;
  const valueFrom = colonIndex === -1 || !value ? null : contentStart + colonIndex + 1 + valueTrimOffset;
  const valueTo = valueFrom === null ? null : valueFrom + value.length;

  return {
    key: key.toLowerCase(),
    openBraceFrom,
    openBraceTo: openBraceFrom + 1,
    keyFrom,
    keyTo,
    colonFrom,
    colonTo: colonFrom === null ? null : colonFrom + 1,
    valueFrom,
    valueTo,
    closeBraceFrom,
    closeBraceTo: closeBraceFrom + 1
  };
}

function addMark(builder: RangeSetBuilder<Decoration>, from: number | null, to: number | null, decoration: Decoration, lineStart: number): void {
  if (from === null || to === null || from >= to) {
    return;
  }

  builder.add(lineStart + from, lineStart + to, decoration);
}

function buildChordProDecorations(view: EditorView): DecorationSet {
  const builder = new RangeSetBuilder<Decoration>();
  const chordPattern = /\[[^\]\r\n]+]/g;
  let inTabBlock = false;

  for (let lineNumber = 1; lineNumber <= view.state.doc.lines; lineNumber += 1) {
    const line = view.state.doc.line(lineNumber);
    const directiveParts = parseDirectiveParts(line.text);
    const directiveKey = directiveParts?.key ?? null;
    const isDirective = directiveParts !== null;
    const isSectionDirective = directiveKey !== null && sectionDirectiveKeys.has(directiveKey);
    const isTabStart = directiveKey !== null && tabStartDirectiveKeys.has(directiveKey);
    const isTabEnd = directiveKey !== null && tabEndDirectiveKeys.has(directiveKey);

    if (directiveParts) {
      addMark(builder, directiveParts.openBraceFrom, directiveParts.openBraceTo, directivePunctuationDecoration, line.from);
      addMark(builder, directiveParts.keyFrom, directiveParts.keyTo, isSectionDirective ? sectionKeyDecoration : directiveKeyDecoration, line.from);
      addMark(builder, directiveParts.colonFrom, directiveParts.colonTo, directivePunctuationDecoration, line.from);
      addMark(builder, directiveParts.valueFrom, directiveParts.valueTo, directiveValueDecoration, line.from);
      addMark(builder, directiveParts.closeBraceFrom, directiveParts.closeBraceTo, directivePunctuationDecoration, line.from);
    } else if (inTabBlock && line.from < line.to) {
      builder.add(line.from, line.to, tabDecoration);
    } else {
      chordPattern.lastIndex = 0;
      let chordMatch: RegExpExecArray | null;
      while ((chordMatch = chordPattern.exec(line.text)) !== null) {
        const chordText = chordMatch[0].slice(1, -1).trim();
        if (!chordText) {
          continue;
        }

        builder.add(line.from + chordMatch.index, line.from + chordMatch.index + chordMatch[0].length, chordDecoration);
      }
    }

    if (isTabStart) {
      inTabBlock = true;
    }

    if (isTabEnd) {
      inTabBlock = false;
    }
  }

  return builder.finish();
}

const chordProHighlightExtension = ViewPlugin.fromClass(
  class {
    decorations: DecorationSet;

    constructor(view: EditorView) {
      this.decorations = buildChordProDecorations(view);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) {
        this.decorations = buildChordProDecorations(update.view);
      }
    }
  },
  {
    decorations: (plugin) => plugin.decorations
  }
);

function createEditableExtensions(): Extension {
  const isEditable = !props.disabled;
  return [
    EditorView.editable.of(isEditable),
    EditorState.readOnly.of(!isEditable)
  ];
}

function createPlaceholderExtension(): Extension {
  return editorPlaceholder(props.placeholder);
}

function createEditorAttributesExtension(): Extension {
  return EditorView.editorAttributes.of({
    "aria-busy": props.loading ? "true" : "false",
    "aria-label": "ChordPro editor"
  });
}

function createEditorState(): EditorState {
  return EditorState.create({
    doc: props.modelValue,
    extensions: [
      history(),
      drawSelection(),
      dropCursor(),
      EditorView.lineWrapping,
      keymap.of([...defaultKeymap, ...historyKeymap]),
      editableCompartment.of(createEditableExtensions()),
      placeholderCompartment.of(createPlaceholderExtension()),
      editorAttributesCompartment.of(createEditorAttributesExtension()),
      chordProHighlightExtension,
      EditorView.updateListener.of((update) => {
        if (!update.docChanged || isApplyingExternalChange) {
          return;
        }

        emit("update:modelValue", update.state.doc.toString());
      })
    ]
  });
}

function syncEditorDocument(value: string): void {
  const view = editorView.value;
  if (!view) {
    return;
  }

  const currentValue = view.state.doc.toString();
  if (currentValue === value) {
    return;
  }

  isApplyingExternalChange = true;
  try {
    view.dispatch({
      changes: {
        from: 0,
        to: currentValue.length,
        insert: value
      },
      annotations: Transaction.addToHistory.of(false)
    });
  } finally {
    isApplyingExternalChange = false;
  }
}

function scrollToTop(): void {
  const view = editorView.value;
  if (!view) {
    return;
  }

  view.scrollDOM.scrollTop = 0;
  view.scrollDOM.scrollLeft = 0;
}

defineExpose({
  scrollToTop
});

onMounted(() => {
  if (!editorHostRef.value) {
    return;
  }

  editorView.value = new EditorView({
    state: createEditorState(),
    parent: editorHostRef.value
  });
});

onBeforeUnmount(() => {
  editorView.value?.destroy();
  editorView.value = null;
});

watch(
  () => props.modelValue,
  (value) => {
    syncEditorDocument(value);
  }
);

watch(
  () => props.disabled,
  () => {
    editorView.value?.dispatch({
      effects: editableCompartment.reconfigure(createEditableExtensions())
    });
  }
);

watch(
  () => props.placeholder,
  () => {
    editorView.value?.dispatch({
      effects: placeholderCompartment.reconfigure(createPlaceholderExtension())
    });
  }
);

watch(
  () => props.loading,
  () => {
    editorView.value?.dispatch({
      effects: editorAttributesCompartment.reconfigure(createEditorAttributesExtension())
    });
  }
);
</script>

<template>
  <section class="editor-pane">
    <div v-if="$slots.header" class="editor-header">
      <slot name="header" />
    </div>

    <div class="editor-body">
      <div
        ref="editorHostRef"
        :class="['editor-codemirror', { 'is-disabled': disabled }]"
      />

      <LoadingOverlayCard
        v-if="loading"
        :message="loadingMessage"
        :scrim="modelValue.trim().length > 0"
      />
    </div>

    <div v-if="$slots.actions" class="editor-actions">
      <slot name="actions" />
    </div>
  </section>
</template>

<style scoped>
.editor-pane {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 0.85rem;
  min-height: 0;
}

.editor-body {
  position: relative;
  display: flex;
  flex: 1;
  min-height: 0;
}

.editor-codemirror {
  flex: 1;
  display: flex;
  min-width: 0;
  min-height: 0;
}

.editor-codemirror :deep(.cm-editor) {
  flex: 1;
  width: 100%;
  min-height: 0;
  border: 1px solid rgba(47, 59, 49, 0.16);
  background: #fffef9;
  color: #1f251f;
  font: inherit;
  box-sizing: border-box;
}

.editor-codemirror :deep(.cm-editor.cm-focused) {
  outline: 2px solid rgba(55, 81, 59, 0.24);
  outline-offset: -2px;
}

.editor-codemirror :deep(.cm-scroller) {
  overflow: auto;
  font-family: var(--editor-monospace-family);
  line-height: 1.5;
}

.editor-codemirror :deep(.cm-content) {
  min-height: 100%;
  padding: 0.9rem 1rem;
  caret-color: #1f251f;
}

.editor-codemirror :deep(.cm-line) {
  padding: 0;
}

.editor-codemirror :deep(.cm-placeholder) {
  color: rgba(31, 37, 31, 0.46);
}

.editor-codemirror :deep(.cm-selectionBackground),
.editor-codemirror :deep(.cm-content ::selection) {
  background: rgba(55, 81, 59, 0.22);
}

.editor-codemirror.is-disabled :deep(.cm-editor) {
  cursor: default;
}

.editor-codemirror :deep(.cm-cho-directive-punctuation) {
  color: #9a6a2e;
  font-weight: 720;
}

.editor-codemirror :deep(.cm-cho-directive-key),
.editor-codemirror :deep(.cm-cho-directive) {
  color: #9a6a2e;
  font-weight: 720;
}

.editor-codemirror :deep(.cm-cho-directive-value) {
  color: #5f7a61;
  font-weight: 560;
}

.editor-codemirror :deep(.cm-cho-section-key) {
  color: #a66a1f;
  font-weight: 780;
}

.editor-codemirror :deep(.cm-cho-chord) {
  color: #2f7a55;
  font-weight: 750;
}

.editor-codemirror :deep(.cm-cho-tab-line) {
  color: #526152;
}

.editor-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.65rem;
}
</style>
