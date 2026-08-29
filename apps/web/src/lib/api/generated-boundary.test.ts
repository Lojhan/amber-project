import { expectTypeOf, it } from "vitest";
import type {
  CompleteUploadRequest,
  PurchaseOrderResponse,
  QuotationResponse,
  ReserveUploadRequest,
  UploadReservationResponse,
} from "./types";
import type { ProcurementApi } from "./workflow";

it("binds workflow requests and responses to generated operations", () => {
  expectTypeOf<
    Parameters<ProcurementApi["complete"]>[0]
  >().toEqualTypeOf<CompleteUploadRequest>();
  expectTypeOf<Parameters<ProcurementApi["reserve"]>[0]>().toEqualTypeOf<
    ReserveUploadRequest["filename"]
  >();
  expectTypeOf<
    Awaited<ReturnType<ProcurementApi["reserve"]>>
  >().toEqualTypeOf<UploadReservationResponse>();
  expectTypeOf<
    Awaited<ReturnType<ProcurementApi["quotation"]>>
  >().toEqualTypeOf<QuotationResponse>();
  expectTypeOf<
    Awaited<ReturnType<ProcurementApi["issue"]>>
  >().toEqualTypeOf<PurchaseOrderResponse>();
});
