import os
import sys
import time
import requests
from concurrent.futures import ThreadPoolExecutor, as_completed
import threading

TOKEN = os.environ.get("HF_TOKEN", "")
REPO_ID = "NandiAi/VKP-Omni-2B"
TARGET_DIR = os.path.expanduser(r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B/snapshots/b8473449fccbd9dbec9cfafafc34a790f3d6a959")
os.makedirs(TARGET_DIR, exist_ok=True)

TARGET_FILE = "model.safetensors"
NUM_WORKERS = 8

def fast_download():
    target_path = os.path.join(TARGET_DIR, TARGET_FILE)
    url = f"https://huggingface.co/{REPO_ID}/resolve/main/{TARGET_FILE}"
    headers = {"Authorization": f"Bearer {TOKEN}"}

    print(f"Connecting to Hugging Face CDN for {TARGET_FILE}...", flush=True)
    head_resp = requests.head(url, headers=headers, allow_redirects=True, timeout=20)
    head_resp.raise_for_status()
    total_size = int(head_resp.headers.get("content-length", 0))
    print(f"Total size: {total_size / (1024*1024):.2f} MB ({total_size} bytes)", flush=True)

    if not os.path.exists(target_path):
        with open(target_path, "wb") as f:
            f.truncate(total_size)
        existing_size = 0
    else:
        existing_size = os.path.getsize(target_path)

    if existing_size >= total_size:
        print(f"File already complete! ({existing_size / (1024*1024):.2f} MB)", flush=True)
        return

    print(f"Existing contiguous bytes: {existing_size / (1024*1024):.2f} MB", flush=True)
    remaining_bytes = total_size - existing_size
    print(f"Remaining to download: {remaining_bytes / (1024*1024):.2f} MB across {NUM_WORKERS} parallel workers", flush=True)

    # Ensure file is sized
    with open(target_path, "r+b") as f:
        f.seek(0, os.SEEK_END)
        cur = f.tell()
        if cur < total_size:
            f.seek(total_size - 1)
            f.write(b'\0')

    chunk_size = remaining_bytes // NUM_WORKERS
    tasks = []
    for i in range(NUM_WORKERS):
        start = existing_size + i * chunk_size
        end = (start + chunk_size - 1) if i < NUM_WORKERS - 1 else (total_size - 1)
        tasks.append((i, start, end))

    print(f"Worker segments configured: {len(tasks)} parallel workers.", flush=True)

    lock = threading.Lock()
    downloaded_in_run = 0
    t0 = time.time()
    last_print = [t0]

    def worker_download(worker_id, start, end):
        nonlocal downloaded_in_run
        worker_headers = {
            "Authorization": f"Bearer {TOKEN}",
            "Range": f"bytes={start}-{end}"
        }
        
        # Retry loop per worker
        for attempt in range(5):
            try:
                with requests.get(url, headers=worker_headers, stream=True, allow_redirects=True, timeout=30) as r:
                    r.raise_for_status()
                    with open(target_path, "r+b") as f:
                        f.seek(start)
                        cur_pos = start
                        for chunk in r.iter_content(chunk_size=512 * 1024):
                            if chunk:
                                f.seek(cur_pos)
                                f.write(chunk)
                                cur_pos += len(chunk)
                                with lock:
                                    downloaded_in_run += len(chunk)
                                    now = time.time()
                                    if now - last_print[0] > 3:
                                        total_done = existing_size + downloaded_in_run
                                        pct = (total_done / total_size) * 100
                                        speed = downloaded_in_run / (now - t0) / (1024 * 1024)
                                        print(f" -> Progress: {total_done / (1024*1024):.1f}/{total_size / (1024*1024):.1f} MB ({pct:.1f}%) | Speed: {speed:.2f} MB/s", flush=True)
                                        last_print[0] = now
                return True
            except Exception as e:
                print(f"[Worker {worker_id}] Error (attempt {attempt+1}): {e}", flush=True)
                time.sleep(2)
        return False

    with ThreadPoolExecutor(max_workers=NUM_WORKERS) as executor:
        futures = [executor.submit(worker_download, wid, st, en) for wid, st, en in tasks]
        for f in as_completed(futures):
            if not f.result():
                print("A worker failed after retries.", flush=True)
                sys.exit(1)

    t_total = time.time() - t0
    final_size = os.path.getsize(target_path)
    avg_speed = (downloaded_in_run / t_total) / (1024 * 1024) if t_total > 0 else 0
    print(f"\nAll workers complete! Final file size: {final_size / (1024*1024):.2f} MB in {t_total:.1f}s (Avg {avg_speed:.2f} MB/s)!", flush=True)

    # Update refs/main to point to this snapshot
    refs_main = os.path.expanduser(r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B/refs/main")
    if os.path.exists(os.path.dirname(refs_main)):
        with open(refs_main, "w") as f:
            f.write("b8473449fccbd9dbec9cfafafc34a790f3d6a959")
        print("Updated refs/main -> b8473449fccbd9dbec9cfafafc34a790f3d6a959", flush=True)

if __name__ == "__main__":
    fast_download()
