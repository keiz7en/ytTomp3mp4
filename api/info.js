const ytdl = require('@distube/ytdl-core');

module.exports = async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const { url } = req.body || {};

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log('Fetching info for:', url);

        // Get video info with agent
        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
        });
        
        const videoDetails = info.videoDetails;
        const duration = parseInt(videoDetails.lengthSeconds) || 0;

        // Get best thumbnail
        const thumbnails = videoDetails.thumbnails || [];
        const thumbnail = thumbnails[thumbnails.length - 1]?.url || 
                         thumbnails[0]?.url || 
                         `https://img.youtube.com/vi/${videoDetails.videoId}/maxresdefault.jpg`;

        console.log('Got info for:', videoDetails.title);

        return res.status(200).json({
            videoId: videoDetails.videoId,
            title: videoDetails.title,
            author: videoDetails.author?.name || 'Unknown',
            duration: duration,
            thumbnail: thumbnail,
            viewCount: videoDetails.viewCount || '0'
        });

    } catch (error) {
        console.error('Error fetching video info:', error.message);

        if (error.message?.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return res.status(403).json({ error: 'This video is private' });
        }

        if (error.message?.includes('age')) {
            return res.status(403).json({ error: 'Age-restricted videos are not supported' });
        }

        if (error.message?.includes('Sign in')) {
            return res.status(403).json({ error: 'This video requires sign-in' });
        }

        return res.status(500).json({ 
            error: 'Failed to fetch video information. YouTube may be blocking requests. Please try again later.'
        });
    }
};
