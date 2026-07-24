import subprocess
import time
import sys
import logging
from datetime import datetime
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler('autopull.log'),
        logging.StreamHandler(sys.stdout)
    ]
)

def run_command(cmd, timeout=30):
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout)
        return result.returncode == 0, result.stdout.strip(), result.stderr.strip()
    except subprocess.TimeoutExpired:
        return False, '', f'Timeout after {timeout}s'
    except Exception as e:
        return False, '', str(e)

def update_progress(interval=60, repo_path=None):
    if repo_path:
        Path(repo_path).mkdir(parents=True, exist_ok=True)
    
    logging.info(f'Auto-pull started (interval: {interval}s)')
    
    success_count = 0
    fail_count = 0
    
    while True:
        try:
            now = datetime.now().strftime('%H:%M:%S')
            
            ok, out, err = run_command(['git', 'pull'])
            
            if ok:
                if 'Already up to date' in out:
                    logging.info(f'[{now}] No changes')
                else:
                    logging.info(f'[{now}] Pulled successfully:\n{out}')
                    success_count += 1
            else:
                logging.warning(f'[{now}] Pull failed: {err}')
                fail_count += 1
                
                if 'not a git repository' in err:
                    logging.error('Not a git repository. Stopping.')
                    break
            
            if fail_count > 5:
                logging.error('Too many failures. Stopping.')
                break
            
            time.sleep(interval)
            
        except KeyboardInterrupt:
            logging.info(f'Stopped. Success: {success_count}, Failures: {fail_count}')
            break
        except Exception as e:
            logging.error(f'Unexpected error: {e}')
            time.sleep(interval)

if __name__ == '__main__':
    import argparse
    
    parser = argparse.ArgumentParser(description='Auto git pull')
    parser.add_argument('--interval', type=int, default=60, help='Pull interval in seconds')
    parser.add_argument('--path', type=str, help='Repository path')
    
    args = parser.parse_args()
    update_progress(interval=args.interval, repo_path=args.path)