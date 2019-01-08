const KALMAN_SAMPLING_MILLIS = 8000;

const WORKOUT = {
    vdata: [],
    kalman: null,
    kalmanInterval: null,

    startUpdates: function () {
        WORKOUT.kalman = KALMAN();
        if (WORKOUT.kalmanInterval == null) {
            WORKOUT.kalmanInterval = window.setInterval(this.sampleKalmanPoint, KALMAN_SAMPLING_MILLIS);
        }
    },

    stopUpdates: function () {
        if (WORKOUT.kalmanInterval != null) {
            window.clearInterval(WORKOUT.kalmanInterval);
            WORKOUT.kalmanInterval = null;
        }
        WORKOUT.kalman = null;
    },

    handleGPS: function (loc) { return WORKOUT.kalman == null ? null : WORKOUT.kalman.handleGPS(loc); },

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
        } else {
            const datum = WORKOUT.kalman.location();
            VASTRA.showDataRow(datum);
            WORKOUT.vdata.push(datum);
            VASTRA.log('defined new vpoint: ' + JSON.stringify(datum));
            return VASTRA.showPosition(datum);
        }
    }
};

