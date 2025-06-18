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

## 8. Error Handling & Logging
- ✅ Basic error handling and logging in backend
- ✅ Logging for Sonarr API, DB, and WebSocket
- ⚠️ Comprehensive error handling for all endpoints (incomplete)

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
✅ Complete  ⚠️ Needs verification or improvement  ❌ Not yet implemented



currently broken
  ✅import modal ui works like shit 
  ✅radio buttons for import mode settings and proper saving and reading of import mode state
   ✅ test auto import mode once the backed is fixed
  Add hover/focus states
    Make sure the  segmented controls have visible hover and focus outlines (e.g. a bright accent glow) so keyboard users and mouse users get clear feedback.
  Enhance affordance on the divider
    The thin line divides content, but you could add a subtle drop-shadow or slightly darker line to strengthen the separation, especially on very large screens.
  Responsive behavior
    On narrower viewports, you may want the two sections to stack vertically rather than squeeze horizontally. Ensuring both labels and controls wrap cleanly will maintain ease of use on tablet or phone.
  the alphabet bar should expand to fill all avail vertical space more gracefully
  when shows import for some reason they are not brough in alphabetically
    likely due to how the api call sshows based on sonarr_id, should review if can switch to pulling by show name or cache the import and relist it by name before performing import. 
  the home page randomly refrehses. repeatedly
  a previous chat was going to review tdarr to see its mongo db setup in the background to advise on more robust db solution