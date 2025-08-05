# Cliparr Migration Checklist (Python → Node/TypeScript)

✅ 1. Sonarr API Integration
- ✅ Basic API client structure exists
- ✅ Series/episodes fetching implemented
- ✅ Show import functionality implemented

## 2. Database Operations
- ✅ Schema management implemented
- ✅ Basic CRUD operations implemented
- ✅ Database initialization and connection handling
- ✅ Pagination implementation
  - ✅ Backend pagination with LIMIT/OFFSET
  - ✅ Episode count aggregation
  - ✅ Total count calculation
  - ✅ Page size configuration
  - 💭 Frontend pagination UI needs implementation
- ✅ Database persistence (no longer wiped on start)

✅ 3. Import Modes & Background Tasks
- ✅ Auto/import/none modes
- ✅ Background import task (with polling interval and UI)
- ✅ Manual import functionality (basic manual import via UI is working)

✅ 4. API Endpoints
- ✅ `/sonarr/unimported`
- ✅ `/sonarr/import`
- ✅ `/imported-shows`
- ✅ `/series/{show_id}`
- ✅ `/settings/import-mode`
- ✅ `/websocket-test`

✅ 5. WebSocket Events
- ✅ WebSocket server runs and connects
- ✅ Import progress events
- ✅ Diagnostics events

## 7. Health & Diagnostics
- ✅ Health check endpoint
- ✅ Database connection status indicator on frontend
- ✅ Performance logging/diagnostics endpoint
- ✅ database health endpoint
- ❌ database health check/status/report warnings/errors/thresholds if db having perf issues

## 8. Error Handling & Logging
- ✅ Basic error handling and logging in backend
- ✅ Logging for Sonarr API, DB, and WebSocket
- ⚠️ Comprehensive error handling for all endpoints (incomplete)
- ❌ log file handling page similar to sonarr or better

## 9. Frontend Features & UI
- ✅ Alphabet Sidebar
  ✅ Letter-based navigation
  ✅ Dynamic letter availability based on shows
  ✅ Smooth scrolling to sections
- ✅ Table Features
  ✅ Sortable columns
  💭 Pagination
  ✅ Row selection
  ✅ Custom styling (dark theme)
- ✅ Show Details Page
  ✅Season-based collapsible tables
  ✅ Episode information display
  - File details
- ✅ Styling & Layout
  ✅ Dark theme implementation
  ✅ Consistent color scheme
  ✅ Responsive design
  ✅ Custom table styling
  ✅ Modal components
  ✅ Toast notifications
- ✅ Navigation
  ✅ Sidebar with icons
  ✅ Active state indicators
  ✅ Nested menu items
  ✅ Import modal integration

## 10. Database Initialization and Connection Status
- ✅ Database initializes and status is shown on frontend
- ✅ Test endpoint and UI confirmation

## 11. Recently Completed UI Improvements
- ✅ import modal ui works like shit 
- ✅ radio buttons for import mode settings and proper saving and reading of import mode state
- ✅ test auto import mode once the backed is fixed
- ✅ Add hover/focus states
- ✅ Make sure the segmented controls have visible hover and focus outlines (e.g. a bright accent glow) so keyboard users and mouse users get clear feedback
- ✅ If no shows are present, display a friendly illustration + "Click Import to get started" call-to-action

## 12. Table & List Enhancements Needed
- ❌ Virtual scrolling
      Even if you don't paginate, windowed rendering (only mounting rows in view) will keep scroll performance rock-solid once you hit thousands of entries
- ❌ Alphabetical grouping (A → Z)
      Rather than full pagination/search, you can chunk your virtualized list by first‐letter headers—i.e. one sticky "A" row, then all "A…" shows, then "B," etc. Scanning a thousand items becomes way more navigable, and it only adds a tiny bit of markup in your render loop
- ✅ Loading / empty states
      Show a subtle skeleton row animation while data is loading
- ✅ Shift‐click range-select
      Right now you've got individual checkboxes—allow holding Shift to select a contiguous block. It maps exactly to desktop expectations and only adds a handful of lines to your click-handler logic
- ✅ Overall remove some extra spacing and padding in the nav bar and the main table to tighten things up
      remove excess spacing from all tables 1 px at a time and see changes to find one i like
- ✅ When using keyboard shortcuts and you get into the table the space bar should allow you to select the row you are ons tick box currently it only allows you to select the select all tick box.
## 13. Mobile & Responsive Tasks
- ❌ Need a hamburger nav or transform the table into a card list on mobile
- ❌ the alphabet bar should expand to fill all avail vertical space more gracefully
- ❌ properly add an alphabet bar to the import modal 
- ❌ fix scroll bars site wide to remove the up and down arrows
- ✅ enter onkeybnoard in import modal should click on import
- ❌ keyboard shortcuts should begin in intelligently useful points on the page
## 14. Bug Fixes & Issues
- 💭 the home page randomly refrehses. repeatedly
- ✅ review all logging and remove things that are no longer needed
- ✅ we lost the tooltip on why the import refresh is grayed out

