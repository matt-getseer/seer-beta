-- AlterTable
ALTER TABLE "User" ADD COLUMN     "aiProvider" TEXT NOT NULL DEFAULT 'anthropic',
ADD COLUMN     "anthropicApiKey" TEXT,
ADD COLUMN     "hasAnthropicKey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "hasOpenAIKey" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "openaiApiKey" TEXT,
ADD COLUMN     "useCustomAI" BOOLEAN NOT NULL DEFAULT false;
