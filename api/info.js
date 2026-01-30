// Use YouTube oEmbed API for video info (works without any library)
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

        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log('Fetching info for video:', videoId);

        // Use YouTube oEmbed API (no authentication required)
        const oembedUrl = `https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`;
        
        const response = await fetch(oembedUrl);
        
        if (!response.ok) {
            if (response.status === 401 || response.status === 403) {
                return res.status(403).json({ error: 'This video is private or restricted' });
            }
            if (response.status === 404) {
                return res.status(404).json({ error: 'Video not found' });
            }
            throw new Error(`oEmbed API error: ${response.status}`);
        }

        const data = await response.json();

        // Get thumbnail (use high quality)
        const thumbnail = `https://img.youtube.com/vi/${videoId}/maxresdefault.jpg`;

        return res.status(200).json({
            videoId: videoId,
            title: data.title || 'Unknown',
            author: data.author_name || 'Unknown',
            duration: 0, // oEmbed doesn't provide duration
            thumbnail: thumbnail,
            viewCount: '0'
        });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(500).json({ 
            error: 'Failed to fetch video information. Please check the URL and try again.'
        });
    }
};

function extractVideoId(url) {
    if (!url) return null;
    
    const patterns = [
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/,
        /^([a-zA-Z0-9_-]{11})$/
    ];
    
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    
    // Try URL parsing
    try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('v')) {
            return urlObj.searchParams.get('v');
        }
    } catch (e) {}
    
    return null;
}
