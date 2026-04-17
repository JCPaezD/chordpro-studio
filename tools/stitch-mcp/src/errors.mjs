export function formatError(error) {
  if (error instanceof Error) {
    return error.message;
  }

  return String(error);
}

export function toolErrorResult(message) {
  return {
    isError: true,
    content: [
      {
        type: "text",
        text: message,
      },
    ],
  };
}
