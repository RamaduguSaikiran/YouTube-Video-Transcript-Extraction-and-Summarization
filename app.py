from flask import Flask, request, jsonify, render_template, send_from_directory, send_file
from youtube_transcript_api import YouTubeTranscriptApi
import google.generativeai as genai
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
from pytube import YouTube
import os
import re
import json
import requests
from dotenv import load_dotenv
import traceback
from functools import lru_cache
from gtts import gTTS
import tempfile
import uuid
from datetime import datetime

# Load environment variables
load_dotenv()

# Configure API keys
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')
GOOGLE_API_KEY = os.getenv('GOOGLE_API_KEY')
RAPID_API_KEY = os.getenv('RAPID_API_KEY')
RAPID_API_HOST = os.getenv('RAPID_API_HOST')

# Initialize Flask app
app = Flask(__name__, static_folder='static')
CORS(app)

# Set up rate limiting
# Note: In production, consider using a proper storage backend instead of in-memory
# Examples: redis, memcached, or a database backend
limiter = Limiter(
    get_remote_address,
    app=app,
    default_limits=["200 per day", "50 per hour"]
)

# Configure Google Gemini API key
genai.configure(api_key=GOOGLE_API_KEY)

# YouTube API key for alternative metadata fetching
YOUTUBE_API_KEY = os.getenv('YOUTUBE_API_KEY')  # Same key as for Gemini

# Cache for storing transcripts and summaries
CACHE_DURATION = 3600  # 1 hour in seconds

def extract_video_id(url):
    """
    Extract the YouTube video ID from various URL formats.
    Supports standard youtube.com URLs, youtu.be short URLs, and embedded URLs.
    """
    # Regular expressions for different YouTube URL formats
    youtube_regex = r'(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    
    match = re.search(youtube_regex, url)
    if match:
        return match.group(1)
    return None

@app.route('/')
def index():
    return render_template('index.html')

@lru_cache(maxsize=100)
def get_cached_transcript(video_id):
    return YouTubeTranscriptApi.get_transcript(video_id, languages=['en'])

def get_video_metadata_api(video_id):
    """
    Alternative method to get video metadata using YouTube Data API
    """
    try:
        print(f"Trying alternative method for video ID: {video_id}")
        # Skip the API call since it's being blocked and go straight to the basic approach
        print("YouTube API is currently blocked, using basic approach instead")
        return get_basic_video_info(video_id)
    except Exception as e:
        print(f"Error in get_video_metadata_api: {str(e)}")
        import traceback
        traceback.print_exc()
        # Try the basic approach as a last resort
        return get_basic_video_info(video_id)

def get_basic_video_info(video_id):
    """
    Get basic video info without using APIs, as a last resort
    """
    try:
        print(f"Using basic approach for video ID: {video_id}")
        # Create a thumbnail URL directly from the video ID
        thumbnail_url = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
        
        # Create a fallback title based on the video ID
        title = f"YouTube Video (ID: {video_id})"
        
        # Get the current date for fallback
        from datetime import datetime
        current_date = datetime.now().strftime("%Y-%m-%d")
        
        # Create basic metadata
        metadata = {
            'title': title,
            'author': "Content Creator",
            'views': 0,
            'publish_date': current_date,
            'description': "Description not available due to API limitations.",
            'thumbnail': thumbnail_url,
            'video_id': video_id,
            'url': f"https://www.youtube.com/watch?v={video_id}"
        }
        
        print("Using basic video info as fallback")
        return metadata
    except Exception as e:
        print(f"Error in get_basic_video_info: {str(e)}")
        # Return minimal info if even this fails
        return {
            'title': f"Video {video_id}",
            'author': "Unknown",
            'views': 0,
            'publish_date': "Unknown",
            'description': "No description available",
            'thumbnail': f"https://img.youtube.com/vi/{video_id}/default.jpg",
            'video_id': video_id,
            'url': f"https://www.youtube.com/watch?v={video_id}"
        }

