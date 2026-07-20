// Voice Recognition using Web Speech API
class VoiceHandler {
    constructor() {
        this.recognition = null;
        this.isRecording = false;
        this.initRecognition();
    }

    initRecognition() {
        // Browser support check
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        
        if (!SpeechRecognition) {
            console.log('Speech recognition not supported');
            return;
        }

        this.recognition = new SpeechRecognition();
        this.recognition.continuous = false;
        this.recognition.interimResults = true;
        this.recognition.lang = 'en-US'; // Change to 'hi-IN' for Hindi

        // When voice is recognized
        this.recognition.onresult = (event) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const transcript = event.results[i][0].transcript;
                if (event.results[i].isFinal) {
                    finalTranscript += transcript;
                } else {
                    interimTranscript += transcript;
                }
            }

            // Show interim results
            if (interimTranscript) {
                document.getElementById('userInput').value = interimTranscript;
            }

            // Send final result automatically
            if (finalTranscript) {
                document.getElementById('userInput').value = finalTranscript;
                this.stopRecording();
                app.sendMessage(); // Auto-send fix
            }
        };

        // Error handling
        this.recognition.onerror = (event) => {
            console.error('Voice Error:', event.error);
            this.stopRecording();
        };

        // Auto-restart after stop
        this.recognition.onend = () => {
            if (this.isRecording) {
                this.recognition.start();
            }
        };
    }

    startRecording() {
        if (!this.recognition) {
            alert('Voice recognition is not supported in your browser');
            return;
        }

        try {
            this.recognition.start();
            this.isRecording = true;
            
            // UI Update
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.add('recording');
            voiceBtn.innerHTML = '🔴';
        } catch (error) {
            console.error('Start Error:', error);
        }
    }

    stopRecording() {
        if (this.recognition) {
            this.recognition.stop();
            this.isRecording = false;
            
            // UI Update
            const voiceBtn = document.getElementById('voiceBtn');
            voiceBtn.classList.remove('recording');
            voiceBtn.innerHTML = '🎤';
        }
    }

    // Text to Speech (AI Response ko suno)
    speakText(text) {
        if ('speechSynthesis' in window) {
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.lang = 'en-US';
            utterance.rate = 1;
            utterance.pitch = 1;
            
            // Choose voice
            const voices = window.speechSynthesis.getVoices();
            utterance.voice = voices[0];
            
            window.speechSynthesis.speak(utterance);
        }
    }
}

// Global instance
const voiceHandler = new VoiceHandler();

function toggleVoiceInput() {
    if (voiceHandler.isRecording) {
        voiceHandler.stopRecording();
    } else {
        voiceHandler.startRecording();
    }
}
