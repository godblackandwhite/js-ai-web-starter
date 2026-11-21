# ---------------------------------------------------------
# Etapa 1: Builder (Compilación de TypeScript)
# ---------------------------------------------------------
FROM node:20-alpine AS builder

WORKDIR /app

# Instalar dependencias necesarias para compilar
COPY package*.json tsconfig.json ./
RUN npm install

# Copiar código fuente y compilar
COPY server ./server
RUN npm run build

# ---------------------------------------------------------
# Etapa 2: Runner (Entorno de ejecución productivo y ligero)
# ---------------------------------------------------------
FROM node:20-alpine AS runner

WORKDIR /app

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0

# Instalar curl para verificar el estado de salud (healthcheck)
RUN apk --no-cache add curl

# Instalar solo dependencias de producción
COPY package*.json ./
RUN npm install --omit=dev && npm cache clean --force

# Copiar código compilado desde la etapa anterior
COPY --from=builder /app/dist ./dist

# Copiar assets estáticos (Frontend y Diapositivas)
COPY public ./public
COPY slides ./slides

# Ejecutar como usuario no-root por seguridad
USER node

# Exponer el puerto
EXPOSE 3000

# Verificación de salud del contenedor
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1

# Comando de arranque
CMD ["node", "dist/server/index.js"]
