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
  - ⚠️ Frontend pagination UI needs implementation
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
- ❌ Performance logging/diagnostics endpoint
- ❌ database health endpoint
- ❌ database health check/status/report warnings/errors/thresholds if db having perf issues

## 8. Error Handling & Logging
- ✅ Basic error handling and logging in backend
- ✅ Logging for Sonarr API, DB, and WebSocket
- ⚠️ Comprehensive error handling for all endpoints (incomplete)
- ❌ log file handling page similar to sonarr or better

## 9. Frontend Features & UI
- ❌ Alphabet Sidebar
  ✅ Letter-based navigation
  - Dynamic letter availability based on shows
  - Smooth scrolling to sections
- ❌ Table Features
  - Sortable columns
  - Pagination
  - Row selection
  - Custom styling (dark theme)
- ❌ Show Details Page
  - Season-based collapsible tables
  - Episode information display
  - File details
- ❌ Styling & Layout
  - Dark theme implementation
  - Consistent color scheme
  - Responsive design
  - Custom table styling
  - Modal components
  - Toast notifications
- ❌ Navigation
  - Sidebar with icons
  - Active state indicators
  - Nested menu items
  - Import modal integration

## 10. Database Initialization and Connection Status
- ✅ Database initializes and status is shown on frontend
- ✅ Test endpoint and UI confirmation

---

**Legend:**  
✅ Complete  ⚠️ Needs verification or improvement  ❌ Not yet implemented


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
- ❌ Loading / empty states
      Show a subtle skeleton row animation while data is loading
- ❌ Shift‐click range-select
      Right now you've got individual checkboxes—allow holding Shift to select a contiguous block. It maps exactly to desktop expectations and only adds a handful of lines to your click-handler logic
- ❌ Overall remove some extra spacing and padding in the nav bar and the main table to tighten things up
      remove excess spacing from all tables 1 px at a time and see changes to find one i like

## 13. Mobile & Responsive Tasks
- ❌ Need a hamburger nav or transform the table into a card list on mobile
- ❌ Responsive behavior
      On narrower viewports, you may want the two sections to stack vertically rather than squeeze horizontally. Ensuring both labels and controls wrap cleanly will maintain ease of use on tablet or phone
- ❌ the alphabet bar should expand to fill all avail vertical space more gracefully
- ❌ properly add an alphabet bar to the import modal 
- ❌ fix scroll bars site wide to remove the up and down arrows

## 14. Bug Fixes & Issues
- ❌ the home page randomly refrehses. repeatedly
- ❌ we lost the tooltip on why the import refresh is grayed out

## 15. Infrastructure Investigation
- ❌ a previous chat was going to review tdarr to see its mongo db setup in the background to advise on more robust db solution