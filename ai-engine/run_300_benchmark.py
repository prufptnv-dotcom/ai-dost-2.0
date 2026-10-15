"""
AI-Dost Versioned Benchmark Runner (v2.0.0-verified)
Executes reproducible, sandboxed evaluations across the 300-question benchmark dataset.
Replaces heuristic formatting/length scoring with execution testing and calibrated rubrics.
"""

import os
import sys
import time
import json
import statistics
import requests
from typing import Dict, Any

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from benchmark_evaluator.evaluator import evaluate_response_verified, EVALUATOR_VERSION, DATASET_VERSION, get_git_revision

API_URL = "http://127.0.0.1:8002/api/ai-dost/chat"
DATASET_FILE = "benchmark_300_dataset.json"
HISTORICAL_RESULTS_FILE = "benchmark_300_results_historical_heuristic.json"
VERIFIED_RESULTS_FILE = "benchmark_300_verified_results.json"
SUMMARY_REPORT = "benchmark_300_verified_summary.md"

def run_benchmark():
    if not os.path.exists(DATASET_FILE):
        print(f"Error: {DATASET_FILE} not found!")
        sys.exit(1)

    with open(DATASET_FILE, "r", encoding="utf-8") as f:
        questions = json.load(f)

    results = []
    done_qids = set()

    if os.path.exists(VERIFIED_RESULTS_FILE):
        try:
            with open(VERIFIED_RESULTS_FILE, "r", encoding="utf-8") as f:
                existing = json.load(f)
                if isinstance(existing, list):
                    results = existing
                    done_qids = {r["qid"] for r in results if r.get("success")}
                    print(f"Resuming benchmark: loaded {len(done_qids)} previously completed verified questions.")
        except Exception as e:
            print(f"Could not load previous verified results: {e}")

    git_rev = get_git_revision()
    print("=" * 80)
    print(f"AI-Dost 3.1: Reproducible Benchmark Engine (Evaluator {EVALUATOR_VERSION} | Git {git_rev})")
    print(f"Total Questions: {len(questions)} | Target: {API_URL}")
    print(f"Remaining to run: {len(questions) - len(done_qids)}")
    print("=" * 80)

    t_start = time.time()

    for idx, item in enumerate(questions, 1):
        qid = item["qid"]
        if qid in done_qids:
            continue

        prompt = item["prompt"]
        cat = item["cat"]
        diff = item["diff"]

        print(f"[{idx}/300] [{qid} | {diff}] {prompt[:45]}...", end=" ", flush=True)

        t0 = time.time()
        success = False
        reply = ""
        last_err = ""
        model_name = "unknown"

        for attempt in range(2):
            try:
                resp = requests.post(API_URL, json={"prompt": prompt, "max_tokens": 700}, timeout=90)
                if resp.status_code == 200:
                    data = resp.json()
                    reply = data.get("response", "").strip()
                    model_name = data.get("model", "unknown")
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
            eval_record = evaluate_response_verified(item, reply, dt, model_id=model_name)
            score = eval_record["score"]
            pf = eval_record["pass_fail"]
            status = eval_record.get("status", "DONE")
            note = eval_record["evaluator_note"]

            record = {
                **eval_record,
                "model_answer": reply,
                "success": True,
                "generated_tokens": max(1, int(len(reply) / 3.8)),
                "tokens_per_sec": round(max(1, int(len(reply) / 3.8)) / dt, 1) if dt > 0 else 0
            }
            print(f"-> {pf} [{status}] ({score}/10, {dt:.1f}s) [{note[:60]}]", flush=True)
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
                "status": "HTTP_OR_TIMEOUT_ERROR",
                "failure_type": "NETWORK_OR_SERVER_ERROR",
                "evaluator_note": f"Error: {last_err}",
                "success": False,
                "evaluator_version": EVALUATOR_VERSION,
                "dataset_version": DATASET_VERSION,
                "git_revision": git_rev,
                "model_id": model_name
            }
            print(f"-> FAIL ({last_err})", flush=True)

        results.append(record)
        done_qids.add(qid)

        with open(VERIFIED_RESULTS_FILE, "w", encoding="utf-8") as f:
            json.dump(results, f, ensure_ascii=False, indent=2)

        time.sleep(0.1)

    total_time = round(time.time() - t_start, 1)
    print("\n" + "=" * 80)
    print(f"Completed Evaluation in {total_time}s!")
    print("=" * 80)

    generate_verified_summary_sheet(results)

