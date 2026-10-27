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

    SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new"
    if [ -f "$HOME/.ssh/id_ed25519_github" ]; then
        SSH_OPTS="$SSH_OPTS -i $HOME/.ssh/id_ed25519_github"
    fi
    if [ -f "$HOME/.ssh/id_ed25519" ]; then
        SSH_OPTS="$SSH_OPTS -i $HOME/.ssh/id_ed25519"
    fi

    SSH_DEST="szymon@$HOST_IP"

    echo "🚀 [3/3] Przesyłanie wersji do kontenera Incus 'cyberevolution'..."
    tar -C dist -cf - . | ssh $SSH_OPTS "$SSH_DEST" "incus exec cyberevolution -- tar -C /var/www/html -xf -"

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

    SSH_OPTS="-o BatchMode=yes -o ConnectTimeout=5 -o StrictHostKeyChecking=accept-new"
    if [ -f "$HOME/.ssh/id_ed25519_github" ]; then
        SSH_OPTS="$SSH_OPTS -i $HOME/.ssh/id_ed25519_github"
    fi
    if [ -f "$HOME/.ssh/id_ed25519" ]; then
        SSH_OPTS="$SSH_OPTS -i $HOME/.ssh/id_ed25519"
    fi

    if ! ssh $SSH_OPTS "frog@$VPS_IP" "echo OK" >/dev/null 2>&1; then
        echo "❌ Błąd: Brak dostępu przez klucz SSH do frog@$VPS_IP."
        exit 1
    fi

    echo "🚀 [3/3] Przesyłanie wersji na serwer produkcyjny Mikrus..."
    tar -C dist -cf - . | ssh $SSH_OPTS "frog@$VPS_IP" "tar -C /var/www/cyberevolution -xf -"

    echo ""
    echo "=================================================="
    echo "✅ Wdrożenie produkcyjne (FINAL) zakończone!"
    echo "🌍 Gra jest dostępna publicznie na świecie pod adresem:"
    echo "   🔗 http://frog02.mikr.us:31385"
    echo "   🌐 Tailscale: http://100.107.9.8:31385"
    echo "=================================================="
else
    echo "Nieznany cel: $TARGET. Użyj: local lub prod"
    exit 1
fi
