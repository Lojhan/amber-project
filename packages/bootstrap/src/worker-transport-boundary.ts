import { asBrandId, type BrandId } from "@procurement/domain";

export const toBrandScopedWorkerCommand = <
  Command extends Readonly<{ brandId: string }>,
>(
  command: Command,
): Omit<Command, "brandId"> & Readonly<{ brandId: BrandId }> => ({
  ...command,
  brandId: asBrandId(command.brandId),
});