## 15. Infrastructure Investigation
- ❌ a previous chat was going to review tdarr to see its mongo db setup in the background to advise on more robust db solution

## 16. Import System Issues
- ✅ MIGHT BE FIXED - app is suddenly duplicating imports on start/app refreshes
  something with the way the import mode setting change triggers an import without using the check existing shows in localdb function and duplicates the shows. fix it you fuck

## 17. Search & Navigation Features
- ✅ reconsider a search function to find specific shows
- ✅ feed current nav bar to bolt to get similiar styling to new home page

## 18. UI/UX Improvements
- ✅ fix excess spacing on new home page
- ✅ repipe everything to new home page
- ❌ add alphabet bar to import modal
- ❌ ASK BOLT can you cleanly/easily include the alphabet bar from the homepage to the import modal?
      also have bolt process the settings page with its new ui
- ✅  enter key should hit delete button on main table (WORKING - DO NOT TOUCH)
- ✅  save button on settings page should act like delete button on main page
- ✅  save button should still be clickable with enter when it appears

## 19. Import Mode Automation
- ✅ create trigger when setting import mode changes to auto to trigger a scan upon saving to import all shows automatically

## 20. Toast System Review
- ✅ All toasts use the new modern UI system (ToastProvider)
- ✅ No old toast systems or alert() calls found
- ✅ WebSocket events appropriately use console logging for debugging
- ✅ User-facing notifications properly use the modern toast system

✅ look into perf issues while changing pages



when swithing to docker make sure we look at the pathing import from the os+ sonarr we are doing in pathmap.js

Here’s an updated optimization checklist (SQLite-only—no PostgreSQL migration mentioned). Nothing has been changed yet; please review and tell me which items you’d like implemented.
1. Backend / Database (better-sqlite3)
✅ Prepared-statement cache
  Db_Operations.js recompiles SQL every call (db.prepare(...)[fn]()).
  Store prepared statements (or a tiny cache) to reduce parse overhead.
✅Batch inserts
  batchInsertShows runs one INSERT per show inside a loop.
  Use multi-row insert:
  INSERT INTO shows (title, path) VALUES (?, ?), (?, ?), ...;
✅Non-blocking FS calls
  fs.existsSync & fs.mkdirSync in Auto_DB_Setup.js block the event loop.
  Replace with await fs.promises.stat / mkdir.
PRAGMA optimize
  After schema creation call PRAGMA optimize; periodically (e.g. on startup/shutdown) for automatic index maintenance.
  Foreign-key enforcement toggle
  Confirm PRAGMA foreign_keys = ON; (not explicitly set yet) so cascades work reliably.
Query logging throttling
  timedQuery logs every query; for large imports this floods memory (recentQueries).
  Keep only slow queries (>20 ms) or limit the array by time window, not count.
✅Remove logger re-export
  Db_Operations.js re-exports the logger, creating a potential circular dependency.
2. Backend / General Node
• Graceful shutdown
  Add process.on('SIGINT'|'SIGTERM') handler that stops ImportTaskManager, flushes logs, and closes DB.
Environment lookups
  Read process.env.SONARR_* once at module load; reuse constants instead of reading inside every request.
Parallel show import
  importTask processes shows sequentially.
  Use a small concurrency pool (e.g. p-limit with 4–6) to shorten initial sync.
WebSocket broadcast efficiency
  Filter wss.clients by client.readyState === OPEN once and reuse the array, or throttle broadcasts if status messages fire rapidly.
3. Front-End React
• Delete duplicate “copy” pages (HomePage copy.tsx, SettingsPage copy.jsx) to avoid confusion.
✅Consistent extensions
  Rename .js React components (EmptyState.js, etc.) to .jsx for uniformity (no code changes).
Table virtualization
  HomePage renders entire show list; switch to react-window for smooth scrolling when shows > 500.
Debounced search
  Wrap setSearchQuery with lodash.debounce (≈200 ms) to cut re-renders while typing.
Icon tree-shaking
  Import only used Lucide icons where needed (import { Search } from 'lucide-react') instead of star imports to slim bundle.
Code-split routes
  Apply React.lazy & Suspense to ShowDetailsPage, SettingsPage, etc., reducing initial bundle size.
4. Tooling & Build
• ESLint / Prettier
  Enforce 100-char line length (your preference) via max-len & prettier config.
Vite build-time splits
  Use build.rollupOptions.output.manualChunks to separate vendor libs (react, lucide-react) from app code for better caching.
Dockerfile improvements
  Convert to multi-stage build (builder → slim runtime) and add HEALTHCHECK.
