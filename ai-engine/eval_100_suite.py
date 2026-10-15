import os
import sys
import json
import time
import re
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed

API_URL = "http://127.0.0.1:8002/api/ai-dost/chat"

# 100 Questions across 10 Categories (10 questions each: Easy -> Medium -> Hard -> Very Complex)
EVAL_QUESTIONS = [
    # ── Category 1: Python & Algorithms ──
    {"id": 1, "cat": "Algorithms", "diff": "Easy", "q": "Write a Python function to check if a number is even or odd."},
    {"id": 2, "cat": "Algorithms", "diff": "Easy", "q": "Write a Python one-liner to reverse a list."},
    {"id": 3, "cat": "Algorithms", "diff": "Easy", "q": "Write a Python function to count vowels in a given string."},
    {"id": 4, "cat": "Algorithms", "diff": "Medium", "q": "Implement Binary Search in Python with an explanation of its time complexity."},
    {"id": 5, "cat": "Algorithms", "diff": "Medium", "q": "Write a Python function to find the first non-repeating character in a string."},
    {"id": 6, "cat": "Algorithms", "diff": "Medium", "q": "Implement a function to merge two sorted arrays without using extra space."},
    {"id": 7, "cat": "Algorithms", "diff": "Hard", "q": "Implement an LRU (Least Recently Used) Cache class in Python with O(1) get and put operations."},
    {"id": 8, "cat": "Algorithms", "diff": "Hard", "q": "Write a dynamic programming solution in Python for the 0/1 Knapsack problem."},
    {"id": 9, "cat": "Algorithms", "diff": "Very Complex", "q": "Implement Dijkstra's shortest path algorithm using a min-heap (priority queue) in Python."},
    {"id": 10, "cat": "Algorithms", "diff": "Very Complex", "q": "Explain and write Python code for finding Strongly Connected Components using Tarjan's or Kosaraju's algorithm."},

    # ── Category 2: Web Dev & JavaScript ──
    {"id": 11, "cat": "Web Dev", "diff": "Easy", "q": "What is the difference between let, const, and var in JavaScript?"},
    {"id": 12, "cat": "Web Dev", "diff": "Easy", "q": "How do you center a div horizontally and vertically using CSS Flexbox?"},
    {"id": 13, "cat": "Web Dev", "diff": "Easy", "q": "Write a simple JavaScript function to debounce an input event."},
    {"id": 14, "cat": "Web Dev", "diff": "Medium", "q": "Explain how the JavaScript Event Loop and Microtask Queue work with an example."},
    {"id": 15, "cat": "Web Dev", "diff": "Medium", "q": "How does React useState and useEffect work under the hood during component re-rendering?"},
    {"id": 16, "cat": "Web Dev", "diff": "Medium", "q": "Write a custom React hook `useLocalStorage` with get and set functionality."},
    {"id": 17, "cat": "Web Dev", "diff": "Hard", "q": "Explain Server-Side Rendering (SSR) vs Static Site Generation (SSG) in Next.js, and how hydration works."},
    {"id": 18, "cat": "Web Dev", "diff": "Hard", "q": "Implement a robust WebSocket client wrapper in JavaScript with automatic exponential backoff reconnection."},
    {"id": 19, "cat": "Web Dev", "diff": "Very Complex", "q": "How do you implement Virtual DOM diffing algorithm? Write a minimal virtual DOM create and patch function in JS."},
    {"id": 20, "cat": "Web Dev", "diff": "Very Complex", "q": "Design a client-side micro-frontend routing architecture using native Web Components and custom events."},

    # ── Category 3: Database & SQL ──
    {"id": 21, "cat": "Database", "diff": "Easy", "q": "Write an SQL query to select all employees with a salary greater than 50000."},
    {"id": 22, "cat": "Database", "diff": "Easy", "q": "What is the difference between INNER JOIN and LEFT JOIN in SQL?"},
    {"id": 23, "cat": "Database", "diff": "Easy", "q": "Write an SQL query to find duplicate email addresses in a Users table."},
    {"id": 24, "cat": "Database", "diff": "Medium", "q": "Write an SQL query using window function (DENSE_RANK or ROW_NUMBER) to find the 2nd highest salary in each department."},
    {"id": 25, "cat": "Database", "diff": "Medium", "q": "What are ACID properties in relational databases? Explain each briefly."},
    {"id": 26, "cat": "Database", "diff": "Medium", "q": "Explain Database Normalization from 1NF to 3NF with a practical example."},
    {"id": 27, "cat": "Database", "diff": "Hard", "q": "Write a Recursive Common Table Expression (CTE) in PostgreSQL to traverse an organization reporting hierarchy."},
    {"id": 28, "cat": "Database", "diff": "Hard", "q": "Explain how B-Tree and B+ Tree indexing works in PostgreSQL/MySQL, and why B+ Tree is preferred for range scans."},
    {"id": 29, "cat": "Database", "diff": "Very Complex", "q": "How does Two-Phase Commit (2PC) protocol ensure atomic distributed transactions across multiple databases?"},
    {"id": 30, "cat": "Database", "diff": "Very Complex", "q": "Design an indexing and partitioning strategy for a multi-tenant database handling 100 million transactions daily."},

    # ── Category 4: Mathematics & Statistics ──
    {"id": 31, "cat": "Mathematics", "diff": "Easy", "q": "What is the quadratic formula, and how do you find the roots of ax^2 + bx + c = 0?"},
    {"id": 32, "cat": "Mathematics", "diff": "Easy", "q": "Calculate the derivative of f(x) = 3x^3 - 5x^2 + 2x - 7 with respect to x."},
    {"id": 33, "cat": "Mathematics", "diff": "Easy", "q": "What is the probability of rolling a sum of 7 with two fair 6-sided dice?"},
    {"id": 34, "cat": "Mathematics", "diff": "Medium", "q": "Explain Bayes' Theorem with an intuitive medical diagnostic test example."},
    {"id": 35, "cat": "Mathematics", "diff": "Medium", "q": "Evaluate the definite integral of x * e^x dx from 0 to 1 using integration by parts."},
    {"id": 36, "cat": "Mathematics", "diff": "Medium", "q": "What is the Central Limit Theorem and why is it fundamental in statistics?"},
    {"id": 37, "cat": "Mathematics", "diff": "Hard", "q": "Find the eigenvalues and eigenvectors of matrix [[4, 1], [2, 3]]."},
    {"id": 38, "cat": "Mathematics", "diff": "Hard", "q": "Explain Principal Component Analysis (PCA) mathematically using covariance matrix and singular value decomposition."},
    {"id": 39, "cat": "Mathematics", "diff": "Very Complex", "q": "Solve the second-order linear differential equation: y'' + 4y' + 4y = e^(-2x) with initial conditions y(0)=1, y'(0)=0."},
    {"id": 40, "cat": "Mathematics", "diff": "Very Complex", "q": "Derive the closed-form solution of the Black-Scholes formula for European call options and explain its assumptions."},

    # ── Category 5: System Design & Architecture ──
    {"id": 41, "cat": "System Design", "diff": "Easy", "q": "What is the difference between Horizontal and Vertical scaling?"},
    {"id": 42, "cat": "System Design", "diff": "Easy", "q": "What is a Reverse Proxy and how is it different from a Forward Proxy?"},
    {"id": 43, "cat": "System Design", "diff": "Easy", "q": "Explain what a Content Delivery Network (CDN) is and why web applications use it."},
    {"id": 44, "cat": "System Design", "diff": "Medium", "q": "Explain the CAP theorem with real-world examples of CP and AP systems."},
    {"id": 45, "cat": "System Design", "diff": "Medium", "q": "Design a URL Shortener service like Bitly: describe API, database schema, and hash generation strategy."},
    {"id": 46, "cat": "System Design", "diff": "Medium", "q": "How does Consistent Hashing work in distributed caching systems like Memcached or DynamoDB?"},
    {"id": 47, "cat": "System Design", "diff": "Hard", "q": "Design a Distributed Rate Limiter using Redis Token Bucket or Sliding Window algorithm for high-concurrency API."},
    {"id": 48, "cat": "System Design", "diff": "Hard", "q": "Design a real-time Notification System (Push, SMS, Email) handling 10 million daily active users."},
    {"id": 49, "cat": "System Design", "diff": "Very Complex", "q": "Design a globally distributed, fault-tolerant Chat Application like WhatsApp supporting end-to-end encryption, read receipts, and offline message storage."},
    {"id": 50, "cat": "System Design", "diff": "Very Complex", "q": "Architect a high-frequency trading (HFT) order matching engine architecture focusing on microsecond latency and zero-data loss."},

    # ── Category 6: Logical Reasoning & Puzzles ──
    {"id": 51, "cat": "Logic & Puzzles", "diff": "Easy", "q": "A farmer needs to cross a river with a wolf, a goat, and a cabbage. The boat holds only the farmer and one item. How does he cross safely?"},
    {"id": 52, "cat": "Logic & Puzzles", "diff": "Easy", "q": "If five machines take five minutes to make five widgets, how long will it take 100 machines to make 100 widgets?"},
    {"id": 53, "cat": "Logic & Puzzles", "diff": "Easy", "q": "There are 3 light switches outside a closed room. Only one controls the bulb inside. You can enter the room once. How do you identify the switch?"},
    {"id": 54, "cat": "Logic & Puzzles", "diff": "Medium", "q": "Explain the Monty Hall problem and why switching doors increases your probability of winning from 1/3 to 2/3."},
    {"id": 55, "cat": "Logic & Puzzles", "diff": "Medium", "q": "You have 8 balls of identical look, but one is slightly heavier. Using a balance scale only twice, how do you find the heavier ball?"},
    {"id": 56, "cat": "Logic & Puzzles", "diff": "Medium", "q": "You have two ropes. Each takes exactly 60 minutes to burn completely, but they burn unevenly. How do you measure exactly 45 minutes?"},
    {"id": 57, "cat": "Logic & Puzzles", "diff": "Hard", "q": "You have 100 doors in a row, all initially closed. You make 100 passes toggling doors. Which doors remain open at the end, and why?"},
    {"id": 58, "cat": "Logic & Puzzles", "diff": "Hard", "q": "There are 25 horses and you can only race 5 horses at a time. What is the minimum number of races needed to find the top 3 fastest horses without a timer?"},
    {"id": 59, "cat": "Logic & Puzzles", "diff": "Very Complex", "q": "Solve the Blue Eyes puzzle: 100 people with blue eyes on an island where speaking about eye color is forbidden until a guru says 'At least one person has blue eyes'. When do they leave?"},
    {"id": 60, "cat": "Logic & Puzzles", "diff": "Very Complex", "q": "100 prisoners numbered 1 to 100 enter a room with 100 closed boxes containing random numbers 1-100. Each can open 50 boxes. What strategy gives them >30% survival chance?"},

    # ── Category 7: Science & Physics ──
    {"id": 61, "cat": "Physics & Science", "diff": "Easy", "q": "State Newton's Three Laws of Motion with a simple everyday example for each."},
    {"id": 62, "cat": "Physics & Science", "diff": "Easy", "q": "Why is the sky blue during the day and red during sunset? Explain Rayleigh scattering."},
    {"id": 63, "cat": "Physics & Science", "diff": "Easy", "q": "What is the difference between AC (Alternating Current) and DC (Direct Current)?"},
    {"id": 64, "cat": "Physics & Science", "diff": "Medium", "q": "Explain the Photoelectric Effect and how Einstein's explanation proved the particle nature of light."},
    {"id": 65, "cat": "Physics & Science", "diff": "Medium", "q": "What is the Doppler Effect and how is it used in astronomy to detect redshift and blueshift?"},
    {"id": 66, "cat": "Physics & Science", "diff": "Medium", "q": "Explain Bernoulli's Principle and how it contributes to aerodynamic lift in airplane wings."},
    {"id": 67, "cat": "Physics & Science", "diff": "Hard", "q": "Explain Heisenberg's Uncertainty Principle mathematically (delta x * delta p >= hbar / 2) and conceptually."},
    {"id": 68, "cat": "Physics & Science", "diff": "Hard", "q": "Describe the Carnot Cycle and explain why a Carnot engine represents the theoretical maximum thermal efficiency."},
    {"id": 69, "cat": "Physics & Science", "diff": "Very Complex", "q": "Explain Einstein's General Theory of Relativity: how mass-energy curves spacetime according to the Einstein Field Equations."},
    {"id": 70, "cat": "Physics & Science", "diff": "Very Complex", "q": "Explain Quantum Entanglement and the Bell Inequality test that ruled out local hidden variable theories."},

    # ── Category 8: Hindi & Cultural Nuances ──
    {"id": 71, "cat": "Hindi & Culture", "diff": "Easy", "q": "Namaste! Apna parichay dijiye: aap kaun hain aur aapko kisne banaya hai?"},
    {"id": 72, "cat": "Hindi & Culture", "diff": "Easy", "q": "Hindi muhavara 'Aankhon ka tara hona' ka arth aur ek udaharan vakya likhiye."},
    {"id": 73, "cat": "Hindi & Culture", "diff": "Easy", "q": "Bharat ke Rashtrapati aur Pradhan Mantri ke beech sanvaidhanik antar kya hai?"},
    {"id": 74, "cat": "Hindi & Culture", "diff": "Medium", "q": "Muhavara 'Naach na aane aangan tedha' ka arth aur ek practical daily-life udaharan samjhaiye."},
    {"id": 75, "cat": "Hindi & Culture", "diff": "Medium", "q": "Chandrayaan-3 ki safalta Bharat ke antariksh anushandhan ke liye kyo aitihaasik hai? Sankshep me batayein."},
    {"id": 76, "cat": "Hindi & Culture", "diff": "Medium", "q": "Hindi sahitya ke Chhayavaad yug ke pramukh kavi aur unki visheshtaon ka vivran dijiye."},
    {"id": 77, "cat": "Hindi & Culture", "diff": "Hard", "q": "Nagar Nigam Adhikari ko apne ilaqe me peyajal samasya aur sadak marammat ke liye ek aupcharik shikaayat patra likhiye."},
    {"id": 78, "cat": "Hindi & Culture", "diff": "Hard", "q": "Kautilya ke Arthashastra me varnit 'Saptanga Siddhanta' (Rajya ke 7 ang) ka vishleshan kijiye."},
    {"id": 79, "cat": "Hindi & Culture", "diff": "Very Complex", "q": "Bharatiya Sanvidhan ke Anuchhed 21 (Right to Life & Personal Liberty) ke vistar aur Supreme Court ke landmark judgements par ek vistrit nibandh likhiye."},
    {"id": 80, "cat": "Hindi & Culture", "diff": "Very Complex", "q": "Sankhya Darshan aur Advaita Vedanta darshan ke beech mukhya tatva-mimansa (Metaphysics) ka tulnatmak vishleshan kijiye."},

    # ── Category 9: Business & Professional Writing ──
    {"id": 81, "cat": "Business Writing", "diff": "Easy", "q": "Draft a polite 1-day sick leave email to a team manager."},
    {"id": 82, "cat": "Business Writing", "diff": "Easy", "q": "Write a professional LinkedIn connection message to a Senior Software Engineer at Google."},
    {"id": 83, "cat": "Business Writing", "diff": "Easy", "q": "Write a polite follow-up email after a job interview that took place one week ago."},
    {"id": 84, "cat": "Business Writing", "diff": "Medium", "q": "Draft a formal resignation letter giving two weeks notice with gratitude and handover commitment."},
    {"id": 85, "cat": "Business Writing", "diff": "Medium", "q": "Write an executive summary for a business proposal pitching an AI customer support bot to an e-commerce startup."},
    {"id": 86, "cat": "Business Writing", "diff": "Medium", "q": "Draft a professional email negotiating a higher compensation package after receiving a software developer job offer."},
    {"id": 87, "cat": "Business Writing", "diff": "Hard", "q": "Draft a Mutual Non-Disclosure Agreement (NDA) confidentiality clause defining confidential information, exclusions, and remedies for breach."},
    {"id": 88, "cat": "Business Writing", "diff": "Hard", "q": "Write a comprehensive post-mortem root-cause analysis (RCA) report for a 2-hour production outage caused by a database migration deadlock."},
    {"id": 89, "cat": "Business Writing", "diff": "Very Complex", "q": "Draft a complete B2B SaaS Service Level Agreement (SLA) covering 99.9% uptime commitments, maintenance windows, latency benchmarks, and tiered service credits."},
    {"id": 90, "cat": "Business Writing", "diff": "Very Complex", "q": "Write a detailed Series-A investor pitch memo for an Indian AI infrastructure platform, addressing TAM, unit economics, moat, CAC/LTV, and 3-year financial projections."},

    # ── Category 10: Cybersecurity, AI & DevOps ──
    {"id": 91, "cat": "Cybersecurity & AI", "diff": "Easy", "q": "What is the difference between Symmetric and Asymmetric encryption?"},
    {"id": 92, "cat": "Cybersecurity & AI", "diff": "Easy", "q": "Explain how public-key authentication works in SSH."},
    {"id": 93, "cat": "Cybersecurity & AI", "diff": "Easy", "q": "What is overfitting in machine learning and how do you prevent it?"},
    {"id": 94, "cat": "Cybersecurity & AI", "diff": "Medium", "q": "What is Cross-Site Scripting (XSS) and what are the standard defenses against it?"},
    {"id": 95, "cat": "Cybersecurity & AI", "diff": "Medium", "q": "Explain the difference between Docker containers and Virtual Machines (hypervisors)."},
    {"id": 96, "cat": "Cybersecurity & AI", "diff": "Medium", "q": "Explain the Transformer model architecture: Self-Attention mechanism and Query-Key-Value matrices."},
    {"id": 97, "cat": "Cybersecurity & AI", "diff": "Hard", "q": "How does SQL injection occur? Write vulnerable code and its parameterized query remediation in Python SQLite."},
    {"id": 98, "cat": "Cybersecurity & AI", "diff": "Hard", "q": "Explain how Kubernetes Pod scheduling, ReplicaSets, and Ingress controllers work together in a production deployment."},
    {"id": 99, "cat": "Cybersecurity & AI", "diff": "Very Complex", "q": "Explain the mathematical formulation of Backpropagation through Time (BPTT) and how LoRA (Low-Rank Adaptation) works for fine-tuning LLMs with rank r."},
    {"id": 100, "cat": "Cybersecurity & AI", "diff": "Very Complex", "q": "Design a Zero-Trust Network Architecture (ZTNA) with mTLS, continuous identity verification, micro-segmentation, and automated anomaly detection for a financial enterprise."}
]

