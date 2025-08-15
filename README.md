# 🎥 AI Video Summarizer

An AI-powered web application that extracts and summarizes YouTube video transcripts using **Google's Gemini AI**, with optional text-to-speech support.  
The solution is scalable for applications in **education**, **content moderation**, and **media monitoring**.

---

## 🚀 Features

- **YouTube Video Transcript Extraction** – Fetches transcripts using the YouTube Data API & YouTube Transcript API.
- **AI Summarization** – Utilizes Google's **Gemini AI** for concise, meaningful summaries.
- **Text-to-Speech Conversion** – Generates audio summaries with **gTTS**.
- **PDF Export** – Download summaries as PDFs using **html2pdf.js**.
- **Dark/Light Theme Support** – Toggle-friendly UI for comfortable reading.
- **Responsive Design** – Works seamlessly on desktop, tablet, and mobile.
- **Local History Management** – Saves past summaries using **LocalStorage**.

---

## 🛠️ Tech Stack

### **Frontend**
- **HTML5** – Semantic markup
- **CSS3** – Styling, animations, and responsiveness  
  - CSS Grid & Flexbox for layouts  
  - CSS Variables for theming  
  - Media queries for device adaptation  
- **JavaScript** – Client-side interactivity  
  - DOM manipulation  
  - Async/Await for API calls  
  - LocalStorage for history management  

**Frontend Libraries:**
- `html2pdf.js` – Export summaries as PDFs
- `Font Awesome` – Icons
- `Google Fonts` – Typography

---

### **Backend**
- **Python** – Core backend logic
- **Flask** – Lightweight web framework  
  - Routing  
  - Static file serving  
  - CORS handling (`flask_cors`)  
  - Rate limiting (`flask_limiter`)  
- **Google Generative AI (Gemini)** – AI-based summarization
- **gTTS** – Text-to-speech conversion
- **YouTube APIs** – Transcript & metadata fetching
- **RapidAPI** – Alternative transcript source

**Backend Libraries:**
- `python-dotenv` – Environment variable management
- `pytube` – YouTube video processing
- `google.generativeai` – Gemini integration

---

## 📂 Project Architecture

