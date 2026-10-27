import { createSlot, uid } from "./editorUtils.js";

export function normalizeLayerOrder(order, elements, slots) {
  const elementIds = new Set(elements.map((item) => item.id));
  const slotIds = new Set(slots.map((slot) => slot.id));
  const seen = new Set();
  const normalized = [];

  for (const entry of Array.isArray(order) ? order : []) {
    if (!entry || !entry.id || !entry.kind) continue;
    const key = `${entry.kind}:${entry.id}`;
    if (seen.has(key)) continue;
    if (entry.kind === "element" && !elementIds.has(entry.id)) continue;
    if (entry.kind === "slot" && !slotIds.has(entry.id)) continue;
    seen.add(key);
    normalized.push(entry);
  }

  for (const slot of slots) {
    const key = `slot:${slot.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ kind: "slot", id: slot.id });
    }
  }

  for (const item of elements) {
    const key = `element:${item.id}`;
    if (!seen.has(key)) {
      seen.add(key);
      normalized.push({ kind: "element", id: item.id });
    }
  }

  return normalized;
}




export function buildTemplateLayout(id, singleW, canvasH, slides) {
  const canvasW = singleW * slides;
  const nextSlots = [];
  const nextManagedElements = [];
    if (id === "magazine") {
      nextSlots.push(
        createSlot({
          x: singleW * 0.48,
          y: 110,
          width: singleW * 0.42,
          height: canvasH * 0.7,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Cover Image",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Your Story",
        x: 80,
        y: 80,
        width: 420,
        fontSize: 72,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "cover") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.52,
          y: 90,
          width: canvasW * 0.38,
          height: canvasH * 0.72,
          radius: 30,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Hero Image",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "A Quiet\nCarousel Story",
          x: 100,
          y: canvasH * 0.16,
          width: canvasW * 0.36,
          fontSize: 88,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Minimal layout · seamless slices",
          x: 108,
          y: canvasH * 0.58,
          width: 580,
          fontSize: 32,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 0.92,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "film") {
      for (let i = 0; i < slides; i++) {
        nextSlots.push(
          createSlot({
            x: i * singleW + 72,
            y: 78,
            width: singleW - 144,
            height: canvasH - 156,
            radius: 24,
            stroke: "#f3f4f6",
            strokeWidth: 18,
            fill: "rgba(255,255,255,0.02)",
            label: `Frame ${i + 1}`,
          })
        );
      }

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Film Diary",
        x: 92,
        y: 88,
        width: 340,
        fontSize: 40,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "split") {
      nextSlots.push(
        createSlot({
          x: singleW * 0.52,
          y: canvasH * 0.16,
          width: singleW * 0.38,
          height: canvasH * 0.68,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          label: "Right Image",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "Moodboard",
          x: 100,
          y: canvasH * 0.2,
          width: 420,
          fontSize: 84,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Left text, right image.\nSimple and clean.",
          x: 100,
          y: canvasH * 0.44,
          width: 440,
          fontSize: 32,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "frame") {
      nextSlots.push(
        createSlot({
          x: 72,
          y: 72,
          width: canvasW - 144,
          height: canvasH - 144,
          radius: 34,
          stroke: "#ffffff",
          strokeWidth: 20,
          fill: "rgba(255,255,255,0.03)",
          label: "Main Image",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Framed Layout",
        x: 100,
        y: 92,
        width: 420,
        fontSize: 44,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "grid4") {
      const outerPad = 72;
      const gap = 20;

      const frameW = canvasW - outerPad * 2;
      const frameH = canvasH - outerPad * 2;

      const cellW = (frameW - gap) / 2;
      const cellH = (frameH - gap) / 2;

      nextSlots.push(
        createSlot({
          x: outerPad,
          y: outerPad,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 1",
        }),
        createSlot({
          x: outerPad + cellW + gap,
          y: outerPad,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 2",
        }),
        createSlot({
          x: outerPad,
          y: outerPad + cellH + gap,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 3",
        }),
        createSlot({
          x: outerPad + cellW + gap,
          y: outerPad + cellH + gap,
          width: cellW,
          height: cellH,
          radius: 24,
          stroke: "#ffffff",
          strokeWidth: 6,
          fill: "rgba(255,255,255,0.04)",
          label: "Photo 4",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Grid Collage",
        x: 96,
        y: 20,
        width: 420,
        fontSize: 40,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "duo") {
      nextSlots.push(
        createSlot({
          x: 72,
          y: 120,
          width: singleW * 0.42,
          height: canvasH * 0.66,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Before",
        }),
        createSlot({
          x: singleW * 0.52,
          y: 120,
          width: singleW * 0.42,
          height: canvasH * 0.66,
          radius: 28,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "After",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Before / After",
        x: 82,
        y: 52,
        width: 520,
        fontSize: 52,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "triptych") {
      const gap = 22;
      const pad = 58;
      const slotW = (canvasW - pad * 2 - gap * 2) / 3;
      nextSlots.push(
        createSlot({
          x: pad,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 1",
        }),
        createSlot({
          x: pad + slotW + gap,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 2",
        }),
        createSlot({
          x: pad + (slotW + gap) * 2,
          y: 150,
          width: slotW,
          height: canvasH * 0.68,
          radius: 26,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Story 3",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Three Moments",
        x: 72,
        y: 62,
        width: 620,
        fontSize: 56,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "polaroid") {
      nextSlots.push(
        createSlot({
          x: 88,
          y: 118,
          width: singleW * 0.34,
          height: canvasH * 0.46,
          radius: 12,
          stroke: "#ffffff",
          strokeWidth: 24,
          fill: "rgba(255,255,255,0.16)",
          label: "Photo 1",
        }),
        createSlot({
          x: singleW * 0.48,
          y: 244,
          width: singleW * 0.36,
          height: canvasH * 0.5,
          radius: 12,
          stroke: "#ffffff",
          strokeWidth: 24,
          fill: "rgba(255,255,255,0.16)",
          label: "Photo 2",
        })
      );

      nextManagedElements.push({
        id: uid("text"),
        type: "text",
        text: "Weekend Notes",
        x: 96,
        y: canvasH * 0.73,
        width: 620,
        fontSize: 54,
        fontStyle: "bold",
        fill: "#111827",
        align: "left",
        opacity: 1,
        isTemplateManaged: true,
      });
    }

    if (id === "quote") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.62,
          y: 128,
          width: canvasW * 0.28,
          height: canvasH * 0.64,
          radius: 34,
          stroke: "#ffffff",
          strokeWidth: 8,
          fill: "rgba(255,255,255,0.08)",
          label: "Portrait",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "A small idea,\nclearly framed.",
          x: 96,
          y: canvasH * 0.22,
          width: canvasW * 0.48,
          fontSize: 78,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Use this layout for quotes, announcements, or educational carousel openings.",
          x: 104,
          y: canvasH * 0.62,
          width: canvasW * 0.42,
          fontSize: 30,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "product") {
      nextSlots.push(
        createSlot({
          x: canvasW * 0.12,
          y: 112,
          width: canvasW * 0.44,
          height: canvasH * 0.72,
          radius: 38,
          stroke: "#ffffff",
          strokeWidth: 10,
          fill: "rgba(255,255,255,0.1)",
          label: "Product",
        })
      );

      nextManagedElements.push(
        {
          id: uid("text"),
          type: "text",
          text: "Product\nStory",
          x: canvasW * 0.62,
          y: canvasH * 0.18,
          width: canvasW * 0.28,
          fontSize: 76,
          fontStyle: "bold",
          fill: "#111827",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        },
        {
          id: uid("text"),
          type: "text",
          text: "Feature highlight · detail · result",
          x: canvasW * 0.62,
          y: canvasH * 0.56,
          width: canvasW * 0.3,
          fontSize: 28,
          fontStyle: "normal",
          fill: "#4b5563",
          align: "left",
          opacity: 1,
          isTemplateManaged: true,
        }
      );
    }

    if (id === "checker") {
      const pad = 60;
      const gap = 18;
      const cellW = (canvasW - pad * 2 - gap * 2) / 3;
      const cellH = (canvasH - pad * 2 - gap) / 2;
      for (let row = 0; row < 2; row += 1) {
        for (let col = 0; col < 3; col += 1) {
          nextSlots.push(
            createSlot({
              x: pad + col * (cellW + gap),
              y: pad + row * (cellH + gap),
              width: cellW,
              height: cellH,
              radius: 22,
              stroke: "#ffffff",
              strokeWidth: 6,
              fill: "rgba(255,255,255,0.08)",
              label: `Photo ${row * 3 + col + 1}`,
            })
          );
        }
      }
    }

    if (id === "swap-square") {
      const halfH = canvasH / 2;
      const squareSize = Math.min(singleW * 0.34, halfH * 0.62);

      for (let i = 0; i < slides; i += 1) {
        const slideX = i * singleW;
        const group = `swap-${i + 1}`;
        const squareX = slideX + (singleW - squareSize) / 2;
        const topSquareY = (halfH - squareSize) / 2;
        const bottomSquareY = halfH + (halfH - squareSize) / 2;

        const topBase = {
          ...createSlot({
            x: slideX,
            y: 0,
            width: singleW,
            height: halfH,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.08)",
            label: `第 ${i + 1} 張 · 上方圖片`,
          }),
          swapGroup: group,
          swapSource: "a",
          swapLayer: "base",
        };
        const bottomBase = {
          ...createSlot({
            x: slideX,
            y: halfH,
            width: singleW,
            height: halfH,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.08)",
            label: `第 ${i + 1} 張 · 下方圖片`,
          }),
          swapGroup: group,
          swapSource: "b",
          swapLayer: "base",
        };
        const topOverlay = {
          ...createSlot({
            x: squareX,
            y: topSquareY,
            width: squareSize,
            height: squareSize,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.12)",
            label: "下方圖片置換區",
          }),
          swapGroup: group,
          swapSource: "b",
          swapLayer: "overlay",
        };
        const bottomOverlay = {
          ...createSlot({
            x: squareX,
            y: bottomSquareY,
            width: squareSize,
            height: squareSize,
            radius: 0,
            strokeWidth: 0,
            fill: "rgba(255,255,255,0.12)",
            label: "上方圖片置換區",
          }),
          swapGroup: group,
          swapSource: "a",
          swapLayer: "overlay",
        };

        nextSlots.push(topBase, bottomBase, topOverlay, bottomOverlay);
      }
    }

  return { slots: nextSlots, elements: nextManagedElements };
}
