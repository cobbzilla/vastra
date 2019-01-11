// adapted from https://github.com/inkfood/Gyro_demo
$(function () {
    if (window.DeviceOrientationEvent) {

        window.addEventListener("deviceorientation", function(event) {
            document.getElementById("y").style.webkitTransform = "scaleY("+(Math.round(event.beta))+")";
            document.getElementById("x").style.webkitTransform = "scaleX("+(Math.round(event.gamma))+")";
            document.getElementById("angle").style.webkitTransform = "rotateZ("+(Math.round(event.alpha))+"deg)";
        }, true);

    } else {
        // alert("Sorry, your browser doesn't support Device Orientation");
        console.log("Warning: browser doesn't support Device Orientation, no gyro functions");
    }
});
