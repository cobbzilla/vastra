const MB_TOKEN_KEY = 'MAPBOX_TOKEN';

// state of GPS tracking
const S_TRACKING = 'tracking';
const S_PAUSED = 'paused';
const S_OFF = 'off';

const VASTRA = {
    watch: null,
    mapApiToken: null,
    map: null,
    zoomed: false,
    gpsData: [],
    gpsDots: [],
    L: null,
    gpsHandlerFunc: null,
    paused: false,

    init: function (gpsHandlerFunc = VASTRA.showDataRow, L = L, start = true) {
        VASTRA.L = L;
        VASTRA.map = L.map('map').fitWorld();
        VASTRA.gpsHandlerFunc = gpsHandlerFunc;

        VASTRA.mapApiToken = localStorage.getItem(MB_TOKEN_KEY);
        if (typeof VASTRA.mapApiToken === "undefined" || VASTRA.mapApiToken == null) {
            VASTRA.mapApiToken = window.prompt('API key for MapBox');
            localStorage.setItem(MB_TOKEN_KEY, VASTRA.mapApiToken)
        }

        L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token='+VASTRA.mapApiToken, {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox.streets'
        }).addTo(VASTRA.map);

        if (navigator.geolocation) {
            if (start) VASTRA.startTracking();
        } else {
            alert("Geolocation is not supported by this browser.");
        }
    },

    state: function () {
        if (this.watch != null) return S_TRACKING;
        if (this.paused) return S_PAUSED;
        return S_OFF;
    },

    startTracking: function () {
        if (VASTRA.watch != null || VASTRA.state() === S_TRACKING) {
            console.log("startTracking: already tracking GPS");
        } else {
            const wasPaused = VASTRA.paused;
            if (!wasPaused) VASTRA.gpsData = [];

            VASTRA.paused = false;
            VASTRA.watch = navigator.geolocation.watchPosition(function (position) {
                const datum = VASTRA.gpsDatum(position);
                // VASTRA.log("watchPosition: GPS coords "+JSON.stringify(datum));
                VASTRA.gpsData.push(datum);
                VASTRA.gpsHandlerFunc(datum);
                if (typeof VASTRA.onGps !== 'undefined' && VASTRA.onGps != null) {
                    VASTRA.onGps(datum);
                }
            });
            if (typeof VASTRA.onStart !== 'undefined' && VASTRA.onStart != null) {
                VASTRA.onStart(wasPaused);
            }
        }
    },

    pauseTracking : function () {
        navigator.geolocation.clearWatch(VASTRA.watch);
        VASTRA.watch = null;
        VASTRA.paused = true;
        if (typeof VASTRA.onPause !== 'undefined' && VASTRA.onPause != null) {
            VASTRA.onPause();
        }
    },

    stopTracking : function () {
        navigator.geolocation.clearWatch(VASTRA.watch);
        VASTRA.watch = null;
        VASTRA.paused = false;
        if (typeof VASTRA.onStop !== 'undefined' && VASTRA.onStop != null) {
            VASTRA.onStop();
        }
    },

    setView: function (datum, zoom = null) {
        if (zoom != null || !VASTRA.zoomed) {
            VASTRA.map.setView([datum.lat, datum.lon], zoom == null ? 16 : zoom);
            VASTRA.zoomed = true;
        }
    },

    showPosition: function (datum) {
        VASTRA.setView(datum);
        return VASTRA.addCircle(datum);
    },


    gpsDatum: function (position) {
        return {
            time: Date.now(),
            lat:       position.coords.latitude,
            latitude:  position.coords.latitude,
            lon:       position.coords.longitude,
            longitude: position.coords.longitude,
            accuracy:  position.coords.accuracy,
            altitude:  position.coords.altitude,
            alt:       position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            altAccuracy:      position.coords.altitudeAccuracy
        };
    },

    addCircle: function  (datum, color = 'red', fillColor = '#f03') {
        const circle = VASTRA.L.circle([datum.lat, datum.lon], {
            color: color,
            fillColor: fillColor,
            fillOpacity: 0.5,
            radius: datum.accuracy != null ? 1+Math.floor(datum.accuracy/2) : 20
        });
        circle.addTo(VASTRA.map);
        return circle;
    },

    showDataRow: function (datum, divId = 'gpsdata') {
        const row = $('<tr></tr>');
        row.append($('<td>Time '+new Date(datum.time)+'</td>'));
        row.append($('<td>Lat '+datum.lat+'</td>'));
        row.append($('<td>Lon '+datum.lon+'</td>'));
        row.append($('<td>Acc '+datum.accuracy+'</td>'));
        row.append($('<td>Alt '+datum.alt+'</td>'));
        row.append($('<td>AltAcc '+datum.altitudeAccuracy+'</td>'));
        $('#'+divId).prepend(row);
        VASTRA.showPosition(datum);
    },

    generateCSV: function (data = VASTRA.gpsData, divId = 'csvDiv') {
        let csvData = "Time,Lat,Lon,Accuracy,Alt,AltAccuracy\r\n";
        for (let i=0; i < data.length; i++) {
            const datum = data[i];
            csvData = csvData + datum.time + "," + datum.lat+","+datum.lon+","+datum.accuracy+","+datum.altitude+","+datum.altitudeAccuracy+"\r\n";
        }
        const now = Date.now();
        $('#'+divId).html('<a download="vastra_'+now+'.csv" href="data:text/csv;charset=utf-8,'+encodeURIComponent(csvData)+'">download CSV</a>');
    },

    log: function (msg, logId = 'log') {
        $('#'+logId).prepend('<p>'+msg+'</p>');
        console.log(msg);
    },
    resetLog: function (logId = 'log') {
        $('#'+logId).empty();
    },

    defaultGpsDotShapeFunc: function (datum) {
        return VASTRA.L.circle([datum.lat, datum.lon], {
            color: 'green',
            fillColor: '#44ff88',
            fillOpacity: 0.1,
            radius: datum.accuracy != null ? 1+Math.floor(datum.accuracy/2) : 20
        });
    },
    showGpsDots: function(shapeFunc = this.defaultGpsDotShapeFunc, btnId = 'btnRawGps') {
        VASTRA.hideGpsDots();
        for (let i = 0; i < VASTRA.gpsData.length; i++) {
            const datum = VASTRA.gpsData[i];

            const shape = shapeFunc(datum);
            shape.addTo(VASTRA.map);
            VASTRA.gpsDots.push(shape);
        }
        $('#'+btnId).text('GPS: '+VASTRA.gpsData.length+ " points");
        VASTRA.onGps = function () { VASTRA.showGpsDots(); };
    },
    hideGpsDots: function (btnId = 'btnRawGps') {
        for (let i = 0; i < VASTRA.gpsDots.length; i++) {
            VASTRA.map.removeLayer(VASTRA.gpsDots[i]);
        }
        VASTRA.gpsDots = [];
        $('#'+btnId).text('GPS');
        VASTRA.onGps = null;
    },
    hasGpsDots: function () { return VASTRA.gpsDots.length > 0; },
    toggleGpsDots: function () { return VASTRA.hasGpsDots() ? VASTRA.hideGpsDots() : VASTRA.showGpsDots(); },

    resetAll:  function () {
        localStorage.clear();
        location.reload();
    }
};