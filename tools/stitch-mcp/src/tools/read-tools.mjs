import * as z from "zod/v4";
import {
  fullDesignSystem,
  normalizeDesignSystemAsset,
  normalizeProject,
  normalizeScreen,
  stripResourcePrefix,
} from "../formatters.mjs";
import { callTool, fetchTextFromUrl } from "../stitch-client.mjs";

export function registerReadTools(server) {
  server.registerTool(
    "list_projects",
    {
      title: "List Stitch Projects",
      description: "List accessible Stitch projects with compact metadata for design exploration.",
    },
    async () => {
      const result = await callTool("list_projects", {});
      const projects = (result.projects ?? []).map(normalizeProject);

      return {
        projectCount: projects.length,
        projects,
      };
    },
  );

  server.registerTool(
    "get_project",
    {
      title: "Get Stitch Project",
      description: "Read one Stitch project with its screen instances and basic metadata.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
      },
    },
    async ({ projectId }) => {
      const result = await callTool("get_project", { name: `projects/${projectId}` });
      return normalizeProject(result);
    },
  );

  server.registerTool(
    "list_screens",
    {
      title: "List Stitch Screens",
      description: "List screens inside one Stitch project with compact metadata.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
      },
    },
    async ({ projectId }) => {
      const result = await callTool("list_screens", { projectId });
      const screens = (result.screens ?? []).map(normalizeScreen);

      return {
        projectId,
        screenCount: screens.length,
        screens,
      };
    },
  );

  server.registerTool(
    "get_screen",
    {
      title: "Get Stitch Screen",
      description: "Read one Stitch screen with metadata and direct asset URLs.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        screenId: z.string().describe("Bare Stitch screen id, without the screens/ prefix."),
      },
    },
    async ({ projectId, screenId }) => {
      const result = await callTool("get_screen", {
        name: `projects/${projectId}/screens/${screenId}`,
        projectId,
        screenId,
      });

      return normalizeScreen(result);
    },
  );

  server.registerTool(
    "list_design_systems",
    {
      title: "List Stitch Design Systems",
      description: "List design systems for one Stitch project with compact theme metadata.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
      },
    },
    async ({ projectId }) => {
      const result = await callTool("list_design_systems", { projectId });
      const designSystems = (result.designSystems ?? []).map(normalizeDesignSystemAsset);

      return {
        projectId,
        designSystemCount: designSystems.length,
        designSystems,
      };
    },
  );

  server.registerTool(
    "get_design_system",
    {
      title: "Get Stitch Design System",
      description:
        "Read one full Stitch design system, including the current theme and DESIGN.md content.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        assetId: z
          .string()
          .optional()
          .describe(
            "Optional bare asset id. If omitted, the tool uses the only design system in the project or errors when there are multiple.",
          ),
      },
    },
    async ({ projectId, assetId }) => {
      const result = await callTool("list_design_systems", { projectId });
      const designSystems = result.designSystems ?? [];

      if (designSystems.length === 0) {
        throw new Error(`Project ${projectId} has no design systems.`);
      }

      const selected =
        assetId == null
          ? selectSingleDesignSystem(projectId, designSystems)
          : designSystems.find((item) => stripResourcePrefix(item.name, "assets/") === assetId);

      if (!selected) {
        throw new Error(`Design system ${assetId} was not found in project ${projectId}.`);
      }

      return fullDesignSystem(selected);
    },
  );

  server.registerTool(
    "get_screen_image",
    {
      title: "Get Stitch Screen Image",
      description: "Return the screenshot URL for one Stitch screen.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        screenId: z.string().describe("Bare Stitch screen id, without the screens/ prefix."),
      },
    },
    async ({ projectId, screenId }) => {
      const result = await callTool("get_screen", {
        name: `projects/${projectId}/screens/${screenId}`,
        projectId,
        screenId,
      });

      return {
        projectId,
        screenId,
        title: result.title ?? null,
        imageUrl: result.screenshot?.downloadUrl ?? null,
      };
    },
  );

  server.registerTool(
    "get_screen_html",
    {
      title: "Get Stitch Screen HTML",
      description: "Download the generated HTML for one Stitch screen and return it inline.",
      inputSchema: {
        projectId: z.string().describe("Bare Stitch project id, without the projects/ prefix."),
        screenId: z.string().describe("Bare Stitch screen id, without the screens/ prefix."),
      },
    },
    async ({ projectId, screenId }) => {
      const result = await callTool("get_screen", {
        name: `projects/${projectId}/screens/${screenId}`,
        projectId,
        screenId,
      });

      const htmlUrl = result.htmlCode?.downloadUrl;

      if (!htmlUrl) {
        throw new Error(`Screen ${screenId} in project ${projectId} has no HTML export URL.`);
      }

      const html = await fetchTextFromUrl(htmlUrl);

      return {
        projectId,
        screenId,
        title: result.title ?? null,
        htmlUrl,
        html,
      };
    },
  );
}

function selectSingleDesignSystem(projectId, designSystems) {
  if (designSystems.length === 1) {
    return designSystems[0];
  }

  const available = designSystems
    .map((item) => stripResourcePrefix(item.name, "assets/"))
    .filter(Boolean)
    .join(", ");

  throw new Error(
    `Project ${projectId} has multiple design systems. Pass assetId explicitly. Available asset ids: ${available}`,
  );
}
