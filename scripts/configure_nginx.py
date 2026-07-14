import sys

backup_path = '/etc/nginx/sites-available/algotrading.bak-botfreq-20260707150052'
target_path = '/etc/nginx/sites-available/algotrading'

# Read backup
with open(backup_path, 'r') as f:
    content = f.read()

# Verify if newnews is already there (avoid duplicates)
if '/pro/newnews' in content:
    print("NEWNEWS already exists in config.")
else:
    # We locate the closing brace of the first server block (the one for port 443).
    # Since the 443 block has location /novnc/websockify, we can insert the new block right before that block ends.
    target_str = """    location = /novnc/websockify {
        proxy_pass http://127.0.0.1:6080/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header Origin "";
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 86400;
        proxy_buffering off;
    }"""
    
    replacement_str = target_str + """

    # NewNews proxy to Astro NodeJS SSR server running under PM2
    location = /pro/newnews {
        return 301 $scheme://$http_host/pro/newnews/;
    }
    location /pro/newnews/ {
        proxy_pass http://127.0.0.1:4322;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Buffer settings for SSE streaming logs
        proxy_buffering off;
        proxy_cache_bypass $http_upgrade;
    }"""
    
    if target_str in content:
        content = content.replace(target_str, replacement_str)
        print("Inserted NewNews location block.")
    else:
        print("Error: Target location block for novnc websockify not found in backup Nginx file.")
        sys.exit(1)

# Write modified file
with open(target_path, 'w') as f:
    f.write(content)

print("Saved config to sites-available/algotrading.")
