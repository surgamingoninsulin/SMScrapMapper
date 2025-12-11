#!/usr/bin/env python3
"""
Scrap Mechanic Map - Desktop Application
Automatically creates folder structure and loads the map application
"""

import os
import sys
from pathlib import Path
import webview

# Get the base directory (where Main.py or EXE is located)
# When running as EXE, PyInstaller sets _MEIPASS for temp dir, but we need the actual EXE location
if getattr(sys, 'frozen', False):
    # Running as compiled EXE
    # sys.executable points to the EXE file itself
    BASE_DIR = Path(sys.executable).parent.resolve()
    # For --onefile builds, static files are in sys._MEIPASS
    if hasattr(sys, '_MEIPASS'):
        STATIC_DIR = Path(sys._MEIPASS) / 'static'
    else:
        STATIC_DIR = BASE_DIR / 'static'
else:
    # Running as script
    BASE_DIR = Path(__file__).parent.resolve()
    STATIC_DIR = BASE_DIR / 'static'

ASSETS_DIR = STATIC_DIR / 'assets'
INDEX_HTML = STATIC_DIR / 'index.html'

# Helper function to get data file paths (resolved at runtime)
def get_cells_json_path():
    """Get the path to cells.json in the data folder"""
    return (BASE_DIR / 'data' / 'cells.json').resolve()

def get_user_data_path():
    """Get the path to user_data.json in the data folder"""
    return (BASE_DIR / 'data' / 'user_data.json').resolve()


def create_folder_structure():
    """Create data folder and placeholder file for cells.json"""
    # Create data folder next to EXE
    data_dir = BASE_DIR / 'data'
    data_dir.mkdir(parents=True, exist_ok=True)
    
    # Create placeholder text file
    placeholder_file = data_dir / '!_README_!.txt'
    if not placeholder_file.exists():
        try:
            with open(placeholder_file, 'w', encoding='utf-8') as f:
                f.write('Place your cells.json file in this folder.\n')
                f.write('The cells.json file is required for the map to function properly.\n')
            print(f"[OK] Created placeholder file: {placeholder_file}")
        except Exception as e:
            print(f"[WARNING] Failed to create placeholder file: {e}")
    else:
        print(f"[OK] Data folder already exists: {data_dir}")




