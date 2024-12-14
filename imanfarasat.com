server {
    listen 80;
    server_name imanfarasat.com www.imanfarasat.com;

    root /var/www/imanfarasat.com;
    index index.html;

    location / {
        proxy_pass http://127.0.0.1:3000;  # Point to your Node.js server running on port 3000
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }

    access_log /var/log/nginx/imanfarasat_access.log;
    error_log /var/log/nginx/imanfarasat_error.log;
}
