-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Team" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "maxSize" INTEGER NOT NULL DEFAULT 6,
    "data" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TeamVersion" (
    "id" TEXT NOT NULL,
    "teamId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TeamVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonType" (
    "id" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "relations" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonType_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonSpecies" (
    "id" TEXT NOT NULL,
    "pokeapiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "types" TEXT[],
    "forms" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonSpecies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonMove" (
    "id" TEXT NOT NULL,
    "pokeapiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "power" INTEGER,
    "accuracy" INTEGER,
    "pp" INTEGER,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "damageClass" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonMove_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonItem" (
    "id" TEXT NOT NULL,
    "pokeapiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PokemonAbility" (
    "id" TEXT NOT NULL,
    "pokeapiId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "display" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PokemonAbility_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Team_userId_updatedAt_idx" ON "Team"("userId", "updatedAt" DESC);

-- CreateIndex
CREATE INDEX "TeamVersion_teamId_createdAt_idx" ON "TeamVersion"("teamId", "createdAt" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "TeamVersion_teamId_version_key" ON "TeamVersion"("teamId", "version");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonSpecies_pokeapiId_key" ON "PokemonSpecies"("pokeapiId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonSpecies_name_key" ON "PokemonSpecies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonMove_pokeapiId_key" ON "PokemonMove"("pokeapiId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonMove_name_key" ON "PokemonMove"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonItem_pokeapiId_key" ON "PokemonItem"("pokeapiId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonItem_name_key" ON "PokemonItem"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonAbility_pokeapiId_key" ON "PokemonAbility"("pokeapiId");

-- CreateIndex
CREATE UNIQUE INDEX "PokemonAbility_name_key" ON "PokemonAbility"("name");

-- AddForeignKey
ALTER TABLE "Team" ADD CONSTRAINT "Team_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TeamVersion" ADD CONSTRAINT "TeamVersion_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "Team"("id") ON DELETE CASCADE ON UPDATE CASCADE;

