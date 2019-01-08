// most of the code here has been adapted from https://github.com/villoren/KalmanLocationManager
// license: https://raw.githubusercontent.com/villoren/KalmanLocationManager/master/LICENCE.txt

// Converts from degrees to radians.
Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
};

// Converts from radians to degrees.
Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
};

const DEG_TO_METER = 111225.0;
const METER_TO_DEG = 1.0 / DEG_TO_METER;

const TIME_STEP = 1.0;
const COORDINATE_NOISE = 4.0 * METER_TO_DEG;
const ALTITUDE_NOISE = 10.0;

const Tracker1D = {
    create: function (timeStep, processNoise) {
        const mt = timeStep;
        const mt2 = mt * mt;
        const mt2d2 = mt2 / 2.0;
        const mt3d2 = mt2 * mt / 2.0;
        const mt4d4 = mt2 * mt2 / 4.0;

        const n2 = processNoise * processNoise;
        const mQa = n2 * mt4d4;
        const mQb = n2 * mt3d2;
        const mQc = mQb;
        const mQd = n2 * mt2;

        const mPa = mQa;
        const mPb = mQb;
        const mPc = mQc;
        const mPd = mQd;

        return {
            // time step
            mt: mt,
            mt2: mt2,
            mt2d2: mt2d2,
            mt3d2: mt3d2,
            mt4d4: mt4d4,

            // Process noise covariance
            mQa: mQa,
            mQb: mQb,
            mQc: mQc,
            mQd: mQd,

            // Estimated state
            mXa: null,
            mXb: null,

            // Estimated covariance
            mPa: mPa,
            mPb: mPb,
            mPc: mPc,
            mPd: mPd,


            /**
             * Reset the filter to the given state.
             * <p>
             * Should be called after creation, unless position and velocity are assumed to be both zero.
             *
             * @param position
             * @param velocity
             * @param noise
             */
            setState: function(position, velocity, noise) {
                // State vector
                this.mXa = position;
                this.mXb = velocity;

                // Covariance
                const n2 = noise * noise;
                this.mPa = n2 * this.mt4d4;
                this.mPb = n2 * this.mt3d2;
                this.mPc = this.mPb;
                this.mPd = n2 * this.mt2;
            },


            /**
             * Update (correct) with the given measurement.
             *
             * @param position
             * @param noise
             */
            update: function(position, noise) {

                const r = noise * noise;

                //  y   =  z   -   H  . x
                const y = position - this.mXa;

                // S = H.P.H' + R
                const s = this.mPa + r;
                const si = 1.0 / s;

                // K = P.H'.S^(-1)
                const Ka = this.mPa * si;
                const Kb = this.mPc * si;

                // x = x + K.y
                this.mXa = this.mXa + Ka * y;
                this.mXb = this.mXb + Kb * y;

                // P = P - K.(H.P)
                const Pa = this.mPa - Ka * this.mPa;
                const Pb = this.mPb - Ka * this.mPb;
                const Pc = this.mPc - Kb * this.mPa;
                const Pd = this.mPd - Kb * this.mPb;

                this.mPa = Pa;
                this.mPb = Pb;
                this.mPc = Pc;
                this.mPd = Pd;
            },


            /**
             * Predict state.
             *
             * @param acceleration Should be 0 unless there's some sort of control input (a gas pedal, for instance).
             */
            predict: function(acceleration) {
                // x = F.x + G.u
                this.mXa = this.mXa + this.mXb * this.mt + acceleration * this.mt2d2;
                this.mXb = this.mXb + acceleration * this.mt;

                // P = F.P.F' + Q
                const Pdt = this.mPd * this.mt;
                const FPFtb = this.mPb + Pdt;
                const FPFta = this.mPa + this.mt * (this.mPc + FPFtb);
                const FPFtc = this.mPc + Pdt;
                const FPFtd = this.mPd;

                this.mPa = FPFta + this.mQa;
                this.mPb = FPFtb + this.mQb;
                this.mPc = FPFtc + this.mQc;
                this.mPd = FPFtd + this.mQd;
            },

            getPosition: function () { return this.mXa; },
            getVelocity: function () { return this.mXb; },
            getAccuracy: function () { return Math.sqrt(mPd / mt2); }
        };
    }
};

const KALMAN = function () {
    return {
        latTracker: null,
        lonTracker: null,
        altTracker: null,
        lastLocation: null,
        predicted: false,
        handleGPS: function (location) {
            NERVA.log('Kalman.handleGPS('+JSON.stringify(location)+') starting');
            // Reusable
            const accuracy = location.accuracy;

            // Latitude
            const lat = location.latitude;
            const latNoise = accuracy * METER_TO_DEG;

            if (this.latTracker == null) {
                this.latTracker = Tracker1D.create(TIME_STEP, COORDINATE_NOISE);
                this.latTracker.setState(lat, 0.0, latNoise);
            }

            if (!this.predicted) this.latTracker.predict(0.0);

            this.latTracker.update(lat, latNoise);

            // Longitude
            const lon = location.longitude;
            const lonNoise = accuracy * Math.cos(Math.radians(lon)) * METER_TO_DEG ;

            if (this.lonTracker == null) {
                this.lonTracker = Tracker1D.create(TIME_STEP, COORDINATE_NOISE);
                this.lonTracker.setState(lon, 0.0, lonNoise);
            }

            if (!this.predicted) this.lonTracker.predict(0.0);

            this.lonTracker.update(lon, lonNoise);

            // Altitude
            if (typeof location.altitude !== 'undefined' && location.altitude != null) {

                const alt = location.altitude;
                const altNoise = accuracy;

                if (this.altTracker == null) {
                    this.altTracker = new Tracker1D.create(TIME_STEP, ALTITUDE_NOISE);
                    this.altTracker.setState(alt, 0.0, altNoise);
                }

                if (!this.predicted) this.altTracker.predict(0.0);

                this.altTracker.update(alt, altNoise);
            }

            // Reset predicted flag
            this.predicted = false;
            this.lastLocation = location;
            NERVA.log('Kalman.handleGPS('+JSON.stringify(location)+') finished OK, predicted now=false');
        },

        location: function () {
            // NERVA.log('Kalman.location() starting');
            this.latTracker.predict(0.0);
            this.lonTracker.predict(0.0);
            if (this.altTracker != null) this.altTracker.predict(0.0);
            const point = {
                time: Date.now(),
                lat:       this.latTracker.getPosition(),
                latitude:  this.latTracker.getPosition(),
                longitude: this.lonTracker.getPosition(),
                lon:       this.lonTracker.getPosition(),
                altitude:  this.lastLocation != null && this.lastLocation.altitude != null && this.altTracker != null ? this.altTracker.getPosition() : null,
                alt:       this.lastLocation != null && this.lastLocation.altitude != null && this.altTracker != null ? this.altTracker.getPosition() : null,
                accuracy:  this.latTracker.getAccuracy() * DEG_TO_METER,
                altitudeAccuracy: null,
                altAccuracy:      null
            };

            this.predicted = true;
            NERVA.log('Kalman.location() returning ' + JSON.stringify(point));
            return point;
        }
    };
};