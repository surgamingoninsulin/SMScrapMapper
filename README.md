<div align="center">
<h1><a href="https://surgamingoninsulin.github.io/SMScrapMapper/">WEBSITE</a></h1>
</div>

# Scrap Mechanic Map - Overview

An interactive map viewer and route planner for Scrap Mechanic, featuring a Google Maps-style route planning system with waypoint management, pathfinding algorithms, and comprehensive settings.

## Features

### ✅ Route Planner
- **Google Maps-style Interface**: Full-screen overlay with modern UI
- **Multi-waypoint Routes**: Create routes with unlimited waypoints
- **Drag-and-Drop Waypoints**: Reposition waypoints by dragging
- **Smart Pathfinding**: A* algorithm with water avoidance and road preference
- **Route Management**: Save, load, and delete routes (persisted in browser)
- **Visual Customization**: Customize route colors, width, opacity, and glow effects

### ✅ Settings System
- **Unified Settings Modal**: Access all settings via cog icon (top-right)
- **Map Options**: Default zoom, center, grid, borders, coordinate display
- **Marker Options**: Size, opacity, labels
- **Route Options**: Color, width, opacity, glow, snap settings
- **UI Customization**: Panel position, width, auto-collapse
- **Data Management**: Export/import settings, reset to defaults

### ✅ Marker System
- **Consistent Design**: All markers use route planner waypoint pin style (blue circles)
- **Quick Waypoint Creation**: Click map → "Add to Route Planner" button
- **Seamless Integration**: Waypoints added without opening route planner window

## Quick Start

1. **Open Route Planner**: Click the 🗺️ Route Planner button at the top center
2. **Add Waypoints**: 
   - Click "Add Waypoint" then click on the map, OR
   - Check "Add Pin on Map Click" to add waypoints directly by clicking the map
3. **Calculate Route**: Click "Calculate Route" to see the path
4. **Save Route**: Enter a route name and click "Save Route"
5. **Load Route**: Click "Open Saved Route" to view and load saved routes

## Pathfinding

The route planner uses intelligent pathfinding:
- **Water Avoidance**: Routes never go through water tiles
- **Road Preference**: Routes prefer road tiles when available
- **Shortest Path**: Always calculates the most efficient route
- **A* Algorithm**: Efficient pathfinding with optimal results

## Settings

Access settings via the ⚙️ cog icon in the top-right corner:
- **Map Display**: Customize zoom, center, grid, borders
- **Markers**: Adjust size, opacity, labels
- **Routes**: Customize colors, width, opacity, glow
- **UI**: Panel position, width, auto-collapse

## Technical Details

- **Storage**: Routes and settings saved in browser localStorage
- **Format**: JSON (routes and settings)
- **Pathfinding**: A* algorithm with water avoidance and road preference
- **Framework**: Leaflet.js for map rendering
- **Styling**: Modern CSS with gradients, animations, and backdrop blur

## Browser Compatibility

- Modern browsers with localStorage support
- Recommended: Chrome, Firefox, Edge (latest versions)

## License

See LICENSE file for details.

---

For detailed implementation information, see [plan.md](plan.md).