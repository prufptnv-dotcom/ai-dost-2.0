import os
import sys
import time
import json
import requests
import statistics

from benchmark_scoring import evaluate_response

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

API_URL = "http://127.0.0.1:8002/api/ai-dost/chat"
DATASET_FILE = "benchmark_300_dataset.json"
RESULTS_FILE = "benchmark_300_results.json"
SUMMARY_REPORT = "benchmark_300_summary_sheet.md"

def run_benchmark():
    if not os.path.exists(DATASET_FILE):
        print(f"Error: {DATASET_FILE} not found!")
        sys.exit(1)

    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)

    results = []
    done_qids = set()

    if os.path.exists(RESULTS_FILE):
        try:
            with open(RESULTS_FILE, "r", encoding="utf-8") as f:
                existing = json.load(f)
                if isinstance(existing, list):
                    results = existing
                    done_qids = {r["qid"] for r in results if r.get("success")}
                    print(f"Resuming benchmark: loaded {len(done_qids)} previously completed questions.")
        except Exception as e:
            print(f"Could not load previous results: {e}")

    print("=" * 75)
    print("AI Dost response-format heuristic benchmark (correctness is not evaluated)")
    print(f"Total Questions: {len(questions)} | Target: {API_URL}")
    print(f"Remaining to run: {len(questions) - len(done_qids)}")
    print("=" * 75)

    t_start = time.time()

    for idx, item in enumerate(questions, 1):
        qid = item["qid"]
        if qid in done_qids:
            continue

        prompt = item["prompt"]
        cat = item["cat"]
        diff = item["diff"]

        print(f"[{idx}/{len(questions)}] [{qid} | {diff}] {prompt[:50]}...", end=" ", flush=True)

        t0 = time.time()
        success = False
        reply = ""
        last_err = ""

        for attempt in range(2):
            try:
                resp = requests.post(API_URL, json={"prompt": prompt, "max_tokens": 700}, timeout=90)
                if resp.status_code == 200:
                    data = resp.json()
                    reply = data.get("response", "").strip()
                    success = True
                    break
                else:
                    last_err = f"HTTP {resp.status_code}: {resp.text[:80]}"
                    time.sleep(1)
            except Exception as e:
                last_err = str(e)
                time.sleep(1)

        dt = time.time() - t0

        if success:
            eval_data = evaluate_response(item, reply, dt)
            tokens = eval_data["tokens_est"]
            tps = round(tokens / dt, 1) if dt > 0 else 0
            score = eval_data["score"]
            format_status = eval_data["format_status"]
            note = eval_data["eval_note"]

            record = {
                "qid": qid,
                "cat": cat,
                "diff": diff,
                "prompt": prompt,
                "model_answer": reply,
                "latency_s": round(dt, 2),
                "generated_tokens": tokens,
                "tokens_per_sec": tps,
                "score": score,
                "pass_fail": "NOT_EVALUATED",
                "format_status": format_status,
                "evaluation_type": eval_data["evaluation_type"],
                "correctness_evaluated": False,
                "is_accuracy_metric": False,
                "evaluator_note": note,
                "success": True
            }
            print(f"-> {format_status} (heuristic {score}/10, {dt:.1f}s, ~{tokens} tokens, ~{tps} tok/s) [{note}]", flush=True)
        else:
            record = {
                "qid": qid,
                "cat": cat,
                "diff": diff,
                "prompt": prompt,
                "error": last_err,
                "latency_s": round(dt, 2),
                "generated_tokens": 0,
                "tokens_per_sec": 0,
                "score": 0,
                "pass_fail": "FAIL",
                "evaluator_note": f"Error: {last_err}",
                "success": False
            }
            print(f"-> FAIL ({last_err})", flush=True)

        results.append(record)
        done_qids.add(qid)

        # Save incrementally
        with open(RESULTS_FILE, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        time.sleep(0.1)

    total_time = round(time.time() - t_start, 1)
    print("\n" + "=" * 75)
    print(f"Completed 300-Question Evaluation in {total_time}s!")
    print("=" * 75)

    generate_summary_sheet(results)

def generate_summary_sheet(results):
    successful = [r for r in results if r.get("success")]
    total_q = len(results)
    completed = len(successful)
    failed = total_q - completed

    def format_status(record):
        status = record.get("format_status")
        if status in {"FORMAT_PASS", "FORMAT_FAIL"}:
            return status
        # Interpret older PASS/FAIL values as the former heuristic threshold,
        # never as evidence that the answer or generated code was correct.
        legacy_status = record.get("pass_fail")
        if legacy_status == "PASS":
            return "FORMAT_PASS"
        if legacy_status == "FAIL":
            return "FORMAT_FAIL"
        return "NOT_EVALUATED"

    latencies = [float(r.get("latency_s", 0) or 0) for r in successful]
    avg_latency = round(statistics.mean(latencies), 2) if latencies else 0
    median_latency = round(statistics.median(latencies), 2) if latencies else 0
    total_tokens = sum(int(r.get("generated_tokens", 0) or 0) for r in successful)
    total_time = sum(latencies)
    avg_tps = round(total_tokens / total_time, 1) if total_time > 0 else 0
    scores = [float(r.get("score", 0) or 0) for r in successful if r.get("score") is not None]
    overall_score = round(statistics.mean(scores), 2) if scores else 0
    format_passes = sum(1 for r in results if format_status(r) == "FORMAT_PASS")
    format_rate = round((format_passes / total_q) * 100, 1) if total_q else 0

    cats = {}
    for r in results:
        c = r.get("cat", "Uncategorized")
        cats.setdefault(c, []).append(r)

    model_label = os.getenv("AI_DOST_BENCHMARK_MODEL", "Not recorded (set AI_DOST_BENCHMARK_MODEL)")
    checkpoint_label = os.getenv("AI_DOST_BENCHMARK_CHECKPOINT", "Not recorded")
    hardware_label = os.getenv("AI_DOST_BENCHMARK_HARDWARE", "Not measured by this runner")
    precision_label = os.getenv("AI_DOST_BENCHMARK_PRECISION", "Not recorded")

    md = f"""# AI Dost: Response-Format Heuristic Run Summary

> **Important limitation:** This is a response-format heuristic, not an accuracy or task-success benchmark. It does not check factual truth, code execution, or whether a requested software change works. Do not use this score alone to claim superiority over another model or coding agent.

**Evaluation method:** `response_format_heuristic_v1`  
**Dataset:** {total_q} prompts from the repository; this is not a blind holdout set.  
**Model identifier:** {model_label}  
**Checkpoint:** {checkpoint_label}  
**Hardware:** {hardware_label}  
**Precision:** {precision_label}  

## Run summary

| Metric | Value |
|---|---|
| **Prompts in results** | {total_q} |
| **Responses received** | {completed} |
| **Request failures / timeouts** | {failed} |
| **Average response latency** | {avg_latency}s |
| **Median response latency** | {median_latency}s |
| **Estimated tokens/sec** | {avg_tps} (character-based token estimate; not provider telemetry) |
| **Mean heuristic format score** | **{overall_score} / 10** |
| **Format-threshold pass rate** | **{format_rate}%** (not correctness/accuracy) |
| **Peak VRAM** | Not measured by this runner |

---

## Category-wise breakdown

| Category | Responses received | Format-threshold rate | Mean heuristic score | Mean latency | Mean estimated tokens |
|---|---:|---:|---:|---:|---:|
"""
    for c, items in cats.items():
        s_items = [x for x in items if x.get("success")]
        pass_cnt = sum(1 for x in items if format_status(x) == "FORMAT_PASS")
        c_rate = f"{(pass_cnt / len(items)) * 100:.1f}%" if items else "0.0%"
        valid_scores = [float(x.get("score", 0) or 0) for x in s_items if x.get("score") is not None]
        c_score = f"{statistics.mean(valid_scores):.2f}" if valid_scores else "N/A"
        c_latencies = [float(x.get("latency_s", 0) or 0) for x in s_items]
        c_lat = f"{statistics.mean(c_latencies):.1f}s" if c_latencies else "N/A"
        c_tokens = [int(x.get("generated_tokens", 0) or 0) for x in s_items]
        c_tok = f"{int(statistics.mean(c_tokens))}" if c_tokens else "N/A"
        md += f"| {c} | {len(s_items)}/{len(items)} | {c_rate} | {c_score}/10 | {c_lat} | {c_tok} |\n"

    md += """
---

## Interpretation

- A response-format pass means only that the configured, shallow format checks did not flag the response.
- A high heuristic score can still belong to a wrong or non-working answer.
- The runner estimates tokens from characters and does not collect actual provider token usage or GPU VRAM.
- Legacy result rows are interpreted as format-threshold results only.

See [BENCHMARK_VALIDITY.md](BENCHMARK_VALIDITY.md) for a competition-ready evaluation protocol.
"""

    with open(SUMMARY_REPORT, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"\nSaved transparent heuristic summary to {SUMMARY_REPORT}")


if __name__ == "__main__":
    run_benchmark()
