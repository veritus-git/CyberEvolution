#!/usr/bin/env bash
set -e

TARGET="${1:-local}"

echo "🔨 [1/3] Budowanie gry CyberEvolution (npm run build)..."
npm run build

if [ "$TARGET" = "local" ] || [ "$TARGET" = "staging" ]; then
    echo "🔍 [2/3] Sprawdzanie połączenia z serwerem Malfred..."
    
    # Sprawdź, czy jesteśmy w sieci domowej LAN (192.168.100.100)
    if ping -c 1 -W 1 192.168.100.100 >/dev/null 2>&1; then
        HOST_IP="192.168.100.100"
        echo "   -> Wykryto sieć domową LAN ($HOST_IP)"
    else
        HOST_IP="100.95.20.38"
        echo "   -> Wykryto połączenie przez Tailscale ($HOST_IP)"
    fi

    SSH_DEST="szymon@$HOST_IP"

    echo "🚀 [3/3] Przesyłanie wersji do kontenera Incus 'cyberevolution'..."
    tar -C dist -cf - . | ssh -o BatchMode=yes -o ConnectTimeout=5 "$SSH_DEST" "incus exec cyberevolution -- tar -C /var/www/html -xf -"

    echo ""
    echo "=================================================="
    echo "✅ Wdrożenie zakończone sukcesem!"
    echo "🎮 Gra jest dostępna 24/7 pod adresami:"
    echo "   🏠 Dom (LAN):      http://192.168.100.100:8085"
    echo "   🌐 Tailscale (VPN): http://100.95.20.38:8085"
    echo "=================================================="

elif [ "$TARGET" = "prod" ] || [ "$TARGET" = "final" ]; then
    VPS_IP="100.107.9.8"
    echo "🔍 [2/3] Sprawdzanie połączenia z VPS-em Mikrus ($VPS_IP)..."

    if ! ssh -o BatchMode=yes -o ConnectTimeout=3 "root@$VPS_IP" "echo OK" >/dev/null 2>&1; then
        echo "❌ Błąd: Brak dostępu przez klucz SSH do root@$VPS_IP."
        echo "   Aby skonfigurować dostęp, wykonaj raz: ssh-copy-id root@$VPS_IP"
        exit 1
    fi

    echo "🚀 [3/3] Przesyłanie wersji na serwer produkcyjny Mikrus..."
    tar -C dist -cf - . | ssh "root@$VPS_IP" "mkdir -p /var/www/cyberevolution && tar -C /var/www/cyberevolution -xf -"

    echo ""
    echo "=================================================="
    echo "✅ Wdrożenie produkcyjne (FINAL) zakończone!"
    echo "=================================================="
else
    echo "Nieznany cel: $TARGET. Użyj: local lub prod"
    exit 1
fi
