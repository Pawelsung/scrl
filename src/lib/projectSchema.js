// Validation for project data coming from outside the running app: imported
// JSON files and restored drafts. Anything that is not plainly ours is dropped
// so a malformed or hostile file cannot reach Konva or the export canvas.

import { RATIOS, TEMPLATES, DEFAULT_CANVAS_COLOR, DEFAULT_CANVAS_COLOR_2 } from "../constants/editor.js";

export const MAX_PROJECT_FILE_BYTES = 300 * 1024 * 1024;

const MAX_SLIDES = 10;
const MAX_ITEMS = 500;
const MAX_TEXT_LENGTH = 5000;
const ELEMENT_TYPES = new Set(["image", "text", "sticker", "frameRect"]);
const BACKGROUND_MODES = new Set(["solid", "gradient"]);
const TEMPLATE_IDS = new Set(TEMPLATES.map((template) => template.id));
// Only inline raster images: remote URLs would leak requests and taint the export canvas.
const SAFE_IMAGE_SRC = /^data:image\/(png|jpe?g|webp|gif);base64,[a-z0-9+/=\s]+$/i;
const HEX_COLOR = /^#[0-9a-f]{3,8}$/i;
const SAFE_ID = /^[\w:.-]{1,120}$/;

export class ProjectValidationError extends Error {}

const isPlainObject = (value) => !!value && typeof value === "object" && !Array.isArray(value);
const isSafeImageSrc = (value) => typeof value === "string" && SAFE_IMAGE_SRC.test(value);
const isSafeId = (value) => typeof value === "string" && SAFE_ID.test(value);

// Recursively keep only JSON-safe primitives: finite numbers, bounded strings, booleans.
function sanitizeValue(value, depth = 0) {
  if (depth > 6) return undefined;
  if (typeof value === "number") return Number.isFinite(value) ? value : undefined;
  if (typeof value === "string") return value.length <= MAX_TEXT_LENGTH ? value : value.slice(0, MAX_TEXT_LENGTH);
  if (typeof value === "boolean" || value === null) return value;
  if (Array.isArray(value)) {
    return value.slice(0, MAX_ITEMS).map((item) => sanitizeValue(item, depth + 1)).filter((item) => item !== undefined);
  }
  if (isPlainObject(value)) {
    const result = {};
    for (const [key, item] of Object.entries(value)) {
      if (key === "__proto__" || key === "constructor" || key === "prototype") continue;
      const clean = sanitizeValue(item, depth + 1);
      if (clean !== undefined) result[key] = clean;
    }
    return result;
  }
  return undefined;
}

function sanitizeImage(image) {
  if (!isPlainObject(image) || !isSafeId(image.id) || !isSafeImageSrc(image.src)) return null;
  const width = Number(image.width);
  const height = Number(image.height);
  if (!(width > 0 && height > 0 && width <= 20000 && height <= 20000)) return null;
  return {
    id: image.id,
    name: typeof image.name === "string" ? image.name.slice(0, 200) : "image",
    src: image.src,
    thumbSrc: isSafeImageSrc(image.thumbSrc) ? image.thumbSrc : image.src,
    width,
    height,
    mediaType: "image",
  };
}

function sanitizeElement(element, assetIds) {
  if (!isPlainObject(element) || !isSafeId(element.id) || !ELEMENT_TYPES.has(element.type)) return null;
  const clean = sanitizeValue(element);
  if ("src" in clean && !isSafeImageSrc(clean.src)) delete clean.src;
  if (clean.sourceAssetId && !assetIds.has(clean.sourceAssetId)) delete clean.sourceAssetId;
  if (clean.type === "image" && !clean.src && !clean.sourceAssetId) return null;
  return clean;
}

function sanitizeSlot(slot, assetIds) {
  if (!isPlainObject(slot) || !isSafeId(slot.id)) return null;
  const clean = sanitizeValue(slot);
  if ("imageSrc" in clean && !isSafeImageSrc(clean.imageSrc)) delete clean.imageSrc;
  if (clean.imageAssetId && !assetIds.has(clean.imageAssetId)) delete clean.imageAssetId;
  return clean;
}

function sanitizeColor(value, fallback) {
  return typeof value === "string" && HEX_COLOR.test(value) ? value : fallback;
}

// Returns a project snapshot safe to hand to applySnapshot. When `images` is
// omitted from the input (history snapshots) it is omitted from the output too.
export function sanitizeProject(data) {
  if (!isPlainObject(data)) throw new ProjectValidationError("檔案內容不是 scrl 專案");
  const hasImages = Array.isArray(data.images);
  const images = hasImages ? data.images.slice(0, MAX_ITEMS).map(sanitizeImage).filter(Boolean) : undefined;
  const assetIds = new Set((images || []).map((image) => image.id));
  const elements = Array.isArray(data.elements)
    ? data.elements.slice(0, MAX_ITEMS).map((item) => sanitizeElement(item, assetIds)).filter(Boolean)
    : [];
  const templateSlots = Array.isArray(data.templateSlots)
    ? data.templateSlots.slice(0, MAX_ITEMS).map((slot) => sanitizeSlot(slot, assetIds)).filter(Boolean)
    : [];
  const slides = Math.round(Number(data.slides));

  return {
    slides: slides >= 1 && slides <= MAX_SLIDES ? slides : 3,
    ratioKey: Object.hasOwn(RATIOS, data.ratioKey) ? data.ratioKey : "4:5",
    backgroundMode: BACKGROUND_MODES.has(data.backgroundMode) ? data.backgroundMode : "solid",
    bgPrimary: sanitizeColor(data.bgPrimary, DEFAULT_CANVAS_COLOR),
    bgSecondary: sanitizeColor(data.bgSecondary, DEFAULT_CANVAS_COLOR_2),
    ...(hasImages ? { images } : {}),
    elements,
    templateSlots,
    layerOrder: Array.isArray(data.layerOrder) ? sanitizeValue(data.layerOrder) : [],
    templateId: TEMPLATE_IDS.has(data.templateId) ? data.templateId : "blank",
  };
}
