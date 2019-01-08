const MB_TOKEN_KEY = 'MAPBOX_TOKEN';

// state of GPS tracking
const S_TRACKING = 'tracking';
const S_PAUSED = 'paused';
const S_OFF = 'off';

const NERVA = {
    watch: null,
    mapApiToken: null,
    map: null,
    zoomed: false,
    gpsData: [],
    gpsDots: [],
    L: null,
    gpsHandlerFunc: null,
    paused: false,

    init: function (gpsHandlerFunc = NERVA.showDataRow, L = L, start = true) {
        NERVA.L = L;
        NERVA.map = L.map('map').fitWorld();
        NERVA.gpsHandlerFunc = gpsHandlerFunc;

        NERVA.mapApiToken = localStorage.getItem(MB_TOKEN_KEY);
        if (typeof NERVA.mapApiToken === "undefined" || NERVA.mapApiToken == null) {
            NERVA.mapApiToken = window.prompt('API key for MapBox');
            localStorage.setItem(MB_TOKEN_KEY, NERVA.mapApiToken)
        }

        L.tileLayer('https://api.tiles.mapbox.com/v4/{id}/{z}/{x}/{y}.png?access_token='+NERVA.mapApiToken, {
            attribution: 'Map data &copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors, <a href="https://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>, Imagery © <a href="https://www.mapbox.com/">Mapbox</a>',
            maxZoom: 18,
            id: 'mapbox.streets'
        }).addTo(NERVA.map);

        if (navigator.geolocation) {
            if (start) NERVA.startTracking();
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
        if (NERVA.watch != null || NERVA.state() === S_TRACKING) {
            console.log("startTracking: already tracking GPS");
        } else {
            const wasPaused = NERVA.paused;
            if (!wasPaused) NERVA.gpsData = [];

            NERVA.paused = false;
            NERVA.watch = navigator.geolocation.watchPosition(function (position) {
                const datum = NERVA.gpsDatum(position);
                // NERVA.log("watchPosition: GPS coords "+JSON.stringify(datum));
                NERVA.gpsData.push(datum);
                NERVA.gpsHandlerFunc(datum);
                if (typeof NERVA.onGps !== 'undefined' && NERVA.onGps != null) {
                    NERVA.onGps(datum);
                }
            });
            if (typeof NERVA.onStart !== 'undefined' && NERVA.onStart != null) {
                NERVA.onStart(wasPaused);
            }
        }
    },

    pauseTracking : function () {
        navigator.geolocation.clearWatch(NERVA.watch);
        NERVA.watch = null;
        NERVA.paused = true;
        if (typeof NERVA.onPause !== 'undefined' && NERVA.onPause != null) {
            NERVA.onPause();
        }
    },

    stopTracking : function () {
        navigator.geolocation.clearWatch(NERVA.watch);
        NERVA.watch = null;
        NERVA.paused = false;
        if (typeof NERVA.onStop !== 'undefined' && NERVA.onStop != null) {
            NERVA.onStop();
        }
    },

    setView: function (datum, zoom = null) {
        if (zoom != null || !NERVA.zoomed) {
            NERVA.map.setView([datum.lat, datum.lon], zoom == null ? 16 : zoom);
        } else {
            NERVA.map.setView([datum.lat, datum.lon]);
        }
    },

    showPosition: function (datum) {
        NERVA.setView(datum);
        return NERVA.addCircle(datum);
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
        const circle = NERVA.L.circle([datum.lat, datum.lon], {
            color: color,
            fillColor: fillColor,
            fillOpacity: 0.5,
            radius: datum.accuracy != null ? 1+Math.floor(datum.accuracy/2) : 20
        });
        circle.addTo(NERVA.map);
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
        NERVA.showPosition(datum);
    },

    generateCSV: function (data = NERVA.gpsData, divId = 'csvDiv') {
        let csvData = "Time,Lat,Lon,Accuracy,Alt,AltAccuracy\r\n";
        for (let i=0; i < data.length; i++) {
            const datum = data[i];
            csvData = csvData + datum.time + "," + datum.lat+","+datum.lon+","+datum.accuracy+","+datum.altitude+","+datum.altitudeAccuracy+"\r\n";
        }
        const now = Date.now();
        $('#'+divId).html('<a download="nerva_'+now+'.csv" href="data:text/csv;charset=utf-8,'+encodeURIComponent(csvData)+'">download CSV</a>');
    },

    log: function (msg, logId = 'log') {
        $('#'+logId).prepend('<p>'+msg+'</p>');
        console.log(msg);
    },
    resetLog: function (logId = 'log') {
        $('#'+logId).empty();
    },

    defaultGpsDotShapeFunc: function (datum) {
        return NERVA.L.circle([datum.lat, datum.lon], {
            color: 'green',
            fillColor: '#22ff44',
            fillOpacity: 0.3,
            radius: datum.accuracy != null ? 1+Math.floor(datum.accuracy/2) : 20
        });
    },
    showGpsDots: function(shapeFunc = this.defaultGpsDotShapeFunc, btnId = 'btnRawGps') {
        NERVA.hideGpsDots();
        for (let i = 0; i < NERVA.gpsData.length; i++) {
            const datum = NERVA.gpsData[i];

            const shape = shapeFunc(datum);
            shape.addTo(NERVA.map);
            NERVA.gpsDots.push(shape);
        }
        $('#'+btnId).text('GPS: '+NERVA.gpsData.length+ " points");
        NERVA.onGps = function () { NERVA.showGpsDots(); };
    },
    hideGpsDots: function (btnId = 'btnRawGps') {
        for (let i = 0; i < NERVA.gpsDots.length; i++) {
            NERVA.map.removeLayer(NERVA.gpsDots[i]);
        }
        NERVA.gpsDots = [];
        $('#'+btnId).text('GPS');
        NERVA.onGps = null;
    },
    hasGpsDots: function () { return NERVA.gpsDots.length > 0; },
    toggleGpsDots: function () { return NERVA.hasGpsDots() ? NERVA.hideGpsDots() : NERVA.showGpsDots(); },

    resetAll:  function () {
        localStorage.clear();
        location.reload();
    }
};