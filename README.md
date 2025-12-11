<div align="center">
<p><img src="./static/assets/img/favicon.png" width="150" height="auto" alt"logo"></p>
<h1><a href="https://surgamingoninsulin.github.io/preview_SMScrapMapper/">DEMO</a></h1>
</div>
<br>
# Scrap Mechanic Map

A desktop application for viewing and navigating the Scrap Mechanic game map with route planning capabilities.

## Features

- **Interactive Map View**: Explore the Scrap Mechanic world map with zoom and pan controls
- **Route Planning**: Create custom routes with waypoints
- **Saved Routes**: Save and manage multiple routes
- **Last Route**: Quickly restore your last calculated route
- **POI Markers**: View points of interest on the map
- **Persistent Data**: Your routes and settings are automatically saved

## Requirements

- **Python 3.7+** (for development)
- **Windows 10+** (for the compiled EXE)
- **cells.json** file (must be placed in the `data` folder next to the EXE)

## Installation

### Option 1: Using the Pre-built EXE

1. Download `SMScrapMapper.exe` from the `dist` folder
2. Place your `cells.json` file in a `data` folder next to the EXE:
   ```
   SMScrapMapper.exe
   data/
     └── cells.json
   ```
3. Run `SMScrapMapper.exe`

The application will automatically create the `data` folder and a README file if it doesn't exist.

### Option 2: Running from Source

1. Clone or download this repository
2. Run `setup.bat` (Windows) - this will:
   - Create a virtual environment
   - Install required dependencies
   - Run the application

Or manually:
```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
python Main.py
```

### Build Configuration

The build process:
- Bundles all static files (HTML, CSS, JS, images) into the EXE
- Creates a single-file executable (`--onefile`)
- Hides the console window (`--noconsole`)
- Includes the application icon
- Excludes unnecessary modules to reduce size

**Important**: The `cells.json` file is **NOT** included in the EXE. You must place it in the `data` folder next to the EXE manually.

## File Structure

```
scrapmechanic map/
├── Main.py                 # Main application entry point
├── requirements.txt        # Python dependencies
├── static/                # Web assets (bundled into EXE)
│   ├── index.html
│   └── assets/
│       ├── js/
│       ├── img/
│       └── style.css
└── data/                  # User data folder (created automatically)
   ├── cells.json         # Map data (user must provide)
   ├── user_data.json     # Saved routes/settings (auto-generated)
   └── !_README_!.txt     # Instructions (auto-generated)
```

## Usage

### First Launch

1. Place your `cells.json` file in the `data` folder next to the EXE
2. Launch `SMScrapMapper.exe`
3. If `cells.json` is missing, you'll see an alert - the app will still run but may not function correctly

### Creating Routes

1. Click on the map to add waypoints
2. Enter a route name in the input field
3. Click "Calculate Route" to generate the path
4. Routes are automatically saved

### Managing Routes

- **New Route**: Start creating a new route
- **Saved Routes**: View and load previously saved routes
- **Last Route**: Restore your most recently calculated route
- **Clear Current Route**: Remove waypoints from the current route

### Settings

Access settings via the map controls panel to customize:
- Map display options
- Route preferences
- Other application settings

## Data Files

### cells.json

- **Location**: `data/cells.json` (next to the EXE)
- **Purpose**: Contains map cell data for the Scrap Mechanic world
- **Required**: Yes (application will show an alert if missing)
- **Source**: You must obtain this file separately

### user_data.json

- **Location**: `data/user_data.json` (next to the EXE)
- **Purpose**: Stores your saved routes and settings
- **Required**: No (auto-generated when you save data)
- **Auto-created**: Yes, when you create routes or change settings

## Troubleshooting

### "cells.json not found" Alert

- Ensure `cells.json` is in the `data` folder next to the EXE
- Check that the file is named exactly `cells.json` (case-sensitive)
- Verify the file is valid JSON

### Application Won't Start

- Check that all dependencies are installed (run `setup.bat`)
- Ensure you have Python 3.7+ installed
- Try running with `build_debug.bat` to see error messages

### Routes Not Saving

- Check that the `data` folder exists next to the EXE
- Verify write permissions in the EXE directory
- Check console output for error messages (if running from source)

## Development

### Running in Development Mode

```bash
python Main.py
```

This will run the application with debug output and console window.

### Dependencies

- `pywebview==5.0.0` - Desktop webview wrapper

### Project Structure

- `Main.py`: Handles file paths, loads data, manages webview window
- `static/`: Web application files (HTML, CSS, JavaScript)
- `static/assets/js/sm_overview_map.js`: Main map logic and route planning

## License

[Add your license information here]

## Credits
og outhor of  un modified sm_overview_map is [the1killer](https://github.com/the1killer/sm_overview)
Built for Scrap Mechanic map navigation and route planning.

