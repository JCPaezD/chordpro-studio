import * as z from "zod/v4";
import {
  fullDesignSystem,
  normalizeMutationResult,
  normalizeProject,
  stripResourcePrefix,
} from "../formatters.mjs";
import { callTool } from "../stitch-client.mjs";

const DEVICE_TYPES = [
  "DEVICE_TYPE_UNSPECIFIED",
  "MOBILE",
  "DESKTOP",
  "TABLET",
  "AGNOSTIC",
];

const MODEL_IDS = [
  "MODEL_ID_UNSPECIFIED",
  "GEMINI_3_PRO",
  "GEMINI_3_FLASH",
  "GEMINI_3_1_PRO",
];

const PREFERRED_MUTATION_MODEL_ID = "GEMINI_3_1_PRO";

const VARIANT_ASPECTS = [
  "VARIANT_ASPECT_UNSPECIFIED",
  "LAYOUT",
  "COLOR_SCHEME",
  "IMAGES",
  "TEXT_FONT",
  "TEXT_CONTENT",
];

const CREATIVE_RANGES = [
  "CREATIVE_RANGE_UNSPECIFIED",
  "REFINE",
  "EXPLORE",
  "REIMAGINE",
];

const designThemeSchema = z.object({
  colorMode: z.string().min(1),
  headlineFont: z.string().min(1),
  bodyFont: z.string().min(1),
  roundness: z.string().min(1),
  customColor: z.string().min(1),
});

const designSystemSchema = z.object({
  displayName: z.string().trim().min(1),
  theme: designThemeSchema.passthrough(),
});

function optionalEnum(values, description) {
  return z.enum(values).optional().describe(description);
}

function preferredModelDescription() {
  return `Optional Stitch model id. If omitted, this MCP defaults to ${PREFERRED_MUTATION_MODEL_ID} for more stable, higher-fidelity mutation results.`;
}

