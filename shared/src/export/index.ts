import { loadImages } from "../images";
import { FORMATS_BY_TYPE, type ExportFormat } from "../schema";
import { fileName, MIME_TYPES, type ExportedFile, type ExportInput } from "./common";
import { renderDocx } from "./docx";
import { renderPdf } from "./pdf";
import { renderPptx } from "./pptx";

export { fileName, MIME_TYPES, type ExportedFile, type ExportInput } from "./common";

const RENDERERS: Record<ExportFormat, (input: ExportInput) => Promise<Buffer>> = {
  pdf: renderPdf,
  docx: renderDocx,
  pptx: renderPptx,
};

export async function exportDocument(format: ExportFormat, input: ExportInput): Promise<ExportedFile> {
  if (!FORMATS_BY_TYPE[input.content.type].includes(format)) {
    throw new Error(`${format} is not available for ${input.content.type}`);
  }
  const images = input.images ?? (input.content.type === "presentation" ? await loadImages(input.content) : undefined);
  return {
    buffer: await RENDERERS[format]({ ...input, images }),
    filename: fileName(input.content, format),
    mimeType: MIME_TYPES[format],
  };
}