Pin Node to an explicit LTS version (e.g. 18-alpine) for reproducibility.
5. Miscellaneous
• Remove unused imports / variables flagged by ESLint.
Add unit tests (Jest + React Testing Library) for key DB helpers and UI hooks.
Consider dotenv-flow for multi-env config; keep .env.example free of DB secrets per your guideline.


---

**Legend:**  
✅ Complete  ⚠️ Needs verification or improvement  ❌ Not yet implemented  💭 May not be needed



look for any other links to the env file and clean those up with info from the new settings page and pathing. 

implement live file browser for output directory settings
  add option to retain folder path in output directory
  add option to overwrite existing files
    make sure to have warnings


1. Use FFmpeg for heavy lifting, not hashing
    Decode to WAV/PCM

    bash
    Copy
    Edit
    ffmpeg -i input.mp4 \
      -vn \
      -acodec pcm_s16le -ar 44100 -ac 1 \
      show.wav
    This gives you a linear PCM file you can fingerprint reliably.

    Optional “where to look” hints

    Silence detect to find roughly where credits start/end:

    bash
    Copy
    Edit
    ffmpeg -i show.wav \
      -af silencedetect=noise=-40dB:d=1 \
      -f null -
    Spectrogram preview, if you want to eyeball repeated intro themes:


2. Plug in a fingerprint library
  Once you have raw audio, feed it to a fingerprint tool. A popular open-source choice is Chromaprint/AcoustID:
  Install the fpcalc binary (part of Chromaprint):
  Call it from Node:


Call it from Node:


    // fingerprint.js
    import { execFile } from 'child_process';
    export function fingerprint(filePath) {
      return new Promise<string>((resolve, reject) => {
        execFile('fpcalc', ['-json', filePath], (err, stdout) => {
          if (err) return reject(err);
          const data = JSON.parse(stdout);
          resolve(data.fingerprint); // a long string of ints
        });
      });
    }
Compare fingerprints with a simple similarity metric (e.g. Levenshtein distance or cosine on hashed chunks):

    import levenshtein from 'fast-levenshtein';

    export function isMatch(fpA: string, fpB: string, threshold = 0.8) {
      const dist = levenshtein.get(fpA, fpB);
      const maxLen = Math.max(fpA.length, fpB.length);
      return (1 - dist / maxLen) >= threshold;
    }

Sliding-window detection
Wrap it all in a job that:

Splits show.wav into overlapping chunks—say 10 s windows with 5 s overlap.

Fingerprints each chunk and checks against your stored “intro” and “credit” fingerprints.

