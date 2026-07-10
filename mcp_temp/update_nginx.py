nginx_conf_path = "/etc/nginx/sites-enabled/nuzum.fun.conf"

new_config = """server {
  listen 80;
  listen [::]:80;
  listen 443 quic;
  listen 443 ssl;
  listen [::]:443 quic;
  listen [::]:443 ssl;
  http2 on;
  http3 off;
  ssl_certificate_key /etc/nginx/ssl-certificates/nuzum.fun.key;
  ssl_certificate /etc/nginx/ssl-certificates/nuzum.fun.crt;
  server_name nuzum.fun www1.nuzum.fun;
  root /home/nuzum/htdocs/nuzum.fun;

  access_log /home/nuzum/logs/nginx/access.log main;
  error_log /home/nuzum/logs/nginx/error.log;

  if ($scheme != "https") {
    rewrite ^ https://$host$request_uri permanent;
  }

  # توجيه طلبات التحقق والاستكشاف من كلوود إلى خادم الـ MCP المخصص (المنفذ 8002)
  location = /.well-known/oauth-protected-resource {
    proxy_pass http://127.0.0.1:8002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  location = /.well-known/oauth-authorization-server {
    proxy_pass http://127.0.0.1:8002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
  }

  # توجيه طلبات المصادقة والتسجيل إلى خادم الـ MCP
  location ~ ^/(oauth|register|authorize) {
    proxy_pass http://127.0.0.1:8002;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
  }

  # توجيه مسار SSE لخادم الـ MCP
  location /sse {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";

    proxy_pass http://127.0.0.1:8002/sse;
    proxy_http_version 1.1;
    proxy_set_header Connection "";
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header Host $host;
    proxy_buffering off;
    proxy_cache off;
    chunked_transfer_encoding off;
    proxy_read_timeout 3600s;
  }

  # توجيه مسار الرسائل لخادم الـ MCP
  location /message {
    add_header Access-Control-Allow-Origin "*";
    add_header Access-Control-Allow-Headers "Content-Type, Authorization";
    add_header Access-Control-Allow-Methods "GET, POST, OPTIONS";

    proxy_pass http://127.0.0.1:8002/message;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
  }

  # بقية مسارات التحقق العام (Let's Encrypt)
  location ~ ^/\\.well-known {
    auth_basic off;
    allow all;
  }

  include /etc/nginx/global_settings;

  index index.html;

  location / {
    proxy_pass http://127.0.0.1:5000/;
    proxy_http_version 1.1;
    proxy_set_header X-Forwarded-Host $host;
    proxy_set_header X-Forwarded-Server $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header Host $host;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "Upgrade";
    proxy_pass_request_headers on;
    proxy_max_temp_file_size 0;
    proxy_connect_timeout 900;
    proxy_send_timeout 900;
    proxy_read_timeout 900;
    proxy_buffer_size 128k;
    proxy_buffers 4 256k;
    proxy_busy_buffers_size 256k;
    proxy_temp_file_write_size 256k;
  }
}
"""

with open(nginx_conf_path, "w") as f:
    f.write(new_config)

print("Nginx configuration successfully rewritten with root-level MCP routing!")
