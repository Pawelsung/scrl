export const RATIOS = {
  "4:5": { w: 1080, h: 1350 },
  "1:1": { w: 1080, h: 1080 },
  "16:9": { w: 1080, h: 608 },
  "9:16": { w: 1080, h: 1920 },
};

export const TEMPLATES = [
  { id: "blank", name: "空白畫布" },
  { id: "magazine", name: "雜誌留白" },
  { id: "cover", name: "大標題封面" },
  { id: "film", name: "底片拼貼" },
  { id: "split", name: "左右文圖" },
  { id: "frame", name: "留白框版型" },
  { id: "grid4", name: "四格拼貼" },
  { id: "duo", name: "雙圖對照" },
  { id: "triptych", name: "三連圖集" },
  { id: "polaroid", name: "拍立得拼貼" },
  { id: "quote", name: "語錄留白" },
  { id: "product", name: "產品展示" },
  { id: "checker", name: "棋盤拼貼" },
  { id: "swap-square", name: "中心方形置換" },
];

export const FONT_OPTIONS = [
  { label: "Inter", value: "Inter, system-ui, sans-serif" },
  { label: "Arial", value: "Arial, Helvetica, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times", value: '"Times New Roman", Times, serif' },
  { label: "Courier", value: '"Courier New", Courier, monospace' },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet", value: '"Trebuchet MS", sans-serif' },
  { label: "Impact", value: "Impact, Haettenschweiler, sans-serif" },
];

export const STICKERS = [
  { id: "tape", label: "紙膠帶", type: "tape" },
  { id: "star", label: "星星", type: "star" },
  { id: "circle", label: "圓點", type: "circle" },
  { id: "heart", label: "愛心", type: "heart" },
  { id: "diamond", label: "菱形", type: "diamond" },
  { id: "triangle", label: "三角形", type: "triangle" },
  { id: "spark", label: "閃光", type: "spark" },
];

export const SNAP_THRESHOLD = 18;
export const SNAP_RELEASE = 28;
export const EDGE_OVERDRAG = 140;
export const MIN_ZOOM = 0.1;
export const MAX_ZOOM = 3;
export const SLOT_NUDGE = 24;
export const SLOT_ZOOM_STEP = 0.08;
export const MAX_IMAGE_DIMENSION_DESKTOP = 3200;
export const MAX_IMAGE_DIMENSION_MOBILE = 2200;
export const DEFAULT_CANVAS_COLOR = "#d9dde3";
export const DEFAULT_CANVAS_COLOR_2 = "#eef0f3";
