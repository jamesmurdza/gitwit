ALTER TABLE "user" ADD COLUMN "encryptedAnthropicKey" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "encryptedOpenAIKey" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "apiKeyIv" text;