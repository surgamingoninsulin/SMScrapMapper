
# Scrap Mechanic Map - UI Redesign Plan

## Overview
Redesign the map interface to match Google Maps style with a left sidebar that slides in/out, and improve the route planner functionality.

---

## 1. Route Planner Modal - "Clear Active Route" Button

### Current State:
- Route planner modal has a purple header bar (`.route-planner-header`)
- Contains title "Route Planner" and close button (×)
- Controls section below header has buttons: "Add Waypoint", "Calculate Route", "Save Route", "Open Saved Route", "Clear"

### Required Changes:
- ✅ Add new button "Clear Active Route" in the purple header bar
- ✅ Position: Far right, after the close button (×)
- ✅ Functionality: Should call `clearRouteWithWaypoints()` function (already exists in `sm_overview_map.js`)

### ✅ Answers:
1. **Only when route is active** - Button should be hidden when no route is active
2. **Exact text: "Clear Current Route"**
3. **Font Awesome map icon** - Use FA icon in the style shown in reference image

### Implementation:
- Add button to `.route-planner-header` (purple bar)
- Position: Far right, after close button (×)
- Show/hide based on route state
- Use Font Awesome icon library

---

## 2. Button Styling - Google Maps Style

### Current State:
- Purple gradient buttons throughout the app
- Various button styles in CSS

### Required Changes:
- ✅ Style purple buttons to match Google Maps reference image
- ✅ Google Maps buttons appear to be:
  - White/light background with subtle shadows
  - Rounded corners
  - Icon + text layout
  - Hover effects with elevation

### ✅ Answers:
1. **ALL purple buttons** - Change all buttons to Google Maps style
2. **Google Maps style** - White/light background with subtle shadows, rounded corners
3. **Yes, buttons should have icons** - Use Font Awesome icons

### Implementation:
- Replace all purple gradient buttons with Google Maps style
- White background, subtle shadows, rounded corners
- Add Font Awesome icons to buttons

---

## 3. Map Controls - Remove Top Elements

### Current State:
- Route planner button at top center
- Settings cog button at top right
- Various other controls

### Required Changes:
- ✅ Remove "App download" button (if exists)
- ✅ Remove buttons on top of map
- ✅ Keep ONLY zoom controls (+ and - buttons)
- ✅ Keep left sidebar

### ✅ Answers:
1. **Move to left sidebar** - Route planner button goes in left bar
2. **Remove all top buttons** - Remove route planner button and cog button from top, place in left sidebar
3. **Zoom controls** - Move + and - buttons to left side (like Google Maps)
4. **Remove all popups/overlays** - Remove all current popups over the map
5. **Reshape layout** - Make entire layout look and feel like Google Maps

### Implementation:
- Remove route planner button from top center
- Remove settings cog button from top right
- Move zoom controls to left side (bottom left like Google Maps)
- Remove all modal overlays, integrate into sidebar

---

## 4. Left Sidebar - Google Maps Style

### Current State:
- No visible left sidebar in current HTML structure
- Settings overlay is a modal

### Required Changes:
- ✅ Create left sidebar (thin bar initially)
- ✅ Top button: Change from "3 stripes" to "COG" icon
- ✅ When cog clicked: Sidebar slides right (expands) showing settings
- ✅ When cog clicked again: Sidebar slides left (collapses) hiding settings
- ✅ Button 2: "Saved" (Opgeslagen) → Change to "CAR" icon
- ✅ Button 3: "Recent" → Change to "Last Route" with appropriate icon
- ✅ Button 4: Add new "New Route" button with map icon (below cog)

### Sidebar Structure:
```
[COG] ← Top button (Settings)
[New Route] ← New button (Route Planner)
[Car] ← Saved routes
[Clock/Route Icon] ← Last Route
```

### ✅ Answers:
1. **Collapsed sidebar width: 70px** - Icons only, no text labels
2. **Expanded sidebar width: 400px** - Full content panel
3. **Sidebar behavior:** When button clicked, 400px content slides over the 70px bar. Top right has X button to close. When closed, slides out left to reveal 70px bar again
4. **Background:** White like Google Maps
5. **Content display:** Content appears in the 400px expanded panel (not modal overlay)

---

## 5. Settings Panel - Slide Animation

### Current State:
- Settings are in a modal overlay
- Opened via cog button at top right

### Required Changes:
- ✅ Move settings into left sidebar
- ✅ When cog clicked: Sidebar expands to right showing settings content
- ✅ Smooth slide animation (CSS transition)
- ✅ When cog clicked again: Sidebar collapses to left

