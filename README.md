# Realize Therapy Center — Website

A single-page website with a working **Book an Appointment** form.
Built with plain HTML/CSS/JS plus a **zero-dependency Node.js server** — light enough
for a small VPS (Standard_B1s: 1 vCPU / 1 GB RAM). No `npm install` needed.

```
public/            the website (index.html, styles.css, script.js)
server.js          serves the site + handles booking submissions
data/bookings.jsonl  booking requests, one JSON object per line (created automatically)
```

## Run locally (Windows or Linux)

```bash
node server.js
```

Open http://localhost:3000 — click any **Book an Appointment** button and submit the form.
Each booking is appended to `data/bookings.jsonl` and logged to the console.

## Viewing bookings

Set an admin key and query the API:

```bash
# Linux
ADMIN_KEY=mysecret node server.js
# Windows PowerShell
$env:ADMIN_KEY = "mysecret"; node server.js
```

Then open: `http://localhost:3000/api/bookings?key=mysecret`
(newest first). You can also just open `data/bookings.jsonl` in any text editor.

## Deploy on your VPS (Ubuntu/Debian)

1. **Install Node.js 18+** (once):
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt-get install -y nodejs
   ```

2. **Copy the project** to the VPS, e.g. `/opt/realize`:
   ```bash
   scp -r RealizeTherapyCenter user@YOUR_VPS_IP:/opt/realize
   ```

3. **Create a systemd service** so it starts on boot and restarts on crash —
   `/etc/systemd/system/realize.service`:
   ```ini
   [Unit]
   Description=Realize Therapy Center website
   After=network.target

   [Service]
   WorkingDirectory=/opt/realize
   ExecStart=/usr/bin/node server.js
   Restart=always
   Environment=PORT=3000
   Environment=ADMIN_KEY=CHANGE_THIS_TO_A_LONG_RANDOM_STRING
   User=www-data
   # give www-data write access to the data folder:
   # sudo chown -R www-data:www-data /opt/realize/data

   [Install]
   WantedBy=multi-user.target
   ```
   ```bash
   sudo mkdir -p /opt/realize/data && sudo chown -R www-data:www-data /opt/realize/data
   sudo systemctl daemon-reload
   sudo systemctl enable --now realize
   sudo systemctl status realize
   ```

4. **(Recommended) Put nginx in front** for port 80/443 and free HTTPS:
   ```bash
   sudo apt-get install -y nginx
   ```
   `/etc/nginx/sites-available/realize`:
   ```nginx
   server {
     listen 80;
     server_name yourdomain.com www.yourdomain.com;
     location / {
       proxy_pass http://127.0.0.1:3000;
       proxy_set_header Host $host;
       proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
     }
   }
   ```
   ```bash
   sudo ln -s /etc/nginx/sites-available/realize /etc/nginx/sites-enabled/
   sudo nginx -t && sudo systemctl reload nginx
   # free SSL certificate:
   sudo apt-get install -y certbot python3-certbot-nginx
   sudo certbot --nginx -d yourdomain.com -d www.yourdomain.com
   ```

5. **Open the firewall** (Azure: allow ports 80 and 443 in the VM's Network Security Group).

## Built-in protections

- Booking endpoint rate-limited to 5 requests / 10 minutes per IP
- Input sanitized (control characters stripped, length-capped), 16 KB body limit
- Static file path-traversal protection
- Admin listing protected by `ADMIN_KEY` (timing-safe comparison)

## Customizing content

Everything visible lives in `public/index.html`:
- **Team members / phone / email / address** — search for the placeholder text and replace it.
- **Photos** — replace the `img-placeholder` divs with `<img src="..." alt="...">` tags
  (put image files in `public/`).
- **Colors & fonts** — defined in `public/styles.css`.
