const ytdl = require('@distube/ytdl-core');

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
        const { url, format = 'mp3', quality = '128' } = body;

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
        
        // Sanitize title for filename
        const sanitizedTitle = videoDetails.title
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);

        if (format === 'mp3') {
            // Audio download - get best audio format
            const filename = `${sanitizedTitle}.mp3`;
            
            // Find best audio format
            let audioFormat = null;
            for (const fmt of info.formats) {
                if (fmt.hasAudio && !fmt.hasVideo) {
                    if (!audioFormat || (fmt.audioBitrate && fmt.audioBitrate > (audioFormat.audioBitrate || 0))) {
                        audioFormat = fmt;
                    }
                }
            }

            if (!audioFormat) {
                // Fallback to any format with audio
                audioFormat = ytdl.chooseFormat(info.formats, { quality: 'highestaudio' });
            }

            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Stream directly
            const stream = ytdl(url, { format: audioFormat });
            stream.pipe(res);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            });

        } else {
            // Video download - MP4
            const filename = `${sanitizedTitle}.mp4`;
            const targetHeight = parseInt(quality) || 720;
            
            // Find best combined format (video + audio)
            let selectedFormat = null;
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

            if (!selectedFormat) {
                return res.status(500).json({ error: 'No suitable video format found' });
            }

            console.log('Using format:', selectedFormat.qualityLabel || selectedFormat.height + 'p');

            res.setHeader('Content-Type', 'video/mp4');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Stream directly
            const stream = ytdl(url, { format: selectedFormat });
            stream.pipe(res);
            
            stream.on('error', (err) => {
                console.error('Stream error:', err);
                if (!res.headersSent) {
                    res.status(500).json({ error: 'Download failed' });
                }
            });
        }

    } catch (error) {
        console.error('Error:', error);

        if (error.message?.includes('Video unavailable')) {
            return res.status(404).json({ error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return res.status(403).json({ error: 'This video is private' });
        }

        if (!res.headersSent) {
            return res.status(500).json({ 
                error: 'Failed to convert video. Please try again.' 
            });
        }
    }
};