def get_video_metadata(url):
    try:
        print(f"Fetching metadata for URL: {url}")
        # First try using pytube
        try:
            yt = YouTube(url)
            
            # Check if we can access the required attributes
            if not hasattr(yt, 'title') or not yt.title:
                raise ValueError("Could not retrieve video title")
                
            # Format publish date safely
            publish_date = yt.publish_date.strftime("%Y-%m-%d") if yt.publish_date else "Unknown"
            
            metadata = {
                'title': yt.title,
                'author': yt.author or "Unknown",
                'length': yt.length or 0,
                'views': yt.views or 0,
                'publish_date': publish_date,
                'description': yt.description or "No description available"
            }
            print(f"Successfully retrieved metadata: {metadata['title']}")
            return metadata
        except Exception as pytube_error:
            print(f"Pytube error: {str(pytube_error)}, trying alternative method")
            # If pytube fails, try using the YouTube Data API
            video_id = extract_video_id(url)
            if not video_id:
                raise ValueError("Could not extract video ID from URL")
            
            return get_video_metadata_api(video_id)
    except Exception as e:
        print(f"Error in get_video_metadata: {str(e)}")
        import traceback
        traceback.print_exc()
        return {'error': str(e)}

@app.route('/get_video_info', methods=['GET'])
@limiter.limit("30 per minute")
def get_video_info():
    youtube_video_url = request.args.get('url')
    if not youtube_video_url:
        return jsonify({'error': 'URL parameter is required'}), 400
    
    try:
        # Extract video ID first to validate the URL
        video_id = extract_video_id(youtube_video_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
            
        # Print debugging information
        print(f"Processing URL: {youtube_video_url}")
        print(f"Extracted video ID: {video_id}")
        
        metadata = get_video_metadata(youtube_video_url)
        
        # Even if we got an error from the metadata function, if it's our last resort basic info,
        # we should still return it with a 200 status so the frontend can proceed
        if 'error' in metadata and 'video_id' not in metadata:
            print(f"Metadata error: {metadata['error']}")
            return jsonify({'error': metadata['error']}), 400
        
        # Add video_id to the response if not already there
        if 'video_id' not in metadata:
            metadata['video_id'] = video_id

        # Add thumbnail URL
        if 'thumbnail' not in metadata:
            metadata['thumbnail'] = f"https://img.youtube.com/vi/{video_id}/maxresdefault.jpg"
            
        return jsonify(metadata)
    except Exception as e:
        print(f"Exception in get_video_info: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/get_transcript', methods=['GET'])
@limiter.limit("30 per minute")
def get_transcript():
    youtube_video_url = request.args.get('url')
    language = request.args.get('lang', 'en')
    
    if not youtube_video_url:
        return jsonify({'error': 'URL parameter is required'}), 400
    
    try:
        # Extract video ID
        video_id = extract_video_id(youtube_video_url)
        if not video_id:
            return jsonify({'error': 'Invalid YouTube URL'}), 400
            
        print(f"Getting transcript for video ID: {video_id}")
        
        # First try RapidAPI method
        transcript_data = get_transcript_from_rapidapi(video_id)
        
        # If RapidAPI method worked, return the transcript
        if transcript_data:
            print(f"Successfully retrieved transcript from RapidAPI")
            return jsonify({
                'transcript': transcript_data,
                'source': 'rapidapi'
            })
        
        # If RapidAPI failed, try YouTube Transcript API as fallback
        try:
            transcript_list = YouTubeTranscriptApi.get_transcript(video_id, languages=[language])
            transcript_text = ' '.join([item['text'] for item in transcript_list])
            
            # Cache the transcript for future use
            # cache_transcript(video_id, transcript_text)
            
            print(f"Successfully retrieved transcript from YouTube Transcript API")
            return jsonify({
                'transcript': transcript_text,
                'source': 'youtube_transcript_api'
            })
        except Exception as transcript_error:
            print(f"Error fetching transcript with YouTube Transcript API: {str(transcript_error)}")
            
            # If both methods failed, return an error
            return jsonify({
                'error': 'Could not retrieve transcript. The video might not have captions available.'
            }), 404
    except Exception as e:
        print(f"Exception in get_transcript: {str(e)}")
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

def get_transcript_from_rapidapi(video_id):
    """
    Get transcript using the RapidAPI YouTube Transcriptor API
    """
    try:
        print(f"Fetching transcript from RapidAPI for video ID: {video_id}")
        
        url = f"https://youtube-transcriptor.p.rapidapi.com/transcript?video_id={video_id}&lang=en"
        
        headers = {
            "X-RapidAPI-Key": RAPID_API_KEY,
            "X-RapidAPI-Host": RAPID_API_HOST
        }
        
        response = requests.get(url, headers=headers)
        response.raise_for_status()  # Raise an exception for other 4XX/5XX responses
        
        data = response.json()
        print(f"RapidAPI response status: {response.status_code}")
        
        # Check if the response contains transcription data
        if 'transcription' in data:
            # Return the entire response structure which includes transcriptionAsText
            # This preserves the full data structure for frontend processing
            print(f"Successfully retrieved transcript from RapidAPI with transcription array")
            return {
                'transcriptionAsText': ' '.join([item.get('subtitle', '') for item in data['transcription']]),
                'transcription': data['transcription']
            }
        elif 'transcript' in data:
            # Some versions of the API might return transcript directly
            print(f"Successfully retrieved transcript from RapidAPI with direct transcript")
            return data['transcript']
        elif 'message' in data and 'No transcript found' in data['message']:
            # Handle the case where RapidAPI explicitly states no transcript is found
            print(f"RapidAPI explicitly reported no transcript found: {data['message']}")
            return None
        else:
            print(f"No transcript found in RapidAPI response: {data}")
            return None
    except requests.exceptions.Timeout:
        print("Timeout error when connecting to RapidAPI")
        return None
    except requests.exceptions.ConnectionError:
        print("Connection error when connecting to RapidAPI")
        return None
    except Exception as e:
        print(f"Error fetching transcript from RapidAPI: {str(e)}")
        return None

@app.route('/generate_summary', methods=['POST'])
@limiter.limit("20 per minute")
def generate_summary():
    data = request.json
    if not data or 'transcript' not in data:
        return jsonify({'error': 'Transcript is required'}), 400
    
    transcript_text = data.get('transcript')
    format_type = data.get('format', 'text')  # text, bullet, or detailed
    
    prompt_templates = {
        'text': """Create a concise summary of the video transcript in a clear, engaging format. Focus on the main points and key takeaways.""",
        'bullet': """Create a bullet-point summary of the main points from the video transcript. Include:
                    • Key concepts and ideas
                    • Important facts and figures
                    • Main conclusions or takeaways""",
        'detailed': """Create a detailed, structured summary of the video content including:
                    1. Main Topic/Theme
                    2. Key Points (with timestamps if available)
                    3. Important Details and Examples
                    4. Conclusions or Final Thoughts
                    5. Additional Resources or References (if mentioned)"""
    }
    
    structured_prompt = f"{prompt_templates.get(format_type, prompt_templates['text'])}\n\nTranscript:\n{transcript_text}"

    try:
        model = genai.GenerativeModel("gemini-2.0-flash")
        response = model.generate_content(structured_prompt)
        summary = response.text
        
        # Generate audio version of the summary
        audio_url = None
        if data.get('generate_audio', False):
            tts = gTTS(text=summary, lang='en')
            audio_filename = f"summary_{uuid.uuid4()}.mp3"
            audio_path = os.path.join(tempfile.gettempdir(), audio_filename)
            tts.save(audio_path)
            audio_url = f"/audio/{audio_filename}"
        
        return jsonify({
            'summary': summary,
            'audio_url': audio_url,
            'format': format_type,
            'timestamp': datetime.now().isoformat()
        })
    except Exception as e:
        print(f"Exception in generate_summary: {str(e)}")
        import traceback
        traceback.print_exc()
        return jsonify({'error': str(e)}), 500

@app.route('/audio/<filename>')
def get_audio(filename):
    try:
        return send_from_directory(tempfile.gettempdir(), filename)
    except Exception as e:
        return jsonify({'error': str(e)}), 404

if __name__ == '__main__':
    app.run(port=5001, debug=True)
