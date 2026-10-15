import os
import time
from gradio_client import Client

TOKEN = os.environ.get("HF_TOKEN", "")
SPACE_ID = "NandiAi/vkp-omni-2b-demo"

def query_cloud_vkp(prompt: str):
    print(f"Connecting to Cloud VKP-Omni Space ({SPACE_ID})...", flush=True)
    t0 = time.time()
    client = Client(SPACE_ID, token=TOKEN)
    res = client.predict(
        message=prompt,
        history=[],
        image=None,
        api_name="/chat"
    )
    # res is (messages_list, text)
    # res[0][-1]['content'][0]['text'] has the assistant reply
    messages = res[0]
    assistant_reply = ""
    for m in reversed(messages):
        if m.get("role") == "assistant":
            for c in m.get("content", []):
                if c.get("type") == "text":
                    assistant_reply = c.get("text", "")
                    break
            if assistant_reply:
                break
    dt = time.time() - t0
    return assistant_reply, dt

if __name__ == "__main__":
    queries = [
        "Namaste! Aap kaun ho aur kisne banaya hai?",
        "Write a Python function to check if a number is prime."
    ]
    for q in queries:
        print(f"\nUser: {q}")
        reply, elapsed = query_cloud_vkp(q)
        print(f"Reply ({elapsed:.2f}s):\n{reply}")
