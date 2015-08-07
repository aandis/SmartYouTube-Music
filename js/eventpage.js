var LONG_VIDEO_DURATION = 1200; // 20 minutes

var watchedIds = {},
    currRelated;

chrome.webRequest.onSendHeaders.addListener(function(callback) {
    if (callback.url.indexOf("https://s.youtube.com/api/stats/playback?ns") > -1) {
        var params = getQueryParams(callback.url);
        var currVideoId = params.docid;

        getVideosDuration(currVideoId, function(durationData) {
            var duration = convertISO8601(durationData.items[0].contentDetails.duration);
            if (duration > LONG_VIDEO_DURATION) {
                if (params.hasOwnProperty("autonav") && params.autonav == "1" && params.hasOwnProperty("autoplay") && params.autoplay == "1" && typeof currRelated !== 'undefined') {
                    chrome.tabs.update(callback.tabId, {
                        url: "https://www.youtube.com/watch?v=" + currRelated
                    });
                }
            } else {
                // Set a timeout so that successive nexts are not considered listened.
                setTimeout(function() {
                    chrome.tabs.get(callback.tabId, function callback(tab) {
                        // Get the video id of the current video being played.
                        var videoId = getQueryParams(tab.url).v;
                        if (videoId === currVideoId) {
                            // Song is streamed for 20sec. Consider it to be listened.
                            watchedIds[currVideoId] = true;
                            getRelatedVideos(currVideoId, filterRelated);
                        }
                    });
                }, 10000);
            }
        });
    }
}, {
    "urls": ["*://*/*"]
}, ["requestHeaders"]);

function getQueryParams(url) {
    var link = document.createElement('a');
    link.href = url;

    var match,
        pl = /\+/g, // Regex for replacing addition symbol with a space
        search = /([^&=]+)=?([^&]*)/g,
        decode = function(s) {
            return decodeURIComponent(s.replace(pl, " "));
        },
        query = link.search.substring(1);

    urlParams = {};
    while (match = search.exec(query))
        urlParams[decode(match[1])] = decode(match[2]);
    return urlParams;
}

function sleepFor(sleepDuration) {
    var now = new Date().getTime();
    while (new Date().getTime() < now + sleepDuration) { /* do nothing */ }
}

function convertISO8601(duration) {
    var reptms = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/;
    var hours = 0,
        minutes = 0,
        seconds = 0,
        totalseconds;

    if (reptms.test(duration)) {
        var matches = reptms.exec(duration);
        if (matches[1]) hours = Number(matches[1]);
        if (matches[2]) minutes = Number(matches[2]);
        if (matches[3]) seconds = Number(matches[3]);
        totalseconds = hours * 3600 + minutes * 60 + seconds;
    }
    return totalseconds;
}

function filterRelated(data) {
    var relatedVideoIdStr = "";
    var results = data.items;
    for (var i = 0; i < results.length; i++) {
        relatedVideoIdStr += results[i].id.videoId;
        if (i != results.length - 1) {
            relatedVideoIdStr += ",";
        }
    };
    getVideosDuration(relatedVideoIdStr, function(durationData) {
        results = durationData.items;
        for (var i = 0; i < results.length; i++) {
            var relatedVideoId = results[i].id;
            var duration = convertISO8601(results[i].contentDetails.duration);
            if (!(relatedVideoId in watchedIds) && duration < LONG_VIDEO_DURATION) {
                currRelated = relatedVideoId;
                console.log(currRelated);
                break;
            }
        };
    });
}

function getVideosDuration(videoIds, callback) {
    $.ajax({
        url: "https://www.googleapis.com/youtube/v3/videos",
        data: {
            "part": "contentDetails",
            "id": videoIds,
            "key": "AIzaSyB_6XGZ5pNjHyhSlWbsOj3P-SboZCYY6H0"
        },
        success: function(data) {
            callback(data);
        }
    });
}

function getRelatedVideos(videoId, callback) {
    $.ajax({
        url: "https://www.googleapis.com/youtube/v3/search",
        data: {
            "part": "snippet",
            "relatedToVideoId": videoId,
            "maxResults": 50,
            "videoDuration": "medium",
            "type": "video",
            "key": "AIzaSyB_6XGZ5pNjHyhSlWbsOj3P-SboZCYY6H0"
        },
        success: function(data) {
            callback(data);
        }
    });
}
