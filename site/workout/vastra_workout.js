const KALMAN_SAMPLING_MILLIS = 2000;
const KALMAN_SAMPLING_MIN_POINTS = 4;

const WORKOUT = {
    vdata: [],
    kalman: null,
    kalmanInterval: null,
    orientationListener: null,
    lastAcceleration: null,
    acceleration: function () { return this.lastAcceleration != null ? this.lastAcceleration : ZERO_GPS; },

    startUpdates: function () {
        WORKOUT.kalman = KALMAN();
        if (WORKOUT.kalmanInterval == null) {
            WORKOUT.kalmanInterval = window.setInterval(this.sampleKalmanPoint, KALMAN_SAMPLING_MILLIS);
        }
        if (WORKOUT.orientationListener == null) {
            WORKOUT.orientationListener = window.addEventListener("deviceorientation", function(event) {
                // divide by 1000 to change from m/s^2 to km/s^2
                this.lastAcceleration = {
                    lon: 0,//event.acceleration.x/1000.0,
                    lat: 0,//event.acceleration.y/1000.0,
                    alt: 0//event.acceleration.z/1000.0
                };
                console.log('accel='+JSON.stringify(this.lastAcceleration));
            }, true);
        }
    },

    stopUpdates: function () {
        if (WORKOUT.kalmanInterval != null) {
            window.clearInterval(WORKOUT.kalmanInterval);
            WORKOUT.kalmanInterval = null;
        }
        if (WORKOUT.orientationListener != null) {
            window.removeEventListener("deviceorientation", WORKOUT.orientationListener);
            WORKOUT.orientationListener = null;
        }
        WORKOUT.kalman = null;
    },

    handleGPS: function (loc, acceleration) {
        if (WORKOUT.kalman != null) WORKOUT.kalman.handleGPS(loc, acceleration);
        $('#gps_stats').html('GPS net_dist='+dist(VASTRA.origPosition, loc)+'m, incr_dist='+dist(loc.lastPosition, loc)+'m, speed='+speed(loc.lastPosition, loc)+'m/s');
        // VASTRA.log('defined new gpoint: ('+loc.distance+') ' + logPoint(loc));
    },

    init: function () {
        VASTRA.onStart = function (wasPaused) {
            $('#btnStart').hide();
            $('#btnPause').show();
            $('#btnStop').show();
            if (!wasPaused) WORKOUT.vdata = [];
            VASTRA.resetLog();
            WORKOUT.startUpdates();
        };
        VASTRA.onPause = function () {
            $('#btnStart').show();
            $('#btnPause').hide();
            $('#btnStop').show();
            WORKOUT.stopUpdates();
        };
        VASTRA.onStop = function () {
            $('#btnStart').show();
            $('#btnPause').hide();
            $('#btnStop').hide();
            WORKOUT.stopUpdates();
        };
        VASTRA.onStop();
        return WORKOUT.handleGPS;
    },

    sampleKalmanPoint: function () {
        if (WORKOUT.kalman == null) {
            VASTRA.log('sampleKalmanPoint: kalman was null');

        } else if (WORKOUT.kalman.numPoints() >= KALMAN_SAMPLING_MIN_POINTS) {
            const datum = WORKOUT.kalman.location(WORKOUT.acceleration());
            VASTRA.showDataRow(datum);
            WORKOUT.vdata.push(datum);
            // VASTRA.log('defined new vpoint: ' + logPoint(datum));
            $('#kalman_stats').html('kalman net_dist='+dist(WORKOUT.kalman.firstEstimate, datum)+'m, incr_dist='+dist(datum.prevEstimate, datum)+'m, speed='+speed(datum.prevEstimate, datum)+'m/s');
            return VASTRA.showPosition(datum);
        }
    }
};
