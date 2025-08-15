// Theme Management
document.addEventListener('DOMContentLoaded', () => {
    // Set up theme
    const savedTheme = localStorage.getItem('theme') || 'light';
    document.body.setAttribute('data-theme', savedTheme);
    const themeToggle = document.getElementById('theme-toggle');
    if (themeToggle) {
        themeToggle.checked = savedTheme === 'dark';
        themeToggle.addEventListener('change', (e) => {
            const theme = e.target.checked ? 'dark' : 'light';
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('theme', theme);
        });
    }
    
    // Set up navigation
    const navLinks = document.querySelectorAll('.nav-links a');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const sectionId = link.getAttribute('href').substring(1);
            showSection(sectionId);
        });
    });
    
    // Set up buttons in home section
    const getStartedBtn = document.querySelector('.btn.primary-btn');
    if (getStartedBtn) {
        getStartedBtn.addEventListener('click', () => {
            showSection('project');
        });
    }
    
    const meetTeamBtn = document.querySelector('.btn.secondary-btn');
    if (meetTeamBtn) {
        meetTeamBtn.addEventListener('click', () => {
            showSection('team');
        });
    }
    
    // Initialize other features
    loadHistory();
    
    // Add event listeners for buttons
    const fetchBtn = document.getElementById('fetch-btn');
    if (fetchBtn) fetchBtn.addEventListener('click', getVideoDetails);
    
    const summarizeBtn = document.getElementById('summarize-btn');
    if (summarizeBtn) summarizeBtn.addEventListener('click', getSummary);
    
    const copyBtn = document.getElementById('copy-btn');
    if (copyBtn) copyBtn.addEventListener('click', copyToClipboard);
    
    const downloadBtn = document.getElementById('download-btn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadPDF);
    
    const shareBtn = document.getElementById('share-btn');
    if (shareBtn) shareBtn.addEventListener('click', shareResult);
    
    // Show home section by default
    showSection('home');
});

// Navigation
function showSection(sectionId) {
    console.log('Showing section:', sectionId);
    
    // Hide all sections first
    document.querySelectorAll('.section').forEach(section => {
        section.style.display = 'none';
        section.classList.remove('active');
    });
    
    // Remove active class from all nav links
    document.querySelectorAll('.nav-links a').forEach(link => {
        link.classList.remove('active');
    });
    
    // Show the target section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.style.display = 'block';
        targetSection.classList.add('active');
        
        // Special handling for project section
        if (sectionId === 'project') {
            // Reset hidden elements in project section
            const hiddenElements = targetSection.querySelectorAll('.hidden');
            hiddenElements.forEach(el => {
                if (el.id !== 'video-info' && 
                    el.id !== 'transcript-container' && 
                    el.id !== 'summary-controls' && 
                    el.id !== 'summary-output') {
                    el.classList.remove('hidden');
                }
            });
            
            const inputGroup = targetSection.querySelector('.input-group');
            if (inputGroup) inputGroup.style.display = 'flex';
            
            const youtubeUrlInput = document.getElementById('youtube-url');
            if (youtubeUrlInput) youtubeUrlInput.style.display = 'block';
            
            const fetchBtn = document.getElementById('fetch-btn');
            if (fetchBtn) {
                fetchBtn.style.display = 'inline-flex';
                fetchBtn.disabled = false;
                fetchBtn.innerHTML = '<i class="fas fa-search"></i> Fetch Video';
            }
            
            // Check for URL parameters
            try {
                const urlParams = new URLSearchParams(window.location.hash.split('?')[1] || '');
                const youtubeUrl = urlParams.get('url');
                
                if (youtubeUrl) {
                    document.getElementById('youtube-url').value = decodeURIComponent(youtubeUrl);
                    setTimeout(() => {
                        document.getElementById('fetch-btn').click();
                    }, 500);
                }
            } catch (error) {
                console.error('Error parsing URL parameters:', error);
            }
        }
    }
    
    // Update active nav link
    const targetLink = document.querySelector(`.nav-links a[href="#${sectionId}"]`);
    if (targetLink) targetLink.classList.add('active');
}

