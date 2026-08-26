#!/usr/bin/env bash
# Arch Linux 32 image for v86: archlinux32 bootstrap + pacstrap base, syslinux, jwm.
# Output: $1 = raw image path. Requires root (sudo) and i386 binfmt for chroot pacman.
set -euo pipefail
OUT="${1:?usage: build.sh <out.img>}"
WORK="$(mktemp -d)"
ROOT="$WORK/root"

BS_URL="https://mirror.archlinux32.org/archisos/latest-bootstrap-i686.tar.gz"
curl -sL "$BS_URL" | tar -xz -C "$WORK"
cp /etc/resolv.conf "$ROOT/etc/" 2>/dev/null || true
mount --bind /dev "$ROOT/dev"
mount --bind /proc "$ROOT/proc"
mount --bind /sys "$ROOT/sys"
trap 'umount -R "$ROOT/dev" "$ROOT/proc" "$ROOT/sys" || true' EXIT

cat > "$WORK/pacstrap.sh" << 'EOT'
set -e
pacman-key --init
pacman-key --populate arch32
pacman -Sy --noconfirm archlinux32-keyring
pacman -Syu --noconfirm --needed \
  base linux syslinux dhcpcd iproute2 \
  xorg-server xorg-xinit xf86-video-fbdev jwm xterm \
  mkinitcpio e2fsprogs
systemctl enable multi-user.target getty@ttyS0 || true
EOT
arch-chroot "$ROOT" bash "$WORK/pacstrap.sh"

# serial autologin root on ttyS0
mkdir -p "$ROOT/etc/systemd/system/getty@ttyS0.service.d"
cat > "$ROOT/etc/systemd/system/getty@ttyS0.service.d/override.conf" << 'EOT'
[Service]
ExecStart=
ExecStart=-/usr/bin/agetty --autologin root --noclear %I 115200 $TERM
EOT

# initcpio: browser keyboard + virtio/ata modules
sed -i 's/^MODULES=.*/MODULES=(atkbd i8042 virtio_pci virtio_blk ata_piix)/' \
  "$ROOT/etc/mkinitcpio.conf"
arch-chroot "$ROOT" mkinitcpio -P

# jwm desktop session (graphical.target path)
cat > "$ROOT/etc/jwm-session" << 'EOT'
#!/bin/sh
xsetroot -solid '#101218' &
exec jwm
EOT
chmod +x "$ROOT/etc/jwm-session"
cat > "$ROOT/root/.xinitrc" << 'EOT'
exec /etc/jwm-session
EOT
cat > "$ROOT/etc/systemd/system/malmox-desktop.service" << 'EOT'
[Unit]
Description=MalMox desktop (jwm on VBE)
After=systemd-user-sessions.service

[Service]
Environment=HOME=/root
ExecStart=/root/start-desktop.sh
Restart=always

[Install]
WantedBy=graphical.target
EOT
ln -sf ../malmox-desktop.service "$ROOT/etc/systemd/system/graphical.target.wants/"
cat > "$ROOT/root/start-desktop.sh" << 'EOT'
#!/bin/sh
while true; do
  xinit /etc/jwm-session -- /usr/lib/Xorg :0 vt1 >/dev/tty1 2>&1
  sleep 2
done
EOT
chmod +x "$ROOT/root/start-desktop.sh"

KVER=$(ls "$ROOT/boot" | grep -oP '^vmlinuz-\K.*' | head -1)

IMG="$OUT"
truncate -s 1G "$IMG"
mkfs.ext4 -F -d "$ROOT" -L root "$IMG"
dd if="$ROOT/usr/lib/syslinux/bios/mbr.bin" of="$IMG" conv=notrunc bs=440 count=1

LOOP=$(losetup --find --show "$IMG")
mount "$LOOP" /mnt
mkdir -p /mnt/boot/syslinux
extlinux --install /mnt/boot/extlinux 2>/dev/null || \
  cp "$ROOT"/usr/lib/syslinux/bios/{ldlinux.c32,libcom32.c32,libutil.c32} /mnt/boot/syslinux/ && \
  extlinux --install /mnt/boot/syslinux
cat << EOL > /mnt/boot/syslinux/syslinux.cfg
DEFAULT arch
TIMEOUT 10
LABEL arch
  LINUX /boot/vmlinuz-$KVER
  INITRD /boot/initramfs-$KVER.img
  APPEND root=/dev/sda rw quiet console=ttyS0,115200 console=tty0
EOL
umount /mnt
losetup -d "$LOOP"

mkdir -p dist-kernel
cp "$ROOT/boot/vmlinuz-$KVER" dist-kernel/arch32-bzImage
cp "$ROOT/boot/initramfs-$KVER.img" dist-kernel/arch32-initrd.img
echo "[malmox] wrote $IMG (+ kernel artifacts in ./dist-kernel)"
