-- Phone–vehicle presence alerts from the driver app (Bluetooth link).
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'phone_left_vehicle';
ALTER TYPE "AlertType" ADD VALUE IF NOT EXISTS 'wrong_vehicle';
