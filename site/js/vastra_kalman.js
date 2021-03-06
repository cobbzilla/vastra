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
    create: function (name, timeStep, processNoise) {
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
            name: name,
            accuracyValues: [],

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
                if (position.accuracy != null) this.accuracyValues.push(position.accuracy);

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
            getVelocity: function () { return typeof this.mXb === 'undefined' || this.mXb == null ? 0.0 : this.mXb; },
            defaultAccuracy: function () { return 20; },
            getAccuracy: function () {
                if (this.accuracyValues.length === 0) return this.defaultAccuracy();
                VASTRA.log('getAccuracy: vals='+JSON.stringify(this.accuracyValues));
                let sum = 0.0;
                for (let i=0; i<this.accuracyValues.length; i++) sum += this.accuracyValues[i];
                return 1 + Math.floor(sum / this.accuracyValues.length);
            }
        };
    }
};

const ZERO_GPS = {
    lat: 0,
    lon: 0,
    alt: 0
};

const KALMAN = function () {
    return {
        latTracker: null,
        lonTracker: null,
        altTracker: null,
        lastLocation: null,
        firstEstimate: null,
        lastEstimate: null,

        predicted: false,
        points: [],
        numPoints: function () { return this.points.length; },

        handleGPS: function (location, accelerationFunc) {
            // VASTRA.log('Kalman.handleGPS('+JSON.stringify(location)+') starting');
            // Reusable
            const accuracy = location.accuracy;

            // todo: consider dropping if accuracy is very poor?

            // add point
            this.points.push(location);

            // Latitude
            const lat = location.latitude;
            const latNoise = accuracy * METER_TO_DEG;

            if (this.latTracker == null) {
                this.latTracker = Tracker1D.create('lat', TIME_STEP, COORDINATE_NOISE);
                this.latTracker.setState(lat, this.latTracker.getVelocity(), latNoise);
            }

            if (!this.predicted) this.latTracker.predict(accelerationFunc().lat);

            this.latTracker.update(lat, latNoise);

            // Longitude
            const lon = location.longitude;
            const lonNoise = accuracy * Math.cos(Math.radians(lon)) * METER_TO_DEG ;

            if (this.lonTracker == null) {
                this.lonTracker = Tracker1D.create('lon', TIME_STEP, COORDINATE_NOISE);
                this.lonTracker.setState(lon, this.lonTracker.getVelocity(), lonNoise);
            }

            if (!this.predicted) this.lonTracker.predict(accelerationFunc().lon);

            this.lonTracker.update(lon, lonNoise);

            // Altitude
            if (typeof location.altitude !== 'undefined' && location.altitude != null) {

                const alt = location.altitude;
                const altNoise = accuracy;

                if (this.altTracker == null) {
                    this.altTracker = new Tracker1D.create('alt', TIME_STEP, ALTITUDE_NOISE);
                    this.altTracker.setState(alt, this.altTracker.getVelocity(), altNoise);
                }

                if (!this.predicted) this.altTracker.predict(accelerationFunc().alt);

                this.altTracker.update(alt, altNoise);
            }

            // Reset predicted flag
            this.predicted = false;
            this.lastLocation = location;
            // VASTRA.log('Kalman.handleGPS('+JSON.stringify(location)+') finished OK, predicted now=false');
        },

        location: function (acceleration = ZERO_GPS) {
            // VASTRA.log('Kalman.location() starting');
            this.latTracker.predict(acceleration.lat);
            this.lonTracker.predict(acceleration.lon);
            if (this.altTracker != null) this.altTracker.predict(acceleration.alt);
            const point = {
                time: Date.now(),
                lat:       this.latTracker.getPosition(),
                latitude:  this.latTracker.getPosition(),
                longitude: this.lonTracker.getPosition(),
                lon:       this.lonTracker.getPosition(),
                altitude:  this.lastLocation != null && this.lastLocation.altitude != null && this.altTracker != null ? this.altTracker.getPosition() : null,
                alt:       this.lastLocation != null && this.lastLocation.altitude != null && this.altTracker != null ? this.altTracker.getPosition() : null,
                accuracy:  this.latTracker.getAccuracy(),
                altitudeAccuracy: null,
                altAccuracy:      null,
                points: this.points,
                prevEstimate: this.lastEstimate
            };
            point.distance = dist(point.prevEstimate, point);
            point.speed = speed(point.prevEstimate, point);

            // reset state
            this.predicted = true;
            this.points = [];
            // VASTRA.log('Kalman.location() returning ' + logPoint(point));
            this.lastEstimate = point;
            if (this.firstEstimate == null) this.firstEstimate = point;
            return point;
        }
    };
};