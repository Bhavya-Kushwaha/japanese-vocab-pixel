import re

with open('templates/index.html', 'r', encoding='utf-8') as f:
    content = f.read()

script_functions = """
        function showToast(msg, type = 'success') {
            const container = document.getElementById('toastContainer');
            if (!container) return;
            const toast = document.createElement('div');
            toast.className = `retro-toast ${type}`;
            toast.innerText = msg;
            container.appendChild(toast);
            setTimeout(() => {
                if (toast.parentNode) toast.parentNode.removeChild(toast);
            }, 3000);
        }

        function showFloatingText(text, x, y, color = '#facc15') {
            const el = document.createElement('div');
            el.className = 'floating-popup';
            el.style.left = x + 'px';
            el.style.top = y + 'px';
            el.style.color = color;
            el.innerText = text;
            document.body.appendChild(el);
            setTimeout(() => el.remove(), 1000);
        }
"""

content = content.replace('<script>', '<script>\n' + script_functions)

content = re.sub(r"return alert\((.*?)\);", r"return showToast(\1, 'error');", content)
content = re.sub(r"alert\((.*?[Ee]rror.*?)\);", r"showToast(\1, 'error');", content)
content = re.sub(r"alert\((.*?[Nn]ot enough.*?)\);", r"showToast(\1, 'error');", content)
content = re.sub(r"alert\((.*?)\);", r"showToast(\1);", content)

with open('templates/index.html', 'w', encoding='utf-8') as f:
    f.write(content)
print("Replacements done.")
