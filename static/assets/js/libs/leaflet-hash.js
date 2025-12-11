// Leaflet Hash Plugin
// Simple implementation for URL hash-based map state
// Based on leaflet-hash by mlevans

(function() {
    'use strict';

    L.Hash = L.Class.extend({
        initialize: function(map) {
            this._map = map;
            this._onHashChange();
            L.DomEvent.on(window, 'hashchange', this._onHashChange, this);
            
            // Update hash on map move
            map.on('moveend', this._updateHash, this);
        },

        _onHashChange: function() {
            var hash = window.location.hash;
            if (!hash || hash === '') {
                return;
            }

            var match = hash.match(/^#(\d+)\/(-?[\d.]+)\/(-?[\d.]+)$/);
            if (match) {
                var zoom = parseInt(match[1], 10);
                var lat = parseFloat(match[2]);
                var lng = parseFloat(match[3]);
                this._map.setView([lat, lng], zoom, {replace: true});
            }
        },

        _updateHash: function() {
            var center = this._map.getCenter();
            var zoom = this._map.getZoom();
            var hash = '#' + zoom + '/' + 
                       Math.round(center.lat * 100) / 100 + '/' + 
                       Math.round(center.lng * 100) / 100;
            if (window.location.hash !== hash) {
                window.history.replaceState('', '', hash);
            }
        }
    });
})();