export function registerMutationTools(server) {
  server.registerTool(
    "create_project",
    {
      title: "Create Stitch Project",
      description: "Create a new Stitch project container for MCP-driven design exploration.",
      inputSchema: {
        title: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe("Optional project title shown in Stitch."),
      },
    },
    async ({ title }) => {
      const result = await callTool("create_project", title ? { title } : {});
      return normalizeProject(result);
    },
  );

  server.registerTool(
    "create_design_system",
    {
      title: "Create Stitch Design System",
      description:
        "Create a design system for a project or globally, using a mostly raw Stitch designSystem payload.",
      inputSchema: {
        projectId: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Optional bare Stitch project id. If omitted, Stitch creates a global design system asset.",
          ),
        designSystem: z
          .any()
          .describe(
            "Full Stitch designSystem payload. Must include displayName and theme with at least colorMode, headlineFont, bodyFont, roundness, and customColor.",
          ),
      },
    },
    async ({ projectId, designSystem }) => {
      const validatedDesignSystem = parseDesignSystem(designSystem);
      const args = projectId
        ? { projectId, designSystem: validatedDesignSystem }
        : { designSystem: validatedDesignSystem };
      const result = await callTool("create_design_system", args);

      return fullDesignSystem({
        ...result,
        projectId: projectId ?? result.projectId ?? null,
      });
    },
  );

  server.registerTool(
    "update_design_system",
    {
      title: "Update Stitch Design System",
      description:
        "Update one design system in a project. If assetId is omitted, the tool uses the only design system in the project or errors when there are multiple.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        assetId: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Optional bare asset id. If omitted, the tool uses the only design system in the project or errors when there are multiple.",
          ),
        designSystem: z
          .any()
          .describe(
            "Full Stitch designSystem payload. Must include displayName and theme with at least colorMode, headlineFont, bodyFont, roundness, and customColor.",
          ),
      },
    },
    async ({ projectId, assetId, designSystem }) => {
      const validatedDesignSystem = parseDesignSystem(designSystem);
      const selectedAssetId = await resolveAssetId(projectId, assetId);
      const result = await callTool("update_design_system", {
        name: `assets/${selectedAssetId}`,
        projectId,
        designSystem: validatedDesignSystem,
      });

      return fullDesignSystem({
        ...result,
        projectId,
      });
    },
  );

  server.registerTool(
    "apply_design_system",
    {
      title: "Apply Stitch Design System",
      description:
        "Apply a project design system to one or more screen instances. Accepts screenInstanceIds and/or sourceScreenIds, then resolves the actual selectedScreenInstances payload automatically.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        assetId: z
          .string()
          .trim()
          .min(1)
          .optional()
          .describe(
            "Optional bare asset id. If omitted, the tool uses the only design system in the project or errors when there are multiple.",
          ),
        screenInstanceIds: z
          .array(z.string().trim().min(1))
          .optional()
          .describe("Optional list of screen instance ids from get_project()."),
        sourceScreenIds: z
          .array(z.string().trim().min(1))
          .optional()
          .describe(
            "Optional list of bare source screen ids. Matching screen instances are resolved automatically from get_project().",
          ),
      },
    },
    async ({ projectId, assetId, screenInstanceIds, sourceScreenIds }) => {
      const selectedScreenInstances = await resolveSelectedScreenInstances(projectId, {
        screenInstanceIds,
        sourceScreenIds,
      });
      const selectedAssetId = await resolveAssetId(projectId, assetId);
      const result = await callTool("apply_design_system", {
        projectId,
        assetId: selectedAssetId,
        selectedScreenInstances,
      });

      return {
        assetId: selectedAssetId,
        selectedScreenInstanceCount: selectedScreenInstances.length,
        selectedScreenInstances,
        ...normalizeMutationResult(result),
      };
    },
  );

  server.registerTool(
    "generate_screen_from_text",
    {
      title: "Generate Stitch Screen From Text",
      description:
        `Generate a new Stitch screen from a prompt. Long-running: do not retry automatically if the connection drops. When modelId is omitted, this MCP defaults to ${PREFERRED_MUTATION_MODEL_ID}.`,
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        prompt: z.string().trim().min(1).describe("Prompt used to generate the screen."),
        deviceType: optionalEnum(
          DEVICE_TYPES,
          "Optional Stitch device type. Leave empty to let Stitch choose its default.",
        ),
        modelId: optionalEnum(
          MODEL_IDS,
          preferredModelDescription(),
        ),
      },
    },
    async ({ projectId, prompt, deviceType, modelId }) => {
      const result = await callTool("generate_screen_from_text", compactArgs({
        projectId,
        prompt,
        deviceType,
        modelId: resolvePreferredModelId(modelId),
      }));

      return normalizeMutationResult(result);
    },
  );

  server.registerTool(
    "edit_screens",
    {
      title: "Edit Stitch Screens",
      description:
        `Edit one or more existing Stitch screens from a prompt. Long-running: do not retry automatically if the connection drops. This is the preferred refinement route for screenshot-based UI iteration. When modelId is omitted, this MCP defaults to ${PREFERRED_MUTATION_MODEL_ID}.`,
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        selectedScreenIds: z
          .array(z.string().trim().min(1))
          .describe("Bare source screen ids to edit, without the screens/ prefix."),
        prompt: z.string().trim().min(1).describe("Prompt describing the requested edits."),
        deviceType: optionalEnum(
          DEVICE_TYPES,
          "Optional Stitch device type. Leave empty to let Stitch choose its default.",
        ),
        modelId: optionalEnum(
          MODEL_IDS,
          preferredModelDescription(),
        ),
      },
    },
    async ({ projectId, selectedScreenIds, prompt, deviceType, modelId }) => {
      ensureNonEmptyList("selectedScreenIds", selectedScreenIds);

      const result = await callTool("edit_screens", compactArgs({
        projectId,
        selectedScreenIds,
        prompt,
        deviceType,
        modelId: resolvePreferredModelId(modelId),
      }));

      return normalizeMutationResult(result);
    },
  );

  server.registerTool(
    "generate_variants",
    {
      title: "Generate Stitch Variants",
      description:
        `Generate variants for one or more existing Stitch screens. Long-running: do not retry automatically if the connection drops. When modelId is omitted, this MCP defaults to ${PREFERRED_MUTATION_MODEL_ID} to improve reliability of generated HTML and icon rendering.`,
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        selectedScreenIds: z
          .array(z.string().trim().min(1))
          .describe("Bare source screen ids to generate variants from."),
        prompt: z
          .string()
          .trim()
          .min(1)
          .describe("Prompt describing how the variants should differ from the source screen."),
        variantOptions: z
          .object({
            variantCount: z.number().int().min(1).max(5).optional(),
            creativeRange: z.enum(CREATIVE_RANGES).optional(),
            aspects: z.array(z.enum(VARIANT_ASPECTS)).optional(),
          })
          .passthrough()
          .describe(
            "Variant generation options. At minimum you can pass variantCount, creativeRange, and aspects.",
          ),
        deviceType: optionalEnum(
          DEVICE_TYPES,
          "Optional Stitch device type. Leave empty to let Stitch choose its default.",
        ),
        modelId: optionalEnum(
          MODEL_IDS,
          preferredModelDescription(),
        ),
      },
    },
    async ({ projectId, selectedScreenIds, prompt, variantOptions, deviceType, modelId }) => {
      ensureNonEmptyList("selectedScreenIds", selectedScreenIds);

      const result = await callTool("generate_variants", compactArgs({
        projectId,
        selectedScreenIds,
        prompt,
        variantOptions,
        deviceType,
        modelId: resolvePreferredModelId(modelId),
      }));

      return normalizeMutationResult(result);
    },
  );
}