Logs the time ranges where you hit your similarity threshold.


    import { fingerprint, isMatch } from './fingerprint';
    import ffmpeg from 'fluent-ffmpeg';

    async function scanForSections(inputMp4, referenceFp, { window=10, overlap=5 }) {
      // 1. extract to WAV (or reuse pre-decoded show.wav)
      await new Promise(r => ffmpeg(inputMp4)
        .output('show.wav')
        .noVideo()
        .audioCodec('pcm_s16le').audioFrequency(44100).audioChannels(1)
        .on('end', r).run()
      );

      const matches = [];
      for (let start = 0; start < DURATION; start += (window - overlap)) {
        // cut chunk
        const chunk = `chunk_${start}.wav`;
        await new Promise(r => ffmpeg('show.wav')
          .setStartTime(start)
          .duration(window)
          .output(chunk)
          .on('end', r).run()
        );
        // fingerprint & compare
        const fp = await fingerprint(chunk);
        if (isMatch(fp, referenceFp)) matches.push({ start, end: start + window });
      }
      return matches;
    }



  Stitching the final video
        Once you’ve got [introStart, introEnd] and [creditStart, creditEnd], use FFmpeg’s concat filter:

          ffmpeg -i input.mp4 -filter_complex "
          [0:v]trim=0:${introStart},setpts=PTS-STARTPTS[v0];
          [0:a]atrim=0:${introStart},asetpts=PTS-STARTPTS[a0];
          [0:v]trim=${introEnd}:${creditStart},setpts=PTS-STARTPTS[v1];
          [0:a]atrim=${introEnd}:${creditStart},asetpts=PTS-STARTPTS[a1];
          [0:v]trim=${creditEnd},setpts=PTS-STARTPTS[v2];
          [0:a]atrim=${creditEnd},asetpts=PTS-STARTPTS[a2];
          [v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[outv][outa]
        " -map "[outv]" -map "[outa]" cleaned.mp4



FFmpeg → decode, silence-detect, slice and stitch.

Chromaprint/fpcalc → turn WAV into a fingerprint string.

Levenshtein (or your own) → match those fingerprints.

Loop windows → detect intros/credits.

FFmpeg concat → drop them and produce your final file.

That approach is essentially what Plex/Audirvana do under the hood, only they’ve tuned thresholds and use proprietary fingerprint databases. With Chromaprint and a good sliding-window strategy you can get very similar—and even finer—results.


 Bulk-extract & fingerprint all episodes
Extract raw audio (once per episode):

bash
Copy
Edit
ffmpeg -i episode1.mp4 \
  -vn \
  -acodec pcm_s16le -ar 44100 -ac 1 \
  ep1.wav
Slide‐window fingerprint each *.wav:

js
Copy
Edit
import { execFile } from 'child_process';
async function fingerprintChunk(path) {
  return new Promise<string>((res, rej) => {
    execFile('fpcalc', ['-length', '10', '-json', path], (e, out) => {
      if (e) return rej(e);
      res(JSON.parse(out).fingerprint);
    });
  });
}
Collect a map of “fingerprint → [occurrences]”

js
Copy
Edit
// PSEUDO-CODE
const fpMap = new Map<string, Array<{ep: string, time: number}>>();
for (let ep of episodes) {
  const duration = await getDuration(ep);
  for (let t = 0; t < duration; t += 5) {
    await cutWav(ep, t, 10, `chunk.wav`);
    const fp = await fingerprintChunk('chunk.wav');
    if (!fpMap.has(fp)) fpMap.set(fp, []);
    fpMap.get(fp).push({ ep, time: t });
  }
}
At this point fpMap contains every 10 s fingerprint and exactly where it showed up in each file.

2. Find the “common” clusters
Count in how many distinct episodes each fingerprint appears

js
Copy
Edit
const counts = new Map<string, Set<string>>();
for (let [fp, occ] of fpMap) {
  if (!counts.has(fp)) counts.set(fp, new Set());
  occ.forEach(o => counts.get(fp).add(o.ep));
}
Filter to fingerprints that appear in ≥ 80 % of episodes

js
Copy
Edit
const threshold = Math.ceil(episodes.length * 0.8);
const commonFPs = Array.from(counts)
  .filter(([, eps]) => eps.size >= threshold)
  .map(([fp]) => fp);
Split into “intro” vs “credits” by where they occur

js
Copy
Edit
const introHits   = [], creditHits = [];
for (let fp of commonFPs) {
  const times = fpMap.get(fp).map(o => o.time);
  const avg   = times.reduce((a,b)=>a+b,0)/times.length;
  if (avg < 60)           introHits.push(avg);
  else if (avg > DURATION-60) creditHits.push(avg);
}
// merge the intros into one continuous [min,max], same for credits
const introStart = Math.min(...introHits);
const introEnd   = Math.max(...introHits) + 10;
const credStart  = Math.min(...creditHits);
const credEnd    = Math.max(...creditHits) + 10;
3. Suggest & trim
Once you have your two segments:

Intro: [introStart, introEnd]

Credits: [credStart, credEnd]

You can suggest to the user:

“Based on scanning 10 episodes, I detect a repeating segment from
~0 s→35 s as the intro, and from ~3200 s→3240 s as credits.
Would you like to remove those?”

And then apply an ffmpeg concat filter to cut them out:

bash
Copy
Edit
ffmpeg -i input.mp4 -filter_complex "
  [0:v]trim=0:${introStart},setpts=PTS-STARTPTS[v0];
  [0:a]atrim=0:${introStart},asetpts=PTS-STARTPTS[a0];
  [0:v]trim=${introEnd}:${credStart},setpts=PTS-STARTPTS[v1];
  [0:a]atrim=${introEnd}:${credStart},asetpts=PTS-STARTPTS[a1];
  [0:v]trim=${credEnd},setpts=PTS-STARTPTS[v2];
  [0:a]atrim=${credEnd},asetpts=PTS-STARTPTS[a2];
  [v0][a0][v1][a1][v2][a2]concat=n=3:v=1:a=1[outv][outa]
" -map "[outv]" -map "[outa]" cleaned.mp4
Why this works
You never need a pre-made “database” of intros/credits.

You’re simply finding the common fingerprints across all episodes.

Anything that repeats in most of the files at the same timestamp is almost certainly your intro or credits.

Once you’ve identified and merged those time-ranges, you can offer those as suggestions for removal.

Let me know if you want a more complete code sample for the clustering step or the user-confirmation UI!


possible UI for review is to have cards for each show with card images and you click on the show and then its broken down by either season or by confidence % and you can then look at whatevers in like 90+ and 80+ etc then theres a way to view and change the thing manually and then approve them for clipping from there or to select all from the whole card and submit for clipping.
  if done by season use the season images from plex for card images




[INFO|soularr|L78] 2025-07-27T18:00:34-0700: Average sequence match ratio: 0.8940753695238904
try to get our verify rate similar to this decimal value