def query_model(item: dict) -> dict:
    q_id = item["id"]
    query = item["q"]
    cat = item["cat"]
    diff = item["diff"]

    last_err = ""
    for attempt in range(3):
        t0 = time.time()
        try:
            resp = requests.post(API_URL, json={"prompt": query, "max_tokens": 700}, timeout=60)
            dt = time.time() - t0
            if resp.status_code == 200:
                data = resp.json()
                reply = data.get("response", "").strip()
                model_used = data.get("model", "VKP-Omni-2B")

                refusal_patterns = [
                    r"I'm sorry, but I can't assist",
                    r"as a text-based AI, I don't have access",
                    r"I cannot fulfill"
                ]
                has_refusal = any(re.search(pat, reply, re.IGNORECASE) for pat in refusal_patterns)
                has_code = "```" in reply
                length = len(reply)

                score = 10
                if has_refusal:
                    score -= 6
                if length < 50:
                    score -= 3
                elif length > 150:
                    score += 1
                if cat in ["Algorithms", "Web Dev", "Database"] and not has_code and diff in ["Hard", "Very Complex"]:
                    score -= 2

                score = max(1, min(10, score))

                return {
                    "id": q_id,
                    "cat": cat,
                    "diff": diff,
                    "q": query,
                    "reply": reply,
                    "model": model_used,
                    "latency_s": round(dt, 2),
                    "length": length,
                    "score": score,
                    "success": True,
                    "has_refusal": has_refusal
                }
            else:
                last_err = f"HTTP {resp.status_code}: {resp.text[:100]}"
                time.sleep(1.5)
        except Exception as e:
            last_err = str(e)
            time.sleep(1.5)

    return {
        "id": q_id,
        "cat": cat,
        "diff": diff,
        "q": query,
        "error": last_err,
        "latency_s": 0,
        "score": 0,
        "success": False
    }