### ✅ Answers:
1. **Settings display:** 400px content panel slides over 70px bar (buttons remain visible behind/underneath)
2. **Close button:** X button in top right of 400px panel to close and slide back to 70px

---

## 6. Route Planner Panel - Slide Animation

### Current State:
- Route planner opens as modal overlay

### Required Changes:
- ✅ When "New Route" button clicked: Sidebar expands to right showing route planner
- ✅ Smooth slide animation
- ✅ When "New Route" clicked again: Sidebar collapses

### ✅ Answers:
1. **Route planner display:** 400px content panel slides over 70px bar (same behavior as settings)
2. **Panel relationship:** Route planner and settings are separate panels (mutually exclusive)
3. **Multiple panels:** Only one panel can be open at a time (settings OR route planner, not both)

---

## 7. Last Route Functionality

### Current State:
- No "Last Route" feature exists

### Required Changes:
- ✅ Track the last calculated/active route
- ✅ Store in localStorage or memory
- ✅ When "Last Route" clicked: Load previous route waypoints and display
- ✅ If no recent route: Disable button (grayed out, non-clickable)

### ✅ Answers:
1. **Persistence: localStorage** - Same as waypoints currently (see `sm_overview_map.js` for reference, uses `localStorage.setItem('sm_routes', ...)`)
2. **Definition: Last calculated route** - The most recently calculated route (not saved, but calculated)
3. **Last Route icon: fa-clock** - Font Awesome clock icon
4. **Disabled state:** Grayed out + tooltip + disabled (can't click when no route exists)
5. **Loading behavior:** Need clarification on what "restore everything" means:
   - Option A: Just display waypoints in the list
   - Option B: Display waypoints + show markers on map
   - Option C: Display waypoints + show markers + calculate and draw route line (full restoration)
   
   **✅ Answer: Restore everything (Option C)**
   - Display waypoints in the list ✓
   - Show waypoint markers on the map ✓
   - Calculate and draw the route line automatically ✓

---

## 8. Icon Requirements

### Icons Needed:
- ✅ COG icon (Settings) - Replace 3 stripes
- ✅ CAR icon (Saved routes)
- ✅ MAP icon (New Route)
- ✅ ROUTE/CLOCK icon (Last Route)
- ✅ Clear Active Route icon (if needed)

### ✅ Answers:
1. **Font Awesome icons** - Use Font Awesome (FA) icon library (confirmed from point 1)
2. **Icon size:** Need to determine (typically 24px or 32px for Google Maps style)

### Icons Needed:
- ⚙️ COG icon (Settings) - `fa fa-cog` or `fa fa-gear`
- 🗺️ MAP icon (New Route) - `fa fa-map` or `fa fa-map-marker`
- 🚗 CAR icon (Saved routes) - `fa fa-car` or `fa fa-bookmark`
- ⏰ CLOCK/ROUTE icon (Last Route) - `fa fa-clock-o` or `fa fa-route`
- 🗺️ MAP icon (Clear Current Route) - `fa fa-map` or similar

### ✅ Icon Size:
- **24px** - Standard Google Maps icon size (will use this as default, can adjust if needed)

---

## Implementation Order

1. ✅ Create plan.md and gather requirements
2. ✅ Get answers to questions
3. ✅ Update plan.md with answers
4. ⏳ Add Font Awesome library to HTML
5. ⏳ Implement left sidebar structure (HTML)
6. ⏳ Style sidebar with Google Maps look (CSS) - 70px collapsed, 400px expanded
7. ⏳ Add slide animations (CSS transitions)
8. ⏳ Move settings into sidebar panel (HTML/JS)
9. ⏳ Move route planner into sidebar panel (HTML/JS)
10. ⏳ Add "Clear Current Route" button to route planner header (only when route active)
11. ⏳ Implement "Last Route" functionality (JS) - localStorage, restore all
12. ⏳ Update button styling to match Google Maps (white buttons with icons)
13. ⏳ Remove top buttons, move zoom controls to left side
14. ⏳ Remove all modal overlays, integrate into sidebar
15. ⏳ Test all functionality

---

## Files to Modify

1. `static/index.html` - Add sidebar structure, modify route planner header
2. `static/assets/style.css` - Add sidebar styles, Google Maps button styles, animations
3. `static/assets/js/sm_overview_map.js` - Add sidebar logic, last route tracking, button handlers

---

## Notes

- All work will be done in the `static` folder only
- Reference image shows Google Maps with white sidebar, rounded buttons, icons
- Need to maintain existing functionality while changing UI

