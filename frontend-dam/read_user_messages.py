import json

transcript_path = r'C:\Users\nikhil sai\.gemini\antigravity-ide\brain\1738f0ea-5353-4582-9354-9833537f3512\.system_generated\logs\transcript.jsonl'
with open(transcript_path, 'r', encoding='utf-8') as f:
    for i, line in enumerate(f):
        try:
            obj = json.loads(line)
            if obj.get('type') == 'USER_INPUT':
                content = str(obj.get('content', ''))
                print(f"--- USER MSG #{i} ---")
                if len(content) > 300:
                    print(content[:250] + " ... [TRUNCATED]")
                else:
                    print(content)
        except Exception as e:
            pass
