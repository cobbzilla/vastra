const MB_TOKEN_KEY = 'MAPBOX_TOKEN';

let NERVA = null;

function resetAll () {
    localStorage.clear();
    location.reload();
}

function initNerva (func, L) {

    NERVA = {
        watch: null,
        mapApiToken: null,
        map: L.map('map').fitWorld(),
        gpsData: [],
        L: L
    };

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
        NERVA.watch = navigator.geolocation.watchPosition(function (position) {
            const datum = gpsDatum(position);
            NERVA.gpsData.push(datum);
            func(datum);
        });
    } else {
        alert("Geolocation is not supported by this browser.");
    }
}

function gpsDatum (position) {
    return {
        time: Date.now(),
        lat: position.coords.latitude,
        lon: position.coords.longitude,
        accuracy: position.coords.accuracy,
        altitude: position.coords.altitude,
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

function generateCSV (data = NERVA.gpsData, divId = 'csvDiv') {
    let csvData = "Time,Lat,Lon,Accuracy,Alt,AltAccuracy\r\n";
    for (let i=0; i < data.length; i++) {
        const datum = data[i];
        csvData = csvData + datum.time + "," + datum.lat+","+datum.lon+","+datum.accuracy+","+datum.altitude+","+datum.altitudeAccuracy+"\r\n";
    }
    const now = Date.now();
    $('#'+divId).html('<a download="nerva_'+now+'.csv" href="data:text/csv;charset=utf-8,'+encodeURIComponent(csvData)+'">download CSV</a>');
}
