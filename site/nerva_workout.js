const NEAR_DISTANCE = 0.0001;
const V_INITIALIZING = "init";
const V_TRACKING = "tracking";
const MIN_ACCEPTABLE_FOR_INIT = 5;
const MAX_ACCEPTABLE_EPSILON = 1e-12;

function initWorkout () {
    NERVA.vdata = [ newVPoint() ];
    NERVA.vstate = function () {
        if (NERVA.vdata.length === 1 && NERVA.vdata[0].acceptable() < MIN_ACCEPTABLE_FOR_INIT) return V_INITIALIZING;
        return V_TRACKING;
    };
    NERVA.onStart = function () {
        $('#btnStart').hide();
        $('#btnPause').show();
        $('#btnStop').show();
    };
    NERVA.onPause = function () {
        $('#btnStart').show();
        $('#btnPause').hide();
        $('#btnStop').show();
    };
    NERVA.onStop = function () {
        $('#btnStart').show();
        $('#btnPause').hide();
        $('#btnStop').hide();
    };
    NERVA.onStop();
}

function viewWorkouts () { /* todo */ }

function updateVirtualPoint(datum) {
    const currentPoint = NERVA.vdata[NERVA.vdata.length-1];
    const vstate = NERVA.vstate();
    const acceptable = currentPoint.acceptable();
    if (vstate === V_INITIALIZING || acceptable.length === 0 || (currentPoint.isNear(datum) && acceptable.length < 10)) {
        currentPoint.add(datum);
        if (vstate !== V_INITIALIZING && NERVA.vdata.length === 1) {
            setView(datum);
        }

    } else {
        let v = currentPoint.vpoint();
        showPosition(v);
        NERVA.vdata.push( newVPoint().add(datum) );
        console.log("defined new vpoint: "+JSON.stringify(v));
    }
}

function newVPoint() {
    return {
        points: [],

        count: function () { return this.points.length; },

        add: function (point) {
            console.log("accumulating point #"+(this.count()+1)+": "+JSON.stringify(point));
            this.points.push(point);
            if (this.min.time == null) this.min.time = point.time;
            if (this.min.lat == null || point.lat < this.min.lat) this.min.lat = point.lat;
            if (this.min.lon == null || point.lon < this.min.lon) this.min.lon = point.lon;
            if (this.min.alt == null || point.alt < this.min.alt) this.min.alt = point.alt;

            this.max.time = point.time;
            if (this.max.lat == null || point.lat > this.max.lat) this.max.lat = point.lat;
            if (this.max.lon == null || point.lon > this.max.lon) this.max.lon = point.lon;
            if (this.max.alt == null || point.alt > this.max.alt) this.max.alt = point.alt;

            return this;
        },

        min: {
            time: null,
            lat: null,
            lon: null,
            alt: null
        },
        max: {
            time: null,
            lat: null,
            lon: null,
            alt: null
        },

        vpoint: function () {

            let count = this.count();
            if (count === 0) return null;           // no points, no vpoint
            if (count === 1) return this.points[0]; // only 1 point, that is our vpoint

            // which points are acceptable (close enough to mean)?
            let acceptable = this.acceptable();

            // if none are acceptable, we have no vpoint
            if (acceptable.length === 0) return null;

            // return average of acceptable points
            return this.mean(acceptable);
        },

        acceptable: function () {
            if (this.points.length === 0) return [];
            if (this.points.length === 1) return [ this.points[0] ];

            // find mean lat/lon/alt
            let mean = this.mean();

            // calculate distances from mean
            for (let i=0; i<this.points.length; i++) {
                this.points[i].dist = dist(this.points[i], mean);
            }

            // order points by nearness to median
            let sorted = this.points.clone();
            sorted.sort(function (a, b) { return a.dist - b.dist; });

            // boundaries of the median quartiles form the basis of the acceptable range, then multiply by 1.5
            let acceptableRange = (q3(sorted) - q1(sorted)) * 1.5;

            // only consider points within the acceptable range
            let acceptable = [];
            for (let i=0; i<this.points.length; i++) {
                if (acceptableRange - this.points[i].dist < MAX_ACCEPTABLE_EPSILON) {
                    acceptable.push(this.points[i]);
                }
            }

            return acceptable;
        },

        mean: function (points = this.points) {
            let total = {
                lat: 0.0,
                lon: 0.0,
                alt: 0.0
            };
            let minTime = Infinity;
            let maxTime = -Infinity;
            for (let i=0; i<points.length; i++) {
                let point = points[i];
                total.lat += point.lat;
                total.lon += point.lon;
                total.alt += point.alt;
                if (point.time < minTime) minTime = point.time;
                if (point.time > maxTime) maxTime = point.time;
            }
            return {
                lat: total.lat / points.length,
                lon: total.lon / points.length,
                alt: total.alt / points.length,
                time: (maxTime + minTime) / 2.0,
                from: minTime,
                to: maxTime
            };
        },

        isNear: function (other) {
            return dist(this.vpoint(), other) < NEAR_DISTANCE;
        }
    };
}