// Toast Notifications
function showToast(message, type = 'info') {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `
        <i class="fas fa-${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
        <span>${message}</span>
    `;
    
    document.getElementById('toast-container').appendChild(toast);
    setTimeout(() => toast.remove(), 3000);
}

// Video Processing
async function getVideoDetails() {
    const youtubeLink = document.getElementById('youtube-url').value.trim();
    if (!youtubeLink) {
        showToast('Please enter a YouTube video link', 'error');
        return;
    }
    
    try {
        // Show loading state
        document.getElementById('fetch-btn').disabled = true;
        document.getElementById('fetch-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Loading...';
        
        // Fetch video info
        const response = await fetch(`/get_video_info?url=${encodeURIComponent(youtubeLink)}`);
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            // Reset button state
            document.getElementById('fetch-btn').disabled = false;
            document.getElementById('fetch-btn').innerHTML = '<i class="fas fa-search"></i> Fetch Video';
            return;
        }
        
        console.log('Video data received:', data);
        
        // Make sure thumbnail is available
        const thumbnailUrl = data.thumbnail || `https://img.youtube.com/vi/${data.video_id}/maxresdefault.jpg`;
        
        // Display video info
        document.getElementById('thumbnail').src = thumbnailUrl;
        document.getElementById('video-title').textContent = data.title || 'Video Title';
        document.getElementById('video-author').textContent = `By ${data.author || 'Unknown'}`;
        document.getElementById('video-stats').innerHTML = `
            <span><i class="fas fa-eye"></i> ${formatNumber(data.views || 0)} views</span>
            <span><i class="fas fa-calendar"></i> ${data.publish_date || 'Unknown'}</span>
        `;
        
        // Show video info section
        const videoInfoElement = document.getElementById('video-info');
        if (videoInfoElement) {
            videoInfoElement.classList.remove('hidden');
            videoInfoElement.style.display = 'flex';
        }
        
        // Fetch transcript
        const transcriptResponse = await fetch(`/get_transcript?url=${encodeURIComponent(youtubeLink)}`);
        const transcriptData = await transcriptResponse.json();
        
        if (transcriptData.error) {
            showToast(transcriptData.error, 'error');
            // Reset button state
            document.getElementById('fetch-btn').disabled = false;
            document.getElementById('fetch-btn').innerHTML = '<i class="fas fa-search"></i> Fetch Video';
            return;
        }
        
        // Display transcript
        const transcriptTextElement = document.getElementById('transcript-text');
        if (transcriptTextElement) {
            // Check if transcript is an object with transcriptionAsText property (RapidAPI format)
            if (transcriptData.transcript && typeof transcriptData.transcript === 'object' && transcriptData.transcript.transcriptionAsText) {
                transcriptTextElement.value = transcriptData.transcript.transcriptionAsText;
                console.log('Using transcriptionAsText from RapidAPI');
            } 
            // Check if transcript is a string (YouTube Transcript API format)
            else if (typeof transcriptData.transcript === 'string') {
                transcriptTextElement.value = transcriptData.transcript;
                console.log('Using string transcript');
            } 
            // Check if transcript is an array of subtitle objects (alternative format)
            else if (Array.isArray(transcriptData.transcript)) {
                // If it's an array of subtitle objects, convert to text
                const fullText = transcriptData.transcript
                    .map(item => item.subtitle || '')
                    .join(' ');
                transcriptTextElement.value = fullText;
                console.log('Using array of subtitles');
            } 
            // If none of the above formats match
            else {
                transcriptTextElement.value = 'Transcript format not recognized. Please try another video.';
                console.error('Unrecognized transcript format:', transcriptData.transcript);
            }
        }
        
        // Show transcript container and summary controls
        const transcriptContainer = document.getElementById('transcript-container');
        if (transcriptContainer) {
            transcriptContainer.classList.remove('hidden');
            transcriptContainer.style.display = 'block';
        }
        
        const summaryControls = document.getElementById('summary-controls');
        if (summaryControls) {
            summaryControls.classList.remove('hidden');
            summaryControls.style.display = 'flex';
        }
        
        // Save to history
        saveToHistory({
            url: youtubeLink,
            title: data.title || `Video ${data.video_id}`,
            thumbnail: thumbnailUrl,
            date: new Date().toISOString()
        });
        
        // Reset button state
        document.getElementById('fetch-btn').disabled = false;
        document.getElementById('fetch-btn').innerHTML = '<i class="fas fa-search"></i> Fetch Video';
        
        // Show success toast
        showToast('Video details fetched successfully', 'success');
        
    } catch (error) {
        console.error('Error fetching video details:', error);
        showToast('Error fetching video details. Please try again.', 'error');
        
        // Reset button state
        document.getElementById('fetch-btn').disabled = false;
        document.getElementById('fetch-btn').innerHTML = '<i class="fas fa-search"></i> Fetch Video';
    }
}

