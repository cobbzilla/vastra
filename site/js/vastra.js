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
    accelerationFunc: null,
    paused: false,
    origPosition: null,
    _lastPosition: null,
    lastPosition: null,

    init: function (gpsHandlerFunc = VASTRA.showDataRow, L = L, accelerationFunc = null, start = true) {
        VASTRA.L = L;
        VASTRA.map = L.map('map').fitWorld();
        VASTRA.gpsHandlerFunc = gpsHandlerFunc;
        VASTRA.accelerationFunc = accelerationFunc;

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
                const datum = VASTRA.gpsDatum(position, VASTRA.lastPosition);
                if (this.origPosition == null) this.origPosition = datum;
                VASTRA.lastPosition = datum;
                // VASTRA.log("watchPosition: GPS coords "+JSON.stringify(datum));
                VASTRA.gpsData.push(datum);
                VASTRA.gpsHandlerFunc(datum, VASTRA.accelerationFunc);
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
        VASTRA.origPosition = null;
        VASTRA.lastPosition = null;
        VASTRA._lastPosition = null;
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


    gpsDatum: function (position, lastPosition = null) {
        const datum = {
            time: Date.now(),
            lat:       position.coords.latitude,
            latitude:  position.coords.latitude,
            lon:       position.coords.longitude,
            longitude: position.coords.longitude,
            accuracy:  position.coords.accuracy,
            altitude:  position.coords.altitude,
            alt:       position.coords.altitude,
            altitudeAccuracy: position.coords.altitudeAccuracy,
            altAccuracy:      position.coords.altitudeAccuracy,
            lastPosition: lastPosition
        };
        datum.distance = lastPosition == null ? 0 : dist(lastPosition, datum);
        datum.speed = lastPosition == null ? 0 : speed(lastPosition, datum);
        return datum;
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
        row.append($('<td>Distance '+datum.distance+'m</td>'));
        row.append($('<td>Speed '+datum.speed+'m/s</td>'));
        $('#'+divId).prepend(row);
        VASTRA.showPosition(datum);
    },

    generateCSV: function (data = VASTRA.gpsData, divId = 'csvDiv') {
        let csvData = "Time,Lat,Lon,Accuracy,Alt,AltAccuracy,Distance,Speed\r\n";
        for (let i=0; i < data.length; i++) {
            const datum = data[i];
            csvData = csvData + datum.time + "," + datum.lat+","+datum.lon+","+datum.accuracy
                +","+datum.altitude+","+datum.altitudeAccuracy
                +","+(typeof datum.distance !== 'undefined' && datum.distance != null && !isNaN(datum.distance)? datum.distance : 0)
                +","+(typeof datum.speed !== 'undefined' && datum.speed != null && !isNaN(datum.speed) ? datum.speed : 0)
                +"\r\n";
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
        $('#'+btnId).text('GPS: '+VASTRA.gpsData.length+ " numPoints");
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

// adapted from https://stackoverflow.com/a/21623206/1251543
function dist(p1, p2) {
    if (typeof p1 === 'undefined' || typeof p2 === 'undefined' || p1 == null || p2 == null) return 0;
    const p = 0.017453292519943295;    // Math.PI / 180
    const c = Math.cos;
    const a = 0.5 - c((p2.lat - p1.lat) * p)/2 +
        c(p1.lat * p) * c(p2.lat * p) *
        (1 - c((p2.lon - p1.lon) * p))/2;
    return 12742 * Math.asin(Math.sqrt(a)) * 1000; // 2 * R; R = 6371 km * 1000 = meters
}

function speed(p1, p2) {
    if (typeof p1 === 'undefined' || typeof p2 === 'undefined' || p1 == null || p2 == null) return 0;
    const distance = dist(p1, p2);
    const duration = 1000 * (p2.time - p1.time); // convert milliseconds -> seconds
    return duration === 0 ? 0 : distance / duration;
}

function logPoint(p) {
    return JSON.stringify({
        lat: p.lat,
        lon: p.lon,
        alt: p.alt,
        acc: p.accuracy,
        altAcc: p.altitudeAccuracy,
        distance: p.distance,
        speed: p.speed
    });
}
