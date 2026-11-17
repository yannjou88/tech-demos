export type PageBox = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
};

export type MarkFractions = {
  x: number;
  y: number;
  w: number;
  h: number;
};

export type PdfPlacement = {
  x: number;
  y: number;
  width: number;
  height: number;
  rotate: number;
};

function quarterTurns(rotation: number): 0 | 90 | 180 | 270 {
  const turns = ((Math.round(rotation / 90) % 4) + 4) % 4;
  return (turns * 90) as 0 | 90 | 180 | 270;
}

export function visualSize(page: PageBox): { width: number; height: number } {
  const rotation = quarterTurns(page.rotation);
  if (rotation === 90 || rotation === 270) {
    return { width: page.height, height: page.width };
  }
  return { width: page.width, height: page.height };
}

/**
 * Map a mark stored as fractions of the on-screen page (origin top-left)
 * onto pdf-lib drawImage options. The image stays upright after the page
 * rotation is applied by the viewer.
 */
export function placeMark(mark: MarkFractions, page: PageBox): PdfPlacement {
  const rotation = quarterTurns(page.rotation);
  const visual = visualSize(page);
  const vx = mark.x * visual.width;
  const vy = mark.y * visual.height;
  const width = mark.w * visual.width;
  const height = mark.h * visual.height;
  const left = vx;
  const bottom = vy + height;

  let x = 0;
  let y = 0;
  if (rotation === 0) {
    x = left;
    y = page.height - bottom;
  } else if (rotation === 90) {
    x = bottom;
    y = left;
  } else if (rotation === 180) {
    x = page.width - left;
    y = bottom;
  } else {
    x = page.width - bottom;
    y = page.height - left;
  }

  return {
    x: x + page.x,
    y: y + page.y,
    width,
    height,
    rotate: rotation,
  };
}

export function markSize(
  bitmapAspect: number,
  pageAspect: number,
  targetWidth: number,
): { w: number; h: number } {
  const safeAspect = bitmapAspect > 0 ? bitmapAspect : 1;
  const safePage = pageAspect > 0 ? pageAspect : 1;
  let w = targetWidth;
  let h = (w * safePage) / safeAspect;
  if (h > 0.42) {
    h = 0.42;
    w = (h * safeAspect) / safePage;
  }
  if (w > 0.8) {
    w = 0.8;
    h = (w * safePage) / safeAspect;
  }
  return { w, h };
}