async function getSummary() {
    const transcriptElement = document.getElementById('transcript-text');
    const transcript = transcriptElement ? transcriptElement.value : '';
    const format = document.getElementById('format-selector').value;
    const generateAudio = document.getElementById('audio-toggle').checked;
    
    if (!transcript || transcript.trim() === '') {
        showToast('No transcript available to summarize', 'error');
        return;
    }
    
    // Check if transcript is too short
    if (transcript.trim().split(' ').length < 10) {
        showToast('Transcript is too short to generate a meaningful summary', 'error');
        return;
    }
    
    try {
        // Show loading state
        document.getElementById('summarize-btn').disabled = true;
        document.getElementById('summarize-btn').innerHTML = '<i class="fas fa-spinner fa-spin"></i> Generating...';
        
        // Fetch summary
        const response = await fetch('/generate_summary', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                transcript: transcript,
                format: format,
                generate_audio: generateAudio
            })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.error || `Server responded with status: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            showToast(data.error, 'error');
            return;
        }
        
        console.log('Summary data received:', data);
        
        // Display summary
        const summaryContent = document.querySelector('.summary-content');
        if (summaryContent) {
            // Clear any existing content first
            summaryContent.innerHTML = '';
            
            // Format and display the summary
            const formattedSummary = formatSummary(data.summary);
            summaryContent.innerHTML = formattedSummary;
        }
        
        // Ensure summary section is visible
        const summaryOutput = document.getElementById('summary-output');
        if (summaryOutput) {
            summaryOutput.classList.remove('hidden');
            summaryOutput.style.display = 'block';
        }
        
        // Handle audio if generated
        if (generateAudio && data.audio_url) {
            // Remove any existing audio player
            const existingPlayer = summaryContent.querySelector('.audio-player');
            if (existingPlayer) {
                existingPlayer.remove();
            }
            
            const audioPlayer = document.createElement('audio');
            audioPlayer.controls = true;
            audioPlayer.src = data.audio_url;
            audioPlayer.className = 'audio-player';
            summaryContent.appendChild(audioPlayer);
        }
        
        showToast('Summary generated successfully', 'success');
        
        // Save to history if not already saved
        const youtubeLink = document.getElementById('youtube-url').value.trim();
        const videoTitle = document.getElementById('video-title').textContent;
        const thumbnailUrl = document.getElementById('thumbnail').src;
        
        if (youtubeLink && videoTitle) {
            const historyItem = {
                url: youtubeLink,
                title: videoTitle,
                thumbnail: thumbnailUrl,
                summary: data.summary,
                format: format,
                date: new Date().toISOString()
            };
            saveToHistory(historyItem);
        }
        
    } catch (error) {
        console.error('Error generating summary:', error);
        showToast('Failed to generate summary: ' + (error.message || 'Unknown error'), 'error');
    } finally {
        // Reset button state
        document.getElementById('summarize-btn').disabled = false;
        document.getElementById('summarize-btn').innerHTML = '<i class="fas fa-magic"></i> Generate Summary';
    }
}

// Utility Functions
function formatNumber(num) {
    if (!num) return '0';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toString();
}

function formatSummary(text) {
    if (!text) return 'No summary available.';
    
    // Handle markdown formatting
    let formattedText = text;
    
    // Convert markdown bold/italic to HTML
    formattedText = formattedText.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>'); // Bold: **text** to <strong>text</strong>
    formattedText = formattedText.replace(/\*([^*]+)\*/g, '<em>$1</em>'); // Italic: *text* to <em>text</em>
    
    // Convert bullet points to HTML
    formattedText = formattedText.replace(/- /g, '• '); 
    formattedText = formattedText.replace(/• /g, '<span class="bullet-point">• </span>');
    
    // Convert line breaks to HTML
    formattedText = formattedText.replace(/\n/g, '<br>');
    
    return formattedText;
}

// History Management
function saveToHistory(item) {
    let history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
    
    // Check if URL already exists in history
    const existingIndex = history.findIndex(h => h.url === item.url);
    if (existingIndex !== -1) history.splice(existingIndex, 1);
    
    // Add to beginning of array
    history.unshift(item);
    
    // Limit history to 10 items
    if (history.length > 10) history = history.slice(0, 10);
    
    localStorage.setItem('videoHistory', JSON.stringify(history));
    loadHistory();
}

function loadHistory() {
    const historyContainer = document.getElementById('history-container');
    const noHistoryMessage = document.querySelector('.no-history-message');
    const history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
    
    if (history.length === 0) {
        historyContainer.innerHTML = '';
        noHistoryMessage.classList.remove('hidden');
        return;
    }
    
    noHistoryMessage.classList.add('hidden');
    
    // Sort history by date (newest first)
    history.sort((a, b) => new Date(b.date) - new Date(a.date));
    
    historyContainer.innerHTML = history.map(item => `
        <div class="history-card">
            <div class="history-thumbnail">
                <img src="${item.thumbnail}" alt="${item.title}">
                <div class="history-overlay">
                    <a href="${item.url}" target="_blank" class="watch-video-btn">
                        <i class="fas fa-play"></i>
                    </a>
                </div>
            </div>
            <div class="history-content">
                <h3 class="history-title">${item.title}</h3>
                <div class="history-meta">
                    <span><i class="far fa-calendar-alt"></i> ${new Date(item.date).toLocaleDateString()}</span>
                    <span><i class="fas fa-tag"></i> ${item.format || 'Standard'}</span>
                </div>
                <div class="history-summary">
                    <p>${item.summary ? formatSummary(item.summary) : 'No summary available'}</p>
                </div>
                <div class="history-actions">
                    <button onclick="copyHistorySummary(this)" data-summary="${item.summary}" class="history-action-btn">
                        <i class="fas fa-copy"></i>
                    </button>
                    <button onclick="downloadHistoryPDF(this)" data-title="${item.title}" data-summary="${item.summary}" class="history-action-btn">
                        <i class="fas fa-file-pdf"></i>
                    </button>
                    <button onclick="deleteHistoryItem('${item.url}')" class="history-action-btn delete">
                        <i class="fas fa-trash-alt"></i>
                    </button>
                </div>
            </div>
        </div>
    `).join('');
}

function copyHistorySummary(button) {
    const summary = button.getAttribute('data-summary');
    navigator.clipboard.writeText(summary)
        .then(() => showToast('Summary copied to clipboard', 'success'))
        .catch(() => showToast('Failed to copy summary', 'error'));
}

function downloadHistoryPDF(button) {
    const title = button.getAttribute('data-title');
    const summary = button.getAttribute('data-summary');
    
    const element = document.createElement('div');
    element.style.padding = '20px';
    element.style.fontFamily = 'Arial, sans-serif';
    
    element.innerHTML = `
        <h1 style="color: #4361ee; font-size: 24px; margin-bottom: 20px;">${title}</h1>
        <div style="line-height: 1.6; font-size: 14px;">${formatSummary(summary)}</div>
        <p style="margin-top: 30px; color: #6c757d; font-size: 12px;">Generated by AI Video Summarizer on ${new Date().toLocaleDateString()}</p>
    `;
    
    showToast('Generating PDF...', 'info');
    
    html2pdf()
        .set({
            margin: [15, 15, 15, 15],
            filename: `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        })
        .from(element)
        .save()
        .then(() => showToast('PDF downloaded successfully', 'success'))
        .catch(error => {
            console.error('PDF generation error:', error);
            showToast('Failed to download PDF', 'error');
        });
}

