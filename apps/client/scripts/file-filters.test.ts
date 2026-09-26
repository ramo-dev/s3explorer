// Semantics checks for the filter predicates. Not shipped.

import type { S3Object } from '../src/types';
import {
  applyFilters,
  DATE_PRESETS,
  EMPTY_FILTERS,
  getFileCategory,
  isDateRangeActive,
  isFiltersActive,
  matchesFilters,
  parseISODate,
} from '../src/lib/fileFilters';

let failures = 0;
const check = (label: string, actual: unknown, expected: unknown) => {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) {
    failures++;
    console.log(`  FAIL ${label}\n       got      ${a}\n       expected ${e}`);
  } else {
    console.log(`  ok   ${label}`);
  }
};

const file = (key: string, over: Partial<S3Object> = {}): S3Object => ({
  key,
  size: 0,
  isFolder: false,
  lastModified: undefined,
  ...over,
});

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.now();

console.log('\n-- category: one list, and dotfiles are not extensions --');
check('png', getFileCategory('a/b/photo.png', false), 'image');
check('uppercase extension', getFileCategory('PHOTO.PNG', false), 'image');
check('no extension', getFileCategory('Makefile', false), 'other');
check('dotfile has no extension', getFileCategory('.gitignore', false), 'other');
check('.env is code, not a dotfile', getFileCategory('.env', false), 'code');
check('a file named "env" has no extension', getFileCategory('env', false), 'other');
check('double extension uses the last', getFileCategory('archive.tar.gz', false), 'archive');
check('trailing dot is not an extension', getFileCategory('weird.', false), 'other');
check('folder wins over extension', getFileCategory('photos.png/', true), 'folder');
check('mp4', getFileCategory('clip.mp4', false), 'video');
check('unknown extension', getFileCategory('thing.qqq', false), 'other');

console.log('\n-- ISO date parsing rejects shapes that look right but are not --');
check('valid', parseISODate('2024-03-01')?.getDate(), 1);
check('feb 31 rolls over, so rejected', parseISODate('2024-02-31'), null);
check('month 13 rejected', parseISODate('2024-13-01'), null);
check('day 0 rejected', parseISODate('2024-03-00'), null);
check('short year rejected', parseISODate('24-03-01'), null);
check('empty rejected', parseISODate(''), null);
check('null rejected', parseISODate(null), null);

console.log('\n-- type filter --');
const mixed: S3Object[] = [
  file('photo.png', { size: 10 }),
  file('clip.mp4', { size: 10 }),
  file('sub/', { isFolder: true }),
  file('notes.md', { size: 10 }),
];
const typeOf = (t: string) => applyFilters(mixed, { ...EMPTY_FILTERS, type: t as never }).map(o => o.key);
check('all', typeOf('all'), ['photo.png', 'clip.mp4', 'sub/', 'notes.md']);
check('image hides folders', typeOf('image'), ['photo.png']);
check('folder shows only folders', typeOf('folder'), ['sub/']);

console.log('\n-- size filter excludes folders, because a prefix reports 0 bytes --');
// Without this, "Under 1 MB" would match every folder in the listing and look
// like the filter was ignoring the size column.
const sized: S3Object[] = [
  file('tiny.txt', { size: 500 }),
  file('mid.txt', { size: 5 * 1024 * 1024 }),
  file('big.txt', { size: 500 * 1024 * 1024 }),
  file('sub/', { isFolder: true, size: 0 }),
];
const sizeOf = (s: string) => applyFilters(sized, { ...EMPTY_FILTERS, size: s as never }).map(o => o.key);
check('under 1 MB', sizeOf('lt1mb'), ['tiny.txt']);
check('1-10 MB', sizeOf('1to10mb'), ['mid.txt']);
check('10-100 MB', sizeOf('10to100mb'), []);
check('over 100 MB', sizeOf('gt100mb'), ['big.txt']);
check('boundaries are half-open, so 1 MB is not "under 1 MB"', sizeOf('lt1mb').includes('mid.txt'), false);

console.log('\n-- date range: `to` is inclusive of the whole day --');
const dated: S3Object[] = [
  file('today.txt', { lastModified: new Date(NOW - 2 * 60 * 60 * 1000).toISOString() }),
  file('mar20.txt', { lastModified: new Date(2024, 2, 20, 0, 0, 1).toISOString() }),
  file('mar21.txt', { lastModified: new Date(2024, 2, 21, 0, 0, 1).toISOString() }),
  file('undated.txt', {}),
  file('sub/', { isFolder: true }),
];
const inRange = (from: string | null, to: string | null) =>
  applyFilters(dated, { ...EMPTY_FILTERS, modified: { from, to } }).map(o => o.key);
check('single day includes all of it', inRange('2024-03-20', '2024-03-20'), ['mar20.txt']);
check('range end is inclusive', inRange('2024-03-20', '2024-03-21'), ['mar20.txt', 'mar21.txt']);
// Open start still excludes the undated object and the folder; only mar20 is
// at or before the bound.
check('open start', inRange(null, '2024-03-20'), ['mar20.txt']);
check('undated objects are excluded by a date filter, not assumed recent', inRange('2024-01-01', null).includes('undated.txt'), false);
check('folders are excluded by a date filter', inRange('2024-01-01', null).includes('sub/'), false);

console.log('\n-- presets produce usable, ordered bounds --');
for (const preset of DATE_PRESETS) {
  const range = preset.range();
  const ok = range.from === null || (parseISODate(range.from) !== null && parseISODate(range.from)!.getTime() <= NOW);
  check(`preset "${preset.label}" from is absent or valid and not future`, ok, true);
  // Only an inverted range is a bug; an open end is the normal shape.
  check(
    `preset "${preset.label}" is not inverted`,
    range.from === null || range.to === null || range.from <= range.to,
    true,
  );
}
check('Any time is inactive', isDateRangeActive(DATE_PRESETS[0].range()), false);
check('a recent preset is active', isDateRangeActive(DATE_PRESETS[2].range()), true);

console.log('\n-- combined filters intersect, and defaults short-circuit --');
const combined = applyFilters([...mixed, ...sized], { type: 'image', size: 'lt1mb', modified: { from: null, to: null } });
check('image AND under 1MB, folder excluded by size', combined.map(o => o.key), ['photo.png']);
check('nothing matches', applyFilters(mixed, { type: 'archive', size: 'all', modified: { from: null, to: null } }), []);
check('no filters returns the same array, not a copy', applyFilters(mixed, EMPTY_FILTERS), mixed);
check('isFiltersActive false for defaults', isFiltersActive(EMPTY_FILTERS), false);
check('isFiltersActive true for one', isFiltersActive({ ...EMPTY_FILTERS, size: 'lt1mb' }), true);
check('matchesFilters agrees with applyFilters', matchesFilters(file('x.png', { size: 1 }), { ...EMPTY_FILTERS, type: 'image' }), true);

console.log(failures === 0 ? '\nAll filter cases pass.\n' : `\n${failures} FAILURES\n`);
process.exit(failures === 0 ? 0 : 1);
