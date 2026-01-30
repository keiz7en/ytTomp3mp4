// Convert endpoint - returns download URLs
// Uses cobalt.tools API for YouTube downloads (free, no auth required)
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
        const { url, format, quality } = req.body || {};

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        const youtubeUrl = `https://www.youtube.com/watch?v=${videoId}`;

        console.log('Converting:', { videoId, format, quality });

        // Use cobalt.tools API
        const cobaltResponse = await fetch('https://api.cobalt.tools/api/json', {
            method: 'POST',
            headers: {
                'Accept': 'application/json',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                url: youtubeUrl,
                vCodec: 'h264',
                vQuality: quality === '1080p' ? '1080' : quality === '720p' ? '720' : quality === '480p' ? '480' : '720',
                aFormat: 'mp3',
                isAudioOnly: format === 'mp3',
                filenamePattern: 'basic',
            })
        });

        const data = await cobaltResponse.json();

        if (data.status === 'error') {
            console.error('Cobalt error:', data);
            return res.status(400).json({ error: data.text || 'Failed to process video' });
        }

        if (data.status === 'stream' || data.status === 'redirect') {
            return res.status(200).json({
                success: true,
                downloadUrl: data.url,
                filename: `video.${format === 'mp3' ? 'mp3' : 'mp4'}`
            });
        }

        if (data.status === 'picker' && data.picker && data.picker.length > 0) {
            // Multiple options available, return the first one
            return res.status(200).json({
                success: true,
                downloadUrl: data.picker[0].url,
                filename: `video.${format === 'mp3' ? 'mp3' : 'mp4'}`
            });
        }

        // Fallback error
        console.error('Unexpected response:', data);
        return res.status(500).json({ error: 'Could not generate download link' });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(500).json({ 
            error: 'Failed to convert video. Please try again.'
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
    
    try {
        const urlObj = new URL(url);
        if (urlObj.searchParams.has('v')) {
            return urlObj.searchParams.get('v');
        }
    } catch (e) {}
    
    return null;
}
