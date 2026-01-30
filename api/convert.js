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
        const { url, format = 'mp3', quality = '128' } = req.body || {};

        if (!url) {
            return res.status(400).json({ error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return res.status(400).json({ error: 'Invalid YouTube URL' });
        }

        console.log('Converting:', url, 'to', format);

        // Get video info with agent
        const info = await ytdl.getInfo(url, {
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
        });
        
        const videoDetails = info.videoDetails;
        
        // Sanitize title for filename
        const sanitizedTitle = videoDetails.title
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50) || 'video';

        let selectedFormat = null;
        let filename = '';
        let contentType = '';

        if (format === 'mp3') {
            filename = `${sanitizedTitle}.m4a`;
            contentType = 'audio/mp4';
            
            // Find best audio format
            for (const fmt of info.formats) {
                if (fmt.hasAudio && !fmt.hasVideo && fmt.audioQuality) {
                    if (!selectedFormat || (fmt.audioBitrate && fmt.audioBitrate > (selectedFormat.audioBitrate || 0))) {
                        selectedFormat = fmt;
                    }
                }
            }

            // Fallback
            if (!selectedFormat) {
                selectedFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio', filter: 'audioonly' });
            }
        } else {
            filename = `${sanitizedTitle}.mp4`;
            contentType = 'video/mp4';
            const targetHeight = parseInt(quality) || 720;
            
            // Find best combined format (video + audio in one)
            for (const fmt of info.formats) {
                if (fmt.container === 'mp4' && fmt.hasVideo && fmt.hasAudio) {
                    const fmtHeight = fmt.height || 0;
                    if (fmtHeight <= targetHeight) {
                        if (!selectedFormat || fmtHeight > (selectedFormat.height || 0)) {
                            selectedFormat = fmt;
                        }
                    }
                }
            }

            // Fallback to any combined format
            if (!selectedFormat) {
                for (const fmt of info.formats) {
                    if (fmt.hasVideo && fmt.hasAudio) {
                        if (!selectedFormat || (fmt.height && fmt.height > (selectedFormat.height || 0))) {
                            selectedFormat = fmt;
                        }
                    }
                }
            }
        }

        if (!selectedFormat) {
            console.error('No suitable format found');
            return res.status(500).json({ error: 'No suitable format found for this video' });
        }

        console.log('Using format:', selectedFormat.qualityLabel || selectedFormat.itag);

        // Set response headers
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        if (selectedFormat.contentLength) {
            res.setHeader('Content-Length', selectedFormat.contentLength);
        }

        // Stream the video/audio
        const stream = ytdl(url, { 
            format: selectedFormat,
            requestOptions: {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                }
            }
        });

        stream.on('error', (err) => {
            console.error('Stream error:', err.message);
            if (!res.headersSent) {
                res.status(500).json({ error: 'Stream failed: ' + err.message });
            }
        });

        stream.pipe(res);

    } catch (error) {
        console.error('Error:', error.message);

        if (error.message?.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return res.status(403).json({ error: 'This video is private' });
        }

        if (error.message?.includes('Sign in')) {
            return res.status(403).json({ error: 'This video requires sign-in' });
        }

        if (!res.headersSent) {
            return res.status(500).json({ 
                error: 'Conversion failed. YouTube may be blocking requests. Please try again later.'
            });
        }
    }
};