def generate_verified_summary_sheet(results):
    successful = [r for r in results if r.get("success")]
    total_q = len(results)
    completed = len(successful)
    failed = total_q - completed

    latencies = [r["latency_s"] for r in successful]
    avg_latency = round(statistics.mean(latencies), 2) if latencies else 0
    median_latency = round(statistics.median(latencies), 2) if latencies else 0
    total_tokens = sum(r.get("generated_tokens", 0) for r in successful)
    total_time = sum(latencies)
    avg_tps = round(total_tokens / total_time, 1) if total_time > 0 else 0
    overall_score = round(sum(r["score"] for r in successful) / len(successful), 2) if successful else 0

    exec_items = [r for r in results if r.get("is_executable")]
    exec_passed = sum(1 for r in exec_items if r.get("pass_fail") == "PASS")
    exec_pass_rate = f"{(exec_passed / len(exec_items)) * 100:.1f}%" if exec_items else "N/A"

    failure_types = {}
    for r in results:
        ft = r.get("failure_type")
        if ft:
            failure_types[ft] = failure_types.get(ft, 0) + 1

    cats = {}
    for r in results:
        c = r["cat"]
        if c not in cats:
            cats[c] = []
        cats[c].append(r)

    git_rev = get_git_revision()

    md = f"""# AI-Dost: Verified Benchmark Evaluation Report
**Evaluator Version:** `{EVALUATOR_VERSION}`  
**Dataset Version:** `{DATASET_VERSION}`  
**Git Revision:** `{git_rev}`  
**Evaluation Methodology:** Isolated Subprocess Sandboxing, Property & Differential Testing, Calibrated Category Rubrics  
**Historical Heuristic Baseline Preserved:** `benchmark_300_results_historical_heuristic.json`  

## Executive Summary

| Metric | Verified Value | Historical Heuristic (Unverified) |
|---|---|---|
| **Evaluator Engine** | `benchmark_evaluator v2.0.0` (Execution-Tested) | String-length & Regex Heuristic |
| **Total Questions** | {total_q} | 300 |
| **Completed Queries** | {completed} | 300 |
| **Mean Latency** | {avg_latency}s | 23.4s |
| **Median Latency** | {median_latency}s | 22.1s |
| **Mean Score** | **{overall_score} / 10** | 9.8 / 10 (Inflated) |
| **Verified Pass Rate** | **{round((sum(1 for r in successful if r.get('pass_fail')=='PASS')/max(1, total_q))*100, 1)}%** | 99.3% (Heuristic) |
| **Executable Code Pass Rate** | **{exec_pass_rate}** ({exec_passed}/{len(exec_items)}) | Not Measured |

---

## Failure Breakdown by Category

| Failure Type | Count | Description |
|---|---|---|
"""
    for ft, count in sorted(failure_types.items(), key=lambda x: x[1], reverse=True):
        md += f"| `{ft}` | {count} | Evaluator classified failure |\n"

    md += """
---

## Category-Wise Breakdown

| Category | Completed | Pass Rate | Avg Score | Executable Tested | Avg Latency |
|---|---|---|---|---|---|
"""
    for c, items in cats.items():
        s_items = [x for x in items if x.get("success")]
        pass_cnt = sum(1 for x in s_items if x.get("pass_fail") == "PASS")
        c_rate = f"{(pass_cnt / len(items)) * 100:.1f}%"
        c_score = f"{sum(x['score'] for x in s_items) / len(s_items):.2f}" if s_items else "0"
        c_lat = f"{statistics.mean([x['latency_s'] for x in s_items]):.1f}s" if s_items else "0s"
        exec_cnt = sum(1 for x in items if x.get("is_executable"))
        md += f"| {c} | {len(s_items)}/{len(items)} | {c_rate} | {c_score}/10 | {exec_cnt} | {c_lat} |\n"

    md += """
---
*Generated by AI-Dost Verified Benchmark Engine (v2.0.0-verified).*
"""

    with open(SUMMARY_REPORT, "w", encoding="utf-8") as f:
        f.write(md)
    print(f"\nSaved verified summary sheet to {SUMMARY_REPORT}")

if __name__ == "__main__":
    run_benchmark()
