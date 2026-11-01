-- Aditiva: respostas do onboarding na organização (perfil, faixa de clientes, canais de aprovação).
-- Colunas opcionais; não altera dados existentes.
ALTER TABLE "Organization" ADD COLUMN "profileRole" TEXT;
ALTER TABLE "Organization" ADD COLUMN "profileClientRange" TEXT;
ALTER TABLE "Organization" ADD COLUMN "profileChannels" TEXT;
ALTER TABLE "Organization" ADD COLUMN "profileAnsweredAt" DATETIME;
