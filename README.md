# Nerva

Nerva aims to provide privacy-first GPS tracking tools for fitness purposes.

Runners, cyclists and many other athletes enjoy the power of commercial GPS services. But how hard are they really? It's GPS and a map at the end of the day. This is not rocket science. Why are we so comfortable giving our data
to third parties?

## Data Privacy
Nerva is self-hosted and does not send your data to any third party.
Nerva uses MapBox for loading map tiles from OpenStreetMap.
For the truly paranoid, you could host your own map tiles; I'm OK with MapBox knowing which map tiles I load, for now.

## Nerva Tools
Nerva offers two different tools, one low-level and one higher-level.

### Nerva Collect
Nerva Collect is a low-level GPS data collection tool. It is a simple static website that you can host anywhere. If you wondered how easy it could be to put GPS dots on a map, this makes a decent starter kit.

#### MapBox
Upon first load, you'll be asked for your MapBox API key. You can get a free one from MapBox. If you don't enter an API key, the GPS tracking will still work, but you won't see the map.

#### How it works
Nerva Collect tracks your location on a map, and puts a red circle on the map every time it is notified of a change.
 * You can download the data as a CSV at any time.
 * GPS data is only stored in the browser session. You will lose all the data when you reload the page, unless you download it.
 * Only your MapBox key is stored in HTML local storage on your device. You can clear it at any time.

#### Installation

On some webserver that you have access to:

    git clone https://github.com/cobbzilla/nerva.git

After cloning the repo, copy or symlink the `nerva/site` to someplace accessible via your web server.
If you copied `nerva/site` to `<<docroot>>/nerva`, the Nerva Collector can be accessed via `https://yoursite.example.com/nerva/collect.html`

### TODO: Nerva Workout

Nerva Workout will extend Nerva Collect to coalesce raw GPS measurements into digested "virtual locations" by averaging recent values and discarding significant outliers.

Nerva Workout will:
 * Draw a path on the map as you progress through your workout
 * Display speed and elevation information
 * Provide a CSV download of virtual (coalesced) data
 * Allow you to save the workout to a named "routine"
 * View aggregate statistics and pretty charts and graphs for your routines
 * All data will be stored in HTML5 local storage, and can be cleared at any time.
