# YT to MP3/MP4 Converter

A simple YouTube to MP3/MP4 converter web application optimized for Vercel deployment.

## Features

- 🎵 Convert YouTube videos to MP3 (audio)
- 🎬 Convert YouTube videos to MP4 (video)
- 📊 Multiple quality options
- 📱 Responsive design
- ⚡ Fast serverless processing
- 🔒 No files stored permanently

## Tech Stack

- **Frontend**: HTML, CSS, JavaScript (Vanilla)
- **Backend**: Node.js (Vercel Serverless Functions)
- **Media**: FFmpeg + ytdl-core

## Project Structure

```
ytTomp3mp4/
├── api/
│   ├── info.js      # Get video information
│   └── convert.js   # Convert and stream media
├── public/
│   ├── index.html   # Main page
│   ├── style.css    # Styles
│   └── app.js       # Frontend logic
├── package.json
├── vercel.json      # Vercel configuration
└── README.md
```

## Local Development

1. Install dependencies:
```bash
npm install
```

2. Install Vercel CLI:
```bash
npm install -g vercel
```

3. Run development server:
```bash
vercel dev
```

4. Open `http://localhost:3000`

## Deployment to Vercel

1. Install Vercel CLI (if not installed):
```bash
npm install -g vercel
```

2. Login to Vercel:
```bash
vercel login
```

3. Deploy:
```bash
vercel --prod
```

## API Endpoints

### `POST /api/info`
Fetch video information.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

**Response:**
```json
{
  "videoId": "VIDEO_ID",
  "title": "Video Title",
  "author": "Channel Name",
  "duration": 180,
  "thumbnail": "https://..."
}
```

### `POST /api/convert`
Convert and download media.

**Request Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "format": "mp3",
  "quality": "320"
}
```

**Response:** Binary stream of the converted file.

## Limitations

- Maximum video duration: 30 minutes
- Vercel function timeout: 60 seconds (Pro plan)
- Some videos may not be available due to restrictions

## Disclaimer

⚠️ This tool is for **personal use only**. Please respect copyright laws and YouTube's Terms of Service. Do not use this to download copyrighted content without permission.

## License

MIT
