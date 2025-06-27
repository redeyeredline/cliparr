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