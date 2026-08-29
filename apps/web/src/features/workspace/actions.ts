export type WorkspaceActions = {
  refresh: () => Promise<void>;
  startAgain: () => void;
  reset: () => Promise<void>;
  upload: (file: File, note?: string) => Promise<void>;
  chooseScenario: (id: string) => Promise<void>;
  resolveMatch: (
    id: string,
    action: "accept" | "select" | "exclude",
    selectedProductId?: string,
  ) => Promise<void>;
  resolveQuantities: (
    lines: readonly Readonly<{
      parsedLineId: string;
      requestedQuantity: string;
    }>[],
  ) => Promise<void>;
  startNegotiation: () => Promise<void>;
  previewPolicy: () => Promise<void>;
  confirmPolicy: () => void;
  preview: () => Promise<void>;
  issue: () => Promise<void>;
  viewPurchaseOrder: (id: string) => Promise<void>;
  sendCopilotMessage: (message: string) => Promise<void>;
};
