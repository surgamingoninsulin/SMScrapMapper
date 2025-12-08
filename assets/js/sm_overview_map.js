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
    var pinnedMarkers = [];
    var highlightedTileTypes = new Set();
    var highlightLayerGroup;
    var availableMarkerIcons = [];
    var markerIconCache = {};

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

    var markerIcon = L.icon({
        iconUrl: basePath + 'assets/img/markers/marker.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        // iconSize: [38,84],
        iconSize: [20,44],
        iconAnchor: [9,44],
        popupAnchor: [0,-50]
    })

    // Pinned marker icon - uses markers folder, falls back to main marker
    var pinnedMarkerIcon = L.icon({
        iconUrl: basePath + 'assets/img/markers/marker.png',
        shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
        iconSize: [20,44],
        iconAnchor: [9,44],
        popupAnchor: [0,-50],
        className: 'pinned-marker-icon'
    });

    L.tileLayer.offsetTileLayer = function(opts) {
        return new L.TileLayer.OffsetTileLayer(opts);
    };

    // var tileLayer = L.tileLayer.offsetTileLayer('./img/{x},{y}.jpg', {
    //     noWrap: true,
    //     maxNativeZoom: 1,
    //     minNativeZoom: 1,
    //     tileSize:250,
    //     className: "imgTileLayer"
    //     // tileSize: 1000
    // }).addTo(map)

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
        var imgMarkersPath = basePath + 'assets/img/markers/'; // Primary location: ./assets/img/markers/
        var markersPath = basePath + 'assets/assets/img/markers/'; // Fallback: assets/assets/img/markers/
        var imgBasePath = basePath + 'assets/img/';
        var patterns = [];
        
        // Always include marker.png from both locations (assets/img/markers/ takes priority)
        patterns.push({ path: imgMarkersPath, file: 'marker.png' }); // Primary location
        patterns.push({ path: markersPath, file: 'marker.png' }); // Fallback
        patterns.push({ path: imgBasePath, file: 'marker.png' }); // Fallback to assets/img/
        
        // Check for markerX.png pattern (marker1.png, marker2.png, etc.) - user has 1-8
        for(var i = 1; i <= 20; i++) {
            // Check assets/img/markers/ (user's actual location)
            patterns.push({ path: imgMarkersPath, file: 'marker' + i + '.png' });
            // Also check assets/assets/img/markers/ as fallback
            patterns.push({ path: markersPath, file: 'marker' + i + '.png' });
        }
        
        // Test each pattern by trying to load the image (with batching to avoid blocking)
        var tested = 0;
        var maxTests = patterns.length;
        var foundIcons = new Set(); // Use Set to avoid duplicates
        var batchSize = 50; // Process in batches to avoid blocking
        var currentBatch = 0;
        
        function checkComplete() {
            if(tested === maxTests) {
                icons = Array.from(foundIcons);
                // Default to assets/img/markers/ if available, otherwise assets/assets/img/markers/
                var defaultMarkerPath = basePath + 'assets/img/markers/marker.png';
                availableMarkerIcons = icons.length > 0 ? icons : [defaultMarkerPath];
                console.log('Discovered ' + availableMarkerIcons.length + ' marker icons');
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
        if(markerIconCache[iconPath]) {
            return markerIconCache[iconPath];
        }
        
        var icon = L.icon({
            iconUrl: iconPath,
            shadowUrl: 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png',
            iconSize: [20,44],
            iconAnchor: [9,44],
            popupAnchor: [0,-50],
            className: 'pinned-marker-icon'
        });
        
        markerIconCache[iconPath] = icon;
        return icon;
    }

    // Pinned markers functions
    function savePinnedMarkers() {
        var markersData = pinnedMarkers.map(function(marker) {
            return {
                lat: marker.getLatLng().lat,
                lng: marker.getLatLng().lng,
                x: marker.options.x,
                y: marker.options.y,
                iconPath: marker.options.iconPath || basePath + 'assets/img/markers/marker.png'
            };
        });
        try {
            localStorage.setItem('sm_pinnedMarkers', JSON.stringify(markersData));
        } catch(e) {
            console.warn('Failed to save pinned markers:', e);
        }
    }

    function loadPinnedMarkers() {
        try {
            var saved = localStorage.getItem('sm_pinnedMarkers');
            if(saved) {
                var markersData = JSON.parse(saved);
                markersData.forEach(function(data) {
                    var iconPath = data.iconPath || basePath + 'assets/img/markers/marker.png';
                    createPinnedMarker(data.lat, data.lng, data.x, data.y, false, iconPath);
                });
            }
        } catch(e) {
            console.warn('Failed to load pinned markers:', e);
        }
    }

    function createPinnedMarker(lat, lng, x, y, save, iconPath) {
        // Default to markers folder if available, otherwise fallback
        // Default to assets/img/markers/ if available, otherwise assets/assets/img/markers/
        iconPath = iconPath || basePath + 'assets/img/markers/marker.png';
        var icon = createMarkerIcon(iconPath);
        
        var marker = L.marker([lat, lng], {
            icon: icon,
            x: x,
            y: y,
            iconPath: iconPath
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
        
        marker.bindPopup(contentForMarker(x, y, true, iconPath), {
            autoClose: false,
            closeOnClick: false
        });
        pinnedMarkers.push(marker);
        
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
            }
        });
        
        if(save !== false) {
            savePinnedMarkers();
        }
        
        return marker;
    }

    function isLocationPinned(lat, lng) {
        var tolerance = 0.01;
        return pinnedMarkers.some(function(marker) {
            var pos = marker.getLatLng();
            return Math.abs(pos.lat - lat) < tolerance && Math.abs(pos.lng - lng) < tolerance;
        });
    }

    function removePinnedMarker(marker) {
        var index = pinnedMarkers.indexOf(marker);
        if(index > -1) {
            pinnedMarkers.splice(index, 1);
            marker.remove();
            savePinnedMarkers();
        }
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
        
        // Add event listeners to tile highlight checkboxes
        var checkboxes = document.querySelectorAll('.tile-highlight-cb');
        checkboxes.forEach(function(checkbox) {
            checkbox.addEventListener('change', function() {
                var tileType = this.getAttribute('data-type');
                highlightTilesOfType(tileType, this.checked);
            });
        });
        
        document.getElementById("stats-toggle").addEventListener('click',function(event){
            var content = document.getElementById("stats-content")
            if(content.classList.contains('collapsed')) {
                content.classList.remove("collapsed")
                document.getElementById("stats").classList.add("scroll-y")
            } else {
                content.classList.add("collapsed")
                document.getElementById("stats").classList.remove("scroll-y")
            }
            event.preventDefault();
        })
        
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
        var initialZoom = 2.5; // 50% of max zoom
        map.setView([-848,-858], initialZoom);
        
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
        
        // Discover marker icons and load pinned markers after cells are loaded
        discoverMarkerIcons();
        setTimeout(function() {
            loadPinnedMarkers();
        }, 500);

        map.on('click', function(e) {
            // Don't handle clicks on markers or popups
            if(e.originalEvent && (e.originalEvent.target.closest('.leaflet-marker-icon') || e.originalEvent.target.closest('.leaflet-popup'))) {
                return;
            }
            
            let xscalar = 2;
            let yscalar = 2;
            let x = Math.floor(e.latlng.lng * xscalar);
            let y = Math.floor(e.latlng.lat * yscalar) + 64;
            
            console.log("lnglat:     ", Math.floor(e.latlng.lng),Math.floor(e.latlng.lat));
            console.log("scaled ll:  ", x,y);
            
            // Check if location is already pinned
            var isPinned = isLocationPinned(e.latlng.lat, e.latlng.lng);
            
            // Only remove clickmarker if it's not pinned
            if(clickmarker && !isPinned) {
                clickmarker.remove();
                clickmarker = null;
            }
            
            // Create new marker only if location is not pinned
            if(!isPinned) {
                clickmarker = L.marker([e.latlng.lat, e.latlng.lng], {icon: markerIcon, x: x, y: y}).addTo(map);
                clickmarker.bindPopup(contentForMarker(x, y, false), {
                    autoClose: false,
                    closeOnClick: false
                });
                
                // Setup pin checkbox handler when popup opens
                clickmarker.on('popupopen', function() {
                    var popup = clickmarker.getPopup();
                    if(popup && popup._contentNode) {
                        var checkbox = popup._contentNode.querySelector('.pin-marker-cb[data-x="' + x + '"][data-y="' + y + '"]');
                        if(checkbox) {
                            // Remove any existing listeners by cloning
                            var newCheckbox = checkbox.cloneNode(true);
                            checkbox.parentNode.replaceChild(newCheckbox, checkbox);
                            newCheckbox.addEventListener('change', function(e) {
                                e.stopPropagation();
                                if(this.checked) {
                                    // Pin the marker
                                    var markerLat = clickmarker.getLatLng().lat;
                                    var markerLng = clickmarker.getLatLng().lng;
                                    var markerX = x;
                                    var markerY = y;
                                    clickmarker.remove();
                                    clickmarker = null;
                                        createPinnedMarker(markerLat, markerLng, markerX, markerY, true, basePath + 'assets/img/markers/marker.png');
                                }
                            });
                        }
                    }
                });
                
                clickmarker.openPopup();
            } else {
                // If location is pinned, just open the existing pinned marker's popup
                var pinnedMarker = pinnedMarkers.find(function(m) {
                    var pos = m.getLatLng();
                    var tolerance = 0.01;
                    return Math.abs(pos.lat - e.latlng.lat) < tolerance && Math.abs(pos.lng - e.latlng.lng) < tolerance;
                });
                if(pinnedMarker) {
                    pinnedMarker.openPopup();
                }
            }
        });
    }

    function contentForMarker(x,y, isPinned, iconPath) {
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
        
        // Add pin checkbox
        var pinChecked = isPinned ? 'checked' : '';
        var markerId = 'marker-' + x + '-' + y;
        content += `<br/><br/><label><input type="checkbox" id="${markerId}" ${pinChecked} class="pin-marker-cb" data-x="${x}" data-y="${y}"> Pin this marker</label>`
        
        // Add change icon button for pinned markers
        if(isPinned) {
            content += `<br/><button class="change-icon-btn" data-x="${x}" data-y="${y}" style="margin-top: 5px; padding: 5px 10px; cursor: pointer;">Change Icon</button>`
        }

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
                marker.bindPopup(contentForMarker(x, y, true, iconPath), {
                    autoClose: false,
                    closeOnClick: false
                });
                marker.openPopup();
                
                // Save
                savePinnedMarkers();
                
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

    function getMap(){ return map;}

    function getClickMarker(){ return clickmarker;}

    return {
        init,
        getMap,
        getClickMarker
    }
})();