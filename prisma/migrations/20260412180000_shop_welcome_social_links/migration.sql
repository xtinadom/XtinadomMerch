-- Shop onboarding: welcome line + structured social links
ALTER TABLE "Shop" ADD COLUMN "welcomeMessage" VARCHAR(280);
ALTER TABLE "Shop" ADD COLUMN "socialLinks" JSONB;