def run_suite():
    out_json = "eval_100_results.json"
    results = []
    done_ids = set()

    if os.path.exists(out_json):
        try:
            with open(out_json, "r", encoding="utf-8") as f:
                existing = json.load(f)
                if isinstance(existing, list):
                    results = existing
                    done_ids = {r["id"] for r in results if r.get("success")}
                    print(f"Loaded {len(done_ids)} existing results from {out_json}")
        except Exception as e:
            print(f"Could not load existing {out_json}: {e}")

    print(f"===========================================================", flush=True)
    print(f"Starting 100-Question Comprehensive Benchmark on VKP-Omni-2B", flush=True)
    print(f"Total Questions: {len(EVAL_QUESTIONS)} across 10 Categories", flush=True)
    print(f"Target: {API_URL}", flush=True)
    print(f"Already Completed: {len(done_ids)}/{len(EVAL_QUESTIONS)}", flush=True)
    print(f"===========================================================\n", flush=True)

    t_start = time.time()

    for idx, item in enumerate(EVAL_QUESTIONS, 1):
        if item["id"] in done_ids:
            continue

        print(f"[{idx}/100] [#{item['id']} {item['cat']} - {item['diff']}] {item['q'][:45]}...", end=" ", flush=True)
        res = query_model(item)
        results.append(res)
        done_ids.add(item["id"])

        if res.get("success"):
            print(f"-> OK ({res['latency_s']}s, {res['length']} chars, {res['score']}/10)", flush=True)
        else:
            print(f"-> FAIL ({res.get('error')})", flush=True)

        # Save incrementally
        with open(out_json, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        time.sleep(0.2)

    total_time = round(time.time() - t_start, 2)
    print(f"\nAll 100 questions processed in {total_time}s!", flush=True)

    # Summary Statistics
    total_q = len(results)
    successful = [r for r in results if r.get("success")]
    success_rate = (len(successful) / total_q) * 100 if total_q else 0
    avg_latency = sum(r["latency_s"] for r in successful) / len(successful) if successful else 0
    avg_score = sum(r["score"] for r in successful) / len(successful) if successful else 0
    zero_refusals = sum(1 for r in successful if not r.get("has_refusal"))

    print("\n--- Summary Performance ---")
    print(f"Total Evaluated: {total_q}")
    print(f"Success Rate: {success_rate:.1f}%")
    print(f"Avg Latency: {avg_latency:.2f}s")
    print(f"Avg Quality Score: {avg_score:.2f}/10")
    print(f"Zero Refusals: {zero_refusals}/{len(successful)}")

if __name__ == "__main__":
    run_suite()
