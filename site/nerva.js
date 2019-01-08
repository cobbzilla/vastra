const MB_TOKEN_KEY = 'MAPBOX_TOKEN';

// state of GPS tracking
const S_TRACKING = 'tracking';
const S_PAUSED = 'paused';
const S_OFF = 'off';

const NERVA = {
    watch: null,
    mapApiToken: null,
    map: null,
    gpsData: [],
    L: L,
    func: null,
    paused: false,
    state: function () {
        if (this.watch != null) return S_TRACKING;
        if (this.paused) return S_PAUSED;
        return S_OFF;
    }
};

Array.prototype.clone = function() {
    return this.slice(0);
};

function resetAll () {
    localStorage.clear();
    location.reload();
}

function initNerva (func, L, start = true) {

    NERVA.L = L;
    NERVA.map = L.map('map').fitWorld();
    NERVA.func = func;

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
        if (start) startTracking();
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function startTracking () {
    if (NERVA.watch != null || NERVA.state() === S_TRACKING) {
        console.log("startTracking: already tracking GPS");
    } else {
        if (NERVA.state() !== S_PAUSED) {
            NERVA.gpsData = [];
        }
        NERVA.paused = false;
        NERVA.watch = navigator.geolocation.watchPosition(function (position) {
            console.log("watch: received point "+JSON.stringify(position));
            const datum = gpsDatum(position);
            NERVA.gpsData.push(datum);
            NERVA.func(datum);
        });
        if (typeof NERVA.onStart !== 'undefined' && NERVA.onStart != null) {
            NERVA.onStart();
        }
    }
}

function pauseTracking () {
    navigator.geolocation.clearWatch(NERVA.watch);
    NERVA.watch = null;
    NERVA.paused = true;
    if (typeof NERVA.onPause !== 'undefined' && NERVA.onPause != null) {
        NERVA.onPause();
    }
}

function stopTracking () {
    navigator.geolocation.clearWatch(NERVA.watch);
    NERVA.watch = null;
    NERVA.paused = false;
    if (typeof NERVA.onStop !== 'undefined' && NERVA.onStop != null) {
        NERVA.onStop();
    }
}

function gpsDatum (position) {
    return {
        time: Date.now(),
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
        alt: position.coords.altitude,
        altitudeAccuracy: position.coords.altitudeAccuracy
    };
}

function setView(datum, zoom = 20) {
    NERVA.map.setView([datum.lat, datum.lon], zoom);
}

function addCircle (datum, color = 'red', fillColor = '#f03') {
    NERVA.L.circle([datum.lat, datum.lon], {
        color: color,
        fillColor: fillColor,
        fillOpacity: 0.5,
        radius: 5
    }).addTo(NERVA.map);
}

function showPosition(datum, divId = 'gpsdata') {
    const row = $('<tr></tr>');
    row.append($('<td>Time '+new Date(datum.time)+'</td>'));
    row.append($('<td>Lat '+datum.lat+'</td>'));
    row.append($('<td>Lon '+datum.lon+'</td>'));
    row.append($('<td>Acc '+datum.accuracy+'</td>'));
    row.append($('<td>Alt '+datum.alt+'</td>'));
    row.append($('<td>AltAcc '+datum.altitudeAccuracy+'</td>'));
    $('#'+divId).prepend(row);
    setView(datum);
    addCircle(datum);
}

function generateCSV (data = NERVA.gpsData, divId = 'csvDiv') {
    let csvData = "Time,Lat,Lon,Accuracy,Alt,AltAccuracy\r\n";
    for (let i=0; i < data.length; i++) {
        const datum = data[i];
        csvData = csvData + datum.time + "," + datum.lat+","+datum.lon+","+datum.accuracy+","+datum.altitude+","+datum.altitudeAccuracy+"\r\n";
    }
    const now = Date.now();
    $('#'+divId).html('<a download="nerva_'+now+'.csv" href="data:text/csv;charset=utf-8,'+encodeURIComponent(csvData)+'">download CSV</a>');
}

function dist (a, b) { return Math.sqrt(Math.pow(a.lat - b.lat, 2) + Math.pow(a.lon - b.lon, 2) + Math.pow(a.alt - b.alt, 2)); }

function q3 (array) { return array.length === 0 ? null : array[Math.min(array.length-1, Math.ceil(array.length * 0.75))].dist; }

function q1 (array) { return array.length === 0 ? null : array[Math.floor((array.length-1) * 0.25)].dist; }