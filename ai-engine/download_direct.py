import os
import sys
import time
import requests

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

TOKEN = os.environ.get("HF_TOKEN", "")
REPO_ID = "NandiAi/VKP-Omni-2B"
TARGET_DIR = os.path.expanduser(r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B/snapshots/b8473449fccbd9dbec9cfafafc34a790f3d6a959")
os.makedirs(TARGET_DIR, exist_ok=True)

FILES = [
    "processor_config.json",
    "tokenizer.json",
    "tokenizer_config.json",
    "model.safetensors"
]

def download_file_resilient(fname):
    target_path = os.path.join(TARGET_DIR, fname)
    url = f"https://huggingface.co/{REPO_ID}/resolve/main/{fname}"
    headers = {"Authorization": f"Bearer {TOKEN}"}

    # Get total size
    total_size = 0
    for head_attempt in range(5):
        try:
            head_resp = requests.head(url, headers=headers, allow_redirects=True, timeout=20)
            head_resp.raise_for_status()
            total_size = int(head_resp.headers.get("content-length", 0))
            break
        except Exception as e:
            print(f"HEAD request error for {fname}: {e}, retrying...", flush=True)
            time.sleep(2)

    attempt = 0
    t_start = time.time()

    while True:
        existing_size = os.path.getsize(target_path) if os.path.exists(target_path) else 0

        if total_size > 0 and existing_size >= total_size:
            print(f"[OK] File {fname} already fully downloaded ({existing_size / (1024*1024):.2f} MB).", flush=True)
            return

        attempt += 1
        req_headers = headers.copy()

        if existing_size > 0 and fname == "model.safetensors":
            req_headers["Range"] = f"bytes={existing_size}-"
            print(f"[{fname}] Resuming from {existing_size / (1024*1024):.1f}/{total_size / (1024*1024):.1f} MB (attempt {attempt})...", flush=True)
            mode = "ab"
        else:
            if fname != "model.safetensors":
                existing_size = 0
            print(f"[{fname}] Starting download ({total_size / (1024*1024):.1f} MB)...", flush=True)
            mode = "wb" if existing_size == 0 else "ab"

        try:
            with requests.get(url, headers=req_headers, stream=True, allow_redirects=True, timeout=30) as resp:
                if resp.status_code == 416: # Range not satisfiable (file already done)
                    print(f"[OK] {fname} already complete (416).", flush=True)
                    return
                resp.raise_for_status()

                t0 = time.time()
                last_print = t0
                bytes_downloaded = existing_size

                with open(target_path, mode) as f:
                    for chunk in resp.iter_content(chunk_size=1024 * 1024):
                        if chunk:
                            f.write(chunk)
                            bytes_downloaded += len(chunk)
                            now = time.time()
                            if now - last_print > 5:
                                pct = (bytes_downloaded / total_size * 100) if total_size > 0 else 0
                                speed = (bytes_downloaded - existing_size) / (now - t0) / (1024 * 1024)
                                print(f" - {fname}: {bytes_downloaded / (1024*1024):.1f}/{total_size / (1024*1024):.1f} MB ({pct:.1f}%) @ {speed:.2f} MB/s", flush=True)
                                last_print = now

            # If we exit clean, check size
            final_size = os.path.getsize(target_path)
            if total_size == 0 or final_size >= total_size:
                print(f"[OK] Successfully downloaded {fname} ({final_size / (1024*1024):.2f} MB) in {time.time()-t_start:.1f}s!", flush=True)
                return

        except Exception as err:
            cur_sz = os.path.getsize(target_path) if os.path.exists(target_path) else 0
            print(f"Connection hiccup at {cur_sz / (1024*1024):.1f} MB: {err}. Auto-reconnecting in 2s...", flush=True)
            time.sleep(2)

if __name__ == "__main__":
    print("=" * 60, flush=True)
    print("Resilient Hugging Face Model Downloader for VKP-Omni-2B", flush=True)
    print("Target:", TARGET_DIR, flush=True)
    print("=" * 60, flush=True)

    for f in FILES:
        download_file_resilient(f)

    # Update refs/main to point to this snapshot
    refs_main = os.path.expanduser(r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B/refs/main")
    if os.path.exists(os.path.dirname(refs_main)):
        with open(refs_main, "w") as f:
            f.write("b8473449fccbd9dbec9cfafafc34a790f3d6a959")
        print("Updated refs/main -> b8473449fccbd9dbec9cfafafc34a790f3d6a959", flush=True)

    print("\nALL SNAPSHOT FILES VERIFIED AND DOWNLOADED SUCCESSFULLY!", flush=True)
