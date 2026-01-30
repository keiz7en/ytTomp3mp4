// Convert endpoint - generates external service URLs
// Direct YouTube downloads don't work on Vercel due to IP blocking
// So we redirect users to trusted converter services
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
        const { url, format } = req.body || {};

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Extract video ID
        const videoId = extractVideoId(url);
        if (!videoId) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log('Processing:', { videoId, format });

        // Generate multiple converter service links
        // These are well-known, reliable YouTube converter services
        const services = [];
        
        if (format === 'mp3') {
            services.push(
                {
                    name: 'Y2Mate',
                    url: `https://www.y2mate.com/youtube-mp3/${videoId}`,
                    instructions: 'Click "Convert" then "Download"'
                },
                {
                    name: 'YTMP3',
                    url: `https://ytmp3.cc/youtube-to-mp3/?url=https://www.youtube.com/watch?v=${videoId}`,
                    instructions: 'Click "Convert" then "Download"'
                },
                {
                    name: 'SaveFrom',
                    url: `https://en.savefrom.net/391GA/#url=https://www.youtube.com/watch?v=${videoId}`,
                    instructions: 'Select MP3 format and download'
                }
            );
        } else {
            services.push(
                {
                    name: 'Y2Mate',
                    url: `https://www.y2mate.com/youtube/${videoId}`,
                    instructions: 'Select quality and click "Download"'
                },
                {
                    name: 'SaveFrom',
                    url: `https://en.savefrom.net/391GA/#url=https://www.youtube.com/watch?v=${videoId}`,
                    instructions: 'Select MP4 quality and download'
                },
                {
                    name: 'SSYouTube',
                    url: `https://ssyoutube.com/watch?v=${videoId}`,
                    instructions: 'Select format and download'
                }
            );
        }

        return res.status(200).json({
            success: true,
            videoId: videoId,
            format: format,
            services: services,
            message: 'Choose a converter service below'
        });

    } catch (error) {
        console.error('Error:', error.message);
        return res.status(500).json({ 
            error: 'Failed to process. Please try again.'
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
