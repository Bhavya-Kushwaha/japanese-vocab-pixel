import subprocess

def run_cmd(cmd):
    print(f"Running: {cmd}")
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode != 0:
        print(f"Error ({result.returncode}):\n{result.stderr}")
    else:
        print(f"Success:\n{result.stdout}")

run_cmd('git add .')
run_cmd('git commit -m "feat: Add Gamification upgrades, Toasts, Speed Run Quiz, and Achievements"')
run_cmd('git push origin main')
