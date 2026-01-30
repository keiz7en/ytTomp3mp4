// DOM Elements
const urlInput = document.getElementById('url-input');
const fetchBtn = document.getElementById('fetch-btn');
const urlError = document.getElementById('url-error');
const videoInfo = document.getElementById('video-info');
const videoThumbnail = document.getElementById('video-thumbnail');
const videoTitle = document.getElementById('video-title');
const videoDuration = document.getElementById('video-duration');
const videoAuthor = document.getElementById('video-author');
const formatSection = document.getElementById('format-section');
const formatBtns = document.querySelectorAll('.format-btn');
const qualitySelect = document.getElementById('quality-select');
const convertBtn = document.getElementById('convert-btn');
const progressSection = document.getElementById('progress-section');
const progressFill = document.getElementById('progress-fill');
const progressText = document.getElementById('progress-text');
const downloadSection = document.getElementById('download-section');
const servicesList = document.getElementById('services-list');
const convertAnother = document.getElementById('convert-another');
const errorSection = document.getElementById('error-section');
const errorMessage = document.getElementById('error-message');
const tryAgain = document.getElementById('try-again');

// State
let currentVideoInfo = null;
let selectedFormat = 'mp3';

// Quality options
const qualityOptions = {
    mp3: [
        { value: '320', label: '320 kbps (Best)' },
        { value: '256', label: '256 kbps (High)' },
        { value: '192', label: '192 kbps (Medium)' },
        { value: '128', label: '128 kbps (Standard)' }
    ],
    mp4: [
        { value: '1080', label: '1080p (Full HD)' },
        { value: '720', label: '720p (HD)' },
        { value: '480', label: '480p (SD)' },
        { value: '360', label: '360p (Low)' }
    ]
};

// YouTube URL validation
function isValidYouTubeUrl(url) {
    const patterns = [
        /^(https?:\/\/)?(www\.)?youtube\.com\/watch\?v=[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/shorts\/[\w-]+/,
        /^(https?:\/\/)?youtu\.be\/[\w-]+/,
        /^(https?:\/\/)?(www\.)?youtube\.com\/embed\/[\w-]+/
    ];
    return patterns.some(pattern => pattern.test(url));
}

// Extract video ID
function extractVideoId(url) {
    const patterns = [
        /[?&]v=([^&]+)/,
        /youtu\.be\/([^?]+)/,
        /embed\/([^?]+)/,
        /shorts\/([^?]+)/
    ];
    for (const pattern of patterns) {
        const match = url.match(pattern);
        if (match) return match[1];
    }
    return null;
}

// Format duration
function formatDuration(seconds) {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
        return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}

// Update quality options
function updateQualityOptions() {
    qualitySelect.innerHTML = '';
    qualityOptions[selectedFormat].forEach(option => {
        const opt = document.createElement('option');
        opt.value = option.value;
        opt.textContent = option.label;
        qualitySelect.appendChild(opt);
    });
}

// Show section
function showSection(section) {
    [videoInfo, formatSection, progressSection, downloadSection, errorSection].forEach(s => {
        s.classList.add('hidden');
    });
    if (section) section.classList.remove('hidden');
}

// Reset UI
function resetUI() {
    urlInput.value = '';
    urlError.textContent = '';
    currentVideoInfo = null;
    selectedFormat = 'mp3';
    formatBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.format === 'mp3'));
    updateQualityOptions();
    showSection(null);
    fetchBtn.classList.remove('loading');
    fetchBtn.disabled = false;
    convertBtn.classList.remove('loading');
    convertBtn.disabled = false;
}

// Fetch video info
async function fetchVideoInfo() {
    const url = urlInput.value.trim();
    
    // Validate URL
    if (!url) {
        urlError.textContent = 'Please enter a YouTube URL';
        return;
    }
    
    if (!isValidYouTubeUrl(url)) {
        urlError.textContent = 'Please enter a valid YouTube URL';
        return;
    }
    
    urlError.textContent = '';
    fetchBtn.classList.add('loading');
    fetchBtn.disabled = true;
    showSection(null);
    
    try {
        const response = await fetch('/api/info', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to fetch video info');
        }
        
        currentVideoInfo = data;
        
        // Update UI
        videoThumbnail.src = data.thumbnail;
        videoTitle.textContent = data.title;
        videoDuration.textContent = data.duration > 0 ? `Duration: ${formatDuration(data.duration)}` : '';
        videoAuthor.textContent = `Channel: ${data.author}`;
        
        updateQualityOptions();
        showSection(videoInfo);
        formatSection.classList.remove('hidden');
        
    } catch (error) {
        urlError.textContent = error.message;
    } finally {
        fetchBtn.classList.remove('loading');
        fetchBtn.disabled = false;
    }
}

// Convert video
async function convertVideo() {
    if (!currentVideoInfo) return;
    
    convertBtn.classList.add('loading');
    convertBtn.disabled = true;
    formatSection.classList.add('hidden');
    showSection(progressSection);
    
    // Simulate progress
    let progress = 0;
    const progressInterval = setInterval(() => {
        progress += Math.random() * 15;
        if (progress > 90) progress = 90;
        progressFill.style.width = `${progress}%`;
        
        if (progress < 30) {
            progressText.textContent = 'Preparing...';
        } else if (progress < 60) {
            progressText.textContent = 'Processing...';
        } else {
            progressText.textContent = 'Almost done...';
        }
    }, 300);
    
    try {
        const response = await fetch('/api/convert', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: urlInput.value.trim(),
                format: selectedFormat,
                quality: qualitySelect.value
            })
        });
        
        clearInterval(progressInterval);
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Conversion failed');
        }
        
        if (!data.services || data.services.length === 0) {
            throw new Error('No download services available');
        }
        
        // Clear previous services
        servicesList.innerHTML = '';
        
        // Add service buttons
        data.services.forEach(service => {
            const btn = document.createElement('a');
            btn.href = service.url;
            btn.target = '_blank';
            btn.rel = 'noopener noreferrer';
            btn.className = 'service-btn';
            btn.innerHTML = `
                <svg viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                ${service.name}
            `;
            btn.title = service.instructions;
            servicesList.appendChild(btn);
        });
        
        progressFill.style.width = '100%';
        progressText.textContent = 'Ready!';
        
        setTimeout(() => {
            showSection(downloadSection);
        }, 500);
        
    } catch (error) {
        clearInterval(progressInterval);
        errorMessage.textContent = error.message;
        showSection(errorSection);
    } finally {
        convertBtn.classList.remove('loading');
        convertBtn.disabled = false;
    }
}

// Event Listeners
fetchBtn.addEventListener('click', fetchVideoInfo);

urlInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') fetchVideoInfo();
});

urlInput.addEventListener('input', () => {
    urlError.textContent = '';
});

formatBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        formatBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        selectedFormat = btn.dataset.format;
        updateQualityOptions();
    });
});

convertBtn.addEventListener('click', convertVideo);

convertAnother.addEventListener('click', resetUI);

tryAgain.addEventListener('click', () => {
    showSection(null);
    if (currentVideoInfo) {
        formatSection.classList.remove('hidden');
        videoInfo.classList.remove('hidden');
    }
});

// Initialize
updateQualityOptions();
