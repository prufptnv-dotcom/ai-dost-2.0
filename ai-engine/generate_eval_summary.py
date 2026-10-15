import json

with open("eval_100_results.json", "r", encoding="utf-8") as f:
    data = json.load(f)

cats = {}
for item in data:
    c = item["cat"]
    if c not in cats:
        cats[c] = []
    cats[c].append(item)

print(f"{'Category':<25} | {'Questions':<9} | {'Avg Score':<9} | {'Avg Time':<8} | {'Avg Chars':<9}")
print("-" * 75)

for c, items in cats.items():
    avg_sc = sum(x["score"] for x in items) / len(items)
    avg_tm = sum(x["latency_s"] for x in items) / len(items)
    avg_ch = sum(x["length"] for x in items) / len(items)
    print(f"{c:<25} | {len(items):<9} | {avg_sc:<9.2f} | {avg_tm:<7.1f}s | {avg_ch:<9.0f}")

print("-" * 75)
total_avg_sc = sum(x["score"] for x in data) / len(data)
total_avg_tm = sum(x["latency_s"] for x in data) / len(data)
total_avg_ch = sum(x["length"] for x in data) / len(data)
print(f"{'OVERALL':<25} | {len(data):<9} | {total_avg_sc:<9.2f} | {total_avg_tm:<7.1f}s | {total_avg_ch:<9.0f}")
