# AI-Dost Go (Golang) High-Speed Gateway

High-performance API Gateway and WebSocket Collaboration microservice built in Go for ultra-low latency (`<2ms`), minimal RAM footprint (~15MB), and high-concurrency Goroutine execution.

## 🚀 Architecture
- **Go Gateway (Port 8080)**: Handles high-speed API routing, CORS, timing logs, and WebSocket collaboration channels.
- **Python Master Brain (Port 5000)**: FastAPI service executing PyTorch models, ChromaDB Vector RAG, and AI Cascading Router (`Groq → NVIDIA NIM → Gemini`).

## 🛠️ Quick Start Setup (Windows)

1. **Install Go (Windows)**:
   - Download the official installer from [https://go.dev/dl/](https://go.dev/dl/).
   - Run `go version` in PowerShell to verify installation.

2. **Run the Go Gateway**:
   ```powershell
   cd backend-go
   go run main.go
   ```

3. **Verify Health Endpoint**:
   - Open `http://localhost:8080/health` in your browser.
