from flask import Flask, render_template, request, jsonify
from supabase import create_client, Client
import requests
import os

app = Flask(__name__, template_folder='../templates')

# These pull the values you just saved in Vercel
url = os.environ.get("SUPABASE_URL")
key = os.environ.get("SUPABASE_KEY")
supabase: Client = create_client(url, key)

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

# --- CLOUD SYNC LOGIC ---
@app.route('/sync', methods=['POST'])
def sync_cloud():
    email = request.form.get('email')
    vocab_json = request.form.get('vocab_list')
    try:
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
        response = supabase.table('user_vocab').select("vocab_data").eq("email", email).execute()
        if response.data:
            return jsonify({"success": True, "data": response.data[0]['vocab_data']})
        return jsonify({"success": False, "error": "No backup found"})
    except Exception as e:
        return jsonify({"success": False, "error": str(e)})

app.index = app