function deleteHistoryItem(url) {
    if (confirm('Are you sure you want to delete this summary from your history?')) {
        const history = JSON.parse(localStorage.getItem('videoHistory') || '[]');
        const updatedHistory = history.filter(item => item.url !== url);
        localStorage.setItem('videoHistory', JSON.stringify(updatedHistory));
        loadHistory();
        showToast('Summary deleted from history', 'success');
    }
}

// Export Functions
function copyToClipboard() {
    const summaryText = document.querySelector('.summary-content').innerText;
    navigator.clipboard.writeText(summaryText)
        .then(() => showToast('Copied to clipboard', 'success'))
        .catch(() => showToast('Failed to copy', 'error'));
}

function downloadPDF() {
    try {
        const summaryContent = document.querySelector('.summary-content');
        const videoTitle = document.getElementById('video-title').textContent || 'Video Summary';
        
        if (!summaryContent || !summaryContent.innerHTML.trim()) {
            showToast('No summary content to download', 'error');
            return;
        }
        
        // Create a styled container for the PDF
        const element = document.createElement('div');
        element.style.padding = '20px';
        element.style.fontFamily = 'Arial, sans-serif';
        
        // Add content to the PDF
        element.innerHTML = `
            <h1 style="color: #4361ee; font-size: 24px; margin-bottom: 20px;">${videoTitle}</h1>
            <div style="line-height: 1.6; font-size: 14px;">${summaryContent.innerHTML}</div>
            <p style="margin-top: 30px; color: #6c757d; font-size: 12px;">Generated by AI Video Summarizer on ${new Date().toLocaleDateString()}</p>
        `;
        
        // Show loading toast
        showToast('Generating PDF...', 'info');
        
        // Generate PDF with html2pdf
        html2pdf()
            .set({
                margin: [15, 15, 15, 15],
                filename: `${videoTitle.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_summary.pdf`,
                image: { type: 'jpeg', quality: 0.98 },
                html2canvas: { scale: 2, useCORS: true },
                jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
            })
            .from(element)
            .save()
            .then(() => {
                showToast('PDF downloaded successfully', 'success');
            })
            .catch((error) => {
                console.error('PDF generation error:', error);
                showToast('Failed to download PDF: ' + (error.message || 'Unknown error'), 'error');
            });
    } catch (error) {
        console.error('PDF generation error:', error);
        showToast('Failed to download PDF: ' + (error.message || 'Unknown error'), 'error');
    }
}

function shareResult() {
    const summaryText = document.querySelector('.summary-content').innerText;
    if (navigator.share) {
        navigator.share({
            title: 'Video Summary',
            text: summaryText,
            url: window.location.href
        })
        .then(() => showToast('Shared successfully', 'success'))
        .catch(() => showToast('Failed to share', 'error'));
    } else {
        copyToClipboard();
    }
}

// Contact Form
document.addEventListener('DOMContentLoaded', () => {
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', (e) => {
            e.preventDefault();
            showToast('Message sent successfully', 'success');
            e.target.reset();
        });
    }
});
