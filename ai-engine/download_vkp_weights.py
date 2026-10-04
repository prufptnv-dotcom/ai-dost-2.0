"""
download_vkp_weights.py
Direct streaming downloader for VKP-Omni-2B safetensors weights.
Bypasses xethub bugs by streaming directly from HuggingFace CDN into snapshot cache.
"""
import os
import sys
import time
import urllib.request

SNAPSHOT_DIR = os.path.expanduser(
    r"~/.cache/huggingface/hub/models--NandiAi--VKP-Omni-2B/snapshots/83badd008654cbd92ac730a96b92baf9d9885eb7"
)
TARGET_FILE = os.path.join(SNAPSHOT_DIR, "model.safetensors")
TEMP_FILE = TARGET_FILE + ".downloading"
URL = "https://huggingface.co/NandiAi/VKP-Omni-2B/resolve/main/model.safetensors"

def download():
    os.makedirs(SNAPSHOT_DIR, exist_ok=True)
    if os.path.exists(TARGET_FILE) and os.path.getsize(TARGET_FILE) > 1_400_000_000:
        print(f"✅ model.safetensors already exists ({os.path.getsize(TARGET_FILE)/(1024*1024):.1f} MB)")
        return

    print(f"Connecting to {URL}...")
    headers = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
    }
    req = urllib.request.Request(URL, headers=headers)
    
    with urllib.request.urlopen(req) as resp:
        total_size = int(resp.headers.get("Content-Length", 0))
        total_mb = total_size / (1024 * 1024)
        print(f"Total size to download: {total_mb:.1f} MB")
        
        downloaded = 0
        chunk_size = 4 * 1024 * 1024  # 4 MB chunks
        start_time = time.time()
        last_print = 0

        with open(TEMP_FILE, "wb") as f:
            while True:
                chunk = resp.read(chunk_size)
                if not chunk:
                    break
                f.write(chunk)
                downloaded += len(chunk)
                now = time.time()
                if now - last_print >= 2.0 or downloaded == total_size:
                    elapsed = max(now - start_time, 0.1)
                    speed_mb = (downloaded / (1024 * 1024)) / elapsed
                    percent = (downloaded / total_size) * 100 if total_size else 0
                    mb = downloaded / (1024 * 1024)
                    print(f"Downloading: {percent:.1f}% ({mb:.1f}/{total_mb:.1f} MB) at {speed_mb:.1f} MB/s", flush=True)
                    last_print = now

    if os.path.exists(TARGET_FILE):
        os.remove(TARGET_FILE)
    os.rename(TEMP_FILE, TARGET_FILE)
    print(f"Successfully downloaded model.safetensors! ({os.path.getsize(TARGET_FILE)/(1024*1024):.1f} MB)")

if __name__ == "__main__":
    download()
