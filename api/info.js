const ytdl = require('@distube/ytdl-core');

// Helper to send JSON response
function sendJson(res, statusCode, data) {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data));
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        return res.end();
    }

    if (req.method !== 'POST') {
        return sendJson(res, 405, { error: 'Method not allowed' });
    }

    try {
        const { url } = req.body;

        if (!url) {
            return sendJson(res, 400, { error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return sendJson(res, 400, { error: 'Invalid YouTube URL' });
        }

        // Get video info
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;

        const duration = parseInt(videoDetails.lengthSeconds);

        // Get best thumbnail
        const thumbnails = videoDetails.thumbnails;
        const thumbnail = thumbnails[thumbnails.length - 1]?.url || 
                         thumbnails[0]?.url || '';

        return sendJson(res, 200, {
            videoId: videoDetails.videoId,
            title: videoDetails.title,
            author: videoDetails.author.name,
            duration: duration,
            thumbnail: thumbnail,
            viewCount: videoDetails.viewCount
        });

    } catch (error) {
        console.error('Error fetching video info:', error);

        if (error.message?.includes('Video unavailable')) {
            return sendJson(res, 404, { error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return sendJson(res, 403, { error: 'This video is private' });
        }

        if (error.message?.includes('age')) {
            return sendJson(res, 403, { error: 'Age-restricted videos are not supported' });
        }

        return sendJson(res, 500, { 
            error: 'Failed to fetch video information. Please try again.' 
        });
    }
};
