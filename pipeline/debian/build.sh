#!/usr/bin/env bash
# Debian i386 (trixie, minbase) image for v86: debootstrap + linux-686-pae + jwm.
# Output: $1 = raw image path. Requires root (sudo).
set -euo pipefail
OUT="${1:?usage: build.sh <out.img>}"
WORK="$(mktemp -d)"
ROOT="$WORK/root"
MIRROR="http://deb.debian.org/debian"

export DEBIAN_FRONTEND=noninteractive
debootstrap --arch=i386 --variant=minbase --include=ca-certificates \
  trixie "$ROOT" "$MIRROR"

mount --bind /dev "$ROOT/dev"
mount --bind /proc "$ROOT/proc"
mount --bind /sys "$ROOT/sys"
trap 'umount "$ROOT/dev" "$ROOT/proc" "$ROOT/sys" || true' EXIT
cp /usr/bin/qemu-i386-static "$ROOT/usr/bin/" 2>/dev/null || true

chroot "$ROOT" apt-get update -qq
chroot "$ROOT" apt-get install -y -qq --no-install-recommends \
  linux-image-686-pae systemd systemd-sysv \
  e2fsprogs extlinux dhcpcd-base iproute2 iputils-ping \
  xserver-xorg-video-fbdev xserver-xorg-core xinit jwm xterm \
  console-setup kbd

# serial autologin on ttyS0, desktop via graphical.target
cat > "$ROOT/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf" << 'EOT'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin root --keep-baud 115200,38400 ttyS0 $TERM
EOT
mkdir -p "$ROOT/etc/systemd/system/serial-getty@ttyS0.service.d"
mv "$ROOT/etc/systemd/system/serial-getty@ttyS0.service.d" /tmp/d 2>/dev/null || true
mkdir -p "$ROOT/etc/systemd/system/serial-getty@ttyS0.service.d"
cat > "$ROOT/etc/systemd/system/serial-getty@ttyS0.service.d/autologin.conf" << 'EOT'
[Service]
ExecStart=
ExecStart=-/sbin/agetty --autologin root --keep-baud 115200,38400 ttyS0 $TERM
EOT
printf '127.0.0.1\tlocalhost\n' > "$ROOT/etc/hosts"
echo "malmox-debian" > "$ROOT/etc/hostname"

# X for the fbdev vesa framebuffer, started by graphical.target through a tiny unit
cat > "$ROOT/etc/systemd/graphical-x.sh" << 'EOT'
#!/bin/sh
while true; do
  xinit /etc/jwm-session -- /usr/bin/Xorg :0 -config /etc/xorg-vbe.conf vt1 >/dev/tty1 2>&1
  sleep 2
done
EOT
chmod +x "$ROOT/etc/systemd/graphical-x.sh"
cat > "$ROOT/etc/systemd/system/malmox-desktop.service" << 'EOT'
[Unit]
Description=MalMox desktop (jwm on VBE)
After=systemd-user-sessions.service

[Service]
ExecStart=/etc/systemd/graphical-x.sh
Restart=always

[Install]
WantedBy=graphical.target
EOT
ln -sf ../malmox-desktop.service "$ROOT/etc/systemd/system/graphical.target.wants/"
cat > "$ROOT/etc/jwm-session" << 'EOT'
#!/bin/sh
xsetroot -solid '#101218' &
exec jwm
EOT
chmod +x "$ROOT/etc/jwm-session"
cat > "$ROOT/etc/xorg-vbe.conf" << 'EOT'
Section "Device"
  Identifier "v86"
  Driver "fbdev"
EndSection
Section "Monitor"
  Identifier "m"
  HorizSync 1-100
  VertRefresh 1-100
EndSection
Section "Screen"
  Identifier "s"
  Device "v86"
  Monitor "m"
  DefaultDepth 16
  SubSection "Display"
    Depth 16
    Modes "1024x768"
  EndSubSection
EndSection
EOT

chroot "$ROOT" systemctl enable multi-user.target || true

# initramfs: ensure ata/virtio/atkbd modules present (debian initramfs-tools does this)
sed -i 's/^MODULES=.*/MODULES=list/' "$ROOT/etc/initramfs-tools/initramfs.conf"
echo "ata_piix" >> "$ROOT/etc/initramfs-tools/modules"
echo "virtio_blk" >> "$ROOT/etc/initramfs-tools/modules"
echo "virtio_pci" >> "$ROOT/etc/initramfs-tools/modules"
chroot "$ROOT" update-initramfs -u

KVER=$(ls "$ROOT/boot" | grep -oP 'vmlinuz-\K.*686-pae' | head -1)

IMG="$OUT"
truncate -s 512M "$IMG"
mkfs.ext4 -F -d "$ROOT" -L root "$IMG"
dd if="$ROOT/usr/lib/syslinux/mbr.bin" of="$IMG" conv=notrunc bs=440 count=1 || \
dd if="$ROOT/usr/lib/EXTLINUX/mbr.bin" of="$IMG" conv=notrunc bs=440 count=1

LOOP=$(losetup --find --show "$IMG")
mount "$LOOP" /mnt
mkdir -p /mnt/boot/extlinux
extlinux --install /mnt/boot/extlinux
cat << EOL > /mnt/boot/extlinux/extlinux.conf
DEFAULT deb
TIMEOUT 10
LABEL deb
  LINUX /boot/vmlinuz-$KVER
  INITRD /boot/initrd.img-$KVER
  APPEND root=/dev/sda rw quiet console=ttyS0,115200 console=tty0
EOL
umount /mnt
losetup -d "$LOOP"

mkdir -p dist-kernel
cp "$ROOT/boot/vmlinuz-$KVER" dist-kernel/debian-bzImage
cp "$ROOT/boot/initrd.img-$KVER" dist-kernel/debian-initrd.img
echo "[malmox] wrote $IMG (+ kernel artifacts in ./dist-kernel)"
