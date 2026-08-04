package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"net/http/httputil"
	"net/url"
	"os"
	"runtime"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

// WebSocket Upgrader - HTTP request ko WebSocket mein convert karta hai
var upgrader = websocket.Upgrader{
	ReadBufferSize:  1024,
	WriteBufferSize: 1024,
	CheckOrigin: func(r *http.Request) bool {
		return true // Development ke liye sabhi origins allow kar rahe hain
	},
}

// Client represents a connected WebSocket collaborator
type Client struct {
	ID   string
	Conn *websocket.Conn
}

// Hub manages WebSocket real-time collaboration channels using Goroutines
type Hub struct {
	clients    map[string]*Client
	broadcast  chan []byte
	register   chan *Client
	unregister chan *Client
	mu         sync.Mutex
}

func newHub() *Hub {
	return &Hub{
		broadcast:  make(chan []byte),
		register:   make(chan *Client),
		unregister: make(chan *Client),
		clients:    make(map[string]*Client),
	}
}

func (h *Hub) run() {
	for {
		select {
		case client := <-h.register:
			h.mu.Lock()
			h.clients[client.ID] = client
			h.mu.Unlock()
			log.Printf("👥 Client connected: %s (Total active: %d)", client.ID, len(h.clients))

		case client := <-h.unregister:
			h.mu.Lock()
			if _, ok := h.clients[client.ID]; ok {
				delete(h.clients, client.ID)
				client.Conn.Close() // Connection properly close karna zaroori hai
				log.Printf("🚪 Client disconnected: %s (Remaining: %d)", client.ID, len(h.clients))
			}
			h.mu.Unlock()

		case message := <-h.broadcast:
			h.mu.Lock()
			for id, client := range h.clients {
				// Broadcast event to client channel
				err := client.Conn.WriteMessage(websocket.TextMessage, message)
				if err != nil {
					log.Printf("Error writing to client %s: %v", id, err)
					client.Conn.Close()
					delete(h.clients, id)
				}
			}
			h.mu.Unlock()
		}
	}
}

// Enable CORS Middleware
func enableCORS(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Requested-With")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return // Fix: Removed incorrect return syntax
		}
		next.ServeHTTP(w, r) // Fix: Added 'r' argument
	})
}

// Request Timing Logger Middleware
func loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r) // Fix: Added 'r' argument
		duration := time.Since(start)
		log.Printf("🚀 [Go-Gateway] %s %s | Latency: %v", r.Method, r.URL.Path, duration)
	})
}

// Handle actual WebSocket Connections
func handleWebSocket(hub *Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("WebSocket Upgrade Error:", err)
		return
	}
	client := &Client{ID: fmt.Sprintf("client-%d", time.Now().UnixNano()), Conn: conn}
	hub.register <- client

	// Read messages from client and broadcast
	go func() {
		defer func() {
			hub.unregister <- client
		}()
		for {
			_, message, err := conn.ReadMessage()
			if err != nil {
				break
			}
			hub.broadcast <- message
		}
	}()
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = "8080"
	}

	pythonBrainURL := os.Getenv("FASTAPI_BRAIN_URL")
	if pythonBrainURL == "" {
		pythonBrainURL = "http://127.0.0.1:5000"
	}

	targetURL, err := url.Parse(pythonBrainURL)
	if err != nil {
		log.Fatalf("Invalid Python Brain URL: %v", err)
	}

	// Initialize and run the WebSocket Hub
	hub := newHub()
	go hub.run()

	proxy := httputil.NewSingleHostReverseProxy(targetURL)
	mux := http.NewServeMux()

	// 1. High-Speed Health Check Endpoint (<2ms response)
	mux.HandleFunc("/health", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		response := map[string]interface{}{
			"status":      "OK",
			"engine":      "Go (Golang) High-Speed Gateway",
			"pythonBrain": pythonBrainURL,
			"timestamp":   time.Now().Format(time.RFC3339),
			"goroutines":  runtime.NumGoroutine(),
		}
		json.NewEncoder(w).Encode(response)
	})

	// 2. Reverse Proxy to Python FastAPI AI Master Brain
	mux.HandleFunc("/api/", func(w http.ResponseWriter, r *http.Request) {
		r.Host = targetURL.Host
		proxy.ServeHTTP(w, r)
	})

	// 3. Real-Time Collaboration Channel Status
	mux.HandleFunc("/ws/status", func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Content-Type", "application/json")
		hub.mu.Lock()
		count := len(hub.clients)
		hub.mu.Unlock()
		json.NewEncoder(w).Encode(map[string]interface{}{
			"status":        "Active",
			"activeClients": count,
			"hub":           "Goroutine Channel Engine",
		})
	})

	// 4. WebSocket Actual Endpoint
	mux.HandleFunc("/ws", func(w http.ResponseWriter, r *http.Request) {
		handleWebSocket(hub, w, r)
	})

	handler := loggingMiddleware(enableCORS(mux))

	fmt.Printf("\n🚀 AI-Dost Go High-Speed Gateway running on http://localhost:%s\n", port)
	fmt.Printf("⚡ Reverse Proxying AI requests -> %s\n", pythonBrainURL)
	fmt.Printf("📋 Health check: http://localhost:%s/health\n\n", port)

	if err := http.ListenAndServe(":"+port, handler); err != nil {
		log.Fatalf("Server failed: %v", err)
	}
}
