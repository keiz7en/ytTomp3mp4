// Convert endpoint - redirect to external download service
// Since YouTube download APIs require self-hosting, we redirect to a trusted service
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

        console.log('Converting:', { videoId, format, quality });

        // Use loader.to service (free, no API key required)
        // This is a redirect-based approach
        const youtubeUrl = encodeURIComponent(`https://www.youtube.com/watch?v=${videoId}`);
        
        let downloadUrl;
        if (format === 'mp3') {
            // For MP3 audio
            downloadUrl = `https://loader.to/ajax/download.php?format=mp3&url=${youtubeUrl}`;
        } else {
            // For MP4 video - map quality
            const qualityMap = {
                '1080': '1080',
                '720': '720', 
                '480': '480',
                '360': '360'
            };
            const videoQuality = qualityMap[quality] || '720';
            downloadUrl = `https://loader.to/ajax/download.php?format=${videoQuality}&url=${youtubeUrl}`;
        }

        // Fetch the download info from loader.to
        const response = await fetch(downloadUrl, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
                'Accept': 'application/json',
            }
        });

        const data = await response.json();

        if (data.success && data.download_url) {
            return res.status(200).json({
                success: true,
                downloadUrl: data.download_url,
                filename: `video.${format === 'mp3' ? 'mp3' : 'mp4'}`
            });
        }

        // If loader.to doesn't work, provide alternative service links
        // These are well-known YouTube converter services
        const alternativeUrl = format === 'mp3' 
            ? `https://www.y2mate.com/youtube-mp3/${videoId}`
            : `https://www.y2mate.com/youtube/${videoId}`;

        return res.status(200).json({
            success: true,
            redirect: true,
            downloadUrl: alternativeUrl,
            message: 'Click the download button to get your file'
        });

    } catch (error) {
        console.error('Error:', error.message);
        
        // Fallback - return a link to a conversion service
        const videoId = extractVideoId(req.body?.url);
        if (videoId) {
            const format = req.body?.format || 'mp4';
            const fallbackUrl = format === 'mp3'
                ? `https://www.y2mate.com/youtube-mp3/${videoId}`
                : `https://www.y2mate.com/youtube/${videoId}`;
            
            return res.status(200).json({
                success: true,
                redirect: true,
                downloadUrl: fallbackUrl,
                message: 'Click to download from external service'
            });
        }
        
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
