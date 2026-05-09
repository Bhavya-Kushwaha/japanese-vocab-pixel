from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
import requests
import os

import os
from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client

app = Flask(
    __name__,
    static_folder='../static',
    static_url_path='/static',
    template_folder='../templates'
)

url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client | None = None
if url and key:
    supabase = create_client(url, key)

@app.route('/')
def home():
    return render_template('index.html')

@app.route('/fetch', methods=['POST'])
def fetch_vocab():
    word = request.form.get('word')
    if not word: return jsonify({"success": False})
    
    response = requests.get(f"https://jisho.org/api/v1/search/words?keyword={word}")
    data = response.json()

    if data.get('data'):
        entry = data['data'][0]
        jlpt_raw = entry.get('jlpt', [])
        level = "???"
        for tag in jlpt_raw:
            if 'jlpt-' in tag:
                level = tag.split('-')[1].upper()
                break

        return jsonify({
            "success": True,
            "kanji": entry['japanese'][0].get('word', word),
            "reading": entry['japanese'][0].get('reading'),
            "meaning": entry['senses'][0]['english_definitions'][0],
            "level": level
        })
    return jsonify({"success": False})

@app.route('/sentence', methods=['POST'])
def fetch_sentence():
    word = request.form.get('word')
    if not word: return jsonify({"success": False})
    
    try:
        url = f"https://tatoeba.org/eng/api_v0/search?from=jpn&to=eng&query={word}"
        response = requests.get(url, timeout=5)
        data = response.json()
        
        if data.get('results') and len(data['results']) > 0:
            top_result = data['results'][0]
            jp_sentence = top_result.get('text', '')
            
            en_sentence = ''
            translations = top_result.get('translations', [])
            if translations and len(translations) > 0:
                # translations usually lists arrays per language
                for t_group in translations:
                    if len(t_group) > 0 and t_group[0].get('text'):
                        en_sentence = t_group[0]['text']
                        break

            return jsonify({
                "success": True,
                "jp": jp_sentence,
                "en": en_sentence
            })
    except Exception as e:
        print("Error fetching sentence:", e)
        
    return jsonify({"success": False})

# --- CLOUD SYNC LOGIC ---
@app.route('/sync', methods=['POST'])
def sync_cloud():
    email = request.form.get('email')
    vocab_json = request.form.get('vocab_list')
    try:
        if not supabase:
            return jsonify({"success": False, "error": "Supabase not configured"})
        # This saves data to your 'user_vocab' table
        supabase.table('user_vocab').upsert({
            "email": email, 
            "vocab_data": vocab_json
        }, on_conflict="email").execute()
        return jsonify({"success": True})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

@app.route('/load-backup', methods=['POST'])
def load_backup():
    email = request.form.get('email')
    try:
        if not supabase:
            return jsonify({"success": False, "error": "Supabase not configured"})
        response = supabase.table('user_vocab').select("vocab_data").eq("email", email).execute()
        if response.data:
            return jsonify({"success": True, "data": response.data[0]['vocab_data']})
        return jsonify({"success": False, "error": "No backup found"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

app.index = app
