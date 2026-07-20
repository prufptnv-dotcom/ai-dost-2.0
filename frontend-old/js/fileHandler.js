class FileHandler {
    constructor() {
        this.currentFile = null;
    }

    async handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.currentFile = file;
        console.log('File uploaded:', file.name);

        // File preview dikhao
        this.showFilePreview(file);

        // File type ke hisab se processing
        const fileType = file.type;
        let fileContent = '';

        if (fileType === 'application/pdf') {
            fileContent = await this.readPDF(file);
        } else if (fileType.includes('image')) {
            fileContent = await this.processImage(file);
        } else if (fileType === 'text/plain' || file.name.endsWith('.py') || file.name.endsWith('.js')) {
            fileContent = await this.readTextFile(file);
        } else if (fileType.includes('word') || fileType.includes('document')) {
            fileContent = await this.readDOCX(file);
        }

        // Add file info to chat
        this.addFileMessage(file.name, fileContent);
        
        // Store for sending
        this.fileContent = fileContent;
    }

    async readPDF(file) {
        // PDF.js library load karo (CDN se)
        const pdfjsLib = window['pdfjs-dist/build/pdf'];
        
        // Set worker
        pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js';

        try {
            const arrayBuffer = await file.arrayBuffer();
            const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
            
            let fullText = '';
            
            // Sab pages se text extract karo
            for (let i = 1; i <= pdf.numPages; i++) {
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items.map(item => item.str).join(' ');
                fullText += pageText + '\n';
            }
            
            console.log('PDF text extracted:', fullText.substring(0, 100));
            return fullText;
        } catch (error) {
            console.error('PDF reading error:', error);
            return 'PDF could not be read';
        }
    }

    async processImage(file) {
        // For images, we'll use base64
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                resolve(e.target.result); // base64 data
            };
            reader.readAsDataURL(file);
        });
    }

    async readTextFile(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => resolve(e.target.result);
            reader.readAsText(file);
        });
    }

    async readDOCX(file) {
        // Using mammoth.js for DOCX
        // Add: <script src="https://cdnjs.cloudflare.com/ajax/libs/mammoth/1.4.0/mammoth.browser.min.js"></script>
        const arrayBuffer = await file.arrayBuffer();
        const result = await mammoth.extractRawText({ arrayBuffer });
        return result.value;
    }

    showFilePreview(file) {
        const previewContainer = document.getElementById('filePreviewContainer') || this.createPreviewContainer();
        previewContainer.innerHTML = '';

        if (file.type.includes('image')) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const img = document.createElement('img');
                img.src = e.target.result;
                previewContainer.appendChild(img);
            };
            reader.readAsDataURL(file);
        }

        const fileInfo = document.createElement('div');
        fileInfo.className = 'file-info';
        fileInfo.innerHTML = `
            <span>📄 ${file.name}</span>
            <button onclick="fileHandler.removeFile()">✕</button>
        `;
        previewContainer.appendChild(fileInfo);
    }

    createPreviewContainer() {
        const inputArea = document.querySelector('.input-area');
        const container = document.createElement('div');
        container.id = 'filePreviewContainer';
        container.className = 'file-preview-box';
        inputArea.insertBefore(container, inputArea.firstChild);
        return container;
    }

    addFileMessage(fileName, content) {
        const messagesContainer = document.getElementById('messages');
        const welcomeScreen = document.getElementById('welcomeScreen');
        
        // Hide welcome screen
        if (welcomeScreen) welcomeScreen.style.display = 'none';

        const fileMessage = document.createElement('div');
        fileMessage.className = 'message user file-message';
        fileMessage.innerHTML = `
            <div class="message-avatar">📁</div>
            <div class="message-content">
                <strong>File Uploaded:</strong> ${fileName}
                <br>Content loaded: ${content.length} characters
            </div>
        `;
        messagesContainer.appendChild(fileMessage);
    }

    removeFile() {
        this.currentFile = null;
        this.fileContent = null;
        const previewContainer = document.getElementById('filePreviewContainer');
        if (previewContainer) previewContainer.remove();
        document.getElementById('fileUpload').value = '';
    }
}

const fileHandler = new FileHandler();

function handleFileUpload(event) {
    fileHandler.handleFileUpload(event);
}