function compactArgs(args) {
  return Object.fromEntries(Object.entries(args).filter(([, value]) => value !== undefined));
}

function resolvePreferredModelId(modelId) {
  if (!modelId || modelId === "MODEL_ID_UNSPECIFIED") {
    return PREFERRED_MUTATION_MODEL_ID;
  }

  return modelId;
}

function parseDesignSystem(designSystem) {
  return designSystemSchema.parse(designSystem);
}

function ensureNonEmptyList(name, value) {
  if (!Array.isArray(value) || value.length === 0) {
    throw new Error(`${name} must contain at least one item.`);
  }
}

async function resolveAssetId(projectId, assetId) {
  if (assetId) {
    return assetId;
  }

  const result = await callTool("list_design_systems", { projectId });
  const designSystems = result.designSystems ?? [];

  if (designSystems.length === 0) {
    throw new Error(`Project ${projectId} has no design systems.`);
  }

  if (designSystems.length > 1) {
    const availableIds = designSystems
      .map((item) => stripResourcePrefix(item.name, "assets/"))
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `Project ${projectId} has multiple design systems. Pass assetId explicitly. Available asset ids: ${availableIds}`,
    );
  }

  return stripResourcePrefix(designSystems[0].name, "assets/");
}

async function resolveSelectedScreenInstances(projectId, { screenInstanceIds, sourceScreenIds }) {
  const requestedScreenInstanceIds = new Set(screenInstanceIds ?? []);
  const requestedSourceScreenIds = new Set(sourceScreenIds ?? []);

  if (requestedScreenInstanceIds.size === 0 && requestedSourceScreenIds.size === 0) {
    throw new Error("Pass at least one screenInstanceIds or sourceScreenIds entry.");
  }

  const project = await callTool("get_project", { name: `projects/${projectId}` });
  const instances = project.screenInstances ?? [];
  const matchedInstances = new Map();

  for (const instance of instances) {
    const sourceScreen = instance.sourceScreen ?? null;
    const sourceScreenId = stripSourceScreenId(sourceScreen);

    if (requestedScreenInstanceIds.has(instance.id) || requestedSourceScreenIds.has(sourceScreenId)) {
      if (sourceScreen) {
        matchedInstances.set(instance.id, {
          id: instance.id,
          sourceScreen,
        });
      }
    }
  }

  if (matchedInstances.size === 0) {
    const availableSourceIds = instances
      .map((instance) => stripSourceScreenId(instance.sourceScreen))
      .filter(Boolean)
      .join(", ");
    const availableInstanceIds = instances
      .map((instance) => instance.id)
      .filter(Boolean)
      .join(", ");

    throw new Error(
      `No matching screen instances were found in project ${projectId}. Available instance ids: ${availableInstanceIds}. Available source screen ids: ${availableSourceIds}`,
    );
  }

  return Array.from(matchedInstances.values());
}

function stripSourceScreenId(resourceName) {
  if (!resourceName) {
    return null;
  }

  const parts = resourceName.split("/screens/");
  return parts.length === 2 ? parts[1] : null;
}
