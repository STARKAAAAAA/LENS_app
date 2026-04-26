import os, json, re

BASE = r"G:\宣传部"
DIR = os.path.dirname(os.path.abspath(__file__))
OUT_JSON = os.path.join(DIR, "photos.json")
OUT_JS = os.path.join(DIR, "photos.js")

def clean_category(dirname):
    name = dirname.strip()
    m = re.match(r'^\d{4}\s+\d{1,2}\s+\d{1,2}\s*(.*)', name)
    if m and m.group(1):
        return m.group(1).strip()
    return name

photos = []

for root, dirs, files in os.walk(BASE):
    for f in files:
        if not f.lower().endswith('.jpg'):
            continue
        full = os.path.join(root, f)
        rel = os.path.relpath(full, BASE)

        parts = rel.replace('\\', '/').split('/')
        top_folder = parts[0]
        category = clean_category(top_folder)

        title = os.path.splitext(f)[0]
        title = re.sub(r'-DxO_DeepPRIME\s*XD2?s?', '', title)
        title = re.sub(r'-CR3_DxO_DeepPRIMEXD', '', title)
        title = title.strip()

        url = 'file:///' + full.replace('\\', '/').replace(' ', '%20').replace('"', '%22')

        photos.append({
            'src': url,
            'category': category,
            'title': title,
            'folder': top_folder
        })

photos.sort(key=lambda p: p['folder'])
categories = list(dict.fromkeys(p['category'] for p in photos))

print(f"找到 {len(photos)} 张 JPG, {len(categories)} 个分类")

data = {'categories': categories, 'photos': photos}

# 写 JSON（备用）
with open(OUT_JSON, 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=None)

# 写 JS（可被 <script src> 直接加载，绕过 file:// CORS）
with open(OUT_JS, 'w', encoding='utf-8') as f:
    f.write('var PHOTOS_DATA = ')
    json.dump(data, f, ensure_ascii=False, indent=None)
    f.write(';\n')

print(f"已写入 {OUT_JSON} 和 {OUT_JS}")
