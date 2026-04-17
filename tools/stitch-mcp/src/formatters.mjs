function sortObjectKeys(value) {
  if (Array.isArray(value)) {
    return value.map(sortObjectKeys);
  }

  if (value && typeof value === "object") {
    return Object.keys(value)
      .sort()
      .reduce((acc, key) => {
        acc[key] = sortObjectKeys(value[key]);
        return acc;
      }, {});
  }

  return value;
}

export function buildToolText(title, payload) {
  const sortedPayload = sortObjectKeys(payload);
  return `${title}\n\n${JSON.stringify(sortedPayload, null, 2)}`;
}

export function toolSuccess(title, payload) {
  return {
    content: [
      {
        type: "text",
        text: buildToolText(title, payload),
      },
    ],
    structuredContent: payload,
  };
}

export function normalizeProject(project) {
  return {
    projectId: stripResourcePrefix(project.name, "projects/"),
    name: project.name,
    title: project.title ?? null,
    projectType: project.projectType ?? null,
    deviceType: project.deviceType ?? null,
    visibility: project.visibility ?? null,
    origin: project.origin ?? null,
    createTime: project.createTime ?? null,
    updateTime: project.updateTime ?? null,
    thumbnailUrl: project.thumbnailScreenshot?.downloadUrl ?? null,
    screenInstances:
      project.screenInstances?.map((instance) => ({
        id: instance.id ?? null,
        type: instance.type ?? null,
        hidden: instance.hidden ?? false,
        sourceScreen: instance.sourceScreen ?? null,
        sourceScreenId: stripScreenId(instance.sourceScreen),
        sourceAsset: instance.sourceAsset ?? null,
        sourceAssetId: stripResourcePrefix(instance.sourceAsset, "assets/"),
        width: instance.width ?? null,
        height: instance.height ?? null,
        x: instance.x ?? null,
        y: instance.y ?? null,
      })) ?? [],
  };
}

export function normalizeScreen(screen) {
  return {
    projectId: stripProjectId(screen.name ?? screen.projectId),
    screenId: screen.id ?? stripScreenId(screen.name),
    name: screen.name ?? null,
    title: screen.title ?? null,
    prompt: screen.prompt ?? null,
    generatedBy: screen.generatedBy ?? null,
    screenType: screen.screenType ?? null,
    deviceType: screen.deviceType ?? null,
    width: screen.width ?? null,
    height: screen.height ?? null,
    status: screen.screenMetadata?.status ?? null,
    summary: screen.screenMetadata?.summary ?? null,
    screenshotUrl: screen.screenshot?.downloadUrl ?? null,
    htmlUrl: screen.htmlCode?.downloadUrl ?? null,
  };
}

export function normalizeDesignSystemAsset(asset) {
  const theme = asset.designSystem?.theme ?? {};

  return {
    assetId: stripResourcePrefix(asset.name, "assets/"),
    name: asset.name,
    version: asset.version ?? null,
    displayName: asset.designSystem?.displayName ?? null,
    colorMode: theme.colorMode ?? null,
    colorVariant: theme.colorVariant ?? null,
    customColor: theme.customColor ?? null,
    headlineFont: theme.headlineFont ?? null,
    bodyFont: theme.bodyFont ?? null,
    labelFont: theme.labelFont ?? null,
    roundness: theme.roundness ?? null,
    hasDesignMd: Boolean(theme.designMd),
  };
}

export function fullDesignSystem(asset) {
  const theme = asset.designSystem?.theme ?? {};

  return {
    projectId: stripProjectId(asset.projectId),
    assetId: stripResourcePrefix(asset.name, "assets/"),
    name: asset.name,
    version: asset.version ?? null,
    displayName: asset.designSystem?.displayName ?? null,
    theme,
    designMd: theme.designMd ?? null,
  };
}

export function normalizeMutationResult(result) {
  const outputComponents = Array.isArray(result?.outputComponents) ? result.outputComponents : [];
  const screens = outputComponents
    .flatMap((component) => component?.design?.screens ?? [])
    .map((screen) => normalizeScreen({ ...screen, projectId: result?.projectId ?? screen?.projectId }));

  const designSystems = outputComponents.flatMap((component) => {
    const designSystem = component?.design?.designSystem;
    if (!designSystem) {
      return [];
    }

    return [
      {
        displayName: designSystem.displayName ?? null,
        theme: designSystem.theme ?? {},
        designMd: designSystem.theme?.designMd ?? null,
      },
    ];
  });

  const messages = outputComponents
    .map((component) => component?.text)
    .filter((value) => typeof value === "string" && value.trim().length > 0);

  const suggestions = outputComponents
    .map((component) => component?.suggestion)
    .filter((value) => typeof value === "string" && value.trim().length > 0);

  return {
    projectId: result?.projectId ?? null,
    sessionId: result?.sessionId ?? stripSessionId(result?.name),
    screenCount: screens.length,
    screens,
    designSystemCount: designSystems.length,
    designSystems,
    messageCount: messages.length,
    messages,
    suggestionCount: suggestions.length,
    suggestions,
  };
}

export function stripResourcePrefix(value, prefix) {
  if (!value) {
    return null;
  }

  return value.startsWith(prefix) ? value.slice(prefix.length) : value;
}

function stripProjectId(resourceNameOrId) {
  if (!resourceNameOrId) {
    return null;
  }

  if (!resourceNameOrId.startsWith("projects/")) {
    return resourceNameOrId;
  }

  const parts = resourceNameOrId.split("/");
  return parts[1] ?? null;
}

function stripScreenId(resourceName) {
  if (!resourceName) {
    return null;
  }

  const parts = resourceName.split("/");
  return parts.at(-1) ?? null;
}

function stripSessionId(resourceName) {
  if (!resourceName) {
    return null;
  }

  const parts = resourceName.split("/sessions/");
  return parts.length === 2 ? parts[1] : null;
}
