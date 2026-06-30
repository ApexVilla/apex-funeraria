#!/usr/bin/env bash
# Rode no VPS (SSH): bash deploy/diagnostico-vps.sh
# Verifica nginx, disco, memória, PHP e gzip — causa comum de "demorou muito para responder".

set -euo pipefail

HOST="${1:-funeraria.apexvilla.com.br}"

echo "=== Diagnóstico VPS — $HOST — $(date -Iseconds) ==="
echo ""

echo "--- Serviços ---"
for svc in nginx php8.2-fpm pdf-caixa; do
  if systemctl list-unit-files "$svc.service" &>/dev/null; then
    printf "%-16s %s\n" "$svc" "$(systemctl is-active "$svc" 2>/dev/null || echo '?')"
  fi
done
# PHP embutido em dev; produção pode usar systemd ou screen
if pgrep -af 'php.*8080' >/dev/null 2>&1; then
  echo "php-8080         ativo ($(pgrep -cf 'php.*8080' || echo 0) processo(s))"
else
  echo "php-8080         INATIVO — API PHP não responde"
fi
echo ""

echo "--- Recursos ---"
free -h | head -2
df -h / /var 2>/dev/null | head -5
echo ""

echo "--- Portas ---"
ss -tlnp 2>/dev/null | grep -E ':443|:80|:8080|:5050' || netstat -tlnp 2>/dev/null | grep -E ':443|:80|:8080|:5050' || true
echo ""

echo "--- Firewall / fail2ban ---"
ufw status 2>/dev/null || echo "ufw: não instalado"
fail2ban-client status 2>/dev/null || echo "fail2ban: não instalado"
echo ""

echo "--- HTTP local ---"
curl -sS -o /dev/null -w "nginx :443 → HTTP %{http_code} em %{time_total}s\n" --connect-timeout 5 "https://127.0.0.1/" -k -H "Host: $HOST" || echo "FALHA ao conectar em :443 local"
curl -sS -o /dev/null -w "php   :8080 health → HTTP %{http_code} em %{time_total}s\n" --connect-timeout 5 "http://127.0.0.1:8080/health" || echo "FALHA health PHP :8080"
echo ""

echo "--- Gzip e cache (deve aparecer Content-Encoding: gzip) ---"
curl -sSI -H "Accept-Encoding: gzip" -H "Host: $HOST" "https://127.0.0.1/" -k | grep -iE '^(HTTP|content-encoding|cache-control|server):' || true
echo ""

echo "--- Últimos erros nginx ---"
journalctl -u nginx --since '2 hours ago' --no-pager -p err 2>/dev/null | tail -15 || true
echo ""
echo "=== Fim ==="