if __name__ == '__main__':
    print("=" * 60)
    print("Scrap Mechanic Map - Starting Application")
    print("=" * 60)
    
    # Create data folder and placeholder file
    print("\n[1/2] Creating data folder structure...")
    create_folder_structure()
    
    # Debug: Print base directory info
    print(f"[DEBUG] Base directory (EXE location): {BASE_DIR}")
    print(f"[DEBUG] Current working directory: {Path.cwd()}")
    print(f"[DEBUG] Running as EXE: {getattr(sys, 'frozen', False)}")
    if getattr(sys, 'frozen', False):
        print(f"[DEBUG] sys.executable: {sys.executable}")
        if hasattr(sys, '_MEIPASS'):
            print(f"[DEBUG] _MEIPASS (temp extraction dir): {sys._MEIPASS}")
            print(f"[DEBUG] NOTE: _MEIPASS is only used for STATIC files (HTML/CSS/JS/images)")
        else:
            print(f"[DEBUG] _MEIPASS: Not available")
    else:
        print(f"[DEBUG] __file__: {__file__}")
    # Get resolved paths
    CELLS_JSON = get_cells_json_path()
    USER_DATA_FILE = get_user_data_path()
    
    print(f"[DEBUG] cells.json location (next to EXE): {CELLS_JSON}")
    print(f"[DEBUG] user_data.json location (next to EXE): {USER_DATA_FILE}")
    print(f"[DEBUG] STATIC_DIR (for bundled files): {STATIC_DIR}")
    
    # Check if cells.json exists next to EXE
    cells_json_content = None
    if CELLS_JSON.exists():
        print(f"[OK] Found cells.json: {CELLS_JSON}")
        try:
            # Read cells.json content to pass to JavaScript
            with open(CELLS_JSON, 'r', encoding='utf-8') as f:
                cells_json_content = f.read()
            print(f"[OK] Successfully read cells.json ({len(cells_json_content)} characters)")
        except Exception as e:
            print(f"[WARNING] Failed to read cells.json: {e}")
    else:
        # cells.json is optional - application will work without it (just show alert)
        print(f"[INFO] cells.json not found at {CELLS_JSON} - application will continue without it")
        print(f"  Please place cells.json in the data folder: {BASE_DIR / 'data'}")
    
    # Check if index.html exists
    if not INDEX_HTML.exists():
        print(f"[ERROR] index.html not found at {INDEX_HTML}")
        print(f"[DEBUG] STATIC_DIR: {STATIC_DIR}")
        print(f"[DEBUG] BASE_DIR: {BASE_DIR}")
        if getattr(sys, 'frozen', False) and hasattr(sys, '_MEIPASS'):
            print(f"[DEBUG] _MEIPASS: {sys._MEIPASS}")
        print("  Cannot start application without index.html")
        # Try to list what's in STATIC_DIR
        if STATIC_DIR.exists():
            print(f"[DEBUG] Contents of {STATIC_DIR}:")
            try:
                for item in STATIC_DIR.iterdir():
                    print(f"  - {item.name}")
            except Exception as e:
                print(f"  [ERROR] Could not list directory: {e}")
        sys.exit(1)
    
    # Convert path to file:// URL for webview
    html_path = INDEX_HTML.resolve()
    html_url = html_path.as_uri()  # Converts to file:// URL
    
    print(f"\n[2/2] Opening application window...")
    print(f"  Loading: {html_url}")
    print(f"  STATIC_DIR: {STATIC_DIR}")
    print("=" * 60 + "\n")
    
    # Load user data from file if it exists (backup from previous session)
    # user_data.json is optional - will be created automatically when needed
    user_data_backup = {}
    print(f"[DEBUG] Looking for user_data.json at: {USER_DATA_FILE}")
    print(f"[DEBUG] File exists: {USER_DATA_FILE.exists()}")
    if USER_DATA_FILE.exists():
        try:
            import json
            with open(USER_DATA_FILE, 'r', encoding='utf-8') as f:
                user_data_backup = json.load(f)
            print(f"[OK] Loaded user data backup: {len(user_data_backup)} items")
        except Exception as e:
            print(f"[WARNING] Failed to load user data backup: {e}")
            import traceback
            traceback.print_exc()
    else:
        print(f"[INFO] user_data.json not found at {USER_DATA_FILE}")
        print(f"[INFO] Will be created automatically when needed")
    
    # Create and start webview window (application mode)
    window = webview.create_window(
        'Scrap Mechanic Map',
        html_url,
        width=1400,
        height=900,
        min_size=(800, 600),
        resizable=True
    )
    
    # Inject cells.json and restore user data after page loads
    import threading
    import json as json_lib
    def wait_and_inject():
        import time
        # First, set up the promise mechanism for data restoration
        if user_data_backup:
            window.evaluate_js("""
                (function() {
                    if(!window.__dataRestorePromise) {
                        window.__dataRestorePromise = {
                            resolved: false,
                            resolve: function() {
                                this.resolved = true;
                                if(this.callback) this.callback();
                            },
                            then: function(callback) {
                                if(this.resolved) {
                                    callback();
                                } else {
                                    this.callback = callback;
                                }
                            }
                        };
                        window.__waitForDataRestore = new Promise(function(resolve) {
                            window.__dataRestorePromise.resolve = resolve;
                            if(window.__dataRestorePromise.resolved) {
                                resolve();
                            }
                        });
                    }
                })();
            """)
        
        # Wait for page to load and JavaScript to initialize
        for i in range(10):  # Try up to 10 times (5 seconds total)
            time.sleep(0.5)
            try:
                # Check if page is ready
                result = window.evaluate_js("typeof SMOverviewMap !== 'undefined'")
                if result:
                    # Inject cells.json if available
                    if cells_json_content:
                        escaped_json = json_lib.dumps(cells_json_content)
                        window.evaluate_js(f"""
                            window.__cellsJsonData = {escaped_json};
                            if(typeof SMOverviewMap !== 'undefined' && typeof SMOverviewMap.init === 'function') {{
                                SMOverviewMap.init({escaped_json});
                            }}
                        """)
                        print(f"[OK] Successfully injected cells.json into page")
                    
                    # Restore user data from backup file BEFORE init runs
                    if user_data_backup:
                        try:
                            escaped_backup = json_lib.dumps(user_data_backup)
                            window.evaluate_js(f"""
                                (function() {{
                                    var backup = {escaped_backup};
                                    if(window.localStorage) {{
                                        // Always restore from backup (overwrite existing)
                                        for(var key in backup) {{
                                            localStorage.setItem(key, backup[key]);
                                        }}
                                        console.log('Restored user data from backup file:', Object.keys(backup));
                                        
                                        // Resolve the promise to allow init() to proceed
                                        if(window.__dataRestorePromise) {{
                                            window.__dataRestorePromise.resolve();
                                        }}
                                        
                                        // If SMOverviewMap is already initialized, reload the data
                                        if(typeof SMOverviewMap !== 'undefined' && typeof SMOverviewMap.init === 'function') {{
                                            // Re-run loadSettings and loadRoutes
                                            if(typeof loadSettings === 'function') {{
                                                loadSettings();
                                            }}
                                            if(typeof loadRoutes === 'function') {{
                                                loadRoutes();
                                            }}
                                            // Update last route button if function exists
                                            if(typeof updateLastRouteButton === 'function') {{
                                                updateLastRouteButton();
                                            }}
                                        }}
                                    }}
                                }})();
                            """)
                            print(f"[OK] Restored user data from backup file")
                        except Exception as e:
                            print(f"[WARNING] Failed to restore user data: {e}")
                            # Resolve promise even on error so init can proceed
                            try:
                                window.evaluate_js("""
                                    if(window.__dataRestorePromise) {
                                        window.__dataRestorePromise.resolve();
                                    }
                                """)
                            except:
                                pass
                    
                    # Set up backup on page unload (when window closes)
                    window.evaluate_js("""
                        (function() {
                            // Backup localStorage before page unloads
                            window.addEventListener('beforeunload', function() {
                                try {
                                    var allData = {};
                                    for(var i = 0; i < localStorage.length; i++) {
                                        var key = localStorage.key(i);
                                        if(key && key.startsWith('sm_')) {
                                            allData[key] = localStorage.getItem(key);
                                        }
                                    }
                                    // Store in window for Python to read on close
                                    window.__userDataToSave = JSON.stringify(allData);
                                } catch(e) {
                                    console.warn('Failed to backup localStorage:', e);
                                }
                            });
                            
                            // Also backup periodically (every 30 seconds) as safety measure
                            if(!window.__backupInterval) {
                                window.__backupInterval = setInterval(function() {
                                    try {
                                        var allData = {};
                                        for(var i = 0; i < localStorage.length; i++) {
                                            var key = localStorage.key(i);
                                            if(key && key.startsWith('sm_')) {
                                                allData[key] = localStorage.getItem(key);
                                            }
                                        }
                                        window.__userDataToSave = JSON.stringify(allData);
                                    } catch(e) {
                                        console.warn('Failed to backup localStorage:', e);
                                    }
                                }, 30000); // Backup every 30 seconds
                            }
                        })();
                    """)
                    
                    return
            except Exception as e:
                if i == 9:  # Last attempt
                    print(f"[WARNING] Failed to inject data after multiple attempts: {e}")
                continue
    
    threading.Thread(target=wait_and_inject, daemon=True).start()
    
    # Periodic backup thread to save localStorage to file
    def periodic_backup():
        import time
        import json
        while True:
            time.sleep(15)  # Check every 15 seconds
            try:
                # Check if there's data to save from JavaScript
                data_to_save = window.evaluate_js("""
                    (function() {
                        try {
                            if(window.__userDataToSave) {
                                var data = window.__userDataToSave;
                                window.__userDataToSave = null; // Clear after reading
                                return data;
                            }
                            // Fallback: read directly from localStorage
                            var allData = {};
                            for(var i = 0; i < localStorage.length; i++) {
                                var key = localStorage.key(i);
                                if(key && key.startsWith('sm_')) {
                                    allData[key] = localStorage.getItem(key);
                                }
                            }
                            return JSON.stringify(allData);
                        } catch(e) {
                            return '{}';
                        }
                    })();
                """)
                
                if data_to_save and data_to_save != '{}' and data_to_save != 'null':
                    try:
                        user_data = json.loads(data_to_save)
                        # Only save if there's actual data
                        if user_data:
                            user_data_path = get_user_data_path()
                            # Ensure data folder exists
                            user_data_path.parent.mkdir(parents=True, exist_ok=True)
                            with open(user_data_path, 'w', encoding='utf-8') as f:
                                json.dump(user_data, f, indent=2)
                    except Exception as e:
                        print(f"[WARNING] Failed to save user data: {e}")
            except:
                pass  # Silently fail to avoid spam
    
    threading.Thread(target=periodic_backup, daemon=True).start()
    
    # Save data on window close
    def save_on_close():
        import json
        try:
            # Try to get data one last time before closing
            data_to_save = window.evaluate_js("""
                (function() {
                    try {
                        var allData = {};
                        for(var i = 0; i < localStorage.length; i++) {
                            var key = localStorage.key(i);
                            if(key && key.startsWith('sm_')) {
                                allData[key] = localStorage.getItem(key);
                            }
                        }
                        return JSON.stringify(allData);
                    } catch(e) {
                        return '{}';
                    }
                })();
            """)
            
            if data_to_save and data_to_save != '{}':
                try:
                    user_data = json.loads(data_to_save)
                    # Only save if there's actual data
                    if user_data:
                        user_data_path = get_user_data_path()
                        # Ensure data folder exists
                        user_data_path.parent.mkdir(parents=True, exist_ok=True)
                        with open(user_data_path, 'w', encoding='utf-8') as f:
                            json.dump(user_data, f, indent=2)
                        print(f"[OK] Saved user data to {user_data_path}")
                except Exception as e:
                    print(f"[WARNING] Failed to save user data on close: {e}")
        except:
            pass
    
    # Register cleanup function
    import atexit
    atexit.register(save_on_close)
    
    if not cells_json_content:
        # If cells.json not found, show alert and inject a flag to prevent fallback loading
        def show_alert_and_prevent_fallback():
            import time
            time.sleep(1)
            try:
                window.evaluate_js("""
                    (function() {
                        window.__cellsJsonNotFound = true;
                        alert('ERROR: cells.json not found!\\n\\nPlease place cells.json next to the EXE file:\\n' + window.location.pathname.replace(/[^/]*$/, '') + '\\n\\nThe application will continue but may not function correctly without cells.json.');
                    })();
                """)
            except:
                pass
        threading.Thread(target=show_alert_and_prevent_fallback, daemon=True).start()
    
    try:
        webview.start(debug=False)
    except Exception as e:
        print(f"[ERROR] Failed to start webview: {e}")
        import traceback
        traceback.print_exc()
        input("Press Enter to exit...")
        sys.exit(1)

