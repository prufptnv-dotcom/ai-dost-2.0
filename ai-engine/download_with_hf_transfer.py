import os
import sys
import time

# Enable high-speed Rust-based hf_transfer
os.environ["HF_HUB_ENABLE_HF_TRANSFER"] = "1"

from huggingface_hub import snapshot_download

TOKEN = os.environ.get("HF_TOKEN", "")
REPO_ID = "NandiAi/VKP-Omni-2B"

print(f"Starting ultra high-speed Rust-accelerated download of {REPO_ID}...", flush=True)
t0 = time.time()

try:
    path = snapshot_download(
        repo_id=REPO_ID,
        token=TOKEN,
        resume_download=True
    )
    t_tot = time.time() - t0
    print(f"\nDownload completed successfully in {t_tot:.1f}s!", flush=True)
    print(f"Snapshot directory: {path}", flush=True)

    # Verify model.safetensors
    weights = os.path.join(path, "model.safetensors")
    if os.path.isfile(weights):
        size_mb = os.path.getsize(weights) / (1024 * 1024)
        print(f"Verified model.safetensors: {size_mb:.2f} MB", flush=True)
except Exception as e:
    print(f"Download error: {e}", flush=True)
    sys.exit(1)
