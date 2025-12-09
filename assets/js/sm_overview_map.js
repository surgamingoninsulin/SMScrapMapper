//
// SM Overview Map
// v1.0.0
//
let SMOverviewMap;
SMOverviewMap = (function() {
    var celljson = "";
    var celldata = [];
    var cells = {};
    var map;
    var clickmarker;
    // Old pinned markers system removed - using route planner waypoints instead
    var pinnedMarkers = []; // Empty array for compatibility
    var highlightedTileTypes = new Set();
    var highlightLayerGroup;
    var availableMarkerIcons = [];
    var markerIconCache = {};
    var pinsVisible = true;
    var openPopupOnClick = false;
    var routeMode = false;
    var selectedPinA = null;
    var selectedPinB = null;
    var routeLine = null;
    var routeLayer = null;
    
    // Advanced Route Planning
    var routePlanningMode = false;
    var routeWaypoints = []; // Array of {marker, x, y, lat, lng, name}
    var currentRoute = null; // Current route being edited
    var routeWaypointMarkers = []; // Leaflet markers for waypoints
    var savedRoutes = []; // Array of saved routes {name, waypoints: [{x, y, lat, lng, name}]}
    var addPinFromMapMode = false; // Enable adding pins from map clicks in route planner
    
    // Settings/Options
    var appSettings = {
        version: "1.0.0",
        map: {
            defaultZoom: 2.5,
            defaultCenterX: -848,
            defaultCenterY: -858,
            showGrid: false,
            showCellBorders: false,
            coordinateDisplay: "onHover" // always, onHover, onClick, never
        },
        pins: {
            defaultIcon: "marker.png",
            autoNaming: true,
            markerSize: 100, // percentage
            markerOpacity: 100, // percentage
            showLabels: "never" // always, onHover, never
        },
        routes: {
            defaultColor: "#FF1744",
            lineWidth: 3,
            lineOpacity: 100,
            glowEffect: true,
            snapToRoads: false,
            snapToGrid: false
        },
        ui: {
            panelPosition: "right",
            panelWidth: 200,
            autoCollapse: false
        }
    };

    var minZoom = 0
    var maxZoom = 5
    var gridSize = 64
    
    // Detect base path for GitHub Pages compatibility
    function getBasePath() {
        // Get the base path from the current script location
        var scripts = document.getElementsByTagName('script');
        for(var i = scripts.length - 1; i >= 0; i--) {
            if(scripts[i].src && scripts[i].src.indexOf('sm_overview_map.js') !== -1) {
                var scriptPath = scripts[i].src;
                // Extract base path (everything before assets/js/sm_overview_map.js)
                var basePath = scriptPath.substring(0, scriptPath.indexOf('assets/js/'));
                return basePath;
            }
        }
        
        // Fallback: try to detect from window location
        var path = window.location.pathname;
        // Remove index.html or trailing slash
        if(path.endsWith('index.html')) {
            path = path.substring(0, path.length - 10);
        }
        if(!path.endsWith('/')) {
            path = path + '/';
        }
        return path;
    }
    
    var basePath = getBasePath();

    // A quick extension to allow image layer rotation.
    L.RotateImageLayer = L.ImageOverlay.extend({
        options: {rotation: 0},
        _animateZoom: function(e){
            L.ImageOverlay.prototype._animateZoom.call(this, e);
            var img = this._image;
            img.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.rotation + 'deg)';
        },
        _reset: function(){
            L.ImageOverlay.prototype._reset.call(this);
            var img = this._image;
            img.style[L.DomUtil.TRANSFORM] += ' rotate(' + this.options.rotation + 'deg)';
        }
    });
    L.rotateImageLayer = function(url, bounds, options) {
        return new L.RotateImageLayer(url, bounds, options);
    };
    
    L.TileLayer.OffsetTileLayer = L.TileLayer.extend({
        _getTilePos: function (coords) {
            var pos = L.TileLayer.prototype._getTilePos.call(this, coords);
            if(coords.z <= 1) {
                return pos.subtract([200, 420]);
            } else if(coords.z == 2){
                return pos.subtract([1200, 1400]);
            } else {
                return pos;
            }
        }
    });

    // Use route planner waypoint icon style instead of marker.png
    var markerIcon = L.divIcon({
        className: 'waypoint-marker',
        html: '<div style="width: 20px; height: 20px; background: #667eea; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    })

    // Pinned marker icon - now uses waypoint style (old system removed)
    var pinnedMarkerIcon = L.divIcon({
        className: 'waypoint-marker',
        html: '<div style="width: 20px; height: 20px; background: #667eea; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
    });

    L.tileLayer.offsetTileLayer = function(opts) {
        return new L.TileLayer.OffsetTileLayer(opts);
    };

    let loadFile = async function(file, callback) {
        $.getJSON(file, function() {
        }).done(function(d) {
            if(typeof callback === 'function') {
                callback(d);
            } else {
                return d;
            }
        }).fail(function(d, e, f) {
            console.warn(file + " had a problem loading. Sorry!");
            console.warn(d, e, f);
        }).always(function() {
        });
    };
    let xy = function(x, y) {
        let n = L.latLng;
        return L.Util.isArray(x) ? n(x[1], x[0]) : n(y, x)
    }

    // Discover available marker icons by scanning markers folder
    function discoverMarkerIcons() {
        var icons = [];
        // Primary location: ./assets/img/markers/
        var imgMarkersPath = basePath + 'assets/img/markers/';
        var markersPath = basePath + 'assets/assets/img/markers/'; // Fallback
        var imgBasePath = basePath + 'assets/img/';
        var patterns = [];
        
        // Always include marker.png from primary location first
        patterns.push({ path: imgMarkersPath, file: 'marker.png' });
        patterns.push({ path: markersPath, file: 'marker.png' }); // Fallback
        patterns.push({ path: imgBasePath, file: 'marker.png' }); // Fallback to assets/img/
        
        // Check for markerX.png pattern (marker1.png through marker10.png)
        for(var i = 1; i <= 10; i++) {
            // Check assets/img/markers/ (primary location)
            patterns.push({ path: imgMarkersPath, file: 'marker' + i + '.png' });
            // Also check fallback location
            patterns.push({ path: markersPath, file: 'marker' + i + '.png' });
        }
        
        console.log('Scanning for markers in: ' + imgMarkersPath);
        
        // Test each pattern by trying to load the image (with batching to avoid blocking)
        var tested = 0;
        var maxTests = patterns.length;
        var foundIcons = new Set(); // Use Set to avoid duplicates
        var batchSize = 50; // Process in batches to avoid blocking
        var currentBatch = 0;
        
        function checkComplete() {
            if(tested === maxTests) {
                icons = Array.from(foundIcons);
                // Sort icons: marker.png first, then marker1.png through marker10.png
                icons.sort(function(a, b) {
                    var aFile = a.split('/').pop();
                    var bFile = b.split('/').pop();
                    if(aFile === 'marker.png') return -1;
                    if(bFile === 'marker.png') return 1;
                    var aMatch = aFile.match(/^marker(\d+)\.png$/);
                    var bMatch = bFile.match(/^marker(\d+)\.png$/);
                    if(aMatch && bMatch) {
                        return parseInt(aMatch[1]) - parseInt(bMatch[1]);
                    }
                    return aFile.localeCompare(bFile);
                });
                // Default to assets/img/markers/ if available
                var defaultMarkerPath = basePath + 'assets/img/markers/marker.png';
                availableMarkerIcons = icons.length > 0 ? icons : [defaultMarkerPath];
                console.log('Discovered ' + availableMarkerIcons.length + ' marker icons:', availableMarkerIcons);
            }
        }
        
        function processBatch(startIndex) {
            var endIndex = Math.min(startIndex + batchSize, patterns.length);
            for(var i = startIndex; i < endIndex; i++) {
                var pattern = patterns[i];
                var fullPath = pattern.path + pattern.file;
                var img = new Image();
                img.onload = function(path) {
                    return function() {
                        foundIcons.add(path);
                        tested++;
                        checkComplete();
                    };
                }(fullPath);
                img.onerror = function() {
                    tested++;
                    checkComplete();
                };
                img.src = fullPath;
            }
            
            // Process next batch asynchronously
            if(endIndex < patterns.length) {
                setTimeout(function() {
                    processBatch(endIndex);
                }, 10);
            }
        }
        
        // Start processing in batches
        processBatch(0);
        
        return icons;
    }

    // Create icon from path
    function createMarkerIcon(iconPath) {
        // Get marker size from settings
        var markerSize = getSetting('pins', 'markerSize') || 100;
        var baseWidth = 20;
        var baseHeight = 44;
        var newWidth = Math.round(baseWidth * (markerSize / 100));
        var newHeight = Math.round(baseHeight * (markerSize / 100));
        var newAnchorX = Math.round(9 * (markerSize / 100));
        var newAnchorY = Math.round(44 * (markerSize / 100));
        
        // Create cache key with size
        var cacheKey = iconPath + '_' + markerSize;
        if(markerIconCache[cacheKey]) {
            return markerIconCache[cacheKey];
        }
        
        var icon = L.icon({
            iconUrl: iconPath,
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            iconSize: [newWidth, newHeight],
            iconAnchor: [newAnchorX, newAnchorY],
            popupAnchor: [0, -newHeight],
            className: 'pinned-marker-icon'
        });
        
        markerIconCache[cacheKey] = icon;
        return icon;
    }

    // OLD PINNED MARKERS SYSTEM - REMOVED (using route planner waypoints instead)
    function savePinnedMarkers() {
        // Removed - use route planner waypoints instead
    }

    function loadPinnedMarkers() {
        // Removed - use route planner waypoints instead
    }

    function createPinnedMarker(lat, lng, x, y, save, iconPath, name) {
        // OLD SYSTEM - REMOVED
        // This function is kept for compatibility but does nothing
        // Use route planner waypoints instead
        return null;
        // Default to markers folder if available, otherwise fallback
        // Default to assets/img/markers/ if available, otherwise assets/assets/img/markers/
        iconPath = iconPath || basePath + 'assets/img/markers/marker.png';
        name = name || '';
        var icon = createMarkerIcon(iconPath);
        
        var marker = L.marker([lat, lng], {
            icon: icon,
            x: x,
            y: y,
            iconPath: iconPath,
            name: name
        }).addTo(map);
        
        // Add class to marker element for styling (fallback if image doesn't exist)
        marker.on('add', function() {
            var iconElement = marker._icon;
            if(iconElement) {
                iconElement.classList.add('pinned-marker');
                // If image fails to load, apply fallback styling
                iconElement.onerror = function() {
                    this.src = basePath + 'assets/img/markers/marker.png';
                    this.classList.add('pinned-marker-fallback');
                };
            }
        });
        
        marker.bindPopup(contentForMarker(x, y, true, iconPath, name), {
            autoClose: false,
            closeOnClick: false
        });
        
        // Apply opacity from settings
        var markerOpacity = getSetting('pins', 'markerOpacity') || 100;
        marker.on('add', function() {
            var iconElement = marker._icon;
            if(iconElement && markerOpacity < 100) {
                iconElement.style.opacity = (markerOpacity / 100);
            }
        });
        
        // OLD SYSTEM: pinnedMarkers.push(marker);
        
        // Add click handler for route selection and waypoint adding
        marker.on('click', function(e) {
            if(routePlanningMode && routePlanningMode === 'waypoint') {
                e.originalEvent.stopPropagation();
                addWaypointFromPin(marker);
            } else if(routeMode) {
                e.originalEvent.stopPropagation();
                // Determine which pin to select based on button state
                var selectPinABtn = document.getElementById('select-pin-a-btn');
                var selectPinBBtn = document.getElementById('select-pin-b-btn');
                var pinType = null;
                if(selectPinABtn && selectPinABtn.textContent.indexOf('Selecting') !== -1) {
                    pinType = 'A';
                } else if(selectPinBBtn && selectPinBBtn.textContent.indexOf('Selecting') !== -1) {
                    pinType = 'B';
                }
                selectPinForRoute(marker, pinType);
            }
        });
        
        // Setup event handlers when popup opens
        marker.on('popupopen', function() {
            var popup = marker.getPopup();
            if(popup && popup._contentNode) {
                // Setup checkbox handler
                var checkbox = popup._contentNode.querySelector('.pin-marker-cb[data-x="' + x + '"][data-y="' + y + '"]');
                if(checkbox) {
                    checkbox.checked = true; // Ensure it's checked for pinned markers
                    // Remove any existing listeners by cloning
                    var newCheckbox = checkbox.cloneNode(true);
                    checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                    newCheckbox.addEventListener('change', function(e) {
                        e.stopPropagation();
                        if(!this.checked) {
                            removePinnedMarker(marker);
                        }
                    });
                }
                
                // Setup icon change button
                var changeIconBtn = popup._contentNode.querySelector('.change-icon-btn[data-x="' + x + '"][data-y="' + y + '"]');
                if(changeIconBtn) {
                    // Remove any existing listeners by cloning
                    var newBtn = changeIconBtn.cloneNode(true);
                    changeIconBtn.parentNode.replaceChild(newBtn, changeIconBtn);
                    newBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        showIconSelector(marker, x, y);
                    });
                }
                
                // Setup name input field
                var nameInput = popup._contentNode.querySelector('.marker-name-input[data-x="' + x + '"][data-y="' + y + '"]');
                if(nameInput) {
                    // Remove any existing listeners by cloning
                    var newInput = nameInput.cloneNode(true);
                    nameInput.parentNode.replaceChild(newInput, nameInput);
                    
                    // Prevent clicks on input from triggering map clicks
                    newInput.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                    });
                    
                    // Auto-save on blur
                    newInput.addEventListener('blur', function(e) {
                        e.stopPropagation();
                        updateMarkerName(marker, this.value, x, y);
                    });
                    
                    // Auto-save on Enter key
                    newInput.addEventListener('keypress', function(e) {
                        if(e.key === 'Enter') {
                            e.stopPropagation();
                            e.preventDefault();
                            updateMarkerName(marker, this.value, x, y);
                            this.blur();
                        }
                    });
                }
                
                // Setup save name button
                var saveNameBtn = popup._contentNode.querySelector('.save-name-btn[data-x="' + x + '"][data-y="' + y + '"]');
                if(saveNameBtn) {
                    // Remove any existing listeners by cloning
                    var newSaveBtn = saveNameBtn.cloneNode(true);
                    saveNameBtn.parentNode.replaceChild(newSaveBtn, saveNameBtn);
                    
                    // Prevent clicks from propagating to map
                    newSaveBtn.addEventListener('click', function(e) {
                        e.stopPropagation();
                        e.preventDefault();
                        var nameInput = popup._contentNode.querySelector('.marker-name-input[data-x="' + x + '"][data-y="' + y + '"]');
                        if(nameInput) {
                            updateMarkerName(marker, nameInput.value, x, y);
                        }
                        return false;
                    }, true); // Use capture phase to catch early
                }
            }
        });
        
        if(save !== false) {
            savePinnedMarkers();
        }
        // Always update pins list when a marker is created
        updatePinsList();
        
        return marker;
    }
    
    function updateMarkerName(marker, newName, x, y) {
        marker.options.name = newName || '';
        savePinnedMarkers();
        marker.bindPopup(contentForMarker(x, y, true, marker.options.iconPath, marker.options.name), {
            autoClose: false,
            closeOnClick: false
        });
        marker.openPopup();
        // Always update pins list when name changes
        updatePinsList();
    }

    // OLD SYSTEM - REMOVED
    function isLocationPinned(lat, lng) {
        // Always return false - old marker system removed
        return false;
    }

    function removePinnedMarker(marker) {
        // OLD SYSTEM - REMOVED
        // Markers are now managed through route planner waypoints
    }

    // Tile highlighting functions
    function getCellBounds(cellX, cellY) {
        var mod = gridSize / 2;
        var startx = mod * cellX;
        var starty = (mod * cellY) - mod;
        var endx = startx + mod;
        var endy = starty + mod;
        return [xy(startx, starty), xy(endx, endy)];
    }

    function createCellGeoJSON(cell) {
        var bounds = getCellBounds(cell.x, cell.y);
        return {
            type: 'Feature',
            geometry: {
                type: 'Polygon',
                coordinates: [[
                    [bounds[0].lng, bounds[0].lat],
                    [bounds[1].lng, bounds[0].lat],
                    [bounds[1].lng, bounds[1].lat],
                    [bounds[0].lng, bounds[1].lat],
                    [bounds[0].lng, bounds[0].lat]
                ]]
            },
            properties: {
                cellX: cell.x,
                cellY: cell.y,
                type: cell.type
            }
        };
    }

    function highlightTilesOfType(type, highlight) {
        if(highlight) {
            highlightedTileTypes.add(type);
        } else {
            highlightedTileTypes.delete(type);
        }
        updateTileHighlights();
    }

    function updateTileHighlights() {
        // Clear existing highlights
        highlightLayerGroup.clearLayers();
        
        if(highlightedTileTypes.size === 0) {
            return;
        }
        
        // Create GeoJSON features for all highlighted tile types
        var features = [];
        celldata.forEach(function(cell) {
            if(highlightedTileTypes.has(cell.type)) {
                features.push(createCellGeoJSON(cell));
            }
        });
        
        if(features.length > 0) {
            var geoJsonLayer = L.geoJSON(features, {
                style: function(feature) {
                    return {
                        color: '#FFD700',
                        weight: 3,
                        opacity: 0.8,
                        fillColor: '#FFD700',
                        fillOpacity: 0.3
                    };
                }
            });
            geoJsonLayer.addTo(highlightLayerGroup);
        }
    }

    // Settings Management Functions
    function loadSettings() {
        try {
            var saved = localStorage.getItem('sm_appSettings');
            if(saved) {
                var parsed = JSON.parse(saved);
                // Merge with defaults (handle version migration)
                if(parsed.version === appSettings.version) {
                    appSettings = Object.assign({}, appSettings, parsed);
                } else {
                    // Migrate settings if version changed
                    appSettings = migrateSettings(parsed);
                }
            }
        } catch(e) {
            console.warn('Failed to load settings:', e);
        }
    }
    
    function saveSettings() {
        try {
            localStorage.setItem('sm_appSettings', JSON.stringify(appSettings));
        } catch(e) {
            console.warn('Failed to save settings:', e);
        }
    }
    
    function getSetting(category, key) {
        if(appSettings[category] && appSettings[category][key] !== undefined) {
            return appSettings[category][key];
        }
        return null;
    }
    
    function setSetting(category, key, value) {
        if(!appSettings[category]) {
            appSettings[category] = {};
        }
        appSettings[category][key] = value;
        saveSettings();
        applySetting(category, key, value);
    }
    
    function applySetting(category, key, value) {
        // Apply setting changes to the map/UI
        if(category === 'map') {
            if(key === 'defaultZoom' && map) {
                // Could set zoom, but usually only on initial load
            }
        } else if(category === 'pins') {
            if(key === 'markerSize' || key === 'markerOpacity') {
                // Update all marker icons
                updateMarkerStyles();
            }
        } else if(category === 'routes') {
            if(key === 'defaultColor' || key === 'lineWidth' || key === 'lineOpacity' || key === 'glowEffect') {
                // Update route line if exists
                if(routeLine) {
                    var routeColor = appSettings.routes.defaultColor;
                    var routeWidth = appSettings.routes.lineWidth;
                    var routeOpacity = appSettings.routes.lineOpacity / 100;
                    
                    routeLine.setStyle({
                        color: routeColor,
                        weight: routeWidth,
                        opacity: routeOpacity
                    });
                    
                    // Apply glow effect via CSS
                    if(routeLayer && routeLayer._container) {
                        var pathElements = routeLayer._container.querySelectorAll('path');
                        pathElements.forEach(function(path) {
                            if(appSettings.routes.glowEffect) {
                                path.style.filter = 'drop-shadow(0 0 3px ' + routeColor + ') drop-shadow(0 0 6px ' + routeColor + ')';
                            } else {
                                path.style.filter = '';
                            }
                        });
                    }
                    
                    // Bring to front
                    routeLine.bringToFront();
                }
            }
        } else if(category === 'ui') {
            if(key === 'panelWidth') {
                // Update all panel widths
                applyPanelWidth(value);
            } else if(key === 'panelPosition') {
                applyPanelPosition(value);
            }
        }
    }
    
    function applyPanelWidth(width) {
        var panels = ['stats', 'pins', 'settings'];
        panels.forEach(function(panelId) {
            var panel = document.getElementById(panelId);
            if(panel) {
                panel.style.width = width + 'px';
                panel.style.minWidth = width + 'px';
                panel.style.maxWidth = width + 'px';
            }
        });
    }
    
    function applyPanelPosition(position) {
        var panels = ['stats', 'pins', 'settings'];
        panels.forEach(function(panelId) {
            var panel = document.getElementById(panelId);
            if(panel) {
                if(position === 'left') {
                    panel.style.right = 'auto';
                    panel.style.left = '10px';
                } else {
                    panel.style.left = 'auto';
                    panel.style.right = '10px';
                }
            }
        });
    }
    
    function applyInitialUISettings() {
        // Apply UI settings on load
        var panelWidth = getSetting('ui', 'panelWidth') || 200;
        var panelPosition = getSetting('ui', 'panelPosition') || 'right';
        applyPanelWidth(panelWidth);
        applyPanelPosition(panelPosition);
    }
    
    function updateMarkerStyles() {
        // Update marker icon sizes/opacity based on settings
        var markerSize = getSetting('pins', 'markerSize') || 100;
        var markerOpacity = getSetting('pins', 'markerOpacity') || 100;
        
        // Calculate new icon size (base size is 20x44)
        var baseWidth = 20;
        var baseHeight = 44;
        var newWidth = Math.round(baseWidth * (markerSize / 100));
        var newHeight = Math.round(baseHeight * (markerSize / 100));
        var newAnchorX = Math.round(9 * (markerSize / 100));
        var newAnchorY = Math.round(44 * (markerSize / 100));
        
        // Update all pinned markers
        // OLD SYSTEM - REMOVED
        // Marker styles are now managed through route planner waypoints
    }
    
    function migrateSettings(oldSettings) {
        // Migrate settings from old version to new
        var migrated = Object.assign({}, appSettings);
        // Copy over existing values that still exist
        if(oldSettings.map) migrated.map = Object.assign({}, appSettings.map, oldSettings.map);
        if(oldSettings.pins) migrated.pins = Object.assign({}, appSettings.pins, oldSettings.pins);
        if(oldSettings.routes) migrated.routes = Object.assign({}, appSettings.routes, oldSettings.routes);
        if(oldSettings.ui) migrated.ui = Object.assign({}, appSettings.ui, oldSettings.ui);
        migrated.version = appSettings.version;
        return migrated;
    }
    
    function resetSettings() {
        if(confirm('Reset all settings to defaults? This cannot be undone.')) {
            appSettings = {
                version: "1.0.0",
                map: {
                    defaultZoom: 2.5,
                    defaultCenterX: -848,
                    defaultCenterY: -858,
                    showGrid: false,
                    showCellBorders: false,
                    coordinateDisplay: "onHover"
                },
                pins: {
                    defaultIcon: "marker.png",
                    autoNaming: true,
                    markerSize: 100,
                    markerOpacity: 100,
                    showLabels: "never"
                },
                routes: {
                    defaultColor: "#FF1744",
                    lineWidth: 3,
                    lineOpacity: 100,
                    glowEffect: true,
                    snapToRoads: false,
                    snapToGrid: false
                },
                ui: {
                    panelPosition: "right",
                    panelWidth: 200,
                    autoCollapse: false
                }
            };
            saveSettings();
            initializeSettingsPanel();
        }
    }
    
    function exportSettings() {
        var dataStr = JSON.stringify(appSettings, null, 2);
        var dataBlob = new Blob([dataStr], {type: 'application/json'});
        var url = URL.createObjectURL(dataBlob);
        var link = document.createElement('a');
        link.href = url;
        link.download = 'scrapmap-settings.json';
        link.click();
        URL.revokeObjectURL(url);
    }
    
    function importSettings() {
        var input = document.createElement('input');
        input.type = 'file';
        input.accept = 'application/json';
        input.onchange = function(e) {
            var file = e.target.files[0];
            if(file) {
                var reader = new FileReader();
                reader.onload = function(e) {
                    try {
                        var imported = JSON.parse(e.target.result);
                        appSettings = migrateSettings(imported);
                        saveSettings();
                        initializeSettingsPanel();
                        alert('Settings imported successfully!');
                    } catch(err) {
                        alert('Failed to import settings: ' + err.message);
                    }
                };
                reader.readAsText(file);
            }
        };
        input.click();
    }
    
    function positionPinsPanel() {
        var statsPanel = document.getElementById("stats");
        var pinsPanel = document.getElementById("pins");
        if(statsPanel && pinsPanel) {
            var statsRect = statsPanel.getBoundingClientRect();
            var statsHeight = statsRect.height;
            pinsPanel.style.top = (statsRect.top + statsHeight + 5) + 'px';
        }
    }
    
    function positionSettingsPanel() {
        var pinsPanel = document.getElementById("pins");
        var settingsPanel = document.getElementById("settings");
        if(pinsPanel && settingsPanel) {
            var pinsRect = pinsPanel.getBoundingClientRect();
            var pinsHeight = pinsRect.height;
            // Position settings panel below pins with a small gap (5px)
            settingsPanel.style.top = (pinsRect.top + pinsHeight + 5) + 'px';
        }
    }
    
    function initializeSettingsPanel() {
        var settingsContent = document.getElementById('settings-content');
        if(!settingsContent) return;
        
        var html = '<div style="font-size: 0.8em;">';
        
        // Map Options
        html += '<div class="stat-title" style="margin-top: 0;">Map Display</div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Default Zoom: <input type="range" id="setting-default-zoom" min="0" max="5" step="0.5" value="' + (appSettings.map.defaultZoom || 2.5) + '" style="width: 100%;"><span id="default-zoom-value">' + (appSettings.map.defaultZoom || 2.5) + '</span></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Default Center X: <input type="number" id="setting-center-x" value="' + (appSettings.map.defaultCenterX || -848) + '" style="width: 100%; margin-top: 2px;"></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Default Center Y: <input type="number" id="setting-center-y" value="' + (appSettings.map.defaultCenterY || -858) + '" style="width: 100%; margin-top: 2px;"></div>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-show-grid" ' + (appSettings.map.showGrid ? 'checked' : '') + '> Show Grid</label>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-show-borders" ' + (appSettings.map.showCellBorders ? 'checked' : '') + '> Show Cell Borders</label>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Coordinate Display: <select id="setting-coord-display" style="width: 100%; margin-top: 2px;"><option value="always"' + (appSettings.map.coordinateDisplay === 'always' ? ' selected' : '') + '>Always</option><option value="onHover"' + (appSettings.map.coordinateDisplay === 'onHover' ? ' selected' : '') + '>On Hover</option><option value="onClick"' + (appSettings.map.coordinateDisplay === 'onClick' ? ' selected' : '') + '>On Click</option><option value="never"' + (appSettings.map.coordinateDisplay === 'never' ? ' selected' : '') + '>Never</option></select></div>';
        
        // Pin Options
        html += '<div class="stat-title" style="margin-top: 10px;">Pins & Markers</div>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-auto-naming" ' + (appSettings.pins.autoNaming ? 'checked' : '') + '> Auto-naming (poi x,y)</label>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Marker Size: <input type="range" id="setting-marker-size" min="50" max="200" value="' + appSettings.pins.markerSize + '" style="width: 100%;"><span id="marker-size-value">' + appSettings.pins.markerSize + '%</span></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Marker Opacity: <input type="range" id="setting-marker-opacity" min="0" max="100" value="' + appSettings.pins.markerOpacity + '" style="width: 100%;"><span id="marker-opacity-value">' + appSettings.pins.markerOpacity + '%</span></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Show Labels: <select id="setting-show-labels" style="width: 100%; margin-top: 2px;"><option value="always"' + (appSettings.pins.showLabels === 'always' ? ' selected' : '') + '>Always</option><option value="onHover"' + (appSettings.pins.showLabels === 'onHover' ? ' selected' : '') + '>On Hover</option><option value="never"' + (appSettings.pins.showLabels === 'never' ? ' selected' : '') + '>Never</option></select></div>';
        
        // Route Options
        html += '<div class="stat-title" style="margin-top: 10px;">Routes</div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Default Color: <input type="color" id="setting-route-color" value="' + appSettings.routes.defaultColor + '" style="width: 100%; margin-top: 2px;"></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Line Width: <input type="range" id="setting-line-width" min="1" max="10" value="' + appSettings.routes.lineWidth + '" style="width: 100%;"><span id="line-width-value">' + appSettings.routes.lineWidth + 'px</span></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Line Opacity: <input type="range" id="setting-line-opacity" min="0" max="100" value="' + appSettings.routes.lineOpacity + '" style="width: 100%;"><span id="line-opacity-value">' + appSettings.routes.lineOpacity + '%</span></div>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-glow-effect" ' + (appSettings.routes.glowEffect ? 'checked' : '') + '> Glow Effect</label>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-snap-roads" ' + (appSettings.routes.snapToRoads ? 'checked' : '') + '> Snap to Roads</label>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-snap-grid" ' + (appSettings.routes.snapToGrid ? 'checked' : '') + '> Snap to Grid</label>';
        
        // UI Options
        html += '<div class="stat-title" style="margin-top: 10px;">UI Customization</div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Panel Position: <select id="setting-panel-position" style="width: 100%; margin-top: 2px;"><option value="right"' + (appSettings.ui.panelPosition === 'right' ? ' selected' : '') + '>Right</option><option value="left"' + (appSettings.ui.panelPosition === 'left' ? ' selected' : '') + '>Left</option></select></div>';
        html += '<div style="margin: 5px 0; font-size: 0.9em;">Panel Width: <input type="range" id="setting-panel-width" min="150" max="400" value="' + (appSettings.ui.panelWidth || 200) + '" style="width: 100%;"><span id="panel-width-value">' + (appSettings.ui.panelWidth || 200) + 'px</span></div>';
        html += '<label style="display: block; margin: 5px 0; font-size: 0.9em;"><input type="checkbox" id="setting-auto-collapse" ' + (appSettings.ui.autoCollapse ? 'checked' : '') + '> Auto-collapse panels</label>';
        
        // Data Management
        html += '<div class="stat-title" style="margin-top: 10px;">Data</div>';
        html += '<button id="export-settings-btn" class="fancy-btn success" style="width: 100%; margin: 2px 0;">Export Settings</button>';
        html += '<button id="import-settings-btn" class="fancy-btn info" style="width: 100%; margin: 2px 0;">Import Settings</button>';
        html += '<button id="reset-settings-btn" class="fancy-btn danger" style="width: 100%; margin: 2px 0;">Reset to Defaults</button>';
        
        html += '</div>';
        
        settingsContent.innerHTML = html;
        
        // Setup event listeners for all settings
        setupSettingsListeners();
    }
    
    function setupSettingsListeners() {
        // Map settings
        var showGrid = document.getElementById('setting-show-grid');
        if(showGrid) {
            showGrid.addEventListener('change', function() {
                setSetting('map', 'showGrid', this.checked);
            });
        }
        
        var showBorders = document.getElementById('setting-show-borders');
        if(showBorders) {
            showBorders.addEventListener('change', function() {
                setSetting('map', 'showCellBorders', this.checked);
            });
        }
        
        var coordDisplay = document.getElementById('setting-coord-display');
        if(coordDisplay) {
            coordDisplay.addEventListener('change', function() {
                setSetting('map', 'coordinateDisplay', this.value);
            });
        }
        
        var defaultZoom = document.getElementById('setting-default-zoom');
        var defaultZoomValue = document.getElementById('default-zoom-value');
        if(defaultZoom) {
            defaultZoom.addEventListener('input', function() {
                if(defaultZoomValue) defaultZoomValue.textContent = this.value;
                setSetting('map', 'defaultZoom', parseFloat(this.value));
            });
        }
        
        var centerX = document.getElementById('setting-center-x');
        if(centerX) {
            centerX.addEventListener('change', function() {
                setSetting('map', 'defaultCenterX', parseInt(this.value));
            });
        }
        
        var centerY = document.getElementById('setting-center-y');
        if(centerY) {
            centerY.addEventListener('change', function() {
                setSetting('map', 'defaultCenterY', parseInt(this.value));
            });
        }
        
        // Pin settings
        var autoNaming = document.getElementById('setting-auto-naming');
        if(autoNaming) {
            autoNaming.addEventListener('change', function() {
                setSetting('pins', 'autoNaming', this.checked);
            });
        }
        
        var markerSize = document.getElementById('setting-marker-size');
        var markerSizeValue = document.getElementById('marker-size-value');
        if(markerSize) {
            markerSize.addEventListener('input', function() {
                if(markerSizeValue) markerSizeValue.textContent = this.value + '%';
                setSetting('pins', 'markerSize', parseInt(this.value));
            });
        }
        
        var markerOpacity = document.getElementById('setting-marker-opacity');
        var markerOpacityValue = document.getElementById('marker-opacity-value');
        if(markerOpacity) {
            markerOpacity.addEventListener('input', function() {
                if(markerOpacityValue) markerOpacityValue.textContent = this.value + '%';
                setSetting('pins', 'markerOpacity', parseInt(this.value));
            });
        }
        
        var showLabels = document.getElementById('setting-show-labels');
        if(showLabels) {
            showLabels.addEventListener('change', function() {
                setSetting('pins', 'showLabels', this.value);
            });
        }
        
        // Route settings
        var routeColor = document.getElementById('setting-route-color');
        if(routeColor) {
            routeColor.addEventListener('change', function() {
                setSetting('routes', 'defaultColor', this.value);
            });
        }
        
        var lineWidth = document.getElementById('setting-line-width');
        var lineWidthValue = document.getElementById('line-width-value');
        if(lineWidth) {
            lineWidth.addEventListener('input', function() {
                if(lineWidthValue) lineWidthValue.textContent = this.value + 'px';
                setSetting('routes', 'lineWidth', parseInt(this.value));
            });
        }
        
        var lineOpacity = document.getElementById('setting-line-opacity');
        var lineOpacityValue = document.getElementById('line-opacity-value');
        if(lineOpacity) {
            lineOpacity.addEventListener('input', function() {
                if(lineOpacityValue) lineOpacityValue.textContent = this.value + '%';
                setSetting('routes', 'lineOpacity', parseInt(this.value));
            });
        }
        
        var glowEffect = document.getElementById('setting-glow-effect');
        if(glowEffect) {
            glowEffect.addEventListener('change', function() {
                setSetting('routes', 'glowEffect', this.checked);
            });
        }
        
        var snapRoads = document.getElementById('setting-snap-roads');
        if(snapRoads) {
            snapRoads.addEventListener('change', function() {
                setSetting('routes', 'snapToRoads', this.checked);
            });
        }
        
        var snapGrid = document.getElementById('setting-snap-grid');
        if(snapGrid) {
            snapGrid.addEventListener('change', function() {
                setSetting('routes', 'snapToGrid', this.checked);
            });
        }
        
        // UI settings
        var panelPosition = document.getElementById('setting-panel-position');
        if(panelPosition) {
            panelPosition.addEventListener('change', function() {
                setSetting('ui', 'panelPosition', this.value);
                applyPanelPosition(this.value);
            });
        }
        
        var panelWidth = document.getElementById('setting-panel-width');
        var panelWidthValue = document.getElementById('panel-width-value');
        if(panelWidth) {
            panelWidth.addEventListener('input', function() {
                if(panelWidthValue) panelWidthValue.textContent = this.value + 'px';
                setSetting('ui', 'panelWidth', parseInt(this.value));
            });
        }
        
        var autoCollapse = document.getElementById('setting-auto-collapse');
        if(autoCollapse) {
            autoCollapse.addEventListener('change', function() {
                setSetting('ui', 'autoCollapse', this.checked);
            });
        }
        
        // Data management buttons
        var exportBtn = document.getElementById('export-settings-btn');
        if(exportBtn) {
            exportBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                exportSettings();
            });
        }
        
        var importBtn = document.getElementById('import-settings-btn');
        if(importBtn) {
            importBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                importSettings();
            });
        }
        
        var resetBtn = document.getElementById('reset-settings-btn');
        if(resetBtn) {
            resetBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                resetSettings();
            });
        }
    }

    // Pin visibility and list functions
    function togglePinsVisibility() {
        // OLD SYSTEM - REMOVED
        // Waypoint visibility is managed in route planner
        pinsVisible = !pinsVisible;
    }

    function getMarkerSortKey(marker) {
        var iconPath = marker.options.iconPath || basePath + 'assets/img/markers/marker.png';
        var filename = iconPath.split('/').pop();
        var name = marker.options.name || '';
        var x = marker.options.x;
        var y = marker.options.y;
        var displayName = name || `poi (${x},${y})`;
        
        // Extract number from filename (marker1.png -> 1, marker.png -> 0)
        var numberMatch = filename.match(/^marker(\d+)\.png$/);
        var number = numberMatch ? parseInt(numberMatch[1]) : (filename === 'marker.png' ? 0 : 999);
        
        return {
            filename: filename,
            number: number,
            name: displayName.toLowerCase(),
            originalName: displayName
        };
    }

    function generatePinsList() {
        // OLD SYSTEM - REMOVED
        return '<div style="padding: 10px; color: #666;">Use Route Planner to manage waypoints</div>';
    }

    // OLD SYSTEM - REMOVED (pins now shown in route planner waypoints list)
    function updatePinsList() {
        // OLD SYSTEM - REMOVED
        // Pins are now shown as waypoints in the route planner
        return;
    }

    // Route creation functions
    function enableRouteMode(pinType) {
        routeMode = true;
        var status = document.getElementById('route-status');
        var selectPinABtn = document.getElementById('select-pin-a-btn');
        var selectPinBBtn = document.getElementById('select-pin-b-btn');
        
        if(pinType === 'A') {
            if(status) {
                status.textContent = 'Click on Pin A (or select from list)';
            }
            if(selectPinABtn) {
                selectPinABtn.style.backgroundColor = '#4CAF50';
                selectPinABtn.textContent = 'Selecting Pin A...';
            }
        } else if(pinType === 'B') {
            if(status) {
                status.textContent = 'Click on Pin B (or select from list)';
            }
            if(selectPinBBtn) {
                selectPinBBtn.style.backgroundColor = '#4CAF50';
                selectPinBBtn.textContent = 'Selecting Pin B...';
            }
        }
        
        updatePinsList(); // Refresh list to show route selection mode
    }

    function disableRouteMode() {
        routeMode = false;
        var selectPinABtn = document.getElementById('select-pin-a-btn');
        var selectPinBBtn = document.getElementById('select-pin-b-btn');
        
        if(selectPinABtn) {
            selectPinABtn.style.backgroundColor = '#FF1744';
            selectPinABtn.textContent = 'Select Pin A';
        }
        if(selectPinBBtn) {
            selectPinBBtn.style.backgroundColor = '#FF1744';
            selectPinBBtn.textContent = 'Select Pin B';
        }
        
        updatePinsList(); // Refresh list to remove route selection mode
    }

    function selectPinForRoute(marker, pinType) {
        if(!routeMode) return;
        
        var status = document.getElementById('route-status');
        var selectPinABtn = document.getElementById('select-pin-a-btn');
        var selectPinBBtn = document.getElementById('select-pin-b-btn');
        var name = marker.options.name || `poi (${marker.options.x},${marker.options.y})`;
        
        if(pinType === 'A' || (pinType === null && selectedPinA === null)) {
            selectedPinA = marker;
            if(status) {
                status.textContent = 'Pin A: ' + name;
            }
            if(selectPinABtn) {
                selectPinABtn.style.backgroundColor = '#4CAF50';
                selectPinABtn.textContent = 'Pin A: ' + name.substring(0, 15) + (name.length > 15 ? '...' : '');
            }
            disableRouteMode();
            updatePinsList();
        } else if(pinType === 'B' || (pinType === null && selectedPinB === null && marker !== selectedPinA)) {
            selectedPinB = marker;
            if(status) {
                var pinAName = selectedPinA.options.name || `poi (${selectedPinA.options.x},${selectedPinA.options.y})`;
                status.textContent = 'Pin A: ' + pinAName + ' | Pin B: ' + name + ' - Click Calculate';
            }
            if(selectPinBBtn) {
                selectPinBBtn.style.backgroundColor = '#4CAF50';
                selectPinBBtn.textContent = 'Pin B: ' + name.substring(0, 15) + (name.length > 15 ? '...' : '');
            }
            disableRouteMode();
            updatePinsList();
        }
    }

    function clearRoute() {
        if(routeLine) {
            routeLayer.removeLayer(routeLine);
            routeLine = null;
        }
        selectedPinA = null;
        selectedPinB = null;
        
        var clearBtn = document.getElementById('clear-route-btn');
        if(clearBtn) {
            clearBtn.style.display = 'none';
        }
        var status = document.getElementById('route-status');
        if(status) {
            status.textContent = '';
        }
        
        // Reset button states
        var selectPinABtn = document.getElementById('select-pin-a-btn');
        var selectPinBBtn = document.getElementById('select-pin-b-btn');
        if(selectPinABtn) {
            selectPinABtn.style.backgroundColor = '#FF1744';
            selectPinABtn.textContent = 'Select Pin A';
        }
        if(selectPinBBtn) {
            selectPinBBtn.style.backgroundColor = '#FF1744';
            selectPinBBtn.textContent = 'Select Pin B';
        }
        
        updatePinsList();
    }

    function getCellCoords(marker) {
        return {
            x: Math.floor(marker.options.x / 64),
            y: Math.floor(marker.options.y / 64)
        };
    }

    function cellToLatLng(cellX, cellY) {
        // Convert cell coordinates to the center of the tile
        var mod = gridSize / 2; // 32
        // Calculate tile bounds
        var startx = mod * cellX;
        var starty = (mod * cellY) - mod;
        var endx = startx + mod;
        var endy = starty + mod;
        // Return center of tile
        var centerX = startx + (mod / 2);
        var centerY = starty + (mod / 2);
        return xy(centerX, centerY);
    }

    function isWaterTile(cell) {
        if(!cell) return false;
        // Check if cell type is LAKE
        if(cell.type === 'LAKE') return true;
        // Check for water-related POI types
        if(cell.poiType) {
            var waterPOIs = ['POI_CHEMLAKE_MEDIUM', 'POI_LAKE_UNDERWATER_MEDIUM', 'POI_LAKE_RANDOM'];
            if(waterPOIs.indexOf(cell.poiType) !== -1) return true;
        }
        return false;
    }

    function findPathAvoidingWater(startX, startY, endX, endY) {
        // Simple pathfinding that avoids water (doesn't require roads)
        var openSet = [{x: startX, y: startY, g: 0, h: Math.abs(endX - startX) + Math.abs(endY - startY), f: 0, parent: null}];
        var closedSet = {};
        
        function getKey(x, y) {
            return x + ',' + y;
        }
        
        function heuristic(x1, y1, x2, y2) {
            return Math.abs(x2 - x1) + Math.abs(y2 - y1);
        }
        
        function getNeighbors(x, y) {
            var neighbors = [];
            var directions = [
                {dx: 0, dy: -1}, // North
                {dx: 0, dy: 1},  // South
                {dx: 1, dy: 0},  // East
                {dx: -1, dy: 0}  // West
            ];
            
            for(var i = 0; i < directions.length; i++) {
                var nx = x + directions[i].dx;
                var ny = y + directions[i].dy;
                var cell = cells[nx] && cells[nx][ny];
                
                // Skip water tiles
                if(!cell || isWaterTile(cell)) continue;
                
                neighbors.push({x: nx, y: ny});
            }
            
            return neighbors;
        }
        
        while(openSet.length > 0) {
            // Find node with lowest f score
            var currentIndex = 0;
            for(var i = 1; i < openSet.length; i++) {
                if(openSet[i].f < openSet[currentIndex].f) {
                    currentIndex = i;
                }
            }
            
            var current = openSet[currentIndex];
            
            // Check if we reached the goal
            if(current.x === endX && current.y === endY) {
                // Reconstruct path
                var path = [];
                var node = current;
                while(node) {
                    path.unshift({x: node.x, y: node.y});
                    node = node.parent;
                }
                return path;
            }
            
            // Move current from openSet to closedSet
            openSet.splice(currentIndex, 1);
            closedSet[getKey(current.x, current.y)] = true;
            
            // Check neighbors
            var neighbors = getNeighbors(current.x, current.y);
            for(var i = 0; i < neighbors.length; i++) {
                var neighbor = neighbors[i];
                var neighborKey = getKey(neighbor.x, neighbor.y);
                
                if(closedSet[neighborKey]) {
                    continue;
                }
                
                var tentativeG = current.g + 1;
                var h = heuristic(neighbor.x, neighbor.y, endX, endY);
                var f = tentativeG + h;
                
                // Check if this path to neighbor is better
                var inOpenSet = false;
                var openIndex = -1;
                for(var j = 0; j < openSet.length; j++) {
                    if(openSet[j].x === neighbor.x && openSet[j].y === neighbor.y) {
                        inOpenSet = true;
                        openIndex = j;
                        break;
                    }
                }
                
                if(!inOpenSet || tentativeG < openSet[openIndex].g) {
                    if(inOpenSet) {
                        openSet[openIndex].g = tentativeG;
                        openSet[openIndex].h = h;
                        openSet[openIndex].f = f;
                        openSet[openIndex].parent = current;
                    } else {
                        openSet.push({
                            x: neighbor.x,
                            y: neighbor.y,
                            g: tentativeG,
                            h: h,
                            f: f,
                            parent: current
                        });
                    }
                }
            }
        }
        
        // No path found
        return null;
    }

    function findNearestRoadTile(startX, startY, maxDistance) {
        maxDistance = maxDistance || 20; // Search up to 20 cells away
        var bestTile = null;
        var bestDistance = Infinity;
        
        // Search in expanding square, checking Manhattan distance
        for(var radius = 0; radius <= maxDistance; radius++) {
            for(var dx = -radius; dx <= radius; dx++) {
                for(var dy = -radius; dy <= radius; dy++) {
                    var manhattanDist = Math.abs(dx) + Math.abs(dy);
                    // Only check cells at current radius (Manhattan distance)
                    if(manhattanDist !== radius) {
                        continue;
                    }
                    
                    var x = startX + dx;
                    var y = startY + dy;
                    var cell = cells[x] && cells[x][y];
                    
                    // Skip water tiles
                    if(isWaterTile(cell)) continue;
                    
                    if(cell && cell.roads && cell.roads.length > 0) {
                        if(manhattanDist < bestDistance) {
                            bestDistance = manhattanDist;
                            bestTile = {x: x, y: y};
                        }
                    }
                }
            }
            
            // If we found a tile at this radius, return it immediately (closest one)
            if(bestTile && bestDistance === radius) {
                return bestTile;
            }
        }
        
        return bestTile;
    }

    function findRoadPath(startX, startY, endX, endY) {
        // Check if start or end cells are water - if so, can't path through them
        var startCell = cells[startX] && cells[startX][startY];
        var endCell = cells[endX] && cells[endX][endY];
        if(isWaterTile(startCell) || isWaterTile(endCell)) {
            return null;
        }
        
        // A* pathfinding algorithm
        var openSet = [{x: startX, y: startY, g: 0, h: Math.abs(endX - startX) + Math.abs(endY - startY), f: 0, parent: null}];
        var closedSet = {};
        var cameFrom = {};
        
        function getKey(x, y) {
            return x + ',' + y;
        }
        
        function heuristic(x1, y1, x2, y2) {
            return Math.abs(x2 - x1) + Math.abs(y2 - y1);
        }
        
        function getNeighbors(x, y) {
            var neighbors = [];
            var cell = cells[x] && cells[x][y];
            if(!cell || !cell.roads) return neighbors;
            
            // Skip if current cell is water
            if(isWaterTile(cell)) return neighbors;
            
            var roads = cell.roads;
            
            // Check North
            if(roads.indexOf('N') !== -1) {
                var nx = x;
                var ny = y - 1;
                var nCell = cells[nx] && cells[nx][ny];
                // Skip water tiles
                if(nCell && !isWaterTile(nCell) && nCell.roads && nCell.roads.indexOf('S') !== -1) {
                    neighbors.push({x: nx, y: ny});
                }
            }
            
            // Check South
            if(roads.indexOf('S') !== -1) {
                var nx = x;
                var ny = y + 1;
                var nCell = cells[nx] && cells[nx][ny];
                // Skip water tiles
                if(nCell && !isWaterTile(nCell) && nCell.roads && nCell.roads.indexOf('N') !== -1) {
                    neighbors.push({x: nx, y: ny});
                }
            }
            
            // Check East
            if(roads.indexOf('E') !== -1) {
                var nx = x + 1;
                var ny = y;
                var nCell = cells[nx] && cells[nx][ny];
                // Skip water tiles
                if(nCell && !isWaterTile(nCell) && nCell.roads && nCell.roads.indexOf('W') !== -1) {
                    neighbors.push({x: nx, y: ny});
                }
            }
            
            // Check West
            if(roads.indexOf('W') !== -1) {
                var nx = x - 1;
                var ny = y;
                var nCell = cells[nx] && cells[nx][ny];
                // Skip water tiles
                if(nCell && !isWaterTile(nCell) && nCell.roads && nCell.roads.indexOf('E') !== -1) {
                    neighbors.push({x: nx, y: ny});
                }
            }
            
            return neighbors;
        }
        
        while(openSet.length > 0) {
            // Find node with lowest f score
            var currentIndex = 0;
            for(var i = 1; i < openSet.length; i++) {
                if(openSet[i].f < openSet[currentIndex].f) {
                    currentIndex = i;
                }
            }
            
            var current = openSet[currentIndex];
            
            // Check if we reached the goal
            if(current.x === endX && current.y === endY) {
                // Reconstruct path
                var path = [];
                var node = current;
                while(node) {
                    path.unshift({x: node.x, y: node.y});
                    node = node.parent;
                }
                return path;
            }
            
            // Move current from openSet to closedSet
            openSet.splice(currentIndex, 1);
            closedSet[getKey(current.x, current.y)] = true;
            
            // Check neighbors
            var neighbors = getNeighbors(current.x, current.y);
            for(var i = 0; i < neighbors.length; i++) {
                var neighbor = neighbors[i];
                var neighborKey = getKey(neighbor.x, neighbor.y);
                
                if(closedSet[neighborKey]) {
                    continue;
                }
                
                var tentativeG = current.g + 1;
                var h = heuristic(neighbor.x, neighbor.y, endX, endY);
                var f = tentativeG + h;
                
                // Check if this path to neighbor is better
                var inOpenSet = false;
                var openIndex = -1;
                for(var j = 0; j < openSet.length; j++) {
                    if(openSet[j].x === neighbor.x && openSet[j].y === neighbor.y) {
                        inOpenSet = true;
                        openIndex = j;
                        break;
                    }
                }
                
                if(!inOpenSet || tentativeG < openSet[openIndex].g) {
                    if(inOpenSet) {
                        openSet[openIndex].g = tentativeG;
                        openSet[openIndex].h = h;
                        openSet[openIndex].f = f;
                        openSet[openIndex].parent = current;
                    } else {
                        openSet.push({
                            x: neighbor.x,
                            y: neighbor.y,
                            g: tentativeG,
                            h: h,
                            f: f,
                            parent: current
                        });
                    }
                }
            }
        }
        
        // No path found
        return null;
    }

    function drawRoute(pinA, pinB) {
        // Clear existing route line only (keep selected pins)
        if(routeLine) {
            routeLayer.removeLayer(routeLine);
            routeLine = null;
        }
        
        var coordsA = getCellCoords(pinA);
        var coordsB = getCellCoords(pinB);
        
        var path = [];
        var status = document.getElementById('route-status');
        var pathType = '';
        
        // Always find the shortest path avoiding water first
        var shortestPath = findPathAvoidingWater(coordsA.x, coordsA.y, coordsB.x, coordsB.y);
        
        // Also try road-based paths and compare lengths
        var roadPath = findRoadPath(coordsA.x, coordsA.y, coordsB.x, coordsB.y);
        var roadBasedPath = null;
        var roadBasedPathLength = Infinity;
        
        if(roadPath && roadPath.length > 0) {
            // Direct road path exists
            roadBasedPath = roadPath;
            roadBasedPathLength = roadPath.length;
        } else {
            // Try via nearest roads
            var roadA = findNearestRoadTile(coordsA.x, coordsA.y);
            var roadB = findNearestRoadTile(coordsB.x, coordsB.y);
            
            if(roadA && roadB) {
                var pathAtoRoadA = findPathAvoidingWater(coordsA.x, coordsA.y, roadA.x, roadA.y);
                var pathRoadAtoRoadB = findRoadPath(roadA.x, roadA.y, roadB.x, roadB.y);
                var pathRoadBtoB = findPathAvoidingWater(roadB.x, roadB.y, coordsB.x, coordsB.y);
                
                if(pathAtoRoadA && pathRoadAtoRoadB && pathRoadBtoB) {
                    // Build road-based path: A → roadA → roadB → B
                    roadBasedPath = [];
                    // Add path from A to road A (includes A and roadA)
                    for(var i = 0; i < pathAtoRoadA.length; i++) {
                        roadBasedPath.push(pathAtoRoadA[i]);
                    }
                    // Add road path (skip first point as it's roadA, already added)
                    for(var i = 1; i < pathRoadAtoRoadB.length; i++) {
                        roadBasedPath.push(pathRoadAtoRoadB[i]);
                    }
                    // Add path from road B to B (skip first point as it's roadB, already added)
                    for(var i = 1; i < pathRoadBtoB.length; i++) {
                        roadBasedPath.push(pathRoadBtoB[i]);
                    }
                    roadBasedPathLength = roadBasedPath.length;
                }
            }
        }
        
        // Choose the shortest path
        if(shortestPath && shortestPath.length > 0) {
            if(roadBasedPath && roadBasedPathLength < shortestPath.length) {
                // Road-based path is shorter
                path = roadBasedPath;
                pathType = 'Road Route';
            } else {
                // Direct path is shorter
                path = shortestPath;
                pathType = 'Shortest Route';
            }
        } else if(roadBasedPath && roadBasedPathLength < Infinity) {
            // Only road-based path available
            path = roadBasedPath;
            pathType = 'Road Route';
        } else {
            // No path found, draw straight line
            path.push({x: coordsA.x, y: coordsA.y});
            path.push({x: coordsB.x, y: coordsB.y});
            pathType = 'Direct Line (may cross water)';
        }
        
        if(path.length === 0) {
            if(status) {
                status.textContent = 'No valid path found';
            }
            return;
        }
        
        // Convert path to lat/lng coordinates (all points go through tile centers)
        var latLngs = [];
        for(var i = 0; i < path.length; i++) {
            // Each point in the path is already a cell center
            var latLng = cellToLatLng(path[i].x, path[i].y);
            latLngs.push(latLng);
        }
        
        // Ensure start and end points are exactly at tile centers
        // Start point: center of starting tile
        if(latLngs.length > 0) {
            var startCell = {x: coordsA.x, y: coordsA.y};
            latLngs[0] = cellToLatLng(startCell.x, startCell.y);
        }
        // End point: center of ending tile
        if(latLngs.length > 1) {
            var endCell = {x: coordsB.x, y: coordsB.y};
            latLngs[latLngs.length - 1] = cellToLatLng(endCell.x, endCell.y);
        }
        
        // Create polyline with neon red styling on top layer
        // Get route settings
        var routeColor = getSetting('routes', 'defaultColor') || '#FF1744';
        var routeWidth = getSetting('routes', 'lineWidth') || 3;
        var routeOpacity = (getSetting('routes', 'lineOpacity') || 100) / 100;
        var glowEffect = getSetting('routes', 'glowEffect') !== false; // default true
        
        routeLine = L.polyline(latLngs, {
            color: routeColor,
            weight: routeWidth,
            opacity: routeOpacity,
            className: 'route-line'
        });
        
        // Add to route layer and bring to front
        routeLayer.addLayer(routeLine);
        routeLine.bringToFront();
        
        // Apply glow effect if enabled
        if(glowEffect && routeLayer && routeLayer._container) {
            setTimeout(function() {
                var pathElements = routeLayer._container.querySelectorAll('path');
                pathElements.forEach(function(path) {
                    path.style.filter = 'drop-shadow(0 0 3px ' + routeColor + ') drop-shadow(0 0 6px ' + routeColor + ')';
                });
            }, 100);
        }
        
        // Show clear button
        var clearBtn = document.getElementById('clear-route-btn');
        if(clearBtn) {
            clearBtn.style.display = 'block';
        }
        
        // Update status
        if(status) {
            var nameA = pinA.options.name || `poi (${pinA.options.x},${pinA.options.y})`;
            var nameB = pinB.options.name || `poi (${pinB.options.x},${pinB.options.y})`;
            if(!pathType) pathType = 'Route';
            status.textContent = pathType + ': ' + nameA + ' → ' + nameB + ' (' + path.length + ' cells)';
        }
    }

    let loadCells = function(json) {
        celljson = json;
        celldata = SMCellParser.parse(json)

        // var lakeTypes = {}
        var poiCoords = [];
        // var cells = {};
        var stats = "";
        var typeCounts = [];
        var poiCounts = [];
        celldata.forEach((cell) => {
            if(cells[cell.x] == undefined) {
                cells[cell.x] = {};
            }
            cells[cell.x][cell.y] = cell;
            if(cell.poiType) {
                poiCoords.push([cell.x,cell.y]);
            }
            if(typeCounts[cell.type] == undefined) {
                typeCounts[cell.type] = 0;
            }
            typeCounts[cell.type] += 1;
            // if(cell.type == 'LAKE') {
            //     var id = cell.tileid;
            //     if(lakeTypes[id] == undefined) {
            //         lakeTypes[id] = 1;
            //     } else {
            //         lakeTypes[id] = lakeTypes[id] + 1;
            //     }
            // }
        })
        
        stats += `<br/><br/>`
        stats += `Map Seed: ${celldata[0].seed}<br/>`
        stats += `<div class="stat-title">Cell Types:</div><table>`

        var sortedKeys = Object.keys(typeCounts).sort(function(a,b) {
            return ( typeCounts[a] > typeCounts[b] ) ? -1 : 1;
        })
        sortedKeys.forEach((t) => {
            var name = t;
            if(name == "NONE") {name = "NONE (Road/Cliff)"}
            stats += `<tr><td><input type="checkbox" class="tile-highlight-cb" data-type="${t}"></td><td>${name}:</td><td>${typeCounts[t]} (${Math.floor((typeCounts[t] / celldata.length) * 100)}%)</td></tr>`
        })
        stats += "</table>"
        // console.log(JSON.stringify(lakeTypes))

        var poisSum = 0;
        poiCoords.forEach((coord) => {
            let x=coord[0],y=coord[1];
            let cell = cells[x][y];
            if(cell.poiType && cell.foundPoi == undefined) {
                if(poiCounts[cell.poiType] == undefined) {
                    poiCounts[cell.poiType] = 0;
                }
                // if(cell.poiType != "POI_CRASHSITE_AREA") {
                    poiCounts[cell.poiType] += 1;
                    poisSum += 1;
                // }

                let size = POI_SIZES[cell.poiType]
                if(size != undefined) {
                    // console.log(`found ${cell.poiType} at ${x},${y} with size ${size} with tile id ${cell.tileid}`)
                    let mod = (gridSize / 2)
                    let startx =  mod * x;
                    let starty = ( mod * y ) - mod;
                    let endx = startx + ((size) * mod)
                    let endy = starty + ((size) * mod)
                    let poiUrl = getPoiUrl(cell.poiType,cell.tileid,x,y);
                    if(!poiUrl) {
                        if(cell.type != "LAKE" && cell.poiType != "POI_CRASHSITE_AREA") {
                            console.log(`Missing POI Image at ${x},${y} for id ${cell.tileid} ${cell.poiType}`)
                        }
                    }
                    if(poiUrl != undefined) {
                        let rotation=0;
                        switch(cell.rotation) {
                            case 0:
                                rotation=0;
                            break;
                            case 1:
                                rotation=270;
                                // startx += mod * size
                                starty -= mod * size
                                // endx += mod * size
                                endy -= mod * size
                            break;
                            case 2:
                                rotation=180;
                                startx += mod * size
                                starty -= mod * size
                                endx += mod * size
                                endy -= mod * size
                            break;
                            case 3:
                                rotation=90;
                                startx += mod * size
                                // starty += mod * size
                                endx += mod * size
                                // endy += mod * size
                            break;
                        }
                        let poiBounds = [xy(startx, starty), xy(endx, endy)];
                        L.rotateImageLayer(poiUrl, poiBounds, {/*opacity: 0.85,*/ pane:'poiPane',rotation:rotation}).addTo(map).bringToFront();
                    }
                    //Mark all cells for this POI so we dont process them further
                    for(var ix=0;ix<size;ix++) {
                        for(var iy=0;iy<size;iy++) {
                            let poicell = cells[x+ix][y+iy]
                            if(x+ix == -36 && y+iy == -39) {
                                //exception for overlapping cells in starting area
                            } else {
                                poicell.foundPoi = true;
                                if(poiUrl != undefined) {
                                    poicell.poiurlfound = true;
                                }
                            }
                        }
                    }
                }
            }
        })

        var sortedKeys = Object.keys(poiCounts).sort(function(a,b) {
            return ( poiCounts[a] > poiCounts[b] ) ? -1 : 1;
        })

        stats += `<div class="stat-title">POI Types: </div><table>`
        sortedKeys.forEach((t) => {
            stats += `<tr><td>${t}:</td><td>${poiCounts[t]} (${Math.floor((poiCounts[t] / poisSum) * 100)}%)</td></tr>`
        })
        stats += "</table><br/><br/>"

        document.getElementById("stats-content").innerHTML = stats;
        
        // Pins section removed - use Route Planner instead
        
        // Setup pins visibility toggle button
        var togglePinsVisibilityBtn = document.getElementById('toggle-pins-visibility-btn');
        if(togglePinsVisibilityBtn) {
            togglePinsVisibilityBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                togglePinsVisibility();
            });
        }
        
        // Setup open popup checkbox
        var openPopupCb = document.getElementById('open-popup-cb');
        if(openPopupCb) {
            openPopupCb.checked = openPopupOnClick;
            openPopupCb.addEventListener('change', function(e) {
                e.stopPropagation();
                openPopupOnClick = this.checked;
                try {
                    localStorage.setItem('sm_openPopupOnClick', openPopupOnClick.toString());
                } catch(e) {
                    console.warn('Failed to save popup behavior:', e);
                }
            });
        }
        
        // Initialize pins list
        updatePinsList();
        
        // Setup pin waypoint handlers when pins are updated
        setupPinWaypointHandlers();
        
        // Setup route selection buttons
        var selectPinABtn = document.getElementById('select-pin-a-btn');
        if(selectPinABtn) {
            selectPinABtn.addEventListener('click', function(e) {
                e.stopPropagation();
                enableRouteMode('A');
            });
        }
        
        var selectPinBBtn = document.getElementById('select-pin-b-btn');
        if(selectPinBBtn) {
            selectPinBBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                enableRouteMode('B');
            });
        }
        
        // Setup calculate route button
        var calculateRouteBtn = document.getElementById('calculate-route-btn');
        if(calculateRouteBtn) {
            calculateRouteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                if(selectedPinA && selectedPinB) {
                    drawRoute(selectedPinA, selectedPinB);
                } else {
                    var status = document.getElementById('route-status');
                    if(status) {
                        status.textContent = 'Please select both Pin A and Pin B first';
                    }
                }
            });
        }
        
        // Setup clear route button
        var clearRouteBtn = document.getElementById('clear-route-btn');
        if(clearRouteBtn) {
            clearRouteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                clearRoute();
            });
        }
        
        // Initialize route layer with high z-index
        routeLayer = L.layerGroup().addTo(map);
        
        // Initialize route planner
        initializeRoutePlanner();
        
        // Add event listeners to tile highlight checkboxes
        var checkboxes = document.querySelectorAll('.tile-highlight-cb');
        checkboxes.forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                var tileType = this.getAttribute('data-type');
                highlightTilesOfType(tileType, this.checked);
            });
        });
        
        // Setup settings panel
        initializeSettingsPanel();
        
        // Apply initial UI settings
        applyInitialUISettings();
        
        // Setup settings cog button (top right) - opens modal
        var settingsCogBtn = document.getElementById("settings-btn-top");
        if(settingsCogBtn) {
            settingsCogBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                openSettingsModal();
            });
        }
        
        // Setup settings modal close button
        var settingsCloseBtn = document.getElementById("close-settings");
        if(settingsCloseBtn) {
            settingsCloseBtn.addEventListener('click', function(event) {
                event.preventDefault();
                event.stopPropagation();
                closeSettingsModal();
            });
        }
        
        // Close modal when clicking overlay
        var settingsOverlay = document.getElementById("settings-overlay");
        if(settingsOverlay) {
            settingsOverlay.addEventListener('click', function(event) {
                if(event.target === settingsOverlay) {
                    closeSettingsModal();
                }
            });
        }
        
        // Functions to open/close settings modal
        function openSettingsModal() {
            var overlay = document.getElementById("settings-overlay");
            var cogBtn = document.getElementById("settings-btn-top");
            if(overlay) {
                overlay.classList.remove("collapsed");
                if(cogBtn) cogBtn.classList.add("active");
                
                // Ensure content sections are visible
                var settingsContent = document.getElementById("settings-content");
                var statsContent = document.getElementById("stats-content");
                if(settingsContent) settingsContent.classList.remove("collapsed");
                if(statsContent) statsContent.classList.remove("collapsed");
            }
        }
        
        function closeSettingsModal() {
            var overlay = document.getElementById("settings-overlay");
            var cogBtn = document.getElementById("settings-btn-top");
            if(overlay) {
                overlay.classList.add("collapsed");
                if(cogBtn) cogBtn.classList.remove("active");
            }
        }
        
        L.GridLayer.DebugCoords = L.GridLayer.extend({
            createTile: function (coords) {
                var x = coords.x;
                var y = coords.y;
                var tile = document.createElement('div');
                tile.classList.add("cell")
                var inner = document.createElement('div');
                inner.classList.add("innercell")
                tile.appendChild(inner);

                var div = document.createElement('div');
                inner.appendChild(div)
                try {
                    var cell = cells[x][y * -1];
                    tile.classList.add(cell.type.toLowerCase())
                    if(cell.poiType && cell.type == 'LAKE') {
                        div.innerHTML += "<br/><span class='poilabel'>"+cell.poiType+"</span>"
                    }

                    var turl = getTileURL(cell.tileid,cell.x,cell.y);
                    if(!turl) {
                        if(cell.type != "LAKE" && POI_SIZES[cell.poiType] == undefined) {
                            // Only log missing tiles in development
                            // console.log(`Missing tile at ${x},${y*-1} for id ${cell.tileid} ${cell.type}`)
                        }
                        if(cell.poiurlfound == true) {
                            tile.classList.remove(cell.type.toLowerCase())
                        }
                    }
                    if(turl) {
                        tile.classList.remove(cell.type.toLowerCase())
                        var img = document.createElement('img');
                        img.src = turl
                        img.classList.add('tileimg')
                        inner.appendChild(img);
                        if(cell.rotation != 0) {
                            img.classList.add('rot-' + cell.rotation)
                        }
                    } else
                    if(cell.roads && cell.roads.length > 0) {
                        var split = cell.roads.split('');
                        split.forEach((dir) => {
                            var road = document.createElement('div');
                            road.classList.add("road-"+dir)
                            inner.appendChild(road)
                            var roadlines = document.createElement('div');
                            roadlines.classList.add("roadline");
                            road.appendChild(roadlines);
                        })
                        tile.classList.remove("none");
                        tile.classList.add("meadow")
                    }
                } catch(error) {
                    // Silently handle errors - cell might not exist yet
                }
                return tile;
            }
        });

        L.gridLayer.debugCoords = function(opts) {
            return new L.GridLayer.DebugCoords(opts);
        };

        var myGridLayer = L.gridLayer.debugCoords({
            noWrap: true,
            maxNativeZoom: 1,
            minNativeZoom: 1,
            tileSize: gridSize,
            // opacity: 0.75,
            keepBuffer: 0,
            updateWhenIdle: true,
            updateWhenZooming: false,
            // bounds: [[-72,-55],[-71,55]],
            className: "gridLayer"
        })
        map.addLayer( myGridLayer);

        // L.control.layers({"Grid": myGridLayer}, {"Img":tileLayer}).addTo(map);
    };

    let init = function(inputjson) {
        // create the map
        map = L.map("map", {
            crs: L.CRS.Simple,
            minZoom: minZoom,
            maxZoom: maxZoom,
            zoomSnap: 0.5,
            zoomDelta: 0.5,
            wheelPxPerZoomLevel: 120
        })
        map.attributionControl.addAttribution("<a target='_new' href='https://github.com/the1killer/sm_overview'>sm_overview By The1Killer</a>")

        map.createPane('poiPane').style.zIndex = 300;
        
        // Set initial view first (required before Hash initialization)
        // Use settings if available, otherwise defaults
        var initialZoom = getSetting('map', 'defaultZoom') || 2.5;
        var defaultCenterX = getSetting('map', 'defaultCenterX') || -848;
        var defaultCenterY = getSetting('map', 'defaultCenterY') || -858;
        map.setView([defaultCenterX, defaultCenterY], initialZoom);
        
        // Create highlight layer group after view is set
        highlightLayerGroup = L.layerGroup().addTo(map);

        try {
            var hash = new L.Hash(map);
            // Hash will handle view from URL if present, otherwise keep the initial view
        } catch (error) {
            // If Hash fails, keep the initial view we set
        }

        if(inputjson) {
            loadCells(JSON.parse(inputjson));
        } else {
        loadFile(basePath + "assets/json/cells.json",loadCells);
        }
        
        // Load settings first
        loadSettings();
        
        // Discover marker icons (for route planner waypoints)
        discoverMarkerIcons();
        // Load saved routes
        loadRoutes();

        map.on('click', function(e) {
            // Check if in route planning waypoint mode first
            if(routePlanningMode && routePlanningMode === 'waypoint') {
                // Allow waypoint adding from map click
                addWaypointFromMapClick(e.latlng);
                disableWaypointMode();
                // Reopen overlay
                var overlay = document.getElementById('route-planner-overlay');
                if(overlay) {
                    overlay.classList.remove('collapsed');
                }
                // Show brief feedback
                var status = document.getElementById('route-status-modal');
                if(status) {
                    status.textContent = '✓ Waypoint added! Click "Add Waypoint" again to add more.';
                    status.className = 'route-status success';
                    setTimeout(function() {
                        if(status.textContent.indexOf('Waypoint added') !== -1) {
                            status.textContent = '';
                            status.className = '';
                        }
                    }, 3000);
                }
                updateWaypointsList();
                return;
            }
            
            // Check if add pin from map mode is enabled (from route planner)
            if(addPinFromMapMode) {
                // Don't handle clicks on markers or popups
                if(e.originalEvent && (e.originalEvent.target.closest('.leaflet-marker-icon') || e.originalEvent.target.closest('.leaflet-popup'))) {
                    return;
                }
                
                // Add waypoint directly from map click
                addWaypointFromMapClick(e.latlng);
                
                // Show feedback
                var status = document.getElementById('route-status-modal');
                if(status) {
                    status.textContent = '✓ Waypoint added! Click on map to add more.';
                    status.className = 'route-status success';
                    setTimeout(function() {
                        if(status.textContent.indexOf('Waypoint added') !== -1) {
                            status.textContent = '';
                            status.className = '';
                        }
                    }, 2000);
                }
                updateWaypointsList();
                return;
            }
            
            // Only handle clicks directly on the map tiles/background, not on any UI elements
            if(e.originalEvent) {
                var target = e.originalEvent.target;
                
                // Don't handle clicks on any UI elements - be very explicit
                if(target.closest('.leaflet-popup') || 
                   target.closest('.leaflet-marker-icon') ||
                   target.closest('.leaflet-control') ||
                   target.closest('#stats') ||
                   target.closest('#stats-content') ||
                   target.closest('#route-planner-overlay') ||
                   target.closest('button') ||
                   target.closest('input') ||
                   target.closest('label') ||
                   target.closest('table') ||
                   target.closest('div[id^="stats"]') ||
                   target.closest('.icon-selector-overlay') ||
                   target.closest('.icon-selector-modal') ||
                   target.tagName === 'BUTTON' ||
                   target.tagName === 'INPUT' ||
                   target.tagName === 'LABEL' ||
                   target.tagName === 'TABLE' ||
                   target.tagName === 'TD' ||
                   target.tagName === 'TR' ||
                   target.tagName === 'TH') {
                    return;
                }
                
                // Only allow clicks on map tiles/cells or map container background
                var isMapTile = target.classList.contains('cell') || 
                               target.closest('.cell') ||
                               target.closest('.leaflet-tile-container') ||
                               target.closest('.gridLayer') ||
                               (target === map.getContainer());
                
                if(!isMapTile) {
                    return;
                }
            }
            
            let xscalar = 2;
            let yscalar = 2;
            let x = Math.floor(e.latlng.lng * xscalar);
            let y = Math.floor(e.latlng.lat * yscalar) + 64;
            
            console.log("lnglat:     ", Math.floor(e.latlng.lng),Math.floor(e.latlng.lat));
            console.log("scaled ll:  ", x,y);
            
            // Remove existing clickmarker if present
            if(clickmarker) {
                clickmarker.remove();
                clickmarker = null;
            }
            
            // Always create click marker (old pinning system removed)
            clickmarker = L.marker([e.latlng.lat, e.latlng.lng], {icon: markerIcon, x: x, y: y}).addTo(map);
            clickmarker.bindPopup(contentForMarker(x, y, false, null, ''), {
                autoClose: false,
                closeOnClick: false
            });
            
            // Setup waypoint button handler when popup opens
            clickmarker.on('popupopen', function() {
                var popup = clickmarker.getPopup();
                if(popup && popup._contentNode) {
                    var waypointBtn = popup._contentNode.querySelector('button[data-x="' + x + '"][data-y="' + y + '"]');
                    if(waypointBtn) {
                        // Remove any existing listeners by cloning
                        var newBtn = waypointBtn.cloneNode(true);
                        waypointBtn.parentNode.replaceChild(newBtn, waypointBtn);
                        newBtn.addEventListener('click', function(e) {
                            e.stopPropagation();
                            e.preventDefault();
                            // Add as waypoint to route planner
                            var markerLat = clickmarker.getLatLng().lat;
                            var markerLng = clickmarker.getLatLng().lng;
                            var markerX = x;
                            var markerY = y;
                            
                            // Add waypoint directly (don't open route planner window)
                            addWaypoint(markerX, markerY, markerLat, markerLng, '');
                            
                            // Update waypoints list (even if route planner is closed)
                            updateWaypointsList();
                            
                            // Close popup
                            clickmarker.closePopup();
                            
                            // Show brief feedback in route planner if open, otherwise use console
                            var status = document.getElementById('route-status-modal');
                            if(status) {
                                status.textContent = '✓ Waypoint added to route planner!';
                                status.className = 'route-status success';
                                setTimeout(function() {
                                    if(status.textContent.indexOf('Waypoint added') !== -1) {
                                        status.textContent = '';
                                        status.className = '';
                                    }
                                }, 2000);
                            } else {
                                console.log('Waypoint added to route planner at (' + markerX + ', ' + markerY + ')');
                            }
                        });
                    }
                }
            });
            
            clickmarker.openPopup();
        });
    }

    function contentForMarker(x,y, isPinned, iconPath, name) {
        name = name || '';
        let cellX = Math.floor( x / 64)
        let cellY = Math.floor( y / 64)
        let cell = cells[cellX][cellY];
        var ctype = cell.type
        if(ctype == "NONE") {
            ctype = "NONE (Road/Cliff)"
        }
        let poi = cell.poiType;
        var content = `Coords: ${x},${y}<br/>
        Cell: ${cellX},${cellY}<br/>
        Type: ${ctype}<br/>
        TileID: ${cell.tileid}<br/>
        Rotation: ${cell.rotation}`
        if(poi) {
            content += `<br/>POI: ${poi}`
        }
        
        // Add waypoint button instead of pin checkbox
        var markerId = 'waypoint-' + x + '-' + y;
        content += `<br/><br/><button id="${markerId}" class="fancy-btn primary" data-x="${x}" data-y="${y}" style="width: 100%; margin-top: 5px;">Add to Route Planner</button>`

        return content;
    }
    
    // Show icon selector UI
    function showIconSelector(marker, x, y) {
        // Create modal/overlay
        var overlay = document.createElement('div');
        overlay.className = 'icon-selector-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.5); z-index: 10000; display: flex; align-items: center; justify-content: center;';
        
        var modal = document.createElement('div');
        modal.className = 'icon-selector-modal';
        modal.style.cssText = 'background: white; padding: 20px; border-radius: 8px; max-width: 500px; max-height: 80vh; overflow-y: auto;';
        
        var title = document.createElement('h3');
        title.textContent = 'Select Marker Icon';
        title.style.cssText = 'margin-top: 0;';
        modal.appendChild(title);
        
        var iconGrid = document.createElement('div');
        iconGrid.className = 'icon-selector-grid';
        
        // Add discovered icons (always include default markers)
        var defaultMarker = basePath + 'assets/img/markers/marker.png';
        var iconsToShow = availableMarkerIcons.length > 0 ? availableMarkerIcons : [defaultMarker];
        // Ensure default marker from markers folder is included
        if(iconsToShow.indexOf(defaultMarker) === -1) {
            iconsToShow.push(defaultMarker);
        }
        
        // Sort icons alphabetically: marker.png first, then marker1.png, marker2.png, etc.
        iconsToShow.sort(function(a, b) {
            // Extract filename from path
            var aFile = a.split('/').pop();
            var bFile = b.split('/').pop();
            
            // marker.png always comes first
            if(aFile === 'marker.png') return -1;
            if(bFile === 'marker.png') return 1;
            
            // Extract numbers from markerX.png pattern
            var aMatch = aFile.match(/^marker(\d+)\.png$/);
            var bMatch = bFile.match(/^marker(\d+)\.png$/);
            
            // If both are numbered markers, sort by number
            if(aMatch && bMatch) {
                return parseInt(aMatch[1]) - parseInt(bMatch[1]);
            }
            
            // If only one is numbered, numbered comes after marker.png but before others
            if(aMatch) return -1;
            if(bMatch) return 1;
            
            // Otherwise, sort alphabetically
            return aFile.localeCompare(bFile);
        });
        
        iconsToShow.forEach(function(iconPath) {
            var iconItem = document.createElement('div');
            iconItem.className = 'icon-selector-item';
            
            var iconImg = document.createElement('img');
            iconImg.src = iconPath;
            iconImg.onerror = function() { 
                // Hide item if image fails to load
                iconItem.style.display = 'none'; 
            };
            
            var iconLabel = document.createElement('div');
            iconLabel.className = 'icon-selector-item-label';
            var pathParts = iconPath.split('/');
            iconLabel.textContent = pathParts[pathParts.length - 1];
            
            iconItem.appendChild(iconImg);
            iconItem.appendChild(iconLabel);
            
            iconItem.onclick = function() {
                // Update marker icon
                var newIcon = createMarkerIcon(iconPath);
                marker.setIcon(newIcon);
                marker.options.iconPath = iconPath;
                
                // Update popup content
                marker.bindPopup(contentForMarker(x, y, true, iconPath, marker.options.name || ''), {
                    autoClose: false,
                    closeOnClick: false
                });
                marker.openPopup();
                
                // Save
                savePinnedMarkers();
                
                // Always update pins list when icon changes
                updatePinsList();
                
                // Close modal
                document.body.removeChild(overlay);
            };
            
            iconGrid.appendChild(iconItem);
        });
        
        modal.appendChild(iconGrid);
        
        // Add close button
        var closeBtn = document.createElement('button');
        closeBtn.textContent = 'Close';
        closeBtn.style.cssText = 'padding: 8px 16px; cursor: pointer; background: #60A5FA; color: white; border: none; border-radius: 4px;';
        closeBtn.onclick = function() {
            document.body.removeChild(overlay);
        };
        modal.appendChild(closeBtn);
        
        overlay.appendChild(modal);
        overlay.onclick = function(e) {
            if(e.target === overlay) {
                document.body.removeChild(overlay);
            }
        };
        
        document.body.appendChild(overlay);
    }

    // // .toRad() fix
    // // from: http://stackoverflow.com/q/5260423/1418878
    // if (typeof(Number.prototype.toRad) === "undefined") {
    //     Number.prototype.toRad = function() {
    //         return this * Math.PI / 180;
    //     }
    // }

    // function getTileURL(lat, lon, zoom) {
    //     var xtile = parseInt(Math.floor( (lon + 180) / 360 * (1<<zoom) ));
    //     var ytile = parseInt(Math.floor( (1 - Math.log(Math.tan(lat.toRad()) + 1 / Math.cos(lat.toRad())) / Math.PI) / 2 * (1<<zoom) ));
    //     return "" + zoom + "/" + xtile + "/" + ytile;
    // }
    function getPoiUrl(poiType,tileid,x,y) {
        switch(poiType) {
            case 'POI_MECHANICSTATION_MEDIUM':
                return basePath + 'assets/img/mechanic_station.png'
            break;
            case 'POI_HIDEOUT_XL':
                return basePath + 'assets/img/hideout.png'
            break;
            case 'POI_CAMP_LARGE':
                return basePath + 'assets/img/camp_large.jpg'
            break;
            case 'POI_WAREHOUSE4_LARGE':
                return basePath + 'assets/img/warehouse4.png'
            break;
            case 'POI_WAREHOUSE3_LARGE':
                return basePath + 'assets/img/warehouse3_large.png'
            break;
            case 'POI_WAREHOUSE2_LARGE':
                return basePath + 'assets/img/warehouse2.jpg'
            break;
            case 'POI_SILODISTRICT_XL':
                return basePath + 'assets/img/silodistrict.jpg'
            break;
            case 'POI_RUINCITY_XL':
                return basePath + 'assets/img/scrapcity.jpg'
            break;
            case 'POI_PACKINGSTATIONVEG_MEDIUM':
                return basePath + 'assets/img/packing_veg.jpg'
            break;
            case 'POI_PACKINGSTATIONFRUIT_MEDIUM':
                return basePath + 'assets/img/packing_fruit.jpg'
            break;
            case 'POI_CHEMLAKE_MEDIUM':
                if(tileid == 12103) {
                    return basePath + 'assets/img/chemlake_medium_3.jpg'
                } else if(tileid == 12102) {
                    return basePath + 'assets/img/chemlake_medium_2.jpg'
                }
                return basePath + 'assets/img/chemlake_medium_1.jpg'
            break;
            case 'POI_RUIN_MEDIUM':
                if(tileid == 12003) {
                    return basePath + 'assets/img/ruin_medium_3.jpg'
                }
                return basePath + 'assets/img/ruin_medium_4.jpg'
            break;
            case 'POI_FOREST_RUIN_MEDIUM':
                if(tileid == 20402) {
                    return basePath + 'assets/img/forest_ruin_medium_2.jpg'
                }
                return basePath + 'assets/img/forest_ruin_medium_1.jpg'
            break;
            case 'POI_LAKE_UNDERWATER_MEDIUM':
                if(tileid == 80203) {
                    return basePath + 'assets/img/underwater_med_3.jpg'
                } else 
                if(tileid == 80204 || tileid == 80202 || tileid == 80212) {
                    return basePath + 'assets/img/underwater_med_4.jpg'
                }
            break;
            case 'POI_CRASHSITE_AREA':
                if(tileid == 10103) {
                    return basePath + 'assets/img/start_crashsite3.jpg'
                } else if(tileid == 10102) {
                    return basePath + 'assets/img/start_crashsite2.jpg'
                } else if (tileid == 10101 && x == -38 && y == -42) {
                    return basePath + 'assets/img/start_crashsite1.jpg'
                }
            break;
            case 'POI_CAPSULESCRAPYARD_MEDIUM':
                    return basePath + 'assets/img/capsule_scrapyard.jpg'
            break;
            case 'POI_BURNTFOREST_FARMBOTSCRAPYARD_LARGE':
                    return basePath + 'assets/img/burntforest_farmbot_scrapyard.jpg'
            break;
            case 'POI_CRASHEDSHIP_LARGE':
                    return basePath + 'assets/img/crashed_ship.jpg'
            break;
            case 'POI_LABYRINTH_MEDIUM':
                    return basePath + 'assets/img/labyrinth.jpg'
            break;
            case 'POI_BUILDAREA_MEDIUM':
                    return basePath + 'assets/img/buildarea.jpg'
            break;
            case 'POI_LAKE_RANDOM':
                if(tileid == 80102) {
                    return basePath + 'assets/img/lake_generic.jpg'
                }
            
                return basePath + 'assets/img/lake_generic.jpg'
            break;
        }
    }
    function getTileURL(tileid,x,y) {
        var tiles = [
            10105,10106,10107,10108,
            11501,11502,11503,11504,11505,11506,11507,
            11601,
            11701,11702,11703,11704,
            11801,11802,11803,11804,11805,11806,11807,11808,11809,
            11901,11902,11903,
            20101,20102,20103,20104,20105,20106,20107,
            20301,20302,20303,20304,20305,20306,20307,
            30101,30102,
            40101,40201,40202,40203,
            50201,
            50301,
            50402,
            60101,60102,60103,
            60201,
            60301,60302,60303,60304,
            80103,
            1000001,1000002,1000003,1000004,1000005,1000006,1000007,1000008,1000009,1000010,1000011,1000012,1000013,1000014,1000015,1000016,1000017,1000018,1000019,1000020,1000021,1000022,1000023,1000024,1000025,1000026,1000027,1000028,1000029,
            1000101,1000102,1000103,1000105,1000106,1000107,1000104,1000201,1000202,1000301,
            1000501,1000502,1000503,1000504,1000505,1000506,1000507,1000508,1000509,
            1000601,1000602,
            1000701,
            1000901,1000902,
            1001001,1001002,1001101,1001301,1001401,1001501,1001701,1001702,1002101,1002102,1002103,1002201,1002301,1002501,1002502,1002503,1002601,1002602,1002701,1002901,
            1003001,1003101,1003501,1003701,1004701,1005301,1005501,1005701,1005801,1005901,1006101,1006201,1006301,
            1004101,1004102,1004201,1004301,
            1025601,1128402,
            1076801,1076802,1076803,1076804,1076805,1076806,1076807,1076808,1076809,1076810,1076811,1076812,1076813,1076814,
            1076901,
            1077201,1077301,1078401,1078801,1078901,
            1083201,1083701,1084801,1084901,
            1128001,1128002,1128003,1128004,1128005,1128006,1128007,1128008,1128009,1128010,1128011,1128012,1128013,1128014,1128015,1128016,1128501,
            1128101,1128401,1130001,1130101,1134901,1179201,1083301,
            1384001,1384002,
            2000101,2000102,2000103,2000104,2000105,2000301,2000302,2000303,2000304,2000305,2000501,2000701,2001501,2001502,2001503,
            3000101,3000301,3000302,3000701,3000501,3001501,3001502,3001503,3001504,3001505,3001506,
            4000101,4000301,4000501,4000701,4001501,4001502,4001503,4001504,4001505,4001506,4001507,
            5000101,5000102,5000103,5000301,5000302,5000303,5000501,5000701,5000702,5000703,5001501,5001502,
            6000101,6000102,6000103,6000104,6000105,
            6000301,6000302,6000303,6000304,6000305,
            6000501,
            6000701,
            6001501,6001502,
            8000101,8000102,8000103,8000104,8000105,8000106,8000107,8000108,8000109,8000110,8000111,
            8000301,8000302,8000303,8000304,8000305,8000306,8000307,8000308,8000309,8000310,8000311,8000312,8000313,8000314,
            8000501,
            8000701,8000702,8000703,8000704,8000705,8000706
        ];
        if(tiles.includes(tileid)) {
            return basePath + `assets/img/tiles/${tileid}.jpg`
        }
        if(tileid > 8000000) {
            return basePath + 'assets/img/lake_generic.jpg'
        }
        if(x == -37 && y == -39) {
            return basePath + 'assets/img/start_crashsite_-37_-39.jpg';
        } else if(x == -37 && y == -39) {
            return basePath + 'assets/img/start_crashsite_-37_-39.jpg';
        } else if(x == -37 && y == -40) {
            return basePath + 'assets/img/start_crashsite_-37_-40.jpg';
        } else if(x == -36 && y == -40) {
            return basePath + 'assets/img/start_crashsite_-36_-40.jpg';
        } else if(x == -36 && y == -41) {
            return basePath + 'assets/img/start_crashsite_-36_-41.jpg';
        }
    }

    var POI_SIZES = {
        // "POI_ROAD":1,
        "POI_CRASHSITE_AREA":2,
        "POI_BUILDAREA_MEDIUM":2,
        "POI_MECHANICSTATION_MEDIUM":2,
        "POI_LABYRINTH_MEDIUM":2,
        "POI_CHEMLAKE_MEDIUM":2,
        "POI_RUIN_MEDIUM":2,
        "POI_FOREST_RUIN_MEDIUM":2,
        "POI_CAPSULESCRAPYARD_MEDIUM":2,
        "POI_PACKINGSTATIONVEG_MEDIUM": 2,
        "POI_PACKINGSTATIONFRUIT_MEDIUM": 2,
        "POI_LAKE_UNDERWATER_MEDIUM": 2,
        "POI_LAKE_RANDOM": 1,
        "POI_CAMP_LARGE":4,
        "POI_CRASHEDSHIP_LARGE":4,
        "POI_BURNTFOREST_FARMBOTSCRAPYARD_LARGE":4,
        "POI_WAREHOUSE2_LARGE":4,
        "POI_WAREHOUSE3_LARGE":4,
        "POI_WAREHOUSE4_LARGE":4,
        "POI_HIDEOUT_XL":8,
        "POI_RUINCITY_XL": 8,
        "POI_SILODISTRICT_XL": 8
    };

    // Route Planner Functions
    function initializeRoutePlanner() {
        var routePlannerBtn = document.getElementById('route-planner-btn');
        var overlay = document.getElementById('route-planner-overlay');
        var closeBtn = document.getElementById('close-route-planner');
        var addWaypointBtn = document.getElementById('add-waypoint-btn');
        var calculateBtn = document.getElementById('calculate-route-btn-modal');
        var saveBtn = document.getElementById('save-route-btn');
        var clearBtn = document.getElementById('clear-route-btn-modal');
        
        if(routePlannerBtn) {
            routePlannerBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                openRoutePlanner();
            });
        }
        
        if(closeBtn) {
            closeBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                closeRoutePlanner();
            });
        }
        
        if(overlay) {
            overlay.addEventListener('click', function(e) {
                if(e.target === overlay) {
                    closeRoutePlanner();
                }
            });
        }
        
        if(addWaypointBtn) {
            addWaypointBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                enableWaypointMode();
            });
        }
        
        if(calculateBtn) {
            calculateBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                calculateRouteWithWaypoints();
            });
        }
        
        if(saveBtn) {
            saveBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                saveRouteToLocalStorage();
            });
        }
        
        var openSavedRouteBtn = document.getElementById('open-saved-route-btn');
        if(openSavedRouteBtn) {
            openSavedRouteBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                toggleSavedRoutesList();
            });
        }
        
        var closeSavedRoutesBtn = document.getElementById('close-saved-routes-btn');
        if(closeSavedRoutesBtn) {
            closeSavedRoutesBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                var savedRoutesList = document.getElementById('saved-routes-list');
                if(savedRoutesList) {
                    savedRoutesList.classList.add('collapsed');
                }
            });
        }
        
        if(clearBtn) {
            clearBtn.addEventListener('click', function(e) {
                e.stopPropagation();
                clearRouteWithWaypoints();
            });
        }
        
        // Setup add pin from map checkbox
        var addPinFromMapCb = document.getElementById('add-pin-from-map-cb');
        if(addPinFromMapCb) {
            addPinFromMapCb.addEventListener('change', function(e) {
                addPinFromMapMode = this.checked;
                if(addPinFromMapMode) {
                    var status = document.getElementById('route-status-modal');
                    if(status) {
                        status.textContent = 'Click on the map to add pins. Uncheck to disable.';
                        status.className = 'route-status info';
                        setTimeout(function() {
                            if(status.textContent.indexOf('Click on the map') !== -1) {
                                status.textContent = '';
                                status.className = '';
                            }
                        }, 3000);
                    }
                }
            });
        }
        
        // Map click handler for waypoints is now in the main map.on('click') handler above
    }
    
    function openRoutePlanner() {
        var overlay = document.getElementById('route-planner-overlay');
        var btn = document.getElementById('route-planner-btn');
        if(overlay) {
            overlay.classList.remove('collapsed');
            if(btn) btn.classList.add('active');
            routePlanningMode = true;
            updateWaypointsList();
        }
    }
    
    function closeRoutePlanner() {
        var overlay = document.getElementById('route-planner-overlay');
        var btn = document.getElementById('route-planner-btn');
        if(overlay) {
            overlay.classList.add('collapsed');
            if(btn) btn.classList.remove('active');
        }
        routePlanningMode = false;
        // Disable add pin from map mode when closing
        addPinFromMapMode = false;
        var addPinCb = document.getElementById('add-pin-from-map-cb');
        if(addPinCb) {
            addPinCb.checked = false;
        }
        disableWaypointMode();
    }
    
    function enableWaypointMode() {
        routePlanningMode = 'waypoint';
        // Close overlay temporarily to allow map clicking
        var overlay = document.getElementById('route-planner-overlay');
        if(overlay) {
            overlay.style.pointerEvents = 'none';
            overlay.style.opacity = '0.3';
        }
        var status = document.getElementById('route-status-modal');
        if(status) {
            status.textContent = 'Click on the map or a pin to add a waypoint';
            status.className = 'route-status info';
        }
        map.getContainer().style.cursor = 'crosshair';
        
        // Show instruction overlay
        var instructionDiv = document.createElement('div');
        instructionDiv.id = 'waypoint-instruction';
        instructionDiv.style.cssText = 'position: fixed; top: 80px; left: 50%; transform: translateX(-50%); z-index: 3000; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 15px 30px; border-radius: 25px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); font-weight: 600; font-size: 14px;';
        instructionDiv.textContent = '🗺️ Click on the map or a pin to add waypoint';
        document.body.appendChild(instructionDiv);
    }
    
    function disableWaypointMode() {
        routePlanningMode = false;
        map.getContainer().style.cursor = '';
        // Restore overlay
        var overlay = document.getElementById('route-planner-overlay');
        if(overlay) {
            overlay.style.pointerEvents = 'auto';
            overlay.style.opacity = '1';
        }
        var status = document.getElementById('route-status-modal');
        if(status) {
            status.textContent = '';
            status.className = '';
        }
        // Remove instruction overlay
        var instructionDiv = document.getElementById('waypoint-instruction');
        if(instructionDiv) {
            instructionDiv.remove();
        }
    }
    
    function addWaypointFromMapClick(latlng) {
        // Convert lat/lng to cell coordinates
        var xscalar = 2;
        var yscalar = 2;
        var x = Math.floor(latlng.lng * xscalar);
        var y = Math.floor(latlng.lat * yscalar) + 64;
        var cellX = Math.floor(x / 64);
        var cellY = Math.floor(y / 64);
        
        addWaypoint(cellX, cellY, latlng.lat, latlng.lng, null);
    }
    
    function addWaypointFromPin(marker) {
        var coords = getCellCoords(marker);
        var latlng = marker.getLatLng();
        var name = marker.options.name || `poi (${marker.options.x},${marker.options.y})`;
        addWaypoint(coords.x, coords.y, latlng.lat, latlng.lng, name);
    }
    
    function addWaypoint(x, y, lat, lng, name) {
        var waypoint = {
            x: x,
            y: y,
            lat: lat,
            lng: lng,
            name: name || `Waypoint ${routeWaypoints.length + 1}`,
            marker: null
        };
        
        routeWaypoints.push(waypoint);
        
        // Create marker for waypoint
        var waypointIcon = L.divIcon({
            className: 'waypoint-marker',
            html: '<div style="width: 20px; height: 20px; background: #667eea; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3);"></div>',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
        });
        
        var marker = L.marker([lat, lng], {
            icon: waypointIcon,
            draggable: true
        }).addTo(map);
        
        marker.bindPopup(waypoint.name);
        waypoint.marker = marker;
        routeWaypointMarkers.push(marker);
        
        // Make marker draggable and update on drag
        marker.on('dragend', function() {
            var newLatLng = marker.getLatLng();
            waypoint.lat = newLatLng.lat;
            waypoint.lng = newLatLng.lng;
            var xscalar = 2;
            var yscalar = 2;
            var newX = Math.floor(newLatLng.lng * xscalar);
            var newY = Math.floor(newLatLng.lat * yscalar) + 64;
            waypoint.x = Math.floor(newX / 64);
            waypoint.y = Math.floor(newY / 64);
            updateWaypointsList();
            // Recalculate route if it exists
            if(routeLine) {
                calculateRouteWithWaypoints();
            }
            // Recalculate route if it exists
            if(routeLine) {
                calculateRouteWithWaypoints();
            }
        });
        
        updateWaypointsList();
        disableWaypointMode();
    }
    
    function removeWaypoint(index) {
        if(index >= 0 && index < routeWaypoints.length) {
            var waypoint = routeWaypoints[index];
            if(waypoint.marker) {
                map.removeLayer(waypoint.marker);
            }
            routeWaypoints.splice(index, 1);
            routeWaypointMarkers.splice(index, 1);
            updateWaypointsList();
            // Recalculate route if it exists
            if(routeLine) {
                calculateRouteWithWaypoints();
            }
        }
    }
    
    function updateWaypointsList() {
        var list = document.getElementById('waypoints-list');
        if(!list) return;
        
        var html = '<div class="waypoint-item-header"><span>Waypoint</span><span>Location</span><span>Actions</span></div>';
        
        if(routeWaypoints.length === 0) {
            html += '<div style="text-align: center; padding: 20px; color: #999;">No waypoints added. Click "Add Waypoint" and then click on the map or a pin.</div>';
        } else {
            routeWaypoints.forEach(function(waypoint, index) {
                html += '<div class="waypoint-item">';
                html += '<div class="waypoint-number">' + (index + 1) + '</div>';
                html += '<div class="waypoint-location">' + waypoint.name + ' (' + waypoint.x + ', ' + waypoint.y + ')</div>';
                html += '<div class="waypoint-actions">';
                html += '<button class="waypoint-btn delete" data-waypoint-index="' + index + '">Delete</button>';
                html += '</div>';
                html += '</div>';
            });
        }
        
        list.innerHTML = html;
        
        // Add event listeners to delete buttons
        var deleteButtons = list.querySelectorAll('.waypoint-btn.delete');
        deleteButtons.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var index = parseInt(this.getAttribute('data-waypoint-index'));
                removeWaypoint(index);
            });
        });
    }
    
    function calculateRouteWithWaypoints() {
        if(routeWaypoints.length < 2) {
            var status = document.getElementById('route-status-modal');
            if(status) {
                status.textContent = 'Please add at least 2 waypoints';
                status.className = 'route-status error';
            }
            return;
        }
        
        // Clear existing route
        if(routeLine) {
            routeLayer.removeLayer(routeLine);
            routeLine = null;
        }
        
        var allLatLngs = [];
        var status = document.getElementById('route-status-modal');
        
        // Calculate route between each pair of consecutive waypoints
        for(var i = 0; i < routeWaypoints.length - 1; i++) {
            var start = routeWaypoints[i];
            var end = routeWaypoints[i + 1];
            
            // Use existing drawRoute logic but get just the path
            var path = calculatePathBetweenPoints(start.x, start.y, end.x, end.y);
            
            if(path && path.length > 0) {
                // Convert path to lat/lng
                for(var j = 0; j < path.length; j++) {
                    var latLng = cellToLatLng(path[j].x, path[j].y);
                    // Avoid duplicates (except first point of each segment)
                    if(allLatLngs.length === 0 || !latLngsEqual(allLatLngs[allLatLngs.length - 1], latLng)) {
                        allLatLngs.push(latLng);
                    }
                }
            } else {
                // Direct line if no path found
                allLatLngs.push([start.lat, start.lng]);
                allLatLngs.push([end.lat, end.lng]);
            }
        }
        
        if(allLatLngs.length === 0) {
            if(status) {
                status.textContent = 'Failed to calculate route';
                status.className = 'route-status error';
            }
            return;
        }
        
        // Draw route
        var routeColor = getSetting('routes', 'defaultColor') || '#FF1744';
        var routeWidth = getSetting('routes', 'lineWidth') || 3;
        var routeOpacity = (getSetting('routes', 'lineOpacity') || 100) / 100;
        var glowEffect = getSetting('routes', 'glowEffect') !== false;
        
        routeLine = L.polyline(allLatLngs, {
            color: routeColor,
            weight: routeWidth,
            opacity: routeOpacity,
            className: 'route-line'
        });
        
        routeLine.addTo(routeLayer);
        routeLine.bringToFront();
        
        if(glowEffect && routeLayer && routeLayer._container) {
            setTimeout(function() {
                var pathElements = routeLayer._container.querySelectorAll('path');
                pathElements.forEach(function(path) {
                    path.style.filter = 'drop-shadow(0 0 3px ' + routeColor + ') drop-shadow(0 0 6px ' + routeColor + ')';
                });
            }, 100);
        }
        
        if(status) {
            status.textContent = 'Route calculated successfully! ' + routeWaypoints.length + ' waypoints, ' + allLatLngs.length + ' path points';
            status.className = 'route-status success';
        }
    }
    
    function calculatePathBetweenPoints(startX, startY, endX, endY) {
        // Use existing pathfinding logic
        var shortestPath = findPathAvoidingWater(startX, startY, endX, endY);
        var roadPath = findRoadPath(startX, startY, endX, endY);
        
        if(roadPath && roadPath.length > 0) {
            return (shortestPath && shortestPath.length < roadPath.length) ? shortestPath : roadPath;
        }
        return shortestPath;
    }
    
    function latLngsEqual(latlng1, latlng2) {
        return Math.abs(latlng1.lat - latlng2.lat) < 0.001 && Math.abs(latlng1.lng - latlng2.lng) < 0.001;
    }
    
    function clearRouteWithWaypoints() {
        // Clear route line
        if(routeLine) {
            routeLayer.removeLayer(routeLine);
            routeLine = null;
        }
        
        // Clear waypoint markers
        routeWaypointMarkers.forEach(function(marker) {
            map.removeLayer(marker);
        });
        routeWaypointMarkers = [];
        routeWaypoints = [];
        
        updateWaypointsList();
        
        var status = document.getElementById('route-status-modal');
        if(status) {
            status.textContent = 'Route cleared';
            status.className = 'route-status info';
        }
    }
    
    function saveRouteToLocalStorage() {
        var routeName = document.getElementById('route-name-input').value.trim();
        if(!routeName) {
            var status = document.getElementById('route-status-modal');
            if(status) {
                status.textContent = 'Please enter a route name';
                status.className = 'route-status error';
            }
            return;
        }
        
        if(routeWaypoints.length < 2) {
            var status = document.getElementById('route-status-modal');
            if(status) {
                status.textContent = 'Please add at least 2 waypoints before saving';
                status.className = 'route-status error';
            }
            return;
        }
        
        // Prepare route data (without marker references)
        var routeData = {
            name: routeName,
            waypoints: routeWaypoints.map(function(wp) {
                return {
                    x: wp.x,
                    y: wp.y,
                    lat: wp.lat,
                    lng: wp.lng,
                    name: wp.name || ''
                };
            })
        };
        
        // Load existing routes
        loadRoutes();
        
        // Check if route with same name exists
        var existingIndex = savedRoutes.findIndex(function(r) {
            return r.name === routeName;
        });
        
        if(existingIndex >= 0) {
            // Update existing route
            savedRoutes[existingIndex] = routeData;
        } else {
            // Add new route
            savedRoutes.push(routeData);
        }
        
        // Save to localStorage
        try {
            localStorage.setItem('sm_routes', JSON.stringify(savedRoutes));
            var status = document.getElementById('route-status-modal');
            if(status) {
                status.textContent = 'Route "' + routeName + '" saved successfully!';
                status.className = 'route-status success';
            }
            
            // Clear current route planner
            clearRouteWithWaypoints();
            document.getElementById('route-name-input').value = '';
        } catch(e) {
            console.warn('Failed to save route:', e);
            var status = document.getElementById('route-status-modal');
            if(status) {
                status.textContent = 'Failed to save route: ' + e.message;
                status.className = 'route-status error';
            }
        }
    }
    
    function loadRoutes() {
        try {
            var saved = localStorage.getItem('sm_routes');
            if(saved) {
                savedRoutes = JSON.parse(saved);
            } else {
                savedRoutes = [];
            }
        } catch(e) {
            console.warn('Failed to load routes:', e);
            savedRoutes = [];
        }
    }
    
    function toggleSavedRoutesList() {
        var savedRoutesList = document.getElementById('saved-routes-list');
        if(!savedRoutesList) return;
        
        if(savedRoutesList.classList.contains('collapsed')) {
            loadRoutes();
            updateSavedRoutesList();
            savedRoutesList.classList.remove('collapsed');
        } else {
            savedRoutesList.classList.add('collapsed');
        }
    }
    
    function updateSavedRoutesList() {
        var content = document.getElementById('saved-routes-content');
        if(!content) return;
        
        loadRoutes();
        
        if(savedRoutes.length === 0) {
            content.innerHTML = '<div style="text-align: center; padding: 20px; color: #999;">No saved routes. Create a route and save it to see it here.</div>';
            return;
        }
        
        var html = '';
        savedRoutes.forEach(function(route, index) {
            html += '<div class="saved-route-item">';
            html += '<div class="saved-route-info">';
            html += '<div class="saved-route-name">' + escapeHtml(route.name) + '</div>';
            html += '<div class="saved-route-details">' + route.waypoints.length + ' waypoint' + (route.waypoints.length !== 1 ? 's' : '') + '</div>';
            html += '</div>';
            html += '<div class="saved-route-actions">';
            html += '<button class="action-btn primary" data-route-index="' + index + '" style="padding: 8px 16px; font-size: 12px;">Load</button>';
            html += '<button class="action-btn danger" data-route-index="' + index + '" style="padding: 8px 16px; font-size: 12px; margin-left: 5px;">Delete</button>';
            html += '</div>';
            html += '</div>';
        });
        
        content.innerHTML = html;
        
        // Add event listeners
        var loadButtons = content.querySelectorAll('.action-btn.primary[data-route-index]');
        loadButtons.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var index = parseInt(this.getAttribute('data-route-index'));
                loadSavedRoute(index);
            });
        });
        
        var deleteButtons = content.querySelectorAll('.action-btn.danger[data-route-index]');
        deleteButtons.forEach(function(btn) {
            btn.addEventListener('click', function(e) {
                e.stopPropagation();
                var index = parseInt(this.getAttribute('data-route-index'));
                deleteSavedRoute(index);
            });
        });
    }
    
    function loadSavedRoute(index) {
        if(index < 0 || index >= savedRoutes.length) return;
        
        var route = savedRoutes[index];
        
        // Clear current route
        clearRouteWithWaypoints();
        
        // Set route name
        var routeNameInput = document.getElementById('route-name-input');
        if(routeNameInput) {
            routeNameInput.value = route.name;
        }
        
        // Load waypoints
        route.waypoints.forEach(function(wp) {
            addWaypoint(wp.x, wp.y, wp.lat, wp.lng, wp.name || '');
        });
        
        // Close saved routes list
        var savedRoutesList = document.getElementById('saved-routes-list');
        if(savedRoutesList) {
            savedRoutesList.classList.add('collapsed');
        }
        
        // Show success message
        var status = document.getElementById('route-status-modal');
        if(status) {
            status.textContent = 'Route "' + route.name + '" loaded. Click "Calculate Route" to visualize it.';
            status.className = 'route-status success';
        }
    }
    
    function deleteSavedRoute(index) {
        if(index < 0 || index >= savedRoutes.length) return;
        
        if(confirm('Are you sure you want to delete route "' + savedRoutes[index].name + '"?')) {
            savedRoutes.splice(index, 1);
            try {
                localStorage.setItem('sm_routes', JSON.stringify(savedRoutes));
                updateSavedRoutesList();
                var status = document.getElementById('route-status-modal');
                if(status) {
                    status.textContent = 'Route deleted successfully.';
                    status.className = 'route-status success';
                }
            } catch(e) {
                console.warn('Failed to delete route:', e);
            }
        }
    }
    
    function escapeHtml(text) {
        var div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    // OLD SYSTEM - REMOVED
    function setupPinWaypointHandlers() {
        // OLD SYSTEM - REMOVED
        // Waypoints are now managed directly in route planner
    }

    function getMap(){ return map;}

    function getClickMarker(){ return clickmarker;}

    return {
        init,
        getMap,
        getClickMarker,
        removeWaypoint: removeWaypoint
    }
})();