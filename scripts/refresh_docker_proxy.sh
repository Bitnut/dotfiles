#/bin/sh

sudo tee /etc/systemd/system/docker.service.d/proxy.conf <<EOF
[Service]
Environment="HTTP_PROXY=${http_proxy}"
Environment="HTTPS_PROXY=${https_proxy}"
Environment="NO_PROXY=localhost,127.0.0.1,.example.com"
EOF

echo "reloading systemd manager configuration..."

sudo systemctl daemon-reload

echo "reload success!"

echo "restarting docker..."

sudo systemctl restart docker

echo "reload success!"
