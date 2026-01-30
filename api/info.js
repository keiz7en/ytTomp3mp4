const ytdl = require('@distube/ytdl-core');

// Helper to send JSON response
function sendJson(res, statusCode, data) {
    res.setHeader('Content-Type', 'application/json');
    res.status(statusCode).json(data);
}

// Parse body helper
async function parseBody(req) {
    if (req.body) return req.body;
    return new Promise((resolve) => {
        let body = '';
        req.on('data', chunk => body += chunk);
        req.on('end', () => {
            try {
                resolve(JSON.parse(body));
            } catch (e) {
                resolve({});
            }
        });
    });
}

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const body = await parseBody(req);
        const { url } = body;

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        // Get video info
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;

        const duration = parseInt(videoDetails.lengthSeconds);

        // Get best thumbnail
        const thumbnails = videoDetails.thumbnails;
        const thumbnail = thumbnails[thumbnails.length - 1]?.url || 
                         thumbnails[0]?.url || '';

        return res.status(200).json({
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
            return res.status(404).json({ error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return res.status(403).json({ error: 'This video is private' });
        }

        if (error.message?.includes('age')) {
            return res.status(403).json({ error: 'Age-restricted videos are not supported' });
        }

        return res.status(500).json({ 
            error: 'Failed to fetch video information. Please try again.' 
        });
    }
};
