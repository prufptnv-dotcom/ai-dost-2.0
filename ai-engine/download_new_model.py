import os
import sys
import time
from huggingface_hub import hf_hub_download, HfApi

TOKEN = os.environ.get("HF_TOKEN", "")
MODEL_ID = "NandiAi/VKP-Omni-2B"

api = HfApi(token=TOKEN)
files = api.list_repo_files(repo_id=MODEL_ID)
print(f"Repository files ({len(files)}): {files}", flush=True)

for fname in files:
    print(f"Downloading {fname}...", flush=True)
    t0 = time.time()
    try:
        local_path = hf_hub_download(
            repo_id=MODEL_ID,
            filename=fname,
            token=TOKEN,
            revision="main",
            resume_download=True
        )
        sz_mb = os.path.getsize(local_path) / (1024 * 1024)
        print(f"Downloaded {fname} ({sz_mb:.2f} MB) in {time.time()-t0:.2f}s -> {local_path}", flush=True)
    except Exception as e:
        print(f"Error downloading {fname}: {e}", flush=True)
        raise

print("ALL FILES DOWNLOADED SUCCESSFULLY!", flush=True)
