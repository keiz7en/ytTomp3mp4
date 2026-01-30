const ytdl = require('@distube/ytdl-core');
const ffmpeg = require('fluent-ffmpeg');
const ffmpegPath = require('ffmpeg-static');
const fs = require('fs');
const path = require('path');
const os = require('os');

// Set FFmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

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
        const { url, format = 'mp3', quality = '128' } = req.body;

        if (!url) {
            return sendJson(res, 400, { error: 'URL is required' });
        }

        // Validate YouTube URL
        if (!ytdl.validateURL(url)) {
            return sendJson(res, 400, { error: 'Invalid YouTube URL' });
        }

        // Get video info for filename
        const info = await ytdl.getInfo(url);
        const videoDetails = info.videoDetails;
        
        // Sanitize title for filename
        const sanitizedTitle = videoDetails.title
            .replace(/[^\w\s-]/g, '')
            .replace(/\s+/g, '_')
            .substring(0, 50);
        const filename = `${sanitizedTitle}.${format}`;

        if (format === 'mp3') {
            // Audio only - MP3 conversion
            const audioBitrate = parseInt(quality) || 128;
            
            // Set response headers
            res.setHeader('Content-Type', 'audio/mpeg');
            res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
            
            // Get audio stream with best audio quality
            const audioStream = ytdl(url, {
                quality: 'highestaudio',
                filter: 'audioonly'
            });

            audioStream.on('error', (err) => {
                console.error('ytdl audio stream error:', err);
                if (!res.headersSent) {
                    sendJson(res, 500, { error: 'Failed to download audio' });
                }
            });

            // Convert to MP3 using FFmpeg
            const ffmpegProcess = ffmpeg(audioStream)
                .audioBitrate(audioBitrate)
                .audioCodec('libmp3lame')
                .format('mp3')
                .on('start', (cmd) => {
                    console.log('FFmpeg started:', cmd);
                })
                .on('error', (err, stdout, stderr) => {
                    console.error('FFmpeg error:', err);
                    if (!res.headersSent) {
                        sendJson(res, 500, { error: 'Conversion failed' });
                    }
                })
                .on('end', () => {
                    console.log('FFmpeg conversion completed');
                });

            ffmpegProcess.pipe(res, { end: true });

        } else {
            // Video - MP4
            const targetHeight = parseInt(quality) || 720;
            
            // First, try to find a combined format (video + audio in one stream)
            // These are more reliable and don't need merging
            let combinedFormat = null;
            for (const fmt of info.formats) {
                if (fmt.container === 'mp4' && fmt.hasVideo && fmt.hasAudio) {
                    const fmtHeight = fmt.height || 0;
                    if (fmtHeight <= targetHeight) {
                        if (!combinedFormat || fmtHeight > (combinedFormat.height || 0)) {
                            combinedFormat = fmt;
                        }
                    }
                }
            }

            // If target is high quality (720p+) and no good combined format, try merging
            if (targetHeight >= 720 && (!combinedFormat || (combinedFormat.height || 0) < 720)) {
                // Find separate video and audio streams
                let videoFormat = null;
                let audioFormat = null;

                for (const fmt of info.formats) {
                    if (fmt.hasVideo && !fmt.hasAudio) {
                        if (fmt.height && fmt.height <= targetHeight) {
                            if (!videoFormat || fmt.height > videoFormat.height) {
                                videoFormat = fmt;
                            }
                        }
                    }
                }

                for (const fmt of info.formats) {
                    if (fmt.hasAudio && !fmt.hasVideo) {
                        if (!audioFormat || (fmt.audioBitrate && fmt.audioBitrate > (audioFormat.audioBitrate || 0))) {
                            audioFormat = fmt;
                        }
                    }
                }

                if (videoFormat && audioFormat) {
                    console.log(`Downloading & merging: video (${videoFormat.qualityLabel || videoFormat.height + 'p'}) + audio (${audioFormat.audioBitrate}kbps)`);
                    
                    // Download to temp files then merge (more reliable than streaming)
                    const tempDir = os.tmpdir();
                    const tempId = Date.now() + '_' + Math.random().toString(36).substr(2, 9);
                    const tempVideo = path.join(tempDir, `yt_v_${tempId}.mp4`);
                    const tempAudio = path.join(tempDir, `yt_a_${tempId}.m4a`);
                    const tempOutput = path.join(tempDir, `yt_o_${tempId}.mp4`);

                    const cleanup = () => {
                        try { fs.unlinkSync(tempVideo); } catch(e) {}
                        try { fs.unlinkSync(tempAudio); } catch(e) {}
                        try { fs.unlinkSync(tempOutput); } catch(e) {}
                    };

                    try {
                        // Download video and audio in parallel
                        console.log('Downloading streams...');
                        await Promise.all([
                            new Promise((resolve, reject) => {
                                const ws = fs.createWriteStream(tempVideo);
                                ytdl(url, { format: videoFormat })
                                    .on('error', reject)
                                    .pipe(ws)
                                    .on('finish', resolve)
                                    .on('error', reject);
                            }),
                            new Promise((resolve, reject) => {
                                const ws = fs.createWriteStream(tempAudio);
                                ytdl(url, { format: audioFormat })
                                    .on('error', reject)
                                    .pipe(ws)
                                    .on('finish', resolve)
                                    .on('error', reject);
                            })
                        ]);

                        // Merge with FFmpeg
                        console.log('Merging...');
                        await new Promise((resolve, reject) => {
                            ffmpeg()
                                .input(tempVideo)
                                .input(tempAudio)
                                .outputOptions(['-c:v copy', '-c:a aac', '-b:a 192k', '-movflags +faststart'])
                                .output(tempOutput)
                                .on('end', resolve)
                                .on('error', reject)
                                .run();
                        });

                        // Send file
                        console.log('Sending merged file...');
                        res.setHeader('Content-Type', 'video/mp4');
                        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                        
                        const stat = fs.statSync(tempOutput);
                        res.setHeader('Content-Length', stat.size);
                        
                        const readStream = fs.createReadStream(tempOutput);
                        readStream.pipe(res);
                        readStream.on('close', cleanup);
                        
                        return;

                    } catch (err) {
                        console.error('Merge error:', err);
                        cleanup();
                        // Fall through to combined format
                    }
                }
            }

            // Use combined format (either found or as fallback)
            if (!combinedFormat) {
                // Get any combined format
                for (const fmt of info.formats) {
                    if (fmt.container === 'mp4' && fmt.hasVideo && fmt.hasAudio) {
                        if (!combinedFormat || (fmt.height && fmt.height > (combinedFormat.height || 0))) {
                            combinedFormat = fmt;
                        }
                    }
                }
            }

            if (combinedFormat) {
                console.log('Using combined format:', combinedFormat.qualityLabel || combinedFormat.height + 'p');
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                const videoStream = ytdl(url, { format: combinedFormat });
                videoStream.on('error', (err) => {
                    console.error('ytdl error:', err);
                    if (!res.headersSent) {
                        sendJson(res, 500, { error: 'Failed to download video' });
                    }
                });
                videoStream.pipe(res, { end: true });
            } else {
                // Last resort: just download highest quality available
                console.log('Using highest available quality');
                res.setHeader('Content-Type', 'video/mp4');
                res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
                
                const videoStream = ytdl(url, { quality: 'highest' });
                videoStream.on('error', (err) => {
                    console.error('ytdl error:', err);
                    if (!res.headersSent) {
                        sendJson(res, 500, { error: 'Failed to download video' });
                    }
                });
                videoStream.pipe(res, { end: true });
            }
        }

    } catch (error) {
        console.error('Error converting video:', error);

        if (error.message?.includes('Video unavailable')) {
            return sendJson(res, 404, { error: 'Video not found or unavailable' });
        }

        if (error.message?.includes('Private video')) {
            return sendJson(res, 403, { error: 'This video is private' });
        }

        if (!res.headersSent) {
            return sendJson(res, 500, { 
                error: 'Failed to convert video. Please try again.' 
            });
        }
    }
};
