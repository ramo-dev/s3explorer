// API and Network Constants
export const API_TIMEOUTS = {
  DEFAULT: 30000,           // 30 seconds - standard operations
  UPLOAD: 300000,           // 5 minutes - file uploads
  DELETE_BUCKET: 120000,    // 2 minutes - bucket deletion (empties first)
  DELETE_FOLDER: 120000,    // 2 minutes - recursive folder deletion
  RENAME: 60000,            // 1 minute - rename (copy + delete)
  CONNECTION_TEST: 60000,   // 1 minute - connection testing
  ZIP_PREPARE: 120000,      // 2 minutes - expanding folders before a zip download starts
} as const;

// UI Constants
export const UI_DELAYS = {
  SEARCH_DEBOUNCE: 150,     // Debounce delay for search inputs (ms)
} as const;

// Validation Constants
export const VALIDATION = {
  BUCKET_NAME_MIN: 3,
  BUCKET_NAME_MAX: 63,
  OBJECT_KEY_MAX: 1024,
  FILE_NAME_MAX: 255,
} as const;

// Pagination Constants
export const PAGINATION = {
  OBJECTS_PER_PAGE: 1000,   // S3 list objects limit
  // Below ~100 items, native DOM rendering is fast enough and simpler to debug.
  // Above that, we switch to virtual scrolling to avoid layout jank on large folders.
  VIRTUAL_SCROLL_THRESHOLD: 100,
  ROW_HEIGHT: 44,           // Height of each row in virtual scroll (px)
  OVERSCAN_COUNT: 5,        // Extra rows to render above/below viewport
  LOAD_MORE_THRESHOLD: 20,  // Start loading more when within this many items of the end
} as const;

// Grid View Constants
//
// Column count is driven by explicit container-width breakpoints rather than
// floor(width / minTileWidth). The division approach cannot express "5 columns
// on a normal laptop" -- it snaps between 4 and 6 as the window moves, which
// looks like a bug rather than a layout. Breakpoints also make the target
// column count a design decision instead of an emergent one.
//
// The widths below keep tile size in a 205-266px band, which is where Google
// Drive sits on a desktop: square crop, name plus one metadata line, kebab menu
// overlaid in the corner. Six columns on a 1512px laptop with the sidebar
// collapsed is the ceiling before thumbnails stop being legible.
export const GRID = {
  // Container width (px) -> column count, highest match wins. Evaluated
  // top-down, so keep these sorted descending.
  COLUMN_BREAKPOINTS: [
    { minWidth: 1600, columns: 7 },
    { minWidth: 1280, columns: 6 },
    { minWidth: 1024, columns: 5 },  // normal desktop scale
    { minWidth: 768, columns: 4 },
    { minWidth: 560, columns: 3 },
    { minWidth: 380, columns: 2 },
  ] as const,
  FALLBACK_COLUMNS: 1,

  // Height of the text block under each thumbnail (name + metadata line).
  CAPTION_HEIGHT: 56,
  // Spacing between tiles. Applied as GAP/2 padding on each cell, so it also
  // produces a GAP/2 gutter at the pane edges.
  GAP: 12,
  TILE_MIN_WIDTH: 170,    // below this the grid stops being legible
  OVERSCAN_COLUMNS: 2,    // extra columns rendered left/right of the viewport

  // Thumbnails. There is no server-side resizing yet, so an <img> pulls the
  // entire object. IntersectionObserver keeps that to what is on screen, and
  // the size cap avoids the pathological case: a folder of 50MB TIFFs would
  // otherwise fetch 2.5GB to render thumbnails. Both numbers are deliberately
  // conservative because the cost is a full-object transfer, not a resize.
  MAX_THUMBNAIL_BYTES: 8 * 1024 * 1024,
  // Passed as ?w= so the URL shape is already correct for server-side
  // thumbnailing later. The proxy route ignores unknown query params, so this
  // is a no-op today and needs no server change to adopt.
  THUMBNAIL_WIDTH_PARAM: 320,
  // Start fetching slightly before the tile scrolls into view so the image is
  // usually decoded by the time it is needed.
  ROOT_MARGIN_PX: 200,
} as const;

/** Column count for a given container width. */
export function gridColumnsFor(width: number): number {
  for (const bp of GRID.COLUMN_BREAKPOINTS) {
    if (width >= bp.minWidth) return bp.columns;
  }
  return GRID.FALLBACK_COLUMNS;
}

// Storage Keys
export const STORAGE_KEYS = {
  THEME: 's3-explorer-theme',
  WELCOME_DISMISSED: 's3-explorer-welcome-dismissed',
  SIDEBAR_COLLAPSED: 's3-explorer-sidebar-collapsed',
  VIEW_MODE: 's3-explorer-view-mode',
} as const;

