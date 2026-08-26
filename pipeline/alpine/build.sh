#!/usr/bin/env bash
# Alpine x86 (i686) image for v86: apk chroot + Xfbdev/jwm desktop, syslinux MBR.
# Output: $1 = raw image path. Runs on ubuntu-latest.
set -euo pipefail
OUT="${1:?usage: build.sh <out.img>}"
WORK="$(mktemp -d)"
ROOT="$WORK/root"
MIRROR="https://dl-cdn.alpinelinux.org/alpine"
REL="v3.20"

# static apk + base layout for i386
mkdir -p "$ROOT/etc/apk/keys" "$ROOT/etc/apk/repositories"
curl -sL "$MIRROR/$REL/main/x86/apk-tools-static-2.14.4-r0.apk" -o /tmp/apk.apk
tar -xzf /tmp/apk.apk -C /tmp sbin/apk.static 2>/dev/null || tar -xzf /tmp/apk.apk -C "$ROOT" # fallback full extract
APK=/tmp/sbin/apk.static

# arch-specific keys ship inside the static apk; copy from extracted tree if needed
find /tmp -name '*.pub' -exec cp {} "$ROOT/etc/apk/keys/" \; 2>/dev/null || true
cp /etc/resolv.conf "$ROOT/etc/"
echo "$MIRROR/$REL/main" > "$ROOT/etc/apk/repositories"
echo "$MIRROR/$REL/community" >> "$ROOT/etc/apk/repositories"

"$APK" --arch x86 --root "$ROOT" --initdb add \
  alpine-base linux-lts linux-firmware-none \
  e2fsprogs mkinitfs syslinux dhcpcd iproute2 \
  xf86-video-fbdev xterm jwm setxkbmap \
  mesa-dri-gallium

# serial getty + autologin root, and graphical target default off (we switch via cmdline)
chroot "$ROOT" rc-update add devfs boot; chroot "$ROOT" rc-update add dmesg boot
chroot "$ROOT" rc-update add mdev sysinit; chroot "$ROOT" rc-update add hwdrivers sysinit
chroot "$ROOT" rc-update add modloop sysinit
chroot "$ROOT" rc-update add hostname boot; chroot "$ROOT" rc-update add bootmisc boot
chroot "$ROOT" rc-update add syslog boot; chroot "$ROOT" rc-update add networking boot || true
cat > "$ROOT/etc/inittab" << 'EOT'
::sysinit:/sbin/openrc sysinit
::sysinit:/sbin/openrc boot
::wait:/sbin/openrc default
tty1::respawn:/sbin/getty 38400 tty1
ttyS0::respawn:/bin/login -f root
::shutdown:/sbin/openrc shutdown
EOT
echo "root:" | chroot "$ROOT" chpasswd

# initramfs must carry ata/ext4/virtio + atkbd for browser keyboard
sed -i 's/^features=.*/features="ata base ide scsi usb virtio ext4"/' "$ROOT/etc/mkinitfs/mkinitfs.conf"
chroot "$ROOT" mkinitfs "$(ls "$ROOT/lib/modules")"

# assemble raw disk with syslinux MBR
IMG="$OUT"
truncate -s 256M "$IMG"
mkfs.ext4 -F -d "$ROOT" -L root "$IMG"
dd if="$ROOT/usr/share/syslinux/mbr.bin" of="$IMG" conv=notrunc bs=440 count=1

# install extlinux into a loop-mounted boot sector
LOOP=$(sudo losetup --find --show "$IMG")
sudo mount "$LOOP" /mnt
sudo mkdir -p /mnt/boot/extlinux
sudo extlinux --install /mnt/boot/extlinux
cat << 'EOL' | sudo tee /mnt/boot/extlinux/extlinux.conf > /dev/null
DEFAULT lts
TIMEOUT 10
LABEL lts
  LINUX /boot/vmlinuz-lts
  INITRD /boot/initramfs-lts
  APPEND root=/dev/sda rw modules=ext4 console=ttyS0,115200 console=tty0 quiet
EOL
sudo umount /mnt
sudo losetup -d "$LOOP"

# export kernel artifacts for direct-kernel-boot mode switching
mkdir -p dist-kernel
cp "$ROOT/boot/vmlinuz-lts" "dist-kernel/alpine-bzImage"
cp "$ROOT/boot/initramfs-lts" "dist-kernel/alpine-initrd.img"
echo "[malmox] wrote $IMG (+ kernel artifacts in ./dist-kernel)"
