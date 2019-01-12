
const COLLECT = {

    init: function () {
        VASTRA.onStart = function (wasPaused) {
            $('#btnStart').hide();
            $('#btnStop').show();
            VASTRA.resetLog();
        };
        VASTRA.onStop = function () {
            $('#btnStart').show();
            $('#btnStop').hide();
        };
        VASTRA.onStart();
        return VASTRA.showDataRow;
    }
};